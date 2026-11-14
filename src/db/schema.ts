import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from 'drizzle-orm/sqlite-core';

/**
 * Meals Table with index on date (YYYY-MM-DD)
 */
export const meals = sqliteTable(
  'meals',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(), // Local date string: YYYY-MM-DD
    dishName: text('dish_name').notNull(),
    timestamp: text('timestamp').notNull(), // ISO-8601 string
    calories: integer('calories').notNull(),
    protein: real('protein').notNull(),
    carbs: real('carbs').notNull(),
    fat: real('fat').notNull(),
    estimatedWeightGrams: integer('estimated_weight_grams').notNull(),
    portionMultiplier: real('portion_multiplier').notNull().default(1.0),
    imagePath: text('image_path'), // Relative path in documentDirectory (e.g. "images/meals/...")
    thumbnailPath: text('thumbnail_path'),
    ingredientsDetected: text('ingredients_detected').notNull().default('[]'), // JSON array
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('meals_date_idx').on(table.date),
  ]
);

/**
 * Workout Sessions Table with index on date
 */
export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(), // Local date string: YYYY-MM-DD
    title: text('title').notNull(),
    startedAt: text('started_at').notNull(), // ISO-8601 string
    completedAt: text('completed_at'), // ISO-8601 string or null
    totalVolumeKg: real('total_volume_kg').notNull().default(0),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('workout_sessions_date_idx').on(table.date),
  ]
);

/**
 * Exercises Table (nested within a workout session)
 */
export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('exercises_workout_id_idx').on(table.workoutId),
    index('exercises_name_idx').on(table.name),
  ]
);

/**
 * Exercise Sets Table (nested within an exercise)
 */
export const sets = sqliteTable(
  'sets',
  {
    id: text('id').primaryKey(),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    weightKg: real('weight_kg').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    completed: integer('completed').notNull().default(0), // 0 = false, 1 = true
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('sets_exercise_id_idx').on(table.exerciseId),
  ]
);

/**
 * Scanned Supermarket Products Table with index on date
 */
export const scannedProducts = sqliteTable(
  'scanned_products',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(), // Local date string: YYYY-MM-DD
    barcode: text('barcode'),
    productName: text('product_name').notNull(),
    category: text('category'),
    overallSafetyScore: integer('overall_safety_score').notNull(),
    riskLevel: text('risk_level').notNull(),
    scannedAt: text('scanned_at').notNull(), // ISO-8601 string
    imagePath: text('image_path'), // Relative path in documentDirectory
    reportJson: text('report_json').notNull(), // Serialized full ToxicityReport
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('scanned_products_date_idx').on(table.date),
    index('scanned_products_scanned_at_idx').on(table.scannedAt),
  ]
);

/**
 * Daily Nutrition Goals Table (single active config row)
 */
export const dailyGoals = sqliteTable('daily_goals', {
  id: text('id').primaryKey(), // 'default'
  calorieTarget: integer('calorie_target').notNull(),
  proteinTargetGrams: integer('protein_target_grams').notNull(),
  carbsTargetGrams: integer('carbs_target_grams').notNull(),
  fatTargetGrams: integer('fat_target_grams').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Migrations Metadata Table (for tracking one-time migrations)
 */
export const migrationsMeta = sqliteTable('migrations_meta', {
  id: text('id').primaryKey(),
  appliedAt: integer('applied_at').notNull(),
});

/**
 * Short-lived vision results keyed by an image hash so a relaunch can skip Gemini.
 */
export const visionCache = sqliteTable('vision_cache', {
  cacheKey: text('cache_key').primaryKey(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
});

export type MealRecord = typeof meals.$inferSelect;
export type InsertMealRecord = typeof meals.$inferInsert;

export type WorkoutSessionRecord = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSessionRecord = typeof workoutSessions.$inferInsert;

export type ExerciseRecord = typeof exercises.$inferSelect;
export type InsertExerciseRecord = typeof exercises.$inferInsert;

export type SetRecord = typeof sets.$inferSelect;
export type InsertSetRecord = typeof sets.$inferInsert;

export type ScannedProductRecord = typeof scannedProducts.$inferSelect;
export type InsertScannedProductRecord = typeof scannedProducts.$inferInsert;

export type DailyGoalsRecord = typeof dailyGoals.$inferSelect;
export type InsertDailyGoalsRecord = typeof dailyGoals.$inferInsert;
