import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  dbDeleteBodyMeasurement,
  dbDeleteMeal,
  dbDeleteScannedProduct,
  dbDeleteWorkout,
  dbGetAllBodyMeasurements,
  dbGetAllWorkouts,
  dbGetActivityDates,
  dbGetMealsByDate,
  dbGetProductSummaries,
  dbGetScannedProductById,
  dbGetWorkoutsByDate,
  dbInsertBodyMeasurement,
  dbInsertMeal,
  dbInsertScannedProduct,
  dbInsertWorkout,
  dbSetDailyGoals,
  dbUpdateWorkout,
  getDatabase,
  invalidateActivityDatesCache,
} from '../db/client';
import {
  BodyMeasurement,
  ScannedProduct,
  WorkoutSession,
} from '../types';
import { getLocalDateString } from '../utils/date';
import {
  activeWorkoutPersistStorage,
  flushActiveWorkoutPersist,
} from '../utils/debouncedStorage';
import {
  deletePersistedImage,
  saveImageToDocuments,
} from '../utils/imageManager';
import {
  addExerciseToList,
  addSetToExerciseList,
  calculateNewStreak,
  calculateWorkoutVolume,
  fetchInitialFitnessData,
  fetchRefreshedFitnessData,
  getTodayMacroTotals,
  getWorkoutTemplateExercises,
  mergeProductRows,
  removeExerciseFromList,
  removeSetFromExerciseList,
  triggerOrphanImagesCleanup,
  updateSetInExerciseList,
  withDate,
} from './fitnessSyncHelpers';
import { DEFAULT_GOALS, FitnessState } from './fitnessTypes';

// Re-export helpers and types for backwards compatibility
export { calculateWorkoutVolume, getTodayMacroTotals };
export type { FitnessState };

