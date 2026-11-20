import { describe, expect, it, beforeEach, spyOn } from 'bun:test';
import {
  generateJsonBackup,
  importBackup,
  parseAndValidateBackup,
  CURRENT_BACKUP_VERSION,
  BackupPayload,
} from '../backupService';
import * as dbClient from '../../db/client';
import {
  dbGetAllMeals,
  dbGetAllScannedProducts,
  dbGetAllWorkouts,
  dbGetDailyGoals,
  dbInsertMeal,
  dbInsertScannedProduct,
  dbInsertWorkout,
  dbSetDailyGoals,
  getDatabase,
} from '../../db/client';
import { DailyGoals, MealLog, ScannedProduct, WorkoutSession } from '../../types';
import { useFitnessStore } from '../../store/useFitnessStore';
import { getLocalDateString } from '../../utils/date';

describe('Backup Validation & Atomic Restore Service', () => {
  beforeEach(async () => {
    const db = await getDatabase();
    await db.execAsync(`
      DELETE FROM meals;
      DELETE FROM sets;
      DELETE FROM exercises;
      DELETE FROM workout_sessions;
      DELETE FROM scanned_products;
    `);
  });

  const fixtureWorkouts: WorkoutSession[] = [
    {
      id: 'w_bench_001',
      date: '2026-11-10',
      title: 'Chest & Arms',
      startedAt: '2026-11-10T10:00:00.000Z',
      completedAt: '2026-11-10T11:00:00.000Z',
      durationSeconds: 3600,
      totalVolumeKg: 2400,
      notes: 'Strong bench press session',
      exercises: [
        {
          id: 'ex_bench',
          name: 'Barbell Bench Press',
          sets: [
            { id: 's_bench_1', setNumber: 1, weightKg: 80, reps: 10, completed: true },
            { id: 's_bench_2', setNumber: 2, weightKg: 85, reps: 8, completed: true },
          ],
        },
      ],
    },
  ];

  const fixtureMeals: MealLog[] = [
    {
      id: 'm_paneer_001',
      date: '2026-11-10',
      dishName: 'Paneer Butter Masala',
      timestamp: '2026-11-10T13:30:00.000Z',
      calories: 650,
      protein: 26,
      carbs: 48,
      fat: 38,
      estimatedWeightGrams: 350,
      portionMultiplier: 1.0,
      imageUri: 'meals/missing_photo_001.jpg', // missing file test
      thumbnailUri: 'meals/missing_thumb_001.jpg',
      ingredientsDetected: ['Paneer', 'Butter', 'Tomato'],
    },
  ];

  const fixtureProducts: ScannedProduct[] = [
    {
      id: 'prod_maggi_001',
      barcode: '8901058852394',
      productName: 'Maggi 2-Minute Noodles',
      scannedAt: '2026-11-10T15:00:00.000Z',
      imageUrl: 'scans/missing_maggi.jpg',
      reportComplete: true,
      report: {
        productName: 'Maggi 2-Minute Noodles',
        category: 'Food & Beverages',
        overallSafetyScore: 38,
        riskLevel: 'High Risk',
        harmfulIngredients: [
          { name: 'Palmolein', severity: 'moderate', category: 'Preservative', healthImpact: 'Inflammatory lipid' },
          { name: 'Flavor Enhancer 635', severity: 'moderate', category: 'Additive', healthImpact: 'Excitotoxin' },
        ],
        cleanSummary: 'Processed wheat flour with palm oil.',
      },
    },
  ];

  const fixtureGoals: DailyGoals = {
    calorieTarget: 2400,
    proteinTargetGrams: 180,
    carbsTargetGrams: 240,
    fatTargetGrams: 70,
  };

  describe('parseAndValidateBackup', () => {
    it('validates a correct version 1 backup JSON', () => {
      const jsonStr = generateJsonBackup(fixtureWorkouts, fixtureMeals, fixtureGoals, fixtureProducts);
      const res = parseAndValidateBackup(jsonStr);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.payload.version).toBe(CURRENT_BACKUP_VERSION);
        expect(res.payload.workouts.length).toBe(1);
        expect(res.payload.meals.length).toBe(1);
        expect(res.payload.scannedProducts?.length).toBe(1);
        expect(res.payload.dailyGoals?.calorieTarget).toBe(2400);
      }
    });

    it('gracefully rejects an empty file string', () => {
      const res = parseAndValidateBackup('');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('empty');
      }
    });

    it('gracefully rejects corrupt / invalid JSON', () => {
      const res = parseAndValidateBackup('{ corrupt json: true, [');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Invalid JSON file');
      }
    });

    it('rejects an unknown future backup version with a clear upgrade error', () => {
      const futurePayload = {
        version: 99,
        exportedAt: new Date().toISOString(),
        workouts: [],
        meals: [],
      };
      const res = parseAndValidateBackup(JSON.stringify(futurePayload));
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('newer, unsupported version of BetterYou');
        expect(res.error).toContain('version 99');
      }
    });

    it('rejects non-numeric or invalid version field', () => {
      const invalidVersion = {
        version: 'v1.0',
        exportedAt: new Date().toISOString(),
        workouts: [],
        meals: [],
      };
      const res = parseAndValidateBackup(JSON.stringify(invalidVersion));
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Invalid backup version');
      }
    });

    it('rejects malformed items inside meals or workouts', () => {
      const badWorkout = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: [{ id: 'bad', title: '', startedAt: '' }], // missing title
        meals: [],
      };
      const res = parseAndValidateBackup(JSON.stringify(badWorkout));
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('validation failed');
      }
    });
  });

  describe('importBackup round-trip and strategies', () => {
    it('round-trip: exports fixture dataset, wipes DB, imports with replace, and verifies data matches', async () => {
      const payload: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: fixtureWorkouts,
        meals: fixtureMeals,
        scannedProducts: fixtureProducts,
        dailyGoals: fixtureGoals,
      };

      const summary = await importBackup(payload, 'replace');

      expect(summary.strategy).toBe('replace');
      expect(summary.mealsImported).toBe(1);
      expect(summary.workoutsImported).toBe(1);
      expect(summary.productsImported).toBe(1);
      expect(summary.goalsUpdated).toBe(true);
      expect(summary.imagesIncluded).toBe(false);
      expect(summary.imageNotice).toContain('Photos and scans');

      // Verify DB contents
      const meals = await dbGetAllMeals();
      expect(meals.length).toBe(1);
      expect(meals[0].id).toBe('m_paneer_001');
      expect(meals[0].dishName).toBe('Paneer Butter Masala');
      expect(meals[0].imageUri).toBe('meals/missing_photo_001.jpg'); // Missing image handled gracefully

      const workouts = await dbGetAllWorkouts();
      expect(workouts.length).toBe(1);
      expect(workouts[0].id).toBe('w_bench_001');
      expect(workouts[0].exercises.length).toBe(1);
      expect(workouts[0].exercises[0].sets.length).toBe(2);
      expect(workouts[0].exercises[0].sets[0].weightKg).toBe(80);

      const products = await dbGetAllScannedProducts();
      expect(products.length).toBe(1);
      expect(products[0].id).toBe('prod_maggi_001');
      expect(products[0].report.overallSafetyScore).toBe(38);

      const goals = await dbGetDailyGoals();
      expect(goals.calorieTarget).toBe(2400);
      expect(goals.proteinTargetGrams).toBe(180);
    });

    it('merge strategy: keeps existing IDs and imports only new ones', async () => {
      // 1. Initial import of base fixture
      await importBackup(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          workouts: fixtureWorkouts,
          meals: fixtureMeals,
          scannedProducts: fixtureProducts,
          dailyGoals: fixtureGoals,
        },
        'replace'
      );

      // 2. Prepare payload with 1 duplicate meal and 1 new meal
      const secondPayload: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: fixtureWorkouts, // duplicate
        meals: [
          fixtureMeals[0], // duplicate
          {
            id: 'm_oats_002',
            date: '2026-11-11',
            dishName: 'Rolled Oats with Berries',
            timestamp: '2026-11-11T08:30:00.000Z',
            calories: 380,
            protein: 14,
            carbs: 62,
            fat: 7,
            estimatedWeightGrams: 280,
            portionMultiplier: 1.0,
            ingredientsDetected: ['Oats', 'Milk', 'Berries'],
          },
        ],
        scannedProducts: fixtureProducts, // duplicate
      };

      const mergeSummary = await importBackup(secondPayload, 'merge');
      expect(mergeSummary.strategy).toBe('merge');
      expect(mergeSummary.mealsImported).toBe(1); // Only the new meal
      expect(mergeSummary.workoutsImported).toBe(0); // Duplicate skipped
      expect(mergeSummary.productsImported).toBe(0); // Duplicate skipped

      const meals = await dbGetAllMeals();
      expect(meals.length).toBe(2);
      expect(meals.some((m) => m.id === 'm_oats_002')).toBe(true);
      expect(meals.some((m) => m.id === 'm_paneer_001')).toBe(true);
    });

    it('fault-injection: failure on 2nd workout rolls back REPLACE completely to pre-restore state', async () => {
      // 1. Seed initial pre-restore database state
      await dbInsertMeal(fixtureMeals[0]);
      await dbInsertWorkout(fixtureWorkouts[0]);
      await dbInsertScannedProduct(fixtureProducts[0]);
      await dbSetDailyGoals(fixtureGoals);

      // Verify baseline pre-restore state
      const preMeals = await dbGetAllMeals();
      const preWorkouts = await dbGetAllWorkouts();
      const preProducts = await dbGetAllScannedProducts();
      const preGoals = await dbGetDailyGoals();

      expect(preMeals.length).toBe(1);
      expect(preWorkouts.length).toBe(1);
      expect(preProducts.length).toBe(1);
      expect(preGoals.calorieTarget).toBe(2400);

      // 2. Prepare payload with 2 new meals and 2 new workouts
      const faultPayload: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        meals: [
          {
            id: 'm_fault_001',
            date: '2026-11-12',
            dishName: 'Fault Test Meal 1',
            timestamp: '2026-11-12T12:00:00.000Z',
            calories: 500,
            protein: 30,
            carbs: 40,
            fat: 20,
            estimatedWeightGrams: 300,
            portionMultiplier: 1.0,
            ingredientsDetected: [],
          },
        ],
        workouts: [
          {
            id: 'w_fault_001',
            date: '2026-11-12',
            title: 'Fault Workout 1',
            startedAt: '2026-11-12T10:00:00.000Z',
            durationSeconds: 1800,
            totalVolumeKg: 0,
            exercises: [],
          },
          {
            id: 'w_fault_002',
            date: '2026-11-12',
            title: 'Fault Workout 2 (Will Throw)',
            startedAt: '2026-11-12T11:00:00.000Z',
            durationSeconds: 1800,
            totalVolumeKg: 0,
            exercises: [],
          },
        ],
        scannedProducts: [],
      };

      // 3. Inject fault on 2nd workout insert
      let workoutInsertCount = 0;
      const originalDbInsertWorkout = dbClient.dbInsertWorkout;
      const spy = spyOn(dbClient, 'dbInsertWorkout').mockImplementation(async (w: WorkoutSession) => {
        workoutInsertCount++;
        if (workoutInsertCount === 2) {
          throw new Error('Simulated disk I/O failure on second workout');
        }
        return originalDbInsertWorkout(w);
      });

      try {
        await expect(importBackup(faultPayload, 'replace')).rejects.toThrow(
          /Backup restore failed and was completely rolled back/
        );
      } finally {
        spy.mockRestore();
      }

      // 4. Assert byte-for-byte / record-for-record preservation of pre-restore state
      const postMeals = await dbGetAllMeals();
      const postWorkouts = await dbGetAllWorkouts();
      const postProducts = await dbGetAllScannedProducts();
      const postGoals = await dbGetDailyGoals();

      // Counts must exactly match pre-restore
      expect(postMeals.length).toBe(1);
      expect(postWorkouts.length).toBe(1);
      expect(postProducts.length).toBe(1);

      // IDs must match pre-restore (neither replaced nor deleted)
      expect(postMeals[0].id).toBe(fixtureMeals[0].id);
      expect(postWorkouts[0].id).toBe(fixtureWorkouts[0].id);
      expect(postProducts[0].id).toBe(fixtureProducts[0].id);
      expect(postGoals.calorieTarget).toBe(preGoals.calorieTarget);
      expect(postGoals.proteinTargetGrams).toBe(preGoals.proteinTargetGrams);

      // Fault payload records must NOT exist in the database
      expect(postMeals.some((m) => m.id === 'm_fault_001')).toBe(false);
      expect(postWorkouts.some((w) => w.id === 'w_fault_001')).toBe(false);
      expect(postWorkouts.some((w) => w.id === 'w_fault_002')).toBe(false);
    });

    it('fault-injection: failure on 2nd workout rolls back MERGE completely to pre-restore state', async () => {
      // 1. Seed initial pre-restore database state
      await dbInsertMeal(fixtureMeals[0]);
      await dbInsertWorkout(fixtureWorkouts[0]);
      await dbInsertScannedProduct(fixtureProducts[0]);
      await dbSetDailyGoals(fixtureGoals);

      // 2. Prepare payload with 1 new meal and 2 new workouts
      const faultPayload: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        meals: [
          {
            id: 'm_merge_fault_001',
            date: '2026-11-13',
            dishName: 'Merge Fault Meal',
            timestamp: '2026-11-13T12:00:00.000Z',
            calories: 450,
            protein: 25,
            carbs: 50,
            fat: 15,
            estimatedWeightGrams: 300,
            portionMultiplier: 1.0,
            ingredientsDetected: [],
          },
        ],
        workouts: [
          {
            id: 'w_merge_fault_001',
            date: '2026-11-13',
            title: 'Merge Fault Workout 1',
            startedAt: '2026-11-13T10:00:00.000Z',
            durationSeconds: 1800,
            totalVolumeKg: 0,
            exercises: [],
          },
          {
            id: 'w_merge_fault_002',
            date: '2026-11-13',
            title: 'Merge Fault Workout 2 (Will Throw)',
            startedAt: '2026-11-13T11:00:00.000Z',
            durationSeconds: 1800,
            totalVolumeKg: 0,
            exercises: [],
          },
        ],
        scannedProducts: [],
      };

      // 3. Inject fault on 2nd workout insert
      let workoutInsertCount = 0;
      const originalDbInsertWorkout = dbClient.dbInsertWorkout;
      const spy = spyOn(dbClient, 'dbInsertWorkout').mockImplementation(async (w: WorkoutSession) => {
        workoutInsertCount++;
        if (workoutInsertCount === 2) {
          throw new Error('Simulated write abort on second workout during merge');
        }
        return originalDbInsertWorkout(w);
      });

      try {
        await expect(importBackup(faultPayload, 'merge')).rejects.toThrow(
          /Backup restore failed and was completely rolled back/
        );
      } finally {
        spy.mockRestore();
      }

      // 4. Assert byte-for-byte / record-for-record preservation of pre-restore state
      const postMeals = await dbGetAllMeals();
      const postWorkouts = await dbGetAllWorkouts();
      const postProducts = await dbGetAllScannedProducts();

      expect(postMeals.length).toBe(1);
      expect(postWorkouts.length).toBe(1);
      expect(postProducts.length).toBe(1);

      expect(postMeals[0].id).toBe(fixtureMeals[0].id);
      expect(postWorkouts[0].id).toBe(fixtureWorkouts[0].id);
      expect(postProducts[0].id).toBe(fixtureProducts[0].id);

      // New records from faultPayload must NOT have leaked into DB
      expect(postMeals.some((m) => m.id === 'm_merge_fault_001')).toBe(false);
      expect(postWorkouts.some((w) => w.id === 'w_merge_fault_001')).toBe(false);
    });

    it('post-restore UX: fitness store reloads from SQLite via refreshLoadedData without restart', async () => {
      // 1. Initial seed with current local date and load into Zustand store
      const testDate = getLocalDateString();
      useFitnessStore.setState({ dashboardDate: testDate });

      const initialMeal: MealLog = {
        ...fixtureMeals[0],
        date: testDate,
        timestamp: `${testDate}T12:00:00.000Z`,
      };
      const initialWorkout: WorkoutSession = {
        ...fixtureWorkouts[0],
        date: testDate,
        startedAt: `${testDate}T10:00:00.000Z`,
      };

      await dbInsertMeal(initialMeal);
      await dbInsertWorkout(initialWorkout);
      await useFitnessStore.getState().refreshLoadedData();

      const initialStoreMeals = useFitnessStore.getState().meals;
      expect(initialStoreMeals.length).toBe(1);
      expect(initialStoreMeals[0].id).toBe(initialMeal.id);

      // 2. Perform replace restore with fresh payload
      const restoredMealId = 'm_restored_post_ux_001';
      const restoredWorkoutId = 'w_restored_post_ux_001';
      const newPayload: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        meals: [
          {
            id: restoredMealId,
            date: testDate,
            dishName: 'Restored Biryani',
            timestamp: `${testDate}T12:00:00.000Z`,
            calories: 600,
            protein: 35,
            carbs: 65,
            fat: 20,
            estimatedWeightGrams: 350,
            portionMultiplier: 1.0,
            ingredientsDetected: ['Rice', 'Chicken', 'Spices'],
          },
        ],
        workouts: [
          {
            id: restoredWorkoutId,
            date: testDate,
            title: 'Restored Leg Day',
            startedAt: `${testDate}T09:00:00.000Z`,
            durationSeconds: 3600,
            totalVolumeKg: 1500,
            exercises: [],
          },
        ],
        scannedProducts: [],
      };

      const summary = await importBackup(newPayload, 'replace');
      expect(summary.strategy).toBe('replace');

      // 3. Invoke store reload (simulating Settings UI post-restore action)
      await useFitnessStore.getState().refreshLoadedData();

      // 4. Verify Dashboard store state immediately reflects restored data
      const updatedStore = useFitnessStore.getState();
      expect(updatedStore.meals.length).toBe(1);
      expect(updatedStore.meals[0].id).toBe(restoredMealId);
      expect(updatedStore.meals[0].dishName).toBe('Restored Biryani');
      expect(updatedStore.dashboardWorkouts.length).toBe(1);
      expect(updatedStore.dashboardWorkouts[0].id).toBe(restoredWorkoutId);
      expect(updatedStore.dashboardWorkouts[0].title).toBe('Restored Leg Day');

      // Clean up Zustand store state
      useFitnessStore.setState({
        meals: [],
        workouts: [],
        dashboardWorkouts: [],
        dashboardDate: getLocalDateString(),
      });
    });
  });
});
