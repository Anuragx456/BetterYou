import {
  dbGetActivityDates,
  dbGetAllBodyMeasurements,
  dbGetAllMealImagePaths,
  dbGetAllProductImagePaths,
  dbGetAllWorkouts,
  dbGetDailyGoals,
  dbGetLibraryCounts,
  dbGetMealsByDate,
  dbGetProductSummaries,
  dbGetWorkoutsByDate,
  getDatabase,
} from '../db/client';
import { runAsyncStorageToSqliteMigration } from '../db/migration';
import {
  BodyMeasurement,
  DailyGoals,
  ExerciseItem,
  ExerciseSet,
  MacroBreakdown,
  MealLog,
  ScannedProduct,
  WorkoutSession,
} from '../types';
import { getLocalDateString, getLocalDayDifference } from '../utils/date';
import { cleanupOrphanImages } from '../utils/imageManager';

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

export function mergeProductRows(
  incoming: ScannedProduct[],
  existing: ScannedProduct[]
): ScannedProduct[] {
  if (existing.length === 0) return incoming;
  return incoming.map((item) => {
    const prior = existing.find(
      (product) => product.id === item.id && product.reportComplete
    );
    return prior ?? item;
  });
}

export function withDate(dates: string[], date: string): string[] {
  return dates.includes(date) ? dates : [...dates, date];
}

export function scheduleIdleTask(task: () => void): void {
  setTimeout(task, 1000);
}

export function triggerOrphanImagesCleanup(): void {
  scheduleIdleTask(() => {
    Promise.all([dbGetAllMealImagePaths(), dbGetAllProductImagePaths()])
      .then(([mealPaths, prodPaths]) => {
        cleanupOrphanImages([...mealPaths, ...prodPaths]).catch(() => {});
      })
      .catch(() => {});
  });
}

export function getWorkoutTemplateExercises(templateTitle?: string): ExerciseItem[] {
  if (templateTitle === 'Push Day') {
    return [
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
    return [
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
    return [
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
  return [];
}

export function addExerciseToList(
  exercises: ExerciseItem[],
  exerciseName: string
): ExerciseItem[] {
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
  return [...exercises, newExercise];
}

export function removeExerciseFromList(
  exercises: ExerciseItem[],
  exerciseId: string
): ExerciseItem[] {
  return exercises.filter((e) => e.id !== exerciseId);
}

export function addSetToExerciseList(
  exercises: ExerciseItem[],
  exerciseId: string
): ExerciseItem[] {
  return exercises.map((ex) => {
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
}

export function updateSetInExerciseList(
  exercises: ExerciseItem[],
  exerciseId: string,
  setId: string,
  updates: Partial<ExerciseSet>
): ExerciseItem[] {
  return exercises.map((ex) => {
    if (ex.id !== exerciseId) return ex;
    const updatedSets = ex.sets.map((s) => {
      if (s.id !== setId) return s;
      return { ...s, ...updates };
    });
    return { ...ex, sets: updatedSets };
  });
}

export function removeSetFromExerciseList(
  exercises: ExerciseItem[],
  exerciseId: string,
  setId: string
): ExerciseItem[] {
  return exercises.map((ex) => {
    if (ex.id !== exerciseId) return ex;
    const remainingSets = ex.sets
      .filter((s) => s.id !== setId)
      .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    return { ...ex, sets: remainingSets };
  });
}

export function calculateNewStreak(
  lastActiveWorkoutDate: string | undefined,
  todayStr: string,
  currentStreak: number
): number {
  if (!lastActiveWorkoutDate) {
    return 1;
  }
  if (lastActiveWorkoutDate === todayStr) {
    return currentStreak;
  }
  const diffDays = getLocalDayDifference(lastActiveWorkoutDate, todayStr);
  return diffDays === 1 ? currentStreak + 1 : 1;
}

export interface HydratedDbState {
  meals: MealLog[];
  dashboardWorkouts: WorkoutSession[];
  workouts: WorkoutSession[];
  scannedProducts: ScannedProduct[];
  dailyGoals: DailyGoals;
  activityDates: string[];
  dashboardDate: string;
  bodyMeasurements: BodyMeasurement[];
  mealCount: number;
  mealPhotoCount: number;
  workoutCount: number;
  scannedProductCount: number;
  isInitialized: boolean;
}

export async function fetchInitialFitnessData(params: {
  dashboardDate: string;
  workoutsHistoryLoaded: boolean;
  existingScannedProducts: ScannedProduct[];
}): Promise<HydratedDbState> {
  await getDatabase();
  await runAsyncStorageToSqliteMigration();
  const date = params.dashboardDate || getLocalDateString();
  const [
    meals,
    dayWorkouts,
    summaries,
    goals,
    activityDates,
    counts,
    measurements,
  ] = await Promise.all([
    dbGetMealsByDate(date),
    dbGetWorkoutsByDate(date),
    dbGetProductSummaries(3),
    dbGetDailyGoals(),
    dbGetActivityDates(),
    dbGetLibraryCounts().catch(() => null),
    dbGetAllBodyMeasurements().catch(() => []),
  ]);
  const history = params.workoutsHistoryLoaded
    ? await dbGetAllWorkouts()
    : dayWorkouts;

  return {
    meals,
    dashboardWorkouts: dayWorkouts,
    workouts: history,
    scannedProducts: mergeProductRows(summaries, params.existingScannedProducts),
    dailyGoals: goals,
    activityDates,
    dashboardDate: date,
    bodyMeasurements: measurements,
    mealCount: counts?.meals ?? meals.length,
    mealPhotoCount:
      counts?.mealsWithPhotos ??
      meals.filter((meal) => Boolean(meal.imageUri)).length,
    workoutCount: counts?.workouts ?? history.length,
    scannedProductCount: counts?.products ?? summaries.length,
    isInitialized: true,
  };
}

export async function fetchRefreshedFitnessData(params: {
  dashboardDate: string;
  workoutsHistoryLoaded: boolean;
  existingScannedProducts: ScannedProduct[];
  currentCounts: {
    mealCount: number;
    mealPhotoCount: number;
    workoutCount: number;
    scannedProductCount: number;
  };
}): Promise<Partial<HydratedDbState>> {
  const date = params.dashboardDate || getLocalDateString();
  const productLimit = params.existingScannedProducts.length > 3 ? 100 : 3;
  const [meals, dayWorkouts, summaries, activityDates, counts] =
    await Promise.all([
      dbGetMealsByDate(date),
      dbGetWorkoutsByDate(date),
      dbGetProductSummaries(productLimit),
      dbGetActivityDates(),
      dbGetLibraryCounts().catch(() => null),
    ]);
  const history = params.workoutsHistoryLoaded
    ? await dbGetAllWorkouts()
    : dayWorkouts;

  return {
    meals,
    dashboardWorkouts: dayWorkouts,
    workouts: history,
    scannedProducts: mergeProductRows(summaries, params.existingScannedProducts),
    activityDates,
    dashboardDate: date,
    mealCount: counts?.meals ?? params.currentCounts.mealCount,
    mealPhotoCount:
      counts?.mealsWithPhotos ?? params.currentCounts.mealPhotoCount,
    workoutCount: counts?.workouts ?? params.currentCounts.workoutCount,
    scannedProductCount:
      counts?.products ?? params.currentCounts.scannedProductCount,
    isInitialized: true,
  };
}

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
