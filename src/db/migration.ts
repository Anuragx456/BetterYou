import { safeAsyncStorage } from '../utils/storage';
import {
  dbGetAllMeals,
  dbGetAllScannedProducts,
  dbGetAllWorkouts,
  dbInsertMeal,
  dbInsertScannedProduct,
  dbInsertWorkout,
  dbSetDailyGoals,
  getDatabase,
} from './client';
import { DailyGoals, MealLog, ScannedProduct, WorkoutSession } from '../types';

export const MIGRATION_V1_ID = 'async_storage_to_sqlite_v1';
const LEGACY_STORAGE_KEY = 'betteryou-fitness-storage';

export interface MigrationResult {
  status: 'already_completed' | 'no_legacy_data' | 'success' | 'failed';
  mealsMigrated?: number;
  workoutsMigrated?: number;
  productsMigrated?: number;
  error?: string;
}

/**
 * Runs a one-time, idempotent, resumable migration from monolithic AsyncStorage
 * to normalized SQLite tables. Keeps legacy data until migration is verified.
 */
export async function runAsyncStorageToSqliteMigration(): Promise<MigrationResult> {
  const db = await getDatabase();

  // 1. Check if migration was already verified and applied
  const existingMeta = await db.getFirstAsync<{ id: string; applied_at: number }>(
    'SELECT * FROM migrations_meta WHERE id = ?',
    [MIGRATION_V1_ID]
  );

  if (existingMeta) {
    return { status: 'already_completed' };
  }

  // 2. Read legacy AsyncStorage payload
  const rawLegacy = await safeAsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!rawLegacy) {
    // No old data exists; record migration completed
    await db.runAsync('INSERT OR REPLACE INTO migrations_meta (id, applied_at) VALUES (?, ?)', [
      MIGRATION_V1_ID,
      Date.now(),
    ]);
    return { status: 'no_legacy_data' };
  }

  let parsed: {
    state?: {
      meals?: MealLog[];
      workouts?: WorkoutSession[];
      scannedProducts?: ScannedProduct[];
      dailyGoals?: DailyGoals;
      streakDays?: number;
      lastActiveWorkoutDate?: string;
    };
  };

  try {
    parsed = JSON.parse(rawLegacy);
  } catch (err: unknown) {
    console.warn('[migration] Failed to parse legacy AsyncStorage JSON:', err);
    return { status: 'failed', error: 'Invalid JSON in legacy storage' };
  }

  const legacyState = parsed?.state || {};
  const oldMeals = Array.isArray(legacyState.meals) ? legacyState.meals : [];
  const oldWorkouts = Array.isArray(legacyState.workouts) ? legacyState.workouts : [];
  const oldProducts = Array.isArray(legacyState.scannedProducts) ? legacyState.scannedProducts : [];
  const oldGoals = legacyState.dailyGoals;

  try {
    // 3. Resumable & Idempotent insertions
    // Meals
    for (const meal of oldMeals) {
      await dbInsertMeal(meal);
    }

    // Workouts (with nested exercises and sets)
    for (const workout of oldWorkouts) {
      await dbInsertWorkout(workout);
    }

    // Scanned Products
    for (const product of oldProducts) {
      await dbInsertScannedProduct(product);
    }

    // Goals
    if (oldGoals) {
      await dbSetDailyGoals(oldGoals);
    }

    // 4. Verification Check
    const newMeals = await dbGetAllMeals();
    const newWorkouts = await dbGetAllWorkouts();
    const newProducts = await dbGetAllScannedProducts();

    const mealsVerified = newMeals.length >= oldMeals.length;
    const workoutsVerified = newWorkouts.length >= oldWorkouts.length;
    const productsVerified = newProducts.length >= oldProducts.length;

    if (!mealsVerified || !workoutsVerified || !productsVerified) {
      throw new Error(
        `Verification failed: expected at least ${oldMeals.length} meals, ${oldWorkouts.length} workouts, ${oldProducts.length} products; found ${newMeals.length}, ${newWorkouts.length}, ${newProducts.length}. Old data retained.`
      );
    }

    // 5. Mark migration as verified in SQLite
    await db.runAsync('INSERT OR REPLACE INTO migrations_meta (id, applied_at) VALUES (?, ?)', [
      MIGRATION_V1_ID,
      Date.now(),
    ]);

    // 6. Delete legacy AsyncStorage key only AFTER verification succeeds
    await safeAsyncStorage.removeItem(LEGACY_STORAGE_KEY);

    return {
      status: 'success',
      mealsMigrated: oldMeals.length,
      workoutsMigrated: oldWorkouts.length,
      productsMigrated: oldProducts.length,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[migration] Migration halted; preserving old AsyncStorage data:', errorMsg);
    return {
      status: 'failed',
      error: errorMsg,
    };
  }
}
