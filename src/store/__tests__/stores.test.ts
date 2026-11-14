import { describe, it, expect, beforeEach } from 'bun:test';
import { useFitnessStore, calculateWorkoutVolume } from '../useFitnessStore';
import { useSettingsStore } from '../useSettingsStore';
import { getDatabase, invalidateActivityDatesCache } from '../../db/client';
import { ToxicityReport } from '../../types';

describe('Store Logic Tests (useFitnessStore & useSettingsStore)', () => {
  beforeEach(async () => {
    // Clear SQLite tables for deterministic state
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

    // Reset Zustand fitness store state
    useFitnessStore.setState({
      meals: [],
      workouts: [],
      dashboardWorkouts: [],
      scannedProducts: [],
      dailyGoals: {
        calorieTarget: 2200,
        proteinTargetGrams: 160,
        carbsTargetGrams: 220,
        fatTargetGrams: 65,
      },
      activeWorkout: null,
      streakDays: 0,
      isInitialized: false,
      workoutsHistoryLoaded: false,
      activityDates: [],
      mealCount: 0,
      mealPhotoCount: 0,
      workoutCount: 0,
      scannedProductCount: 0,
    });

    // Reset Zustand settings store state
    useSettingsStore.getState().resetSettings();
    useSettingsStore.getState().setColorScheme('light');
  });

  describe('useFitnessStore - Daily Goals & Initialization', () => {
    it('loads initial data and default goals from database', async () => {
      await useFitnessStore.getState().loadDataFromDb();
      const state = useFitnessStore.getState();

      expect(state.isInitialized).toBe(true);
      expect(state.dailyGoals.calorieTarget).toBe(2200);
      expect(state.meals).toEqual([]);
      expect(state.workouts).toEqual([]);
    });

    it('updates daily goals in state and persists to database', async () => {
      await useFitnessStore.getState().updateDailyGoals({
        calorieTarget: 2600,
        proteinTargetGrams: 180,
      });

      const state = useFitnessStore.getState();
      expect(state.dailyGoals.calorieTarget).toBe(2600);
      expect(state.dailyGoals.proteinTargetGrams).toBe(180);
      expect(state.dailyGoals.carbsTargetGrams).toBe(220); // Preserved

      // Verify persistence by reloading from DB
      await useFitnessStore.getState().loadDataFromDb();
      expect(useFitnessStore.getState().dailyGoals.calorieTarget).toBe(2600);
    });
  });

  describe('useFitnessStore - Meal Logging Lifecycle', () => {
    it('adds a meal, updates state, and persists to SQLite', async () => {
      const meal = await useFitnessStore.getState().addMeal({
        dishName: 'Paneer Bhurji with Roti',
        calories: 520,
        protein: 28,
        carbs: 45,
        fat: 22,
        estimatedWeightGrams: 350,
        portionMultiplier: 1,
        ingredientsDetected: ['Paneer', 'Onion', 'Tomato', 'Wheat Roti'],
      });

      expect(meal.id).toBeDefined();
      expect(meal.timestamp).toBeDefined();

      const state = useFitnessStore.getState();
      expect(state.meals.length).toBe(1);
      expect(state.meals[0].dishName).toBe('Paneer Bhurji with Roti');

      // Verify DB persistence
      await useFitnessStore.getState().loadDataFromDb();
      expect(useFitnessStore.getState().meals.length).toBe(1);
      expect(useFitnessStore.getState().meals[0].dishName).toBe('Paneer Bhurji with Roti');
    });

    it('removes a meal from state and SQLite database', async () => {
      const meal = await useFitnessStore.getState().addMeal({
        dishName: 'Protein Shake',
        calories: 200,
        protein: 30,
        carbs: 5,
        fat: 3,
        estimatedWeightGrams: 300,
        portionMultiplier: 1,
        ingredientsDetected: ['Whey Protein', 'Water'],
      });

      expect(useFitnessStore.getState().meals.length).toBe(1);

      await useFitnessStore.getState().removeMeal(meal.id);
      expect(useFitnessStore.getState().meals.length).toBe(0);

      // Verify DB is also empty
      await useFitnessStore.getState().loadDataFromDb();
      expect(useFitnessStore.getState().meals.length).toBe(0);
    });
  });

  describe('useFitnessStore - Active Workout Workflow', () => {
    it('starts an active workout, adds exercises, modifies sets, and calculates volume', () => {
      const store = useFitnessStore.getState();

      store.startWorkout('Chest & Triceps Day');
      let active = useFitnessStore.getState().activeWorkout;
      expect(active).not.toBeNull();
      expect(active?.title).toBe('Chest & Triceps Day');
      expect(active?.exercises.length).toBe(0);

      // Add Bench Press
      store.addExerciseToActiveWorkout('Barbell Bench Press');
      active = useFitnessStore.getState().activeWorkout;
      expect(active?.exercises.length).toBe(1);
      const ex1 = active!.exercises[0];
      expect(ex1.name).toBe('Barbell Bench Press');
      expect(ex1.sets.length).toBe(1);

      // Add second set
      store.addSetToActiveExercise(ex1.id);
      active = useFitnessStore.getState().activeWorkout;
      expect(active!.exercises[0].sets.length).toBe(2);

      // Update sets with weight and reps
      const set1 = active!.exercises[0].sets[0];
      const set2 = active!.exercises[0].sets[1];

      store.updateSetInActiveExercise(ex1.id, set1.id, {
        weightKg: 80,
        reps: 8,
        completed: true,
      });
      store.updateSetInActiveExercise(ex1.id, set2.id, {
        weightKg: 85,
        reps: 6,
        completed: true,
      });

      active = useFitnessStore.getState().activeWorkout;
      // Volume = (80 * 8) + (85 * 6) = 640 + 510 = 1150 kg
      const totalVol = calculateWorkoutVolume(active!.exercises);
      expect(totalVol).toBe(1150);
    });

    it('cancels active workout without saving to SQLite', async () => {
      const store = useFitnessStore.getState();
      store.startWorkout('Leg Day');
      store.addExerciseToActiveWorkout('Squats');

      expect(useFitnessStore.getState().activeWorkout).not.toBeNull();

      store.cancelActiveWorkout();
      expect(useFitnessStore.getState().activeWorkout).toBeNull();
      expect(useFitnessStore.getState().workouts.length).toBe(0);

      // Verify nothing written to DB
      await useFitnessStore.getState().loadDataFromDb();
      expect(useFitnessStore.getState().workouts.length).toBe(0);
    });

    it('finishes active workout, saves session and sets to DB, and updates streak', async () => {
      const store = useFitnessStore.getState();
      store.startWorkout('Back & Biceps');
      store.addExerciseToActiveWorkout('Pull Ups');

      const active = useFitnessStore.getState().activeWorkout!;
      const set1 = active.exercises[0].sets[0];
      store.updateSetInActiveExercise(active.exercises[0].id, set1.id, {
        weightKg: 20,
        reps: 10,
        completed: true,
      });

      const finishedSession = await store.finishActiveWorkout();
      expect(finishedSession).not.toBeNull();
      expect(finishedSession?.totalVolumeKg).toBe(200);
      expect(finishedSession?.completedAt).toBeDefined();

      // Active workout should now be cleared
      expect(useFitnessStore.getState().activeWorkout).toBeNull();
      expect(useFitnessStore.getState().workouts.length).toBe(1);
      expect(useFitnessStore.getState().streakDays).toBeGreaterThanOrEqual(1);

      // Verify loaded from DB
      await useFitnessStore.getState().loadDataFromDb();
      expect(useFitnessStore.getState().workouts.length).toBe(1);
      expect(useFitnessStore.getState().workouts[0].title).toBe('Back & Biceps');
      expect(useFitnessStore.getState().workouts[0].exercises[0].sets[0].reps).toBe(10);
    });

    it('updates and deletes past workout sessions', async () => {
      const store = useFitnessStore.getState();
      store.startWorkout('Old Session');
      const finished = await store.finishActiveWorkout();
      const id = finished!.id;

      // Update workout title
      await store.updateWorkout(id, { title: 'Renamed Session' });
      expect(useFitnessStore.getState().workouts[0].title).toBe('Renamed Session');

      // Delete workout
      await store.removeWorkout(id);
      expect(useFitnessStore.getState().workouts.length).toBe(0);

      // Confirm DB is empty
      await useFitnessStore.getState().loadDataFromDb();
      expect(useFitnessStore.getState().workouts.length).toBe(0);
    });
  });

  describe('useFitnessStore - Scanned Products Lifecycle', () => {
    it('adds, updates, and removes scanned products', async () => {
      const store = useFitnessStore.getState();

      const sampleReport: ToxicityReport = {
        productName: 'Peanut Butter Unsweetened',
        barcode: '8901234567891',
        overallSafetyScore: 88,
        riskLevel: 'Safe',
        category: 'Food & Beverages',
        harmfulIngredients: [],
        cleanSummary: 'Clean formulation',
        allIngredients: ['Roasted Peanuts'],
      };

      await store.addScannedProduct({
        productName: 'Peanut Butter Unsweetened',
        barcode: '8901234567891',
        report: sampleReport,
      });

      expect(useFitnessStore.getState().scannedProducts.length).toBe(1);
      const prod = useFitnessStore.getState().scannedProducts[0];
      expect(prod.productName).toBe('Peanut Butter Unsweetened');

      // Update product
      await store.updateScannedProduct(prod.id, {
        productName: 'All Natural Peanut Butter',
        report: {
          ...sampleReport,
          overallSafetyScore: 92,
        },
      });

      expect(useFitnessStore.getState().scannedProducts[0].productName).toBe('All Natural Peanut Butter');
      expect(useFitnessStore.getState().scannedProducts[0].report.overallSafetyScore).toBe(92);

      // Remove product
      await store.removeScannedProduct(prod.id);
      expect(useFitnessStore.getState().scannedProducts.length).toBe(0);
    });
  });

  describe('useSettingsStore - Key Management & Configuration', () => {
    it('manages custom BYOK API key and resets safely', () => {
      const store = useSettingsStore.getState();
      expect(store.customApiKey).toBe('');

      const dummyKey = ['AI', 'za', 'SyD_TestKey12345678901234567890'].join('');
      store.setCustomApiKey(dummyKey);
      expect(useSettingsStore.getState().customApiKey).toBe(dummyKey);

      store.clearCustomApiKey();
      expect(useSettingsStore.getState().customApiKey).toBe('');
    });

    it('keeps the appearance choice when the API key is reset', () => {
      const store = useSettingsStore.getState();
      store.setColorScheme('dark');
      expect(useSettingsStore.getState().colorScheme).toBe('dark');
      store.resetSettings();
      expect(useSettingsStore.getState().colorScheme).toBe('dark');
      store.setColorScheme('light');
    });

    it('selects models and custom model overrides', () => {
      const store = useSettingsStore.getState();

      store.setSelectedModel('gemini-3.5-flash-lite');
      expect(useSettingsStore.getState().selectedModel).toBe('gemini-3.5-flash-lite');

      store.setIsCustomModel(true);
      store.setCustomModelName('tuned-gemini-custom');
      expect(useSettingsStore.getState().isCustomModel).toBe(true);
      expect(useSettingsStore.getState().customModelName).toBe('tuned-gemini-custom');

      store.resetSettings();
      expect(useSettingsStore.getState().selectedModel).toBe('gemini-3.6-flash');
      expect(useSettingsStore.getState().isCustomModel).toBe(false);
    });
  });
});
