import { WorkoutSession } from '../types';

export interface PrDetectionResult {
  isWeightPr: boolean;
  isVolumePr: boolean;
  previousMaxWeight: number;
  previousMaxVolume: number;
}

export interface PreviousExerciseValues {
  lastDate: string;
  sets: { weightKg: number; reps: number }[];
  summaryText: string;
}

/**
 * Retrieves values and sets from the user's most recent completed session for this exercise.
 * Optimized single-pass search without array allocation or sorting overhead.
 */
export function getPreviousSessionExerciseValues(
  exerciseName: string,
  workouts: WorkoutSession[]
): PreviousExerciseValues | null {
  if (!exerciseName || !workouts || workouts.length === 0) return null;

  const cleanName = exerciseName.toLowerCase().trim();
  let latestSession: WorkoutSession | null = null;
  let latestTime = -1;

  for (let i = 0; i < workouts.length; i++) {
    const session = workouts[i];
    const ex = session.exercises?.find((e) => e.name.toLowerCase().trim() === cleanName);
    if (ex && ex.sets.some((s) => s.completed && s.weightKg > 0)) {
      const time = new Date(session.completedAt || session.startedAt || 0).getTime();
      if (time > latestTime) {
        latestTime = time;
        latestSession = session;
      }
    }
  }

  if (latestSession) {
    const ex = latestSession.exercises?.find((e) => e.name.toLowerCase().trim() === cleanName);
    if (ex) {
      const completedSets = ex.sets.filter((s) => s.completed && s.weightKg > 0);
      const dateStr = (latestSession.completedAt || latestSession.startedAt || '').split('T')[0] || '';
      const summaryText = completedSets.map((s) => `${s.weightKg}kg×${s.reps}`).join(', ');

      return {
        lastDate: dateStr,
        sets: completedSets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
        summaryText,
      };
    }
  }

  return null;
}

/**
 * Checks whether completing a specific set represents an all-time PR (Personal Record)
 * in weight or set volume for that exercise name.
 */
export function detectPersonalRecord(
  exerciseName: string,
  weightKg: number,
  reps: number,
  pastWorkouts: WorkoutSession[]
): PrDetectionResult {
  if (!exerciseName || weightKg <= 0 || reps <= 0) {
    return { isWeightPr: false, isVolumePr: false, previousMaxWeight: 0, previousMaxVolume: 0 };
  }

  const cleanName = exerciseName.toLowerCase().trim();
  let maxPastWeight = 0;
  let maxPastVolume = 0;

  for (const session of pastWorkouts) {
    const ex = session.exercises?.find((e) => e.name.toLowerCase().trim() === cleanName);
    if (ex) {
      for (const s of ex.sets) {
        if (s.completed) {
          if (s.weightKg > maxPastWeight) {
            maxPastWeight = s.weightKg;
          }
          const v = s.weightKg * s.reps;
          if (v > maxPastVolume) {
            maxPastVolume = v;
          }
        }
      }
    }
  }

  const currentVolume = weightKg * reps;
  const isWeightPr = maxPastWeight > 0 && weightKg > maxPastWeight;
  const isVolumePr = maxPastVolume > 0 && currentVolume > maxPastVolume;

  return {
    isWeightPr,
    isVolumePr,
    previousMaxWeight: maxPastWeight,
    previousMaxVolume: maxPastVolume,
  };
}

export interface ExerciseHistorySession {
  date: string;
  maxWeightKg: number;
  totalVolumeKg: number;
  sets: { setNumber: number; weightKg: number; reps: number }[];
}

export interface ExerciseHistorySnapshot {
  previous: PreviousExerciseValues | null;
  maxWeight: number;
  maxVolume: number;
  sessions: ExerciseHistorySession[];
}

export type ExerciseHistoryIndex = Map<string, ExerciseHistorySnapshot>;

export function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * One pass over workout history. Active set rows then look up a name instead of
 * scanning every session on each completed set.
 */
export function buildExerciseHistoryIndex(workouts: readonly WorkoutSession[]): ExerciseHistoryIndex {
  const drafts = new Map<
    string,
    {
      maxWeight: number;
      maxVolume: number;
      latestTime: number;
      previous: PreviousExerciseValues | null;
      sessions: { time: number; point: ExerciseHistorySession }[];
    }
  >();

  for (let i = 0; i < workouts.length; i++) {
    const session = workouts[i];
    const time = new Date(session.completedAt || session.startedAt || 0).getTime();
    const dateStr = (session.completedAt || session.startedAt || '').split('T')[0] || '';
    const exercises = session.exercises || [];

    for (let e = 0; e < exercises.length; e++) {
      const exercise = exercises[e];
      const key = normalizeExerciseName(exercise.name);
      if (!key) continue;

      const completed = (exercise.sets || []).filter((set) => set.completed && set.weightKg > 0);
      if (completed.length === 0) continue;

      let maxWeight = 0;
      let totalVolume = 0;
      let maxSetVolume = 0;
      for (let s = 0; s < completed.length; s++) {
        const set = completed[s];
        if (set.weightKg > maxWeight) maxWeight = set.weightKg;
        const volume = set.weightKg * set.reps;
        totalVolume += volume;
        if (volume > maxSetVolume) maxSetVolume = volume;
      }

      let draft = drafts.get(key);
      if (!draft) {
        draft = {
          maxWeight: 0,
          maxVolume: 0,
          latestTime: -1,
          previous: null,
          sessions: [],
        };
        drafts.set(key, draft);
      }
      if (maxWeight > draft.maxWeight) draft.maxWeight = maxWeight;
      if (maxSetVolume > draft.maxVolume) draft.maxVolume = maxSetVolume;

      const point: ExerciseHistorySession = {
        date: dateStr,
        maxWeightKg: maxWeight,
        totalVolumeKg: totalVolume,
        sets: completed.map((set) => ({
          setNumber: set.setNumber,
          weightKg: set.weightKg,
          reps: set.reps,
        })),
      };
      draft.sessions.push({ time, point });
      if (time > draft.latestTime) {
        draft.latestTime = time;
        draft.previous = {
          lastDate: dateStr,
          sets: point.sets.map((set) => ({ weightKg: set.weightKg, reps: set.reps })),
          summaryText: point.sets.map((set) => `${set.weightKg}kg×${set.reps}`).join(', '),
        };
      }
    }
  }

  const index: ExerciseHistoryIndex = new Map();
  for (const [key, draft] of drafts) {
    index.set(key, {
      previous: draft.previous,
      maxWeight: draft.maxWeight,
      maxVolume: draft.maxVolume,
      sessions: draft.sessions.sort((a, b) => a.time - b.time).map((entry) => entry.point),
    });
  }
  return index;
}

export function personalRecordFromSnapshot(
  weightKg: number,
  reps: number,
  snap: ExerciseHistorySnapshot | undefined
): PrDetectionResult {
  if (!snap || weightKg <= 0 || reps <= 0) {
    return {
      isWeightPr: false,
      isVolumePr: false,
      previousMaxWeight: 0,
      previousMaxVolume: 0,
    };
  }

  const currentVolume = weightKg * reps;
  return {
    isWeightPr: snap.maxWeight > 0 && weightKg > snap.maxWeight,
    isVolumePr: snap.maxVolume > 0 && currentVolume > snap.maxVolume,
    previousMaxWeight: snap.maxWeight,
    previousMaxVolume: snap.maxVolume,
  };
}
