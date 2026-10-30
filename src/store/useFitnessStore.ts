import { safeAsyncStorage } from '../utils/storage';
import { getLocalDateString, getLocalDayDifference } from '../utils/date';
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
  // State
  meals: MealLog[];
  workouts: WorkoutSession[];
  scannedProducts: ScannedProduct[];
  dailyGoals: DailyGoals;
  activeWorkout: WorkoutSession | null;
  streakDays: number;
  lastActiveWorkoutDate?: string;

  // Meal Actions
  addMeal: (meal: Omit<MealLog, 'id' | 'timestamp'>) => void;
  removeMeal: (id: string) => void;

  // Goals Actions
  updateDailyGoals: (goals: Partial<DailyGoals>) => void;

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
  finishActiveWorkout: () => WorkoutSession | null;
  cancelActiveWorkout: () => void;
  addWorkout: (workout: WorkoutSession) => void;
  removeWorkout: (id: string) => void;

  // Scanned Products Actions
  addScannedProduct: (product: Omit<ScannedProduct, 'id' | 'scannedAt'>) => void;
  updateScannedProduct: (id: string, updates: Partial<Omit<ScannedProduct, 'id'>>) => void;
  removeScannedProduct: (id: string) => void;

  // Reset
  clearAllData: () => void;
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

/**
 * Safe AsyncStorage adapter that prevents crashes in headless CLI or SSR environments
 */

const ACTIVE_WORKOUT_STORAGE_KEY = 'betteryou-active-workout';

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set, get) => ({
      meals: [],
      workouts: [],
      scannedProducts: [],
      dailyGoals: DEFAULT_GOALS,
      activeWorkout: null,
      streakDays: 0,
      lastActiveWorkoutDate: undefined,

      addMeal: (mealData) => {
        const newMeal: MealLog = {
          ...mealData,
          id: `meal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          meals: [newMeal, ...state.meals].slice(0, 300),
        }));
      },

      removeMeal: (id) => {
        set((state) => ({
          meals: state.meals.filter((m) => m.id !== id),
        }));
      },

      updateDailyGoals: (goalsUpdate) => {
        set((state) => ({
          dailyGoals: {
            ...state.dailyGoals,
            ...goalsUpdate,
          },
        }));
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
          id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: exerciseName.trim(),
          sets: [
            {
              id: `set_${Date.now()}_1`,
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
          const nextSetNumber = ex.sets.length + 1;
          const lastSet = ex.sets[ex.sets.length - 1];
          const newSet: ExerciseSet = {
            id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${nextSetNumber}`,
            setNumber: nextSetNumber,
            weightKg: lastSet ? lastSet.weightKg : 20,
            reps: lastSet ? lastSet.reps : 10,
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
          const updatedSets = ex.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s));
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
          const filteredSets = ex.sets.filter((s) => s.id !== setId);
          // Renumber sets
          const renumbered = filteredSets.map((s, idx) => ({
            ...s,
            setNumber: idx + 1,
          }));
          return {
            ...ex,
            sets: renumbered,
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

      finishActiveWorkout: () => {
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
          // Already worked out today: streak remains steady
        } else {
          const diffDays = getLocalDayDifference(lastActive, todayStr);
          if (diffDays === 1) {
            newStreak += 1;
          } else {
            // Inactivity reset
            newStreak = 1;
          }
        }

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

      addWorkout: (workout) => {
        set((state) => ({
          workouts: [workout, ...state.workouts].slice(0, 150),
        }));
      },

      removeWorkout: (id) => {
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== id),
        }));
      },

      addScannedProduct: (productData) => {
        const newScanned: ScannedProduct = {
          ...productData,
          id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          scannedAt: new Date().toISOString(),
        };
        set((state) => ({
          scannedProducts: [newScanned, ...state.scannedProducts].slice(0, 100),
        }));
      },

      updateScannedProduct: (id, updates) => {
        set((state) => ({
          scannedProducts: state.scannedProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      removeScannedProduct: (id) => {
        set((state) => ({
          scannedProducts: state.scannedProducts.filter((p) => p.id !== id),
        }));
      },

      clearAllData: () => {
        safeAsyncStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
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
      name: 'betteryou-fitness-storage',
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state) => ({
        meals: state.meals,
        workouts: state.workouts,
        scannedProducts: state.scannedProducts,
        dailyGoals: state.dailyGoals,
        streakDays: state.streakDays,
        lastActiveWorkoutDate: state.lastActiveWorkoutDate,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Restore active workout from dedicated lightweight partition
        Promise.resolve(safeAsyncStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY)).then((stored) => {
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as WorkoutSession;
              if (parsed && parsed.id) {
                useFitnessStore.setState({ activeWorkout: parsed });
                return;
              }
            } catch {
              // Ignore invalid storage cache
            }
          }
          // Migration from legacy unified storage if active workout was present
          if (state.activeWorkout) {
            safeAsyncStorage.setItem(
              ACTIVE_WORKOUT_STORAGE_KEY,
              JSON.stringify(state.activeWorkout)
            );
          }
        });
      },
    }
  )
);

// Synchronize active workout mutations to the dedicated lightweight partition
// so high-frequency set/rep changes never re-serialize historical logs
let prevActiveWorkout = useFitnessStore.getState().activeWorkout;
useFitnessStore.subscribe((state) => {
  if (state.activeWorkout !== prevActiveWorkout) {
    prevActiveWorkout = state.activeWorkout;
    if (state.activeWorkout) {
      safeAsyncStorage.setItem(
        ACTIVE_WORKOUT_STORAGE_KEY,
        JSON.stringify(state.activeWorkout)
      );
    } else {
      safeAsyncStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    }
  }
});

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