let loadDataInFlight: Promise<void> | null = null;

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set, get) => ({
      meals: [],
      workouts: [],
      dashboardWorkouts: [],
      scannedProducts: [],
      dailyGoals: DEFAULT_GOALS,
      isInitialized: false,
      dashboardDate: getLocalDateString(),
      activityDates: [],
      mealCount: 0,
      mealPhotoCount: 0,
      workoutCount: 0,
      scannedProductCount: 0,
      workoutsHistoryLoaded: false,
      bodyMeasurements: [],
      activeWorkout: null,
      streakDays: 0,
      lastActiveWorkoutDate: undefined,

      loadDataFromDb: async () => {
        if (get().isInitialized) return;
        if (loadDataInFlight) return loadDataInFlight;

        loadDataInFlight = (async () => {
          try {
            const initialData = await fetchInitialFitnessData({
              dashboardDate: get().dashboardDate,
              workoutsHistoryLoaded: get().workoutsHistoryLoaded,
              existingScannedProducts: get().scannedProducts,
            });
            set(initialData);
            triggerOrphanImagesCleanup();
          } catch (err: unknown) {
            console.warn('[fitnessStore] loadDataFromDb warning:', err);
          } finally {
            loadDataInFlight = null;
          }
        })();

        return loadDataInFlight;
      },

      loadDashboardDate: async (date: string) => {
        const [meals, dayWorkouts, activityDates] = await Promise.all([
          dbGetMealsByDate(date),
          dbGetWorkoutsByDate(date),
          dbGetActivityDates(),
        ]);
        set({ dashboardDate: date, meals, dashboardWorkouts: dayWorkouts, activityDates });
      },

      loadWorkoutHistory: async () => {
        const workouts = await dbGetAllWorkouts();
        set({ workouts, workoutsHistoryLoaded: true });
      },

      loadAllProductSummaries: async () => {
        const summaries = await dbGetProductSummaries(100);
        set((state) => ({
          scannedProducts: mergeProductRows(summaries, state.scannedProducts),
        }));
      },

      loadScannedProductReport: async (id: string) => {
        const current = get().scannedProducts.find((product) => product.id === id);
        if (current?.reportComplete) return;
        const full = await dbGetScannedProductById(id);
        if (!full) return;
        set((state) => ({
          scannedProducts: state.scannedProducts.some((product) => product.id === id)
            ? state.scannedProducts.map((product) => (product.id === id ? full : product))
            : [full, ...state.scannedProducts],
        }));
      },

      refreshLoadedData: async () => {
        const refreshedData = await fetchRefreshedFitnessData({
          dashboardDate: get().dashboardDate,
          workoutsHistoryLoaded: get().workoutsHistoryLoaded,
          existingScannedProducts: get().scannedProducts,
          currentCounts: {
            mealCount: get().mealCount,
            mealPhotoCount: get().mealPhotoCount,
            workoutCount: get().workoutCount,
            scannedProductCount: get().scannedProductCount,
          },
        });
        set((state) => ({
          ...refreshedData,
          scannedProducts: mergeProductRows(
            refreshedData.scannedProducts ?? [],
            state.scannedProducts
          ),
        }));
      },

      addMeal: async (mealData) => {
        let finalImageUri = mealData.imageUri;
        let finalThumbnailUri = mealData.thumbnailUri;
        if (finalImageUri) {
          try {
            finalImageUri = await saveImageToDocuments(finalImageUri, 'meals');
          } catch {
            // Keep original URI if copy fails
          }
        }
        if (finalThumbnailUri) {
          try {
            finalThumbnailUri = await saveImageToDocuments(finalThumbnailUri, 'meals');
          } catch {
            finalThumbnailUri = undefined;
          }
        }

        const newMeal = await dbInsertMeal({
          ...mealData,
          imageUri: finalImageUri,
          thumbnailUri: finalThumbnailUri,
        });

        set((state) => {
          const mealDate = newMeal.date || getLocalDateString(newMeal.timestamp);
          const onDashboard = mealDate === state.dashboardDate;
          return {
            meals: onDashboard ? [newMeal, ...state.meals].slice(0, 300) : state.meals,
            mealCount: state.mealCount + 1,
            mealPhotoCount: state.mealPhotoCount + (newMeal.imageUri ? 1 : 0),
            activityDates: withDate(state.activityDates, mealDate),
          };
        });

        return newMeal;
      },

      removeMeal: async (id) => {
        const target = get().meals.find((m) => m.id === id);
        if (target?.imageUri) {
          deletePersistedImage(target.imageUri).catch(() => {});
        }
        if (target?.thumbnailUri) {
          deletePersistedImage(target.thumbnailUri).catch(() => {});
        }
        await dbDeleteMeal(id);
        set((state) => ({
          meals: state.meals.filter((m) => m.id !== id),
          mealCount: Math.max(0, state.mealCount - 1),
          mealPhotoCount: target?.imageUri ? Math.max(0, state.mealPhotoCount - 1) : state.mealPhotoCount,
        }));
      },

      updateDailyGoals: async (goalsUpdate) => {
        const updated = await dbSetDailyGoals(goalsUpdate);
        set({ dailyGoals: updated });
      },

      logBodyWeight: async (weightKg: number, note?: string, date?: string) => {
        const measurement: BodyMeasurement = {
          id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          date: date || getLocalDateString(),
          weightKg: Math.round(weightKg * 10) / 10,
          note,
          createdAt: Date.now(),
        };
        await dbInsertBodyMeasurement(measurement);
        set((state) => ({
          bodyMeasurements: [
            measurement,
            ...state.bodyMeasurements.filter((m) => m.id !== measurement.id),
          ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
        }));
      },

      deleteBodyMeasurement: async (id: string) => {
        await dbDeleteBodyMeasurement(id);
        set((state) => ({
          bodyMeasurements: state.bodyMeasurements.filter((m) => m.id !== id),
        }));
      },

      loadBodyMeasurements: async () => {
        const measurements = await dbGetAllBodyMeasurements();
        set({ bodyMeasurements: measurements });
      },

      startWorkout: (templateTitle = 'Custom Workout') => {
        const initialExercises = getWorkoutTemplateExercises(templateTitle);

        const newWorkout: WorkoutSession = {
          id: `workout_${Date.now()}`,
          title: templateTitle,
          startedAt: new Date().toISOString(),
          durationSeconds: 0,
          exercises: initialExercises,
          totalVolumeKg: 0,
        };

        set({ activeWorkout: newWorkout });
      },

      updateActiveWorkout: (workout) => {
        const totalVolumeKg = calculateWorkoutVolume(workout.exercises);
        set({
          activeWorkout: {
            ...workout,
            totalVolumeKg,
          },
        });
      },

      addExerciseToActiveWorkout: (exerciseName) => {
        const current = get().activeWorkout;
        if (!current) return;
        const updatedExercises = addExerciseToList(current.exercises, exerciseName);
        set({
          activeWorkout: {
            ...current,
            exercises: updatedExercises,
            totalVolumeKg: calculateWorkoutVolume(updatedExercises),
          },
        });
      },

      removeExerciseFromActiveWorkout: (exerciseId) => {
        const current = get().activeWorkout;
        if (!current) return;
        const updatedExercises = removeExerciseFromList(current.exercises, exerciseId);
        set({
          activeWorkout: {
            ...current,
            exercises: updatedExercises,
            totalVolumeKg: calculateWorkoutVolume(updatedExercises),
          },
        });
      },

      addSetToActiveExercise: (exerciseId) => {
        const current = get().activeWorkout;
        if (!current) return;
        const updatedExercises = addSetToExerciseList(current.exercises, exerciseId);
        set({
          activeWorkout: {
            ...current,
            exercises: updatedExercises,
            totalVolumeKg: calculateWorkoutVolume(updatedExercises),
          },
        });
      },

      updateSetInActiveExercise: (exerciseId, setId, updates) => {
        const current = get().activeWorkout;
        if (!current) return;
        const updatedExercises = updateSetInExerciseList(current.exercises, exerciseId, setId, updates);
        set({
          activeWorkout: {
            ...current,
            exercises: updatedExercises,
            totalVolumeKg: calculateWorkoutVolume(updatedExercises),
          },
        });
      },

      removeSetFromActiveExercise: (exerciseId, setId) => {
        const current = get().activeWorkout;
        if (!current) return;
        const updatedExercises = removeSetFromExerciseList(current.exercises, exerciseId, setId);
        set({
          activeWorkout: {
            ...current,
            exercises: updatedExercises,
            totalVolumeKg: calculateWorkoutVolume(updatedExercises),
          },
        });
      },

      finishActiveWorkout: async () => {
        const current = get().activeWorkout;
        if (!current) return null;

        const completedWorkout: WorkoutSession = {
          ...current,
          completedAt: new Date().toISOString(),
          totalVolumeKg: calculateWorkoutVolume(current.exercises),
        };

        const todayStr = getLocalDateString();
        const newStreak = calculateNewStreak(
          get().lastActiveWorkoutDate,
          todayStr,
          get().streakDays || 0
        );

        // Save to SQLite
        await dbInsertWorkout(completedWorkout);

        set((state) => {
          const sessionDate = getLocalDateString(
            completedWorkout.completedAt || completedWorkout.startedAt
          );
          const onDashboard = sessionDate === state.dashboardDate;
          const inHistory = state.workoutsHistoryLoaded || onDashboard;
          return {
            activeWorkout: null,
            workouts: inHistory
              ? [completedWorkout, ...state.workouts].slice(0, 150)
              : state.workouts,
            dashboardWorkouts: onDashboard
              ? [completedWorkout, ...state.dashboardWorkouts]
              : state.dashboardWorkouts,
            streakDays: newStreak,
            lastActiveWorkoutDate: todayStr,
            workoutCount: state.workoutCount + 1,
            activityDates: withDate(state.activityDates, sessionDate),
          };
        });

        await flushActiveWorkoutPersist();
        return completedWorkout;
      },

      cancelActiveWorkout: () => {
        set({ activeWorkout: null });
        void flushActiveWorkoutPersist();
      },

      addWorkout: async (workout) => {
        await dbInsertWorkout(workout);
        const sessionDate =
          workout.date ||
          getLocalDateString(workout.completedAt || workout.startedAt);
        set((state) => ({
          workouts: [workout, ...state.workouts].slice(0, 150),
          dashboardWorkouts:
            sessionDate === state.dashboardDate
              ? [workout, ...state.dashboardWorkouts]
              : state.dashboardWorkouts,
          workoutCount: state.workoutCount + 1,
          activityDates: withDate(state.activityDates, sessionDate),
        }));
      },

      updateWorkout: async (id, updates) => {
        await dbUpdateWorkout(id, updates);
        set((state) => ({
          workouts: state.workouts.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
          dashboardWorkouts: state.dashboardWorkouts.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        }));
      },

      removeWorkout: async (id) => {
        await dbDeleteWorkout(id);
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== id),
          dashboardWorkouts: state.dashboardWorkouts.filter((w) => w.id !== id),
          workoutCount: Math.max(0, state.workoutCount - 1),
        }));
      },

      addScannedProduct: async (productData) => {
        let finalImageUri = productData.imageUrl || productData.imageUri;
        if (finalImageUri) {
          try {
            finalImageUri = await saveImageToDocuments(
              finalImageUri,
              'products'
            );
          } catch {
            // Keep original
          }
        }

        const newScanned: ScannedProduct = {
          ...productData,
          imageUrl: finalImageUri,
          imageUri: finalImageUri,
          id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          scannedAt: new Date().toISOString(),
          reportComplete: true,
          flaggedCount: productData.report.harmfulIngredients.length,
        };

        await dbInsertScannedProduct(newScanned);

        set((state) => ({
          scannedProducts: [newScanned, ...state.scannedProducts].slice(0, 100),
          scannedProductCount: state.scannedProductCount + 1,
        }));
      },

      updateScannedProduct: async (id, updates) => {
        const current = get().scannedProducts.find((p) => p.id === id);
        if (!current) return;
        const updated: ScannedProduct = {
          ...current,
          ...updates,
          flaggedCount: updates.report
            ? updates.report.harmfulIngredients.length
            : current.flaggedCount,
        };
        await dbInsertScannedProduct(updated);
        set((state) => ({
          scannedProducts: state.scannedProducts.map((p) =>
            p.id === id ? updated : p
          ),
        }));
      },

      removeScannedProduct: async (id) => {
        const target = get().scannedProducts.find((p) => p.id === id);
        const img = target?.imageUrl || target?.imageUri;
        if (img) {
          deletePersistedImage(img).catch(() => {});
        }
        await dbDeleteScannedProduct(id);
        set((state) => ({
          scannedProducts: state.scannedProducts.filter((p) => p.id !== id),
          scannedProductCount: Math.max(0, state.scannedProductCount - 1),
        }));
      },

      clearAllData: async () => {
        const db = await getDatabase();
        invalidateActivityDatesCache();
        await db.execAsync(`
          DELETE FROM meals;
          DELETE FROM workout_sessions;
          DELETE FROM exercises;
          DELETE FROM sets;
          DELETE FROM scanned_products;
        `);

        set({
          meals: [],
          workouts: [],
          dashboardWorkouts: [],
          scannedProducts: [],
          activeWorkout: null,
          dailyGoals: DEFAULT_GOALS,
          streakDays: 0,
          lastActiveWorkoutDate: undefined,
          activityDates: [],
          mealCount: 0,
          mealPhotoCount: 0,
          workoutCount: 0,
          scannedProductCount: 0,
          workoutsHistoryLoaded: false,
          bodyMeasurements: [],
        });
      },
    }),
    {
      name: 'betteryou-active-workout-draft',
      storage: activeWorkoutPersistStorage,
      partialize: (state) => ({
        // ONLY persist lightweight UI session state: active draft workout and streak
        activeWorkout: state.activeWorkout,
        streakDays: state.streakDays,
        lastActiveWorkoutDate: state.lastActiveWorkoutDate,
      }),
      onRehydrateStorage: () => (state) => {
        // Automatically load normalized SQLite data upon app startup
        if (state) {
          state.loadDataFromDb().catch(() => {});
        }
      },
    }
  )
);
