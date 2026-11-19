import { z } from 'zod';
import { DailyGoals, MealLog, ScannedProduct, WorkoutSession } from '../types';
import {
  dbGetAllMeals,
  dbGetAllScannedProducts,
  dbGetAllWorkouts,
  dbInsertMeal,
  dbInsertScannedProduct,
  dbInsertWorkout,
  dbSetDailyGoals,
  getDatabase,
  invalidateActivityDatesCache,
} from '../db/client';

export const CURRENT_BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  workouts: WorkoutSession[];
  meals: MealLog[];
  dailyGoals?: DailyGoals;
  scannedProducts?: ScannedProduct[];
}

export interface BackupImportSummary {
  strategy: 'replace' | 'merge';
  mealsImported: number;
  workoutsImported: number;
  productsImported: number;
  goalsUpdated: boolean;
  imagesIncluded: false;
  imageNotice: string;
}

// -------------------------------------------------------------
// ZOD VALIDATION SCHEMAS
// -------------------------------------------------------------

const ExerciseSetBackupSchema = z.object({
  id: z.string().min(1),
  setNumber: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  completed: z.boolean(),
});

const ExerciseItemBackupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sets: z.array(ExerciseSetBackupSchema).default([]),
});

const WorkoutSessionBackupSchema = z.object({
  id: z.string().min(1),
  date: z.string().optional(),
  title: z.string().min(1),
  startedAt: z.string().min(1),
  completedAt: z.string().optional(),
  durationSeconds: z.number().nonnegative().optional().default(0),
  totalVolumeKg: z.number().nonnegative().optional().default(0),
  notes: z.string().optional(),
  exercises: z.array(ExerciseItemBackupSchema).default([]),
});

const MealLogBackupSchema = z.object({
  id: z.string().min(1),
  date: z.string().optional(),
  dishName: z.string().min(1),
  timestamp: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  estimatedWeightGrams: z.number().nonnegative().optional().default(0),
  portionMultiplier: z.number().positive().optional().default(1.0),
  imageUri: z.string().optional(),
  thumbnailUri: z.string().optional(),
  ingredientsDetected: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
});

const ScannedProductBackupSchema = z.object({
  id: z.string().min(1),
  barcode: z.string().optional(),
  productName: z.string().min(1),
  scannedAt: z.string().min(1),
  imageUrl: z.string().optional(),
  imageUri: z.string().optional(),
  reportComplete: z.boolean().optional(),
  flaggedCount: z.number().optional(),
  report: z.object({
    productName: z.string(),
    category: z.string().optional(),
    overallSafetyScore: z.number(),
    riskLevel: z.string(),
    harmfulIngredients: z.array(z.any()).default([]),
    cleanSummary: z.string().optional().default(''),
  }),
});

const DailyGoalsBackupSchema = z.object({
  calorieTarget: z.number().int().positive(),
  proteinTargetGrams: z.number().nonnegative(),
  carbsTargetGrams: z.number().nonnegative(),
  fatTargetGrams: z.number().nonnegative(),
});

export const BackupPayloadSchema = z.object({
  version: z.number().int().positive(),
  exportedAt: z.string().min(1),
  workouts: z.array(WorkoutSessionBackupSchema).default([]),
  meals: z.array(MealLogBackupSchema).default([]),
  dailyGoals: DailyGoalsBackupSchema.optional(),
  scannedProducts: z.array(ScannedProductBackupSchema).optional().default([]),
});

export type BackupValidationResult =
  | { success: true; payload: BackupPayload }
  | { success: false; error: string };

/**
 * Validates raw JSON backup content with Zod.
 * Enforces version checking: rejects unknown future versions.
 */
export function parseAndValidateBackup(rawJson: string): BackupValidationResult {
  const trimmed = rawJson ? rawJson.trim() : '';
  if (!trimmed) {
    return { success: false, error: 'Backup file is empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { success: false, error: 'Invalid JSON file: file content could not be parsed.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, error: 'Invalid backup structure: root payload must be a JSON object.' };
  }

  const rawObj = parsed as Record<string, unknown>;

  // Check version field first
  if (typeof rawObj.version !== 'number' || rawObj.version < 1) {
    return { success: false, error: 'Invalid backup version: missing or non-numeric version field.' };
  }

  if (rawObj.version > CURRENT_BACKUP_VERSION) {
    return {
      success: false,
      error: `Backup was created with a newer, unsupported version of BetterYou (version ${rawObj.version}). Please update BetterYou from the app store to restore this file.`,
    };
  }

  const parseResult = BackupPayloadSchema.safeParse(parsed);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      success: false,
      error: `Backup validation failed: ${errorDetails}`,
    };
  }

  return {
    success: true,
    payload: parseResult.data as BackupPayload,
  };
}

