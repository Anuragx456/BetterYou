import { BodyMeasurement, DailyGoals, ExerciseItem, ExerciseSet, MealLog, ScannedProduct, ToxicityReport, WorkoutSession } from '../types';
import { getLocalDateString } from '../utils/date';

export interface DatabaseAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

let dbInstance: DatabaseAdapter | null = null;
let isInitialized = false;

// In-memory fallback for testing environments
class MemoryDatabaseAdapter implements DatabaseAdapter {
  private tables: Record<string, Record<string, unknown>[]> = {
    meals: [],
    workout_sessions: [],
    exercises: [],
    sets: [],
    scanned_products: [],
    daily_goals: [],
    migrations_meta: [],
  };

  async execAsync(sql: string): Promise<void> {
    const trimmed = sql.toLowerCase();
    if (trimmed.includes('delete from meals')) this.tables.meals = [];
    if (trimmed.includes('delete from sets')) this.tables.sets = [];
    if (trimmed.includes('delete from exercises')) this.tables.exercises = [];
    if (trimmed.includes('delete from workout_sessions')) this.tables.workout_sessions = [];
    if (trimmed.includes('delete from scanned_products')) this.tables.scanned_products = [];
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertRowId: number }> {
    const trimmed = sql.trim().toLowerCase();
    if (trimmed.startsWith('begin') || trimmed.startsWith('commit') || trimmed.startsWith('rollback')) {
      return { rowsAffected: 0, lastInsertRowId: 0 };
    }
    if (trimmed.startsWith('delete from meals where id =')) {
      const id = params[0];
      const prev = this.tables.meals.length;
      this.tables.meals = this.tables.meals.filter((m) => m.id !== id);
      return { rowsAffected: prev - this.tables.meals.length, lastInsertRowId: 0 };
    }
    if (trimmed.startsWith('delete from workout_sessions where id =')) {
      const id = params[0];
      this.tables.workout_sessions = this.tables.workout_sessions.filter((w) => w.id !== id);
      this.tables.exercises = this.tables.exercises.filter((e) => e.workout_id !== id);
      return { rowsAffected: 1, lastInsertRowId: 0 };
    }
    if (trimmed.startsWith('delete from scanned_products where id =')) {
      const id = params[0];
      this.tables.scanned_products = this.tables.scanned_products.filter((p) => p.id !== id);
      return { rowsAffected: 1, lastInsertRowId: 0 };
    }
    return { rowsAffected: 1, lastInsertRowId: 1 };
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const trimmed = sql.trim().toLowerCase();
    if (trimmed.includes('from meals')) {
      if (trimmed.includes('where date =')) {
        const targetDate = params[0];
        return this.tables.meals.filter((m) => m.date === targetDate) as unknown as T[];
      }
      return this.tables.meals as unknown as T[];
    }
    if (trimmed.includes('from workout_sessions')) {
      if (trimmed.includes('where date =')) {
        const targetDate = params[0];
        return this.tables.workout_sessions.filter((w) => w.date === targetDate) as unknown as T[];
      }
      return this.tables.workout_sessions as unknown as T[];
    }
    if (trimmed.includes('from exercises')) {
      if (trimmed.includes('where e.workout_id in')) {
        const workoutIds = params as string[];
        const matchedExercises = this.tables.exercises.filter((e) => workoutIds.includes(e.workout_id as string));
        const joined: Record<string, unknown>[] = [];
        for (const ex of matchedExercises) {
          const sets = this.tables.sets.filter((s) => s.exercise_id === ex.id);
          if (sets.length === 0) {
            joined.push({
              workout_id: ex.workout_id,
              ex_id: ex.id,
              ex_name: ex.name,
              ex_order_index: ex.order_index,
              set_id: null,
              set_number: null,
              weight_kg: null,
              reps: null,
              completed: null,
            });
          } else {
            for (const st of sets) {
              joined.push({
                workout_id: ex.workout_id,
                ex_id: ex.id,
                ex_name: ex.name,
                ex_order_index: ex.order_index,
                set_id: st.id,
                set_number: st.set_number,
                weight_kg: st.weight_kg,
                reps: st.reps,
                completed: st.completed,
              });
            }
          }
        }
        return joined as unknown as T[];
      }
      const workoutId = params[0];
      return this.tables.exercises.filter((e) => e.workout_id === workoutId) as unknown as T[];
    }
    if (trimmed.includes('from sets')) {
      const exerciseId = params[0];
      return this.tables.sets.filter((s) => s.exercise_id === exerciseId) as unknown as T[];
    }
    if (trimmed.includes('from scanned_products')) {
      return this.tables.scanned_products as unknown as T[];
    }
    if (trimmed.includes('from migrations_meta')) {
      return this.tables.migrations_meta as unknown as T[];
    }
    return [];
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all[0] ?? null;
  }
}

