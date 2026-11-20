import type {
  BodyMeasurement,
  DailyGoals,
  ExerciseSet,
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
  bodyMeasurements: BodyMeasurement[];

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

  // Bodyweight Actions
  logBodyWeight: (weightKg: number, note?: string, date?: string) => Promise<void>;
  deleteBodyMeasurement: (id: string) => Promise<void>;
  loadBodyMeasurements: () => Promise<void>;

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

export const DEFAULT_GOALS: DailyGoals = {
  calorieTarget: 2200,
  proteinTargetGrams: 160,
  carbsTargetGrams: 220,
  fatTargetGrams: 65,
};