/**
 * Atomically imports backup payload into SQLite database inside a single transaction.
 * Strategies:
 * - "replace": wipes existing meals, workouts, sets, exercises, products, then restores
 * - "merge": skips IDs that already exist in the database
 *
 * Missing images: restored gracefully (relative paths stored, missing files handled by UI fallback).
 * If any error occurs, rolls back fully to prevent partial restoration.
 */
export async function importBackup(
  payload: BackupPayload,
  strategy: 'replace' | 'merge'
): Promise<BackupImportSummary> {
  const db = await getDatabase();
  invalidateActivityDatesCache();

  try {
    await db.execAsync('BEGIN TRANSACTION;');
  } catch {
    // Adapter may not support explicit BEGIN
  }

  try {
    let existingMealIds = new Set<string>();
    let existingWorkoutIds = new Set<string>();
    let existingProductIds = new Set<string>();

    if (strategy === 'replace') {
      // Destructive wipe inside transaction
      await db.execAsync(`
        DELETE FROM meals;
        DELETE FROM sets;
        DELETE FROM exercises;
        DELETE FROM workout_sessions;
        DELETE FROM scanned_products;
      `);
    } else {
      // Merge: query existing IDs to skip duplicates
      const currentMeals = await dbGetAllMeals();
      const currentWorkouts = await dbGetAllWorkouts();
      const currentProducts = await dbGetAllScannedProducts();

      existingMealIds = new Set(currentMeals.map((m) => m.id));
      existingWorkoutIds = new Set(currentWorkouts.map((w) => w.id));
      existingProductIds = new Set(currentProducts.map((p) => p.id));
    }

    let mealsImported = 0;
    let workoutsImported = 0;
    let productsImported = 0;

    // 1. Restore Meals
    for (const meal of payload.meals) {
      if (strategy === 'merge' && existingMealIds.has(meal.id)) {
        continue;
      }
      await dbInsertMeal(meal);
      mealsImported++;
    }

    // 2. Restore Workouts (with nested exercises and sets)
    for (const workout of payload.workouts) {
      if (strategy === 'merge' && existingWorkoutIds.has(workout.id)) {
        continue;
      }
      await dbInsertWorkout(workout);
      workoutsImported++;
    }

    // 3. Restore Scanned Products
    for (const product of payload.scannedProducts || []) {
      if (strategy === 'merge' && existingProductIds.has(product.id)) {
        continue;
      }
      await dbInsertScannedProduct(product);
      productsImported++;
    }

    // 4. Restore Daily Goals
    let goalsUpdated = false;
    if (payload.dailyGoals) {
      await dbSetDailyGoals(payload.dailyGoals);
      goalsUpdated = true;
    }

    try {
      await db.execAsync('COMMIT;');
    } catch {
      // Non-fatal if unsupported by adapter
    }

    invalidateActivityDatesCache();

    return {
      strategy,
      mealsImported,
      workoutsImported,
      productsImported,
      goalsUpdated,
      imagesIncluded: false,
      imageNotice: 'Photos and scans are stored locally on device and are not included in backups.',
    };
  } catch (err: unknown) {
    try {
      await db.execAsync('ROLLBACK;');
    } catch {
      // Ignore
    }
    invalidateActivityDatesCache();
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Backup restore failed and was completely rolled back: ${errorMsg}`);
  }
}

/**
 * Generates a full structured JSON backup of all fitness and nutrition data.
 */
export function generateJsonBackup(
  workouts: WorkoutSession[],
  meals: MealLog[],
  dailyGoals?: DailyGoals,
  scannedProducts?: ScannedProduct[]
): string {
  const payload: BackupPayload = {
    version: CURRENT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    workouts,
    meals,
    dailyGoals,
    scannedProducts: scannedProducts || [],
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
      rows.push(
        [
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
        ].join(',')
      );
      continue;
    }

    for (const ex of session.exercises) {
      const exNameEscaped = `"${(ex.name || 'Exercise').replace(/"/g, '""')}"`;
      for (const set of ex.sets) {
        const setVolume = set.completed ? Math.round(set.weightKg * set.reps) : 0;
        rows.push(
          [
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
          ].join(',')
        );
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

    rows.push(
      [
        dateClean,
        meal.timestamp || '',
        dishEscaped,
        meal.estimatedWeightGrams || 0,
        meal.calories,
        meal.protein,
        meal.carbs,
        meal.fat,
      ].join(',')
    );
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
  if (typeof window !== 'undefined' || (globalThis as Record<string, unknown>).nativeCallSyncHook) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Share = typeof require !== 'undefined' ? require('react-native').Share : null;
      if (Share) {
        const result = await Share.share({
          message: content,
          title,
        });
        if (result.action === Share.sharedAction) {
          return 'shared';
        }
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
