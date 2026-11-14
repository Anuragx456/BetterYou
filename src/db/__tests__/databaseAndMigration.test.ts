import { describe, expect, it, beforeEach } from 'bun:test';
import {
  dbDeleteMeal,
  dbDeleteScannedProduct,
  dbDeleteWorkout,
  dbGetAllMeals,
  dbGetAllScannedProducts,
  dbGetAllWorkouts,
  dbGetDailyGoals,
  dbGetMealsByDate,
  dbGetProductSummaries,
  dbGetScannedProductById,
  dbGetScannedProductsByDate,
  dbGetWorkoutsByDate,
  dbInsertMeal,
  dbInsertScannedProduct,
  dbInsertWorkout,
  dbSetDailyGoals,
  getDatabase,
  invalidateActivityDatesCache,
} from '../client';
import { runAsyncStorageToSqliteMigration } from '../migration';
import {
  cleanupOrphanImages,
  deletePersistedImage,
  getFullImageUri,
  resetVirtualImageStore,
  resolveImageUri,
  saveImageToDocuments,
} from '../../utils/imageManager';
import { safeAsyncStorage } from '../../utils/storage';
import { MealLog, ScannedProduct, WorkoutSession } from '../../types';

describe('SQLite Data Layer & Repository Tests', () => {
  beforeEach(async () => {
    const db = await getDatabase();
    await db.execAsync(`
      DELETE FROM sets;
      DELETE FROM exercises;
      DELETE FROM workout_sessions;
      DELETE FROM meals;
      DELETE FROM scanned_products;
      DELETE FROM daily_goals;
      DELETE FROM migrations_meta;
    `);
    invalidateActivityDatesCache();
  });

  it('initializes tables and indexes correctly', async () => {
    const db = await getDatabase();
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('meals');
    expect(tableNames).toContain('workout_sessions');
    expect(tableNames).toContain('exercises');
    expect(tableNames).toContain('sets');
    expect(tableNames).toContain('scanned_products');
    expect(tableNames).toContain('daily_goals');
    expect(tableNames).toContain('migrations_meta');

    const indexes = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index'"
    );
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('meals_date_idx');
    expect(indexNames).toContain('workout_sessions_date_idx');
    expect(indexNames).toContain('scanned_products_date_idx');
  });

  it('performs CRUD on meals with date indexing', async () => {
    const meal1: MealLog = {
      id: 'meal_1',
      date: '2026-05-10',
      dishName: 'Chicken Rice Bowl',
      timestamp: '2026-05-10T12:30:00Z',
      calories: 650,
      protein: 45,
      carbs: 70,
      fat: 15,
      estimatedWeightGrams: 400,
      portionMultiplier: 1.0,
      imageUri: 'betteryou_images/meals/bowl.jpg',
      ingredientsDetected: ['Chicken breast', 'White rice', 'Olive oil'],
      notes: 'Post workout lunch',
    };

    const meal2: MealLog = {
      id: 'meal_2',
      date: '2026-05-11',
      dishName: 'Oatmeal & Protein',
      timestamp: '2026-05-11T08:00:00Z',
      calories: 450,
      protein: 30,
      carbs: 60,
      fat: 8,
      estimatedWeightGrams: 300,
      portionMultiplier: 1.0,
      ingredientsDetected: ['Oats', 'Whey', 'Almond milk'],
    };

    await dbInsertMeal(meal1);
    await dbInsertMeal(meal2);

    const allMeals = await dbGetAllMeals();
    expect(allMeals.length).toBe(2);

    // Test indexed query by date
    const may10Meals = await dbGetMealsByDate('2026-05-10');
    expect(may10Meals.length).toBe(1);
    expect(may10Meals[0].dishName).toBe('Chicken Rice Bowl');
    expect(may10Meals[0].date).toBe('2026-05-10');
    expect(may10Meals[0].imageUri).toBe('betteryou_images/meals/bowl.jpg');
    expect(may10Meals[0].ingredientsDetected).toEqual(['Chicken breast', 'White rice', 'Olive oil']);

    const may11Meals = await dbGetMealsByDate('2026-05-11');
    expect(may11Meals.length).toBe(1);
    expect(may11Meals[0].dishName).toBe('Oatmeal & Protein');

    // Delete meal
    await dbDeleteMeal('meal_1');
    const remaining = await dbGetAllMeals();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('meal_2');
  });

  it('inserts workouts with nested exercises and sets, and handles cascade delete', async () => {
    const workout: WorkoutSession = {
      id: 'w_push_1',
      title: 'Push Day Hypertrophy',
      startedAt: '2026-05-12T17:00:00Z',
      completedAt: '2026-05-12T18:10:00Z',
      durationSeconds: 4200,
      totalVolumeKg: 3200,
      exercises: [
        {
          id: 'ex_bench',
          name: 'Barbell Bench Press',
          sets: [
            { id: 's1', setNumber: 1, weightKg: 80, reps: 10, completed: true },
            { id: 's2', setNumber: 2, weightKg: 85, reps: 8, completed: true },
            { id: 's3', setNumber: 3, weightKg: 90, reps: 6, completed: true },
          ],
        },
        {
          id: 'ex_incline',
          name: 'Incline DB Press',
          sets: [
            { id: 's4', setNumber: 1, weightKg: 28, reps: 10, completed: true },
          ],
        },
      ],
    };

    await dbInsertWorkout(workout);

    const retrieved = await dbGetAllWorkouts();
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('w_push_1');
    expect(retrieved[0].title).toBe('Push Day Hypertrophy');
    expect(retrieved[0].exercises.length).toBe(2);
    expect(retrieved[0].exercises[0].name).toBe('Barbell Bench Press');
    expect(retrieved[0].exercises[0].sets.length).toBe(3);
    expect(retrieved[0].exercises[0].sets[0].weightKg).toBe(80);
    expect(retrieved[0].exercises[0].sets[0].completed).toBe(true);

    // Query by date
    const byDate = await dbGetWorkoutsByDate('2026-05-12');
    expect(byDate.length).toBe(1);

    // Verify cascade deletion
    const db = await getDatabase();
    await dbDeleteWorkout('w_push_1');

    const remainingWorkouts = await dbGetAllWorkouts();
    expect(remainingWorkouts.length).toBe(0);

    const remainingExercises = await db.getAllAsync('SELECT * FROM exercises WHERE workout_id = ?', ['w_push_1']);
    expect(remainingExercises.length).toBe(0);

    const remainingSets = await db.getAllAsync('SELECT * FROM sets WHERE exercise_id = ?', ['ex_bench']);
    expect(remainingSets.length).toBe(0);
  });

  it('stores and retrieves scanned products with full reports', async () => {
    const product: ScannedProduct = {
      id: 'scan_1',
      barcode: '8901234567890',
      productName: 'Roasted Masala Peanuts',
      scannedAt: '2026-05-12T14:15:00Z',
      imageUrl: 'betteryou_images/products/peanuts.jpg',
      report: {
        productName: 'Roasted Masala Peanuts',
        category: 'Food & Beverages',
        overallSafetyScore: 78,
        riskLevel: 'Moderate',
        cleanSummary: 'Contains permitted preservatives and food color.',
        harmfulIngredients: [
          {
            name: 'INS 102',
            category: 'Azo Dye',
            severity: 'moderate',
            healthImpact: 'Synthetic azo dye linked to hyperactivity.',
          },
        ],
        safeFor: ['High Protein', 'Gluten Free'],
        novaGroup: 4,
        nutriscoreGrade: 'c',
        generatedBy: 'cloud-proxy-gemini-vision',
      },
    };

    await dbInsertScannedProduct(product);

    const allProducts = await dbGetAllScannedProducts();
    expect(allProducts.length).toBe(1);
    expect(allProducts[0].productName).toBe('Roasted Masala Peanuts');
    expect(allProducts[0].report.overallSafetyScore).toBe(78);
    expect(allProducts[0].report.harmfulIngredients.length).toBe(1);
    expect(allProducts[0].report.harmfulIngredients[0].name).toBe('INS 102');

    const byDate = await dbGetScannedProductsByDate('2026-05-12');
    expect(byDate.length).toBe(1);

    const originalParse = JSON.parse;
    let reportParses = 0;
    JSON.parse = ((text: string, reviver?: (key: string, value: unknown) => unknown) => {
      if (text.includes('INS 102')) reportParses += 1;
      return originalParse(text, reviver);
    }) as typeof JSON.parse;
    try {
      const summaries = await dbGetProductSummaries(3);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].reportComplete).toBe(false);
      expect(summaries[0].report.overallSafetyScore).toBe(78);
      expect(summaries[0].report.harmfulIngredients).toEqual([]);
      expect(summaries[0].flaggedCount).toBe(1);
      expect(reportParses).toBe(0);

      const opened = await dbGetScannedProductById('scan_1');
      expect(opened?.reportComplete).toBe(true);
      expect(opened?.report.harmfulIngredients[0].name).toBe('INS 102');
      expect(reportParses).toBe(1);
    } finally {
      JSON.parse = originalParse;
    }

    await dbDeleteScannedProduct('scan_1');
    const remaining = await dbGetAllScannedProducts();
    expect(remaining.length).toBe(0);
  });

  it('manages daily goals persistence correctly', async () => {
    const defaultGoals = await dbGetDailyGoals();
    expect(defaultGoals.calorieTarget).toBe(2200);

    const updated = await dbSetDailyGoals({
      calorieTarget: 2500,
      proteinTargetGrams: 180,
    });

    expect(updated.calorieTarget).toBe(2500);
    expect(updated.proteinTargetGrams).toBe(180);
    expect(updated.carbsTargetGrams).toBe(220); // Preserved unchanged

    const refreshed = await dbGetDailyGoals();
    expect(refreshed.calorieTarget).toBe(2500);
    expect(refreshed.proteinTargetGrams).toBe(180);
  });
});

