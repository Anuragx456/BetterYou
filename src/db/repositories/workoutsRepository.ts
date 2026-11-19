import { ExerciseItem, ExerciseSet, WorkoutSession } from '../../types';
import { getLocalDateString } from '../../utils/date';
import { DatabaseAdapter, getDatabase, invalidateActivityDatesCache } from '../client';

async function hydrateWorkoutsWithExercisesAndSets(
  db: DatabaseAdapter,
  sessionRows: {
    id: string;
    date?: string;
    title: string;
    started_at: string;
    completed_at: string | null;
    total_volume_kg: number;
    notes: string | null;
  }[]
): Promise<WorkoutSession[]> {
  if (sessionRows.length === 0) return [];

  const workoutIds = sessionRows.map((s) => s.id);
  const placeholders = workoutIds.map(() => '?').join(', ');

  interface JoinedExerciseSetRow {
    workout_id: string;
    ex_id: string;
    ex_name: string;
    ex_order_index: number;
    set_id: string | null;
    set_number: number | null;
    weight_kg: number | null;
    reps: number | null;
    completed: number | null;
  }

  const joinedRows = await db.getAllAsync<JoinedExerciseSetRow>(
    `SELECT 
      e.workout_id, e.id AS ex_id, e.name AS ex_name, e.order_index AS ex_order_index,
      s.id AS set_id, s.set_number, s.weight_kg, s.reps, s.completed
    FROM exercises e
    LEFT JOIN sets s ON s.exercise_id = e.id
    WHERE e.workout_id IN (${placeholders})
    ORDER BY e.order_index ASC, s.set_number ASC`,
    workoutIds
  );

  const workoutExercisesMap = new Map<string, Map<string, { exercise: ExerciseItem; sets: ExerciseSet[] }>>();

  for (const row of joinedRows) {
    let exMap = workoutExercisesMap.get(row.workout_id);
    if (!exMap) {
      exMap = new Map();
      workoutExercisesMap.set(row.workout_id, exMap);
    }

    let exEntry = exMap.get(row.ex_id);
    if (!exEntry) {
      exEntry = {
        exercise: {
          id: row.ex_id,
          name: row.ex_name,
          sets: [],
        },
        sets: [],
      };
      exMap.set(row.ex_id, exEntry);
    }

    if (row.set_id) {
      exEntry.sets.push({
        id: row.set_id,
        setNumber: row.set_number ?? 1,
        weightKg: row.weight_kg ?? 0,
        reps: row.reps ?? 0,
        completed: Boolean(row.completed),
      });
    }
  }

  return sessionRows.map((s) => {
    const exMap = workoutExercisesMap.get(s.id);
    const exercises: ExerciseItem[] = exMap
      ? Array.from(exMap.values()).map(({ exercise, sets }) => ({
          ...exercise,
          sets,
        }))
      : [];

    const durationSeconds = s.completed_at
      ? Math.max(0, Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000))
      : 0;

    return {
      id: s.id,
      date: s.date,
      title: s.title,
      startedAt: s.started_at,
      completedAt: s.completed_at ?? undefined,
      durationSeconds,
      totalVolumeKg: s.total_volume_kg,
      notes: s.notes ?? undefined,
      exercises,
    };
  });
}

async function runChunkedInsert(
  db: DatabaseAdapter,
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  const chunkSize = 80;
  const tuple = `(${columns.map(() => '?').join(', ')})`;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    if (chunk.length === 0) continue;
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => tuple).join(', ')}`;
    await db.runAsync(sql, chunk.flat());
  }
}

export async function dbInsertWorkout(workout: WorkoutSession): Promise<void> {
  const db = await getDatabase();
  const date = workout.date || getLocalDateString(workout.completedAt || workout.startedAt);
  const now = Date.now();

  try {
    await db.execAsync('BEGIN TRANSACTION;');
  } catch {
    // Non-fatal if transactions unsupported by adapter
  }

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_sessions (
        id, date, title, started_at, completed_at, total_volume_kg, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workout.id,
        date,
        workout.title,
        workout.startedAt,
        workout.completedAt ?? null,
        workout.totalVolumeKg ?? 0,
        workout.notes ?? null,
        now,
      ]
    );

    await db.runAsync('DELETE FROM exercises WHERE workout_id = ?', [workout.id]);

    const exerciseRows: unknown[][] = [];
    const setRows: unknown[][] = [];
    for (let eIdx = 0; eIdx < (workout.exercises || []).length; eIdx++) {
      const ex = workout.exercises[eIdx];
      exerciseRows.push([ex.id, workout.id, ex.name, eIdx, now]);
      for (const s of ex.sets || []) {
        setRows.push([s.id, ex.id, s.setNumber, s.weightKg, s.reps, s.completed ? 1 : 0, now]);
      }
    }

    await runChunkedInsert(db, 'exercises', ['id', 'workout_id', 'name', 'order_index', 'created_at'], exerciseRows);
    await runChunkedInsert(
      db,
      'sets',
      ['id', 'exercise_id', 'set_number', 'weight_kg', 'reps', 'completed', 'created_at'],
      setRows
    );

    try {
      await db.execAsync('COMMIT;');
    } catch {
      // Non-fatal
    }
    invalidateActivityDatesCache();
  } catch (err) {
    try {
      await db.execAsync('ROLLBACK;');
    } catch {
      // Ignore
    }
    throw err;
  }
}

export async function dbGetWorkoutsByDate(date: string): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  const sessionRows = await db.getAllAsync<{
    id: string;
    title: string;
    started_at: string;
    completed_at: string | null;
    total_volume_kg: number;
    notes: string | null;
  }>('SELECT * FROM workout_sessions WHERE date = ? ORDER BY started_at DESC', [date]);

  return hydrateWorkoutsWithExercisesAndSets(db, sessionRows);
}

export async function dbGetAllWorkouts(): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  const sessionRows = await db.getAllAsync<{
    id: string;
    title: string;
    started_at: string;
    completed_at: string | null;
    total_volume_kg: number;
    notes: string | null;
  }>('SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT 150');

  return hydrateWorkoutsWithExercisesAndSets(db, sessionRows);
}

export async function dbDeleteWorkout(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [id]);
  invalidateActivityDatesCache();
}

export async function dbUpdateWorkout(id: string, updates: Partial<WorkoutSession>): Promise<void> {
  const db = await getDatabase();
  if (updates.title !== undefined) {
    await db.runAsync('UPDATE workout_sessions SET title = ? WHERE id = ?', [updates.title, id]);
  }
  if (updates.notes !== undefined) {
    await db.runAsync('UPDATE workout_sessions SET notes = ? WHERE id = ?', [updates.notes, id]);
  }
  if (updates.totalVolumeKg !== undefined) {
    await db.runAsync('UPDATE workout_sessions SET total_volume_kg = ? WHERE id = ?', [updates.totalVolumeKg, id]);
  }
}
