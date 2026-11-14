import { getLocalDateString, getLocalDayDifference } from '../utils/date';
import {
  dbDeleteMeal,
  dbDeleteScannedProduct,
  dbDeleteWorkout,
  dbUpdateWorkout,
  dbGetActivityDates,
  invalidateActivityDatesCache,
  dbGetAllMealImagePaths,
  dbGetAllProductImagePaths,
  dbGetAllWorkouts,
  dbGetDailyGoals,
  dbGetLibraryCounts,
  dbGetMealsByDate,
  dbGetProductSummaries,
  dbGetScannedProductById,
  dbGetWorkoutsByDate,
  dbInsertMeal,
  dbInsertScannedProduct,
  dbInsertWorkout,
  dbSetDailyGoals,
  getDatabase,
} from '../db/client';
import { runAsyncStorageToSqliteMigration } from '../db/migration';
import {
  cleanupOrphanImages,
  deletePersistedImage,
  saveImageToDocuments,
} from '../utils/imageManager';
import { activeWorkoutPersistStorage, flushActiveWorkoutPersist } from '../utils/debouncedStorage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DailyGoals,
  ExerciseItem,
  ExerciseSet,
  MacroBreakdown,
  MealLog,
  ScannedProduct,
  WorkoutSession,
} from '../types';

export interface FitnessState {
  // In-Memory Cached State (Populated from SQLite)
  meals: MealLog[];
  workouts: WorkoutSession[];
  dashboardWorkouts: WorkoutSession[];
  scannedProducts: ScannedProduct[];
  dailyGoals: DailyGoals;
  isInitialized: boolean;
  dashboardDate: string;
  activityDates: string[];
  mealCount: number;
  mealPhotoCount: number;
  workoutCount: number;
  scannedProductCount: number;
  workoutsHistoryLoaded: boolean;

  // Active Session / UI State
  activeWorkout: WorkoutSession | null;
  streakDays: number;
  lastActiveWorkoutDate?: string;

  // Lifecycle
  loadDataFromDb: () => Promise<void>;
  loadDashboardDate: (date: string) => Promise<void>;
  loadWorkoutHistory: () => Promise<void>;
  loadAllProductSummaries: () => Promise<void>;
  loadScannedProductReport: (id: string) => Promise<void>;
  refreshLoadedData: () => Promise<void>;

  // Meal Actions
  addMeal: (meal: Omit<MealLog, 'id' | 'timestamp'>) => Promise<MealLog>;
  removeMeal: (id: string) => Promise<void>;

  // Goals Actions
  updateDailyGoals: (goals: Partial<DailyGoals>) => Promise<void>;

  // Workout Actions
  startWorkout: (templateTitle?: string) => void;
  updateActiveWorkout: (workout: WorkoutSession) => void;
  addExerciseToActiveWorkout: (exerciseName: string) => void;
  removeExerciseFromActiveWorkout: (exerciseId: string) => void;
  addSetToActiveExercise: (exerciseId: string) => void;
  updateSetInActiveExercise: (
    exerciseId: string,
    setId: string,
    updates: Partial<ExerciseSet>
  ) => void;
  removeSetFromActiveExercise: (exerciseId: string, setId: string) => void;
  finishActiveWorkout: () => Promise<WorkoutSession | null>;
  cancelActiveWorkout: () => void;
  addWorkout: (workout: WorkoutSession) => Promise<void>;
  updateWorkout: (id: string, updates: Partial<WorkoutSession>) => Promise<void>;
  removeWorkout: (id: string) => Promise<void>;

  // Scanned Products Actions
  addScannedProduct: (product: Omit<ScannedProduct, 'id' | 'scannedAt'>) => Promise<void>;
  updateScannedProduct: (id: string, updates: Partial<Omit<ScannedProduct, 'id'>>) => Promise<void>;
  removeScannedProduct: (id: string) => Promise<void>;

  // Reset
  clearAllData: () => Promise<void>;
}

const DEFAULT_GOALS: DailyGoals = {
  calorieTarget: 2200,
  proteinTargetGrams: 160,
  carbsTargetGrams: 220,
  fatTargetGrams: 65,
};

/**
 * Calculates total volume in kg from completed sets: Sum(weightKg * reps)
 */
export function calculateWorkoutVolume(exercises: ExerciseItem[]): number {
  return exercises.reduce((exerciseSum, ex) => {
    const setsSum = ex.sets.reduce((setSum, set) => {
      if (set.completed && set.weightKg > 0 && set.reps > 0) {
        return setSum + set.weightKg * set.reps;
      }
      return setSum;
    }, 0);
    return exerciseSum + setsSum;
  }, 0);
}

function mergeProductRows(incoming: ScannedProduct[], existing: ScannedProduct[]): ScannedProduct[] {
  if (existing.length === 0) return incoming;
  return incoming.map((item) => {
    const prior = existing.find((product) => product.id === item.id && product.reportComplete);
    return prior ?? item;
  });
}

function withDate(dates: string[], date: string): string[] {
  return dates.includes(date) ? dates : [...dates, date];
}

let loadDataInFlight: Promise<void> | null = null;

