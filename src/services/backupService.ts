import { MealLog, WorkoutSession, DailyGoals } from '../types';

export interface BackupPayload {
  version: number;
  exportedAt: string;
  workouts: WorkoutSession[];
  meals: MealLog[];
  dailyGoals?: DailyGoals;
}

/**
 * Generates a full structured JSON backup of all fitness and nutrition data.
 */
export function generateJsonBackup(
  workouts: WorkoutSession[],
  meals: MealLog[],
  dailyGoals?: DailyGoals
): string {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts,
    meals,
    dailyGoals,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Generates a standard CSV representation of workout sessions, exercises, and sets.
 * Compatible with Excel, Google Sheets, and sports science analysis tools.
 */
export function generateWorkoutsCsv(workouts: WorkoutSession[]): string {
  const headers = [
    'Date',
    'Workout_Title',
    'Duration_Minutes',
    'Total_Volume_kg',
    'Exercise_Name',
    'Set_Number',
    'Weight_kg',
    'Reps',
    'Set_Volume_kg',
    'Completed',
  ];

  const rows: string[] = [headers.join(',')];

  for (const session of workouts) {
    const date = session.completedAt || session.startedAt || session.date || '';
    const dateClean = date.split('T')[0] || '';
    const durationMin = Math.round(session.durationSeconds / 60);
    const titleEscaped = `"${(session.title || 'Workout').replace(/"/g, '""')}"`;

    if (!session.exercises || session.exercises.length === 0) {
      rows.push([
        dateClean,
        titleEscaped,
        durationMin,
        session.totalVolumeKg || 0,
        '""',
        0,
        0,
        0,
        0,
        'false',
      ].join(','));
      continue;
    }

    for (const ex of session.exercises) {
      const exNameEscaped = `"${(ex.name || 'Exercise').replace(/"/g, '""')}"`;
      for (const set of ex.sets) {
        const setVolume = set.completed ? Math.round(set.weightKg * set.reps) : 0;
        rows.push([
          dateClean,
          titleEscaped,
          durationMin,
          session.totalVolumeKg || 0,
          exNameEscaped,
          set.setNumber,
          set.weightKg,
          set.reps,
          setVolume,
          set.completed ? 'true' : 'false',
        ].join(','));
      }
    }
  }

  return rows.join('\n');
}

/**
 * Generates a standard CSV representation of logged meals and macronutrients.
 */
export function generateMealsCsv(meals: MealLog[]): string {
  const headers = [
    'Date',
    'Timestamp',
    'Dish_Name',
    'Estimated_Weight_g',
    'Calories_kcal',
    'Protein_g',
    'Carbs_g',
    'Fat_g',
  ];

  const rows: string[] = [headers.join(',')];

  for (const meal of meals) {
    const dateClean = (meal.timestamp || '').split('T')[0] || '';
    const dishEscaped = `"${(meal.dishName || 'Meal').replace(/"/g, '""')}"`;

    rows.push([
      dateClean,
      meal.timestamp || '',
      dishEscaped,
      meal.estimatedWeightGrams || 0,
      meal.calories,
      meal.protein,
      meal.carbs,
      meal.fat,
    ].join(','));
  }

  return rows.join('\n');
}

/**
 * Shares or copies backup content to system share sheet or clipboard.
 */
export async function shareOrCopyData(
  content: string,
  title: string
): Promise<'shared' | 'copied'> {
  if (typeof window !== 'undefined' || (globalThis as any).nativeCallSyncHook) {
    try {
      const { Share } = await import('react-native');
      const result = await Share.share({
        message: content,
        title,
      });
      if (result.action === Share.sharedAction) {
        return 'shared';
      }
    } catch {
      // Fallback to clipboard
    }

    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(content);
      return 'copied';
    } catch {
      // ignore
    }
  }
  return 'copied';
}
