import { safeAsyncStorage } from '../utils/storage';
import { getLocalDateString, getLocalDayDifference } from '../utils/date';
import {
  dbDeleteMeal,
  dbDeleteScannedProduct,
  dbDeleteWorkout,
  dbGetAllMealImagePaths,
  dbGetAllMeals,
  dbGetAllProductImagePaths,
  dbGetAllScannedProducts,
  dbGetAllWorkouts,
  dbGetDailyGoals,
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
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
  scannedProducts: ScannedProduct[];
  dailyGoals: DailyGoals;
  isInitialized: boolean;

  // Active Session / UI State
  activeWorkout: WorkoutSession | null;
  streakDays: number;
  lastActiveWorkoutDate?: string;

  // Lifecycle
  loadDataFromDb: () => Promise<void>;

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

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set, get) => ({
      meals: [],
      workouts: [],
      scannedProducts: [],
      dailyGoals: DEFAULT_GOALS,
      isInitialized: false,
      activeWorkout: null,
      streakDays: 0,
      lastActiveWorkoutDate: undefined,

      loadDataFromDb: async () => {
        try {
          await getDatabase();
          // Run one-time idempotent migration if legacy AsyncStorage data exists
          await runAsyncStorageToSqliteMigration();

          const [dbMeals, dbWorkouts, dbProducts, dbGoals] = await Promise.all([
            dbGetAllMeals(),
            dbGetAllWorkouts(),
            dbGetAllScannedProducts(),
            dbGetDailyGoals(),
          ]);

          set({
            meals: dbMeals,
            workouts: dbWorkouts,
            scannedProducts: dbProducts,
            dailyGoals: dbGoals,
            isInitialized: true,
          });

          // Run background orphan image cleanup job
          Promise.all([dbGetAllMealImagePaths(), dbGetAllProductImagePaths()])
            .then(([mealPaths, prodPaths]) => {
              cleanupOrphanImages([...mealPaths, ...prodPaths]).catch(() => {});
            })
            .catch(() => {});
        } catch (err: unknown) {
          console.warn('[fitnessStore] loadDataFromDb warning:', err);
        }
      },

      addMeal: async (mealData) => {
        let finalImageUri = mealData.imageUri;
        if (finalImageUri) {
          try {
            finalImageUri = await saveImageToDocuments(finalImageUri, 'meals');
          } catch {
            // Keep original URI if copy fails
          }
        }

        const newMeal = await dbInsertMeal({
          ...mealData,
          imageUri: finalImageUri,
        });

        set((state) => ({
          meals: [newMeal, ...state.meals].slice(0, 300),
        }));

        return newMeal;
      },

      removeMeal: async (id) => {
        const target = get().meals.find((m) => m.id === id);
        if (target?.imageUri) {
          deletePersistedImage(target.imageUri).catch(() => {});
        }
        await dbDeleteMeal(id);
        set((state) => ({
          meals: state.meals.filter((m) => m.id !== id),
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

        set((state) => ({
          activeWorkout: null,
          workouts: [completedWorkout, ...state.workouts].slice(0, 150),
          streakDays: newStreak,
          lastActiveWorkoutDate: todayStr,
        }));

        return completedWorkout;
      },

      cancelActiveWorkout: () => {
        set({ activeWorkout: null });
      },

      addWorkout: async (workout) => {
        await dbInsertWorkout(workout);
        set((state) => ({
          workouts: [workout, ...state.workouts].slice(0, 150),
        }));
      },

      removeWorkout: async (id) => {
        await dbDeleteWorkout(id);
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== id),
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
        };

        await dbInsertScannedProduct(newScanned);

        set((state) => ({
          scannedProducts: [newScanned, ...state.scannedProducts].slice(0, 100),
        }));
      },

      updateScannedProduct: async (id, updates) => {
        const current = get().scannedProducts.find((p) => p.id === id);
        if (!current) return;
        const updated: ScannedProduct = {
          ...current,
          ...updates,
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
        }));
      },

      clearAllData: async () => {
        const db = await getDatabase();
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
          scannedProducts: [],
          activeWorkout: null,
          dailyGoals: DEFAULT_GOALS,
          streakDays: 0,
          lastActiveWorkoutDate: undefined,
        });
      },
    }),
    {
      name: 'betteryou-active-workout-draft',
      storage: createJSONStorage(() => safeAsyncStorage),
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
