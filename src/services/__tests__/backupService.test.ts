import { describe, expect, it, beforeEach } from 'bun:test';
import {
  generateJsonBackup,
  importBackup,
  parseAndValidateBackup,
  CURRENT_BACKUP_VERSION,
  BackupPayload,
} from '../backupService';
import {
  dbGetAllMeals,
  dbGetAllScannedProducts,
  dbGetAllWorkouts,
  dbGetDailyGoals,
  getDatabase,
} from '../../db/client';
import { DailyGoals, MealLog, ScannedProduct, WorkoutSession } from '../../types';

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
  });
});