function scheduleIdleTask(task: () => void): void {
  const isNative =
    typeof window !== 'undefined' ||
    Boolean((globalThis as Record<string, unknown>).nativeCallSyncHook);
  if (!isNative) {
    setTimeout(task, 0);
    return;
  }
  void import('react-native')
    .then((reactNative) => {
      const interactionManager = (
        reactNative as unknown as {
          InteractionManager?: {
            runAfterInteractions?: (task: () => void) => void;
          };
        }
      ).InteractionManager;
      if (interactionManager?.runAfterInteractions) {
        interactionManager.runAfterInteractions(task);
        return;
      }
      task();
    })
    .catch(() => {
      task();
    });
}

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
      activeWorkout: null,
      streakDays: 0,
      lastActiveWorkoutDate: undefined,

      loadDataFromDb: async () => {
        if (get().isInitialized) return;
        if (loadDataInFlight) return loadDataInFlight;

        loadDataInFlight = (async () => {
          try {
            await getDatabase();
            await runAsyncStorageToSqliteMigration();
            const date = get().dashboardDate || getLocalDateString();
            const [meals, dayWorkouts, summaries, goals, activityDates, counts] = await Promise.all([
              dbGetMealsByDate(date),
              dbGetWorkoutsByDate(date),
              dbGetProductSummaries(3),
              dbGetDailyGoals(),
              dbGetActivityDates(),
              dbGetLibraryCounts().catch(() => null),
            ]);
            const history = get().workoutsHistoryLoaded ? await dbGetAllWorkouts() : dayWorkouts;

            set({
              meals,
              dashboardWorkouts: dayWorkouts,
              workouts: history,
              scannedProducts: mergeProductRows(summaries, get().scannedProducts),
              dailyGoals: goals,
              activityDates,
              dashboardDate: date,
              mealCount: counts?.meals ?? meals.length,
              mealPhotoCount: counts?.mealsWithPhotos ?? meals.filter((meal) => Boolean(meal.imageUri)).length,
              workoutCount: counts?.workouts ?? history.length,
              scannedProductCount: counts?.products ?? summaries.length,
              isInitialized: true,
            });

            scheduleIdleTask(() => {
              Promise.all([dbGetAllMealImagePaths(), dbGetAllProductImagePaths()])
                .then(([mealPaths, prodPaths]) => {
                  cleanupOrphanImages([...mealPaths, ...prodPaths]).catch(() => {});
                })
                .catch(() => {});
            });
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
        const date = get().dashboardDate || getLocalDateString();
        const productLimit = get().scannedProducts.length > 3 ? 100 : 3;
        const [meals, dayWorkouts, summaries, activityDates, counts] = await Promise.all([
          dbGetMealsByDate(date),
          dbGetWorkoutsByDate(date),
          dbGetProductSummaries(productLimit),
          dbGetActivityDates(),
          dbGetLibraryCounts().catch(() => null),
        ]);
        const history = get().workoutsHistoryLoaded ? await dbGetAllWorkouts() : dayWorkouts;
        set((state) => ({
          meals,
          dashboardWorkouts: dayWorkouts,
          workouts: history,
          scannedProducts: mergeProductRows(summaries, state.scannedProducts),
          activityDates,
          dashboardDate: date,
          mealCount: counts?.meals ?? state.mealCount,
          mealPhotoCount: counts?.mealsWithPhotos ?? state.mealPhotoCount,
          workoutCount: counts?.workouts ?? state.workoutCount,
          scannedProductCount: counts?.products ?? state.scannedProductCount,
          isInitialized: true,
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

      startWorkout: (templateTitle = 'Custom Workout') => {
        let initialExercises: ExerciseItem[] = [];

        if (templateTitle === 'Push Day') {
          initialExercises = [
            {
              id: 'ex_bench',
              name: 'Barbell Bench Press',
              sets: [
                { id: 's1', setNumber: 1, weightKg: 60, reps: 10, completed: false },
                { id: 's2', setNumber: 2, weightKg: 70, reps: 8, completed: false },
                { id: 's3', setNumber: 3, weightKg: 75, reps: 6, completed: false },
              ],
            },
            {
              id: 'ex_incline_db',
              name: 'Incline Dumbbell Press',
              sets: [
                { id: 's4', setNumber: 1, weightKg: 24, reps: 10, completed: false },
                { id: 's5', setNumber: 2, weightKg: 26, reps: 8, completed: false },
              ],
            },
            {
              id: 'ex_overhead_tri',
              name: 'Cable Overhead Tricep Extension',
              sets: [
                { id: 's6', setNumber: 1, weightKg: 25, reps: 12, completed: false },
                { id: 's7', setNumber: 2, weightKg: 30, reps: 10, completed: false },
              ],
            },
          ];
        } else if (templateTitle === 'Pull Day') {
          initialExercises = [
            {
              id: 'ex_deadlift',
              name: 'Conventional Deadlift',
              sets: [
                { id: 's1', setNumber: 1, weightKg: 100, reps: 5, completed: false },
                { id: 's2', setNumber: 2, weightKg: 120, reps: 5, completed: false },
                { id: 's3', setNumber: 3, weightKg: 130, reps: 3, completed: false },
              ],
            },
            {
              id: 'ex_lat_pulldown',
              name: 'Lat Pulldown',
              sets: [
                { id: 's4', setNumber: 1, weightKg: 55, reps: 10, completed: false },
                { id: 's5', setNumber: 2, weightKg: 60, reps: 8, completed: false },
              ],
            },
            {
              id: 'ex_bicep_curl',
              name: 'Dumbbell Bicep Curls',
              sets: [
                { id: 's6', setNumber: 1, weightKg: 14, reps: 12, completed: false },
                { id: 's7', setNumber: 2, weightKg: 16, reps: 10, completed: false },
              ],
            },
          ];
        } else if (templateTitle === 'Leg Day') {
          initialExercises = [
            {
              id: 'ex_squat',
              name: 'Barbell Back Squat',
              sets: [
                { id: 's1', setNumber: 1, weightKg: 80, reps: 8, completed: false },
                { id: 's2', setNumber: 2, weightKg: 90, reps: 8, completed: false },
                { id: 's3', setNumber: 3, weightKg: 100, reps: 6, completed: false },
              ],
            },
            {
              id: 'ex_leg_press',
              name: 'Leg Press',
              sets: [
                { id: 's4', setNumber: 1, weightKg: 160, reps: 12, completed: false },
                { id: 's5', setNumber: 2, weightKg: 180, reps: 10, completed: false },
              ],
            },
            {
              id: 'ex_calves',
              name: 'Standing Calf Raises',
              sets: [
                { id: 's6', setNumber: 1, weightKg: 50, reps: 15, completed: false },
                { id: 's7', setNumber: 2, weightKg: 50, reps: 15, completed: false },
              ],
            },
          ];
        }

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

        const newExercise: ExerciseItem = {
          id: `ex_${Date.now()}`,
          name: exerciseName.trim() || 'Exercise',
          sets: [
            {
              id: `s_${Date.now()}_1`,
              setNumber: 1,
              weightKg: 20,
              reps: 10,
              completed: false,
            },
          ],
        };

        const updatedExercises = [...current.exercises, newExercise];
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

        const updatedExercises = current.exercises.filter((e) => e.id !== exerciseId);
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

        const updatedExercises = current.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;

          const lastSet = ex.sets[ex.sets.length - 1];
          const newSetNumber = ex.sets.length + 1;
          const defaultWeight = lastSet ? lastSet.weightKg : 20;
          const defaultReps = lastSet ? lastSet.reps : 10;

          const newSet: ExerciseSet = {
            id: `s_${Date.now()}_${newSetNumber}`,
            setNumber: newSetNumber,
            weightKg: defaultWeight,
            reps: defaultReps,
            completed: false,
          };

          return {
            ...ex,
            sets: [...ex.sets, newSet],
          };
        });

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

        const updatedExercises = current.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;

          const updatedSets = ex.sets.map((s) => {
            if (s.id !== setId) return s;
            return {
              ...s,
              ...updates,
            };
          });

          return {
            ...ex,
            sets: updatedSets,
          };
        });

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

        const updatedExercises = current.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;

          const remainingSets = ex.sets
            .filter((s) => s.id !== setId)
            .map((s, idx) => ({ ...s, setNumber: idx + 1 }));

          return {
            ...ex,
            sets: remainingSets,
          };
        });

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
        const lastActive = get().lastActiveWorkoutDate;
        let newStreak = get().streakDays || 0;

        if (!lastActive) {
          newStreak = 1;
        } else if (lastActive === todayStr) {
          // Already worked out today: streak steady
        } else {
          const diffDays = getLocalDayDifference(lastActive, todayStr);
          if (diffDays === 1) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        }

        // Save to SQLite
        await dbInsertWorkout(completedWorkout);

        set((state) => {
          const sessionDate = getLocalDateString(completedWorkout.completedAt || completedWorkout.startedAt);
          const onDashboard = sessionDate === state.dashboardDate;
          const inHistory = state.workoutsHistoryLoaded || onDashboard;
          return {
            activeWorkout: null,
            workouts: inHistory ? [completedWorkout, ...state.workouts].slice(0, 150) : state.workouts,
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
        const sessionDate = workout.date || getLocalDateString(workout.completedAt || workout.startedAt);
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
          workouts: state.workouts.map((w) => (w.id === id ? { ...w, ...updates } : w)),
          dashboardWorkouts: state.dashboardWorkouts.map((w) => (w.id === id ? { ...w, ...updates } : w)),
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
            finalImageUri = await saveImageToDocuments(finalImageUri, 'products');
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
          scannedProducts: state.scannedProducts.map((p) => (p.id === id ? updated : p)),
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

/**
 * Helper selector to compute total daily macros from meals logged today
 */
export function getTodayMacroTotals(meals: MealLog[]): MacroBreakdown {
  const todayStr = getLocalDateString();

  return meals
    .filter((meal) => {
      try {
        return getLocalDateString(meal.timestamp) === todayStr;
      } catch {
        return false;
      }
    })
    .reduce<MacroBreakdown>(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}