/**
 * Initializes tables and indexes in SQLite.
 */
export async function getDatabase(): Promise<DatabaseAdapter> {
  if (dbInstance && isInitialized) {
    return dbInstance;
  }

  // Check if running on native device with expo-sqlite
  const isNative = typeof window !== 'undefined' || Boolean((globalThis as Record<string, unknown>).nativeCallSyncHook);

  if (isNative) {
    try {
      const SQLite = await import('expo-sqlite');
      const nativeDb = SQLite.openDatabaseSync('betteryou.db');
      dbInstance = {
        execAsync: async (sql) => nativeDb.execAsync(sql),
        runAsync: async (sql, params = []) => {
          const res = (await (nativeDb.runAsync as any)(sql, params)) as { changes: number; lastInsertRowId: number };
          return { rowsAffected: res.changes, lastInsertRowId: res.lastInsertRowId };
        },
        getAllAsync: async <T>(sql: string, params = []) => (nativeDb.getAllAsync as any)(sql, params) as Promise<T[]>,
        getFirstAsync: async <T>(sql: string, params = []) => (nativeDb.getFirstAsync as any)(sql, params) as Promise<T | null>,
      };
    } catch (err: unknown) {
      console.warn('[db] Failed to load native expo-sqlite, using memory adapter:', err);
      dbInstance = new MemoryDatabaseAdapter();
    }
  } else {
    // In Bun test runner, use bun:sqlite for genuine in-memory SQLite testing!
    try {
      const { Database } = await import('bun:sqlite');
      const bunDb = new Database(':memory:');
      dbInstance = {
        execAsync: async (sql) => {
          bunDb.run(sql);
        },
        runAsync: async (sql, params = []) => {
          const stmt = bunDb.prepare(sql);
          const info = stmt.run(...(params as any[]));
          return { rowsAffected: info.changes, lastInsertRowId: Number(info.lastInsertRowid) };
        },
        getAllAsync: async <T>(sql: string, params = []) => {
          const stmt = bunDb.prepare(sql);
          return stmt.all(...(params as any[])) as T[];
        },
        getFirstAsync: async <T>(sql: string, params = []) => {
          const stmt = bunDb.prepare(sql);
          const result = stmt.get(...(params as any[]));
          return (result ?? null) as T | null;
        },
      };
    } catch {
      dbInstance = new MemoryDatabaseAdapter();
    }
  }

  if (!dbInstance) {
    dbInstance = new MemoryDatabaseAdapter();
  }

  // Create Schema with proper Foreign Keys and Date Indexes
  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      dish_name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      estimated_weight_grams INTEGER NOT NULL,
      portion_multiplier REAL NOT NULL DEFAULT 1.0,
      image_path TEXT,
      thumbnail_path TEXT,
      ingredients_detected TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS meals_date_idx ON meals(date);

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      total_volume_kg REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS workout_sessions_date_idx ON workout_sessions(date);

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS exercises_workout_id_idx ON exercises(workout_id);
    CREATE INDEX IF NOT EXISTS exercises_name_idx ON exercises(name);

    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_kg REAL NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sets_exercise_id_idx ON sets(exercise_id);

    CREATE TABLE IF NOT EXISTS scanned_products (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      barcode TEXT,
      product_name TEXT NOT NULL,
      category TEXT,
      overall_safety_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      image_path TEXT,
      report_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS scanned_products_date_idx ON scanned_products(date);
    CREATE INDEX IF NOT EXISTS scanned_products_scanned_at_idx ON scanned_products(scanned_at);

    CREATE TABLE IF NOT EXISTS daily_goals (
      id TEXT PRIMARY KEY NOT NULL,
      calorie_target INTEGER NOT NULL,
      protein_target_grams INTEGER NOT NULL,
      carbs_target_grams INTEGER NOT NULL,
      fat_target_grams INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY NOT NULL,
      age INTEGER NOT NULL,
      sex TEXT NOT NULL,
      height_cm REAL NOT NULL,
      weight_kg REAL NOT NULL,
      activity_level TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS body_measurements (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS body_measurements_date_idx ON body_measurements(date);

    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      original_json TEXT NOT NULL,
      corrected_json TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS migrations_meta (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vision_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Databases created before thumbnail_path existed need the column added.
  try {
    await dbInstance.execAsync('ALTER TABLE meals ADD COLUMN thumbnail_path TEXT;');
  } catch {
    // The column is already present.
  }

  isInitialized = true;
  return dbInstance;
}

// -------------------------------------------------------------
// MEAL REPOSITORY
// -------------------------------------------------------------

interface MealRow {
  id: string;
  date: string;
  dish_name: string;
  timestamp: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  estimated_weight_grams: number;
  portion_multiplier: number;
  image_path: string | null;
  thumbnail_path?: string | null;
  ingredients_detected: string;
  notes: string | null;
}

function mapMealRow(r: MealRow): MealLog {
  let ingredientsDetected: string[] = [];
  try {
    ingredientsDetected = JSON.parse(r.ingredients_detected);
  } catch {
    ingredientsDetected = [];
  }

  return {
    id: r.id,
    date: r.date,
    dishName: r.dish_name,
    timestamp: r.timestamp,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    estimatedWeightGrams: r.estimated_weight_grams,
    portionMultiplier: r.portion_multiplier,
    imageUri: r.image_path ?? undefined,
    thumbnailUri: r.thumbnail_path ?? undefined,
    ingredientsDetected,
    notes: r.notes ?? undefined,
  };
}

export async function dbInsertMeal(meal: Omit<MealLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<MealLog> {
  const db = await getDatabase();
  const id = meal.id || `meal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = meal.timestamp || new Date().toISOString();
  const date = meal.date || getLocalDateString(timestamp);
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO meals (
      id, date, dish_name, timestamp, calories, protein, carbs, fat,
      estimated_weight_grams, portion_multiplier, image_path, thumbnail_path, ingredients_detected, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      date,
      meal.dishName,
      timestamp,
      meal.calories,
      meal.protein,
      meal.carbs,
      meal.fat,
      meal.estimatedWeightGrams ?? 0,
      meal.portionMultiplier ?? 1.0,
      meal.imageUri ?? null,
      meal.thumbnailUri ?? null,
      JSON.stringify(meal.ingredientsDetected || []),
      meal.notes ?? null,
      now,
    ]
  );
  invalidateActivityDatesCache();

  return {
    id,
    date,
    dishName: meal.dishName,
    timestamp,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    estimatedWeightGrams: meal.estimatedWeightGrams,
    portionMultiplier: meal.portionMultiplier ?? 1.0,
    imageUri: meal.imageUri,
    thumbnailUri: meal.thumbnailUri,
    ingredientsDetected: meal.ingredientsDetected || [],
    notes: meal.notes,
  };
}

export async function dbGetMealsByDate(date: string): Promise<MealLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE date = ? ORDER BY timestamp DESC',
    [date]
  );

  return rows.map(mapMealRow);
}

export async function dbGetAllMeals(): Promise<MealLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MealRow>('SELECT * FROM meals ORDER BY timestamp DESC LIMIT 300');

  return rows.map(mapMealRow);
}

export async function dbDeleteMeal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM meals WHERE id = ?', [id]);
  invalidateActivityDatesCache();
}

export async function dbGetAllMealImagePaths(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ image_path: string | null }>(
    'SELECT image_path FROM meals WHERE image_path IS NOT NULL'
  );
  return rows.map((r) => r.image_path).filter((p): p is string => Boolean(p));
}

// -------------------------------------------------------------
// WORKOUT REPOSITORY
// -------------------------------------------------------------

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

  // Group exercises and sets by workout_id preserving order
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

// -------------------------------------------------------------
// SCANNED PRODUCTS REPOSITORY
// -------------------------------------------------------------

export async function dbInsertScannedProduct(product: ScannedProduct): Promise<void> {
  const db = await getDatabase();
  const date = getLocalDateString(product.scannedAt);
  const now = Date.now();
  const name = product.productName || product.report?.productName || 'Unknown Product';
  const img = product.imageUrl ?? null;

  await db.runAsync(
    `INSERT OR REPLACE INTO scanned_products (
      id, date, barcode, product_name, category, overall_safety_score, risk_level, scanned_at, image_path, report_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      date,
      product.barcode ?? null,
      name,
      product.report.category ?? null,
      product.report.overallSafetyScore,
      product.report.riskLevel,
      product.scannedAt,
      img,
      JSON.stringify(product.report),
      now,
    ]
  );
}

function parseScannedProductRow(r: {
  id: string;
  barcode: string | null;
  product_name: string;
  scanned_at: string;
  image_path: string | null;
  report_json: string;
}): ScannedProduct {
  let report: ToxicityReport;
  try {
    report = JSON.parse(r.report_json);
  } catch {
    report = {
      productName: r.product_name,
      overallSafetyScore: 50,
      riskLevel: 'Moderate',
      harmfulIngredients: [],
      cleanSummary: '',
    };
  }

  return {
    id: r.id,
    barcode: r.barcode ?? undefined,
    productName: r.product_name,
    scannedAt: r.scanned_at,
    imageUrl: r.image_path ?? undefined,
    report,
    reportComplete: true,
  };
}

export async function dbGetAllScannedProducts(): Promise<ScannedProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    barcode: string | null;
    product_name: string;
    scanned_at: string;
    image_path: string | null;
    report_json: string;
  }>('SELECT * FROM scanned_products ORDER BY scanned_at DESC LIMIT 100');

  return rows.map(parseScannedProductRow);
}

interface ProductSummarySqlRow {
  id: string;
  barcode: string | null;
  product_name: string;
  overall_safety_score: number;
  risk_level: string;
  scanned_at: string;
  image_path: string | null;
  flagged_count?: number | null;
}

function mapProductSummary(r: ProductSummarySqlRow): ScannedProduct {
  const riskLevel =
    r.risk_level === 'Safe' || r.risk_level === 'Moderate' || r.risk_level === 'High Risk'
      ? r.risk_level
      : 'Moderate';

  return {
    id: r.id,
    barcode: r.barcode ?? undefined,
    productName: r.product_name,
    scannedAt: r.scanned_at,
    imageUrl: r.image_path ?? undefined,
    reportComplete: false,
    flaggedCount: Number(r.flagged_count ?? 0),
    report: {
      productName: r.product_name,
      overallSafetyScore: r.overall_safety_score,
      riskLevel,
      harmfulIngredients: [],
      cleanSummary: '',
    },
  };
}

/**
 * List rows for the dashboard and the all-scans modal.
 * Leaves report_json on disk so startup does not JSON.parse every scan.
 */
export async function dbGetProductSummaries(limit = 100): Promise<ScannedProduct[]> {
  const db = await getDatabase();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db.getAllAsync<ProductSummarySqlRow>(
    `SELECT id, barcode, product_name, overall_safety_score, risk_level, scanned_at, image_path,
            COALESCE(json_array_length(report_json, '$.harmfulIngredients'), 0) AS flagged_count
     FROM scanned_products
     ORDER BY scanned_at DESC
     LIMIT ${safeLimit}`
  );
  return rows.map(mapProductSummary);
}

export async function dbGetScannedProductById(id: string): Promise<ScannedProduct | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    barcode: string | null;
    product_name: string;
    scanned_at: string;
    image_path: string | null;
    report_json: string;
  }>(
    'SELECT id, barcode, product_name, scanned_at, image_path, report_json FROM scanned_products WHERE id = ?',
    [id]
  );
  if (!row) return null;
  return parseScannedProductRow(row);
}