describe('One-Time Idempotent Resumable Migration', () => {
  const LEGACY_STORAGE_KEY = 'betteryou-fitness-storage';

  beforeEach(async () => {
    const db = await getDatabase();
    await db.execAsync(`
      DELETE FROM sets;
      DELETE FROM exercises;
      DELETE FROM workout_sessions;
      DELETE FROM meals;
      DELETE FROM scanned_products;
      DELETE FROM daily_goals;
      DELETE FROM migrations_meta;
    `);
    await safeAsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  });

  it('returns no_legacy_data if storage is clean', async () => {
    const result = await runAsyncStorageToSqliteMigration();
    expect(result.status).toBe('no_legacy_data');
  });

  it('migrates legacy JSON blob, verifies count, and deletes old key', async () => {
    const legacyPayload = {
      state: {
        meals: [
          {
            id: 'legacy_m1',
            date: '2026-04-01',
            dishName: 'Paneer Bhurji',
            timestamp: '2026-04-01T13:00:00Z',
            calories: 380,
            protein: 24,
            carbs: 12,
            fat: 26,
            estimatedWeightGrams: 200,
            portionMultiplier: 1.0,
            ingredientsDetected: ['Paneer', 'Onion', 'Tomato'],
          },
        ],
        workouts: [
          {
            id: 'legacy_w1',
            title: 'Full Body A',
            startedAt: '2026-04-01T07:00:00Z',
            completedAt: '2026-04-01T08:00:00Z',
            durationSeconds: 3600,
            totalVolumeKg: 2000,
            exercises: [
              {
                id: 'ex_squat',
                name: 'Squat',
                sets: [{ id: 's1', setNumber: 1, weightKg: 100, reps: 5, completed: true }],
              },
            ],
          },
        ],
        scannedProducts: [],
        dailyGoals: {
          calorieTarget: 2100,
          proteinTargetGrams: 150,
          carbsTargetGrams: 200,
          fatTargetGrams: 60,
        },
      },
    };

    await safeAsyncStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyPayload));

    const migrationResult = await runAsyncStorageToSqliteMigration();
    expect(migrationResult.status).toBe('success');
    expect(migrationResult.mealsMigrated).toBe(1);
    expect(migrationResult.workoutsMigrated).toBe(1);

    // Verify SQLite contains the migrated records
    const meals = await dbGetAllMeals();
    expect(meals.length).toBe(1);
    expect(meals[0].dishName).toBe('Paneer Bhurji');

    const workouts = await dbGetAllWorkouts();
    expect(workouts.length).toBe(1);
    expect(workouts[0].exercises[0].name).toBe('Squat');

    const goals = await dbGetDailyGoals();
    expect(goals.calorieTarget).toBe(2100);

    // Verify old legacy key was deleted
    const oldKey = await safeAsyncStorage.getItem(LEGACY_STORAGE_KEY);
    expect(oldKey).toBeNull();

    // Verify running again is idempotent
    const repeatResult = await runAsyncStorageToSqliteMigration();
    expect(repeatResult.status).toBe('already_completed');
  });
});

