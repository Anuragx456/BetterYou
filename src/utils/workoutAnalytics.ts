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