let activityDatesCache: string[] | null = null;

export function invalidateActivityDatesCache(): void {
  activityDatesCache = null;
}

export async function dbGetActivityDates(): Promise<string[]> {
  if (activityDatesCache) return activityDatesCache;
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM meals
     UNION
     SELECT date FROM workout_sessions`
  );
  activityDatesCache = rows.map((row) => row.date).filter((date) => Boolean(date));
  return activityDatesCache;
}

export async function dbGetLibraryCounts(): Promise<{
  meals: number;
  mealsWithPhotos: number;
  workouts: number;
  products: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    meals: number;
    meals_with_photos: number;
    workouts: number;
    products: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM meals) AS meals,
      (SELECT COUNT(*) FROM meals WHERE image_path IS NOT NULL AND image_path != '') AS meals_with_photos,
      (SELECT COUNT(*) FROM workout_sessions) AS workouts,
      (SELECT COUNT(*) FROM scanned_products) AS products`
  );
  return {
    meals: Number(row?.meals ?? 0),
    mealsWithPhotos: Number(row?.meals_with_photos ?? 0),
    workouts: Number(row?.workouts ?? 0),
    products: Number(row?.products ?? 0),
  };
}

export async function dbGetScannedProductsByDate(date: string): Promise<ScannedProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    barcode: string | null;
    product_name: string;
    scanned_at: string;
    image_path: string | null;
    report_json: string;
  }>('SELECT * FROM scanned_products WHERE date = ? ORDER BY scanned_at DESC', [date]);

  return rows.map(parseScannedProductRow);
}