describe('Image Manager & Orphan Cleanup Job', () => {
  beforeEach(() => {
    resetVirtualImageStore();
  });
  it('saves image relative paths and resolves them', async () => {
    const fakeUri = 'file:///cache/Camera/temp_123.jpg';
    const relativePath = await saveImageToDocuments(fakeUri, 'meals');

    expect(relativePath).toStartWith('betteryou_images/meals/meals_');
    expect(relativePath).toEndWith('.jpg');

    const fullUri = getFullImageUri(relativePath);
    expect(fullUri).not.toBeNull();
    expect(fullUri).toContain(relativePath);

    // Resolving null or empty path gracefully returns null
    expect(getFullImageUri('')).toBeNull();
    expect(getFullImageUri(null)).toBeNull();
    expect(await resolveImageUri(null)).toBeNull();
  });

  it('runs orphan cleanup and deletes unreferenced images', async () => {
    const rel1 = await saveImageToDocuments('file:///cache/img1.jpg', 'meals');
    await saveImageToDocuments('file:///cache/img2.jpg', 'meals'); // orphan
    const rel3 = await saveImageToDocuments('file:///cache/img3.jpg', 'products');

    // Keep rel1 and rel3; img2 should be pruned as an orphan
    const cleanupResult = await cleanupOrphanImages([rel1, rel3]);
    expect(cleanupResult.deleted).toBe(1);

    // Deleting an image explicitly
    await deletePersistedImage(rel1);
    const resolved = await resolveImageUri(rel1);
    expect(resolved).toBeNull();
  });
});