export async function dbDeleteScannedProduct(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM scanned_products WHERE id = ?', [id]);
}

export async function dbGetAllProductImagePaths(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ image_path: string | null }>(
    'SELECT image_path FROM scanned_products WHERE image_path IS NOT NULL'
  );
  return rows.map((r) => r.image_path).filter((p): p is string => Boolean(p));
}

// -------------------------------------------------------------
// DAILY GOALS REPOSITORY
// -------------------------------------------------------------

const DEFAULT_GOALS: DailyGoals = {
  calorieTarget: 2200,
  proteinTargetGrams: 160,
  carbsTargetGrams: 220,
  fatTargetGrams: 65,
};

export async function dbGetDailyGoals(): Promise<DailyGoals> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    calorie_target: number;
    protein_target_grams: number;
    carbs_target_grams: number;
    fat_target_grams: number;
  }>('SELECT * FROM daily_goals WHERE id = ?', ['default']);

  if (!row) {
    return DEFAULT_GOALS;
  }

  return {
    calorieTarget: row.calorie_target,
    proteinTargetGrams: row.protein_target_grams,
    carbsTargetGrams: row.carbs_target_grams,
    fatTargetGrams: row.fat_target_grams,
  };
}

export async function dbSetDailyGoals(goals: Partial<DailyGoals>): Promise<DailyGoals> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    calorie_target: number;
    protein_target_grams: number;
    carbs_target_grams: number;
    fat_target_grams: number;
  }>('SELECT * FROM daily_goals WHERE id = ?', ['default']);

  const current: DailyGoals = row
    ? {
        calorieTarget: row.calorie_target,
        proteinTargetGrams: row.protein_target_grams,
        carbsTargetGrams: row.carbs_target_grams,
        fatTargetGrams: row.fat_target_grams,
      }
    : DEFAULT_GOALS;

  const updated: DailyGoals = {
    ...current,
    ...goals,
  };

  await db.runAsync(
    `INSERT OR REPLACE INTO daily_goals (
      id, calorie_target, protein_target_grams, carbs_target_grams, fat_target_grams, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'default',
      updated.calorieTarget,
      updated.proteinTargetGrams,
      updated.carbsTargetGrams,
      updated.fatTargetGrams,
      Date.now(),
    ]
  );

  return updated;
}

// -------------------------------------------------------------
// USER PROFILE REPOSITORY
// -------------------------------------------------------------

export interface UserProfileData {
  id: string;
  age: number;
  sex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
  goalType: 'cut' | 'maintain' | 'bulk';
  updatedAt: string;
}

export async function dbGetUserProfile(): Promise<UserProfileData | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    age: number;
    sex: string;
    height_cm: number;
    weight_kg: number;
    activity_level: string;
    goal_type: string;
    updated_at: string;
  }>('SELECT * FROM user_profile WHERE id = ?', ['default']);

  if (!row) return null;

  return {
    id: row.id,
    age: row.age,
    sex: row.sex as 'male' | 'female',
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as UserProfileData['activityLevel'],
    goalType: row.goal_type as UserProfileData['goalType'],
    updatedAt: row.updated_at,
  };
}

export async function dbUpsertUserProfile(
  profile: Omit<UserProfileData, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string }
): Promise<UserProfileData> {
  const db = await getDatabase();
  const id = profile.id || 'default';
  const updatedAt = profile.updatedAt || new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO user_profile (
      id, age, sex, height_cm, weight_kg, activity_level, goal_type, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      profile.age,
      profile.sex,
      profile.heightCm,
      profile.weightKg,
      profile.activityLevel,
      profile.goalType,
      updatedAt,
    ]
  );

  return {
    id,
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    goalType: profile.goalType,
    updatedAt,
  };
}

// -------------------------------------------------------------
// BODY MEASUREMENTS REPOSITORY
// -------------------------------------------------------------

export interface BodyMeasurementSqlRow {
  id: string;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: number;
}

function parseBodyMeasurementRow(r: BodyMeasurementSqlRow): BodyMeasurement {
  return {
    id: r.id,
    date: r.date,
    weightKg: r.weight_kg,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  };
}

export async function dbInsertBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO body_measurements (id, date, weight_kg, note, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      measurement.id,
      measurement.date,
      measurement.weightKg,
      measurement.note ?? null,
      measurement.createdAt || Date.now(),
    ]
  );
}

export async function dbGetAllBodyMeasurements(): Promise<BodyMeasurement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<BodyMeasurementSqlRow>(
    'SELECT * FROM body_measurements ORDER BY date DESC, created_at DESC'
  );
  return rows.map(parseBodyMeasurementRow);
}

export async function dbGetBodyMeasurementsByDateRange(startDate: string, endDate: string): Promise<BodyMeasurement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<BodyMeasurementSqlRow>(
    'SELECT * FROM body_measurements WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC',
    [startDate, endDate]
  );
  return rows.map(parseBodyMeasurementRow);
}

export async function dbGetLatestBodyMeasurement(): Promise<BodyMeasurement | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<BodyMeasurementSqlRow>(
    'SELECT * FROM body_measurements ORDER BY date DESC, created_at DESC LIMIT 1'
  );
  if (!row) return null;
  return parseBodyMeasurementRow(row);
}

export async function dbDeleteBodyMeasurement(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM body_measurements WHERE id = ?', [id]);
}

// -------------------------------------------------------------
// CORRECTIONS REPOSITORY
// -------------------------------------------------------------

export interface CorrectionEntry {
  id: string;
  type: 'meal' | 'toxicity';
  originalJson: string;
  correctedJson: string;
  timestamp: number;
}

export async function dbInsertCorrection(entry: {
  id?: string;
  type: 'meal' | 'toxicity';
  originalJson: string;
  correctedJson: string;
  timestamp?: number;
}): Promise<CorrectionEntry> {
  const db = await getDatabase();
  const id = entry.id || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = entry.timestamp || Date.now();

  await db.runAsync(
    `INSERT OR REPLACE INTO corrections (id, type, original_json, corrected_json, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [id, entry.type, entry.originalJson, entry.correctedJson, timestamp]
  );

  return {
    id,
    type: entry.type,
    originalJson: entry.originalJson,
    correctedJson: entry.correctedJson,
    timestamp,
  };
}

export async function dbGetAllCorrections(type?: 'meal' | 'toxicity'): Promise<CorrectionEntry[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM corrections ORDER BY timestamp DESC';
  const params: unknown[] = [];
  if (type) {
    sql = 'SELECT * FROM corrections WHERE type = ? ORDER BY timestamp DESC';
    params.push(type);
  }

  const rows = await db.getAllAsync<{
    id: string;
    type: 'meal' | 'toxicity';
    original_json: string;
    corrected_json: string;
    timestamp: number;
  }>(sql, params);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    originalJson: r.original_json,
    correctedJson: r.corrected_json,
    timestamp: r.timestamp,
  }));
}

export async function dbClearCorrections(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM corrections;');
}



