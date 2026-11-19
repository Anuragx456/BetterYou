export interface DatabaseAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

let dbInstance: DatabaseAdapter | null = null;
let isInitialized = false;

// In-memory fallback for testing environments
class MemoryDatabaseAdapter implements DatabaseAdapter {
  private tables: Record<string, Record<string, unknown>[]> = {
    meals: [],
    workout_sessions: [],
    exercises: [],
    sets: [],
    scanned_products: [],
    daily_goals: [],
    migrations_meta: [],
  };

  async execAsync(sql: string): Promise<void> {
    const trimmed = sql.toLowerCase();
    if (trimmed.includes('delete from meals')) this.tables.meals = [];
    if (trimmed.includes('delete from sets')) this.tables.sets = [];
    if (trimmed.includes('delete from exercises')) this.tables.exercises = [];
    if (trimmed.includes('delete from workout_sessions')) this.tables.workout_sessions = [];
    if (trimmed.includes('delete from scanned_products')) this.tables.scanned_products = [];
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertRowId: number }> {
    const trimmed = sql.trim().toLowerCase();
    if (trimmed.startsWith('begin') || trimmed.startsWith('commit') || trimmed.startsWith('rollback')) {
      return { rowsAffected: 0, lastInsertRowId: 0 };
    }
    if (trimmed.startsWith('delete from meals where id =')) {
      const id = params[0];
      const prev = this.tables.meals.length;
      this.tables.meals = this.tables.meals.filter((m) => m.id !== id);
      return { rowsAffected: prev - this.tables.meals.length, lastInsertRowId: 0 };
    }
    if (trimmed.startsWith('delete from workout_sessions where id =')) {
      const id = params[0];
      this.tables.workout_sessions = this.tables.workout_sessions.filter((w) => w.id !== id);
      this.tables.exercises = this.tables.exercises.filter((e) => e.workout_id !== id);
      return { rowsAffected: 1, lastInsertRowId: 0 };
    }
    if (trimmed.startsWith('delete from scanned_products where id =')) {
      const id = params[0];
      this.tables.scanned_products = this.tables.scanned_products.filter((p) => p.id !== id);
      return { rowsAffected: 1, lastInsertRowId: 0 };
    }
    return { rowsAffected: 1, lastInsertRowId: 1 };
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const trimmed = sql.trim().toLowerCase();
    if (trimmed.includes('from meals')) {
      if (trimmed.includes('where date =')) {
        const targetDate = params[0];
        return this.tables.meals.filter((m) => m.date === targetDate) as unknown as T[];
      }
      return this.tables.meals as unknown as T[];
    }
    if (trimmed.includes('from workout_sessions')) {
      if (trimmed.includes('where date =')) {
        const targetDate = params[0];
        return this.tables.workout_sessions.filter((w) => w.date === targetDate) as unknown as T[];
      }
      return this.tables.workout_sessions as unknown as T[];
    }
    if (trimmed.includes('from exercises')) {
      if (trimmed.includes('where e.workout_id in')) {
        const workoutIds = params as string[];
        const matchedExercises = this.tables.exercises.filter((e) => workoutIds.includes(e.workout_id as string));
        const joined: Record<string, unknown>[] = [];
        for (const ex of matchedExercises) {
          const sets = this.tables.sets.filter((s) => s.exercise_id === ex.id);
          if (sets.length === 0) {
            joined.push({
              workout_id: ex.workout_id,
              ex_id: ex.id,
              ex_name: ex.name,
              ex_order_index: ex.order_index,
              set_id: null,
              set_number: null,
              weight_kg: null,
              reps: null,
              completed: null,
            });
          } else {
            for (const st of sets) {
              joined.push({
                workout_id: ex.workout_id,
                ex_id: ex.id,
                ex_name: ex.name,
                ex_order_index: ex.order_index,
                set_id: st.id,
                set_number: st.set_number,
                weight_kg: st.weight_kg,
                reps: st.reps,
                completed: st.completed,
              });
            }
          }
        }
        return joined as unknown as T[];
      }
      const workoutId = params[0];
      return this.tables.exercises.filter((e) => e.workout_id === workoutId) as unknown as T[];
    }
    if (trimmed.includes('from sets')) {
      const exerciseId = params[0];
      return this.tables.sets.filter((s) => s.exercise_id === exerciseId) as unknown as T[];
    }
    if (trimmed.includes('from scanned_products')) {
      return this.tables.scanned_products as unknown as T[];
    }
    if (trimmed.includes('from migrations_meta')) {
      return this.tables.migrations_meta as unknown as T[];
    }
    return [];
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all[0] ?? null;
  }
}

/**
 * Initializes tables and indexes in SQLite.
 */
export async function getDatabase(): Promise<DatabaseAdapter> {
  if (dbInstance && isInitialized) {
    return dbInstance;
  }

  // Check if running on native device with expo-sqlite
  const isNative = typeof window !== 'undefined' || Boolean((globalThis as Record<string, unknown>).nativeCallSyncHook);

  if (isNative) {
    try {
      const SQLite = await import('expo-sqlite');
      const nativeDb = SQLite.openDatabaseSync('betteryou.db');
      dbInstance = {
        execAsync: async (sql) => nativeDb.execAsync(sql),
        runAsync: async (sql, params = []) => {
          const res = (await (nativeDb.runAsync as any)(sql, params)) as { changes: number; lastInsertRowId: number };
          return { rowsAffected: res.changes, lastInsertRowId: res.lastInsertRowId };
        },
        getAllAsync: async <T>(sql: string, params = []) => (nativeDb.getAllAsync as any)(sql, params) as Promise<T[]>,
        getFirstAsync: async <T>(sql: string, params = []) => (nativeDb.getFirstAsync as any)(sql, params) as Promise<T | null>,
      };
    } catch (err: unknown) {
      console.warn('[db] Failed to load native expo-sqlite, using memory adapter:', err);
      dbInstance = new MemoryDatabaseAdapter();
    }
  } else {
    // In Bun test runner, use bun:sqlite for genuine in-memory SQLite testing!
    try {
      const { Database } = await import('bun:sqlite');
      const bunDb = new Database(':memory:');
      dbInstance = {
        execAsync: async (sql) => {
          bunDb.run(sql);
        },
        runAsync: async (sql, params = []) => {
          const stmt = bunDb.prepare(sql);
          const info = stmt.run(...(params as any[]));
          return { rowsAffected: info.changes, lastInsertRowId: Number(info.lastInsertRowid) };
        },
        getAllAsync: async <T>(sql: string, params = []) => {
          const stmt = bunDb.prepare(sql);
          return stmt.all(...(params as any[])) as T[];
        },
        getFirstAsync: async <T>(sql: string, params = []) => {
          const stmt = bunDb.prepare(sql);
          const result = stmt.get(...(params as any[]));
          return (result ?? null) as T | null;
        },
      };
    } catch {
      dbInstance = new MemoryDatabaseAdapter();
    }
  }

  if (!dbInstance) {
    dbInstance = new MemoryDatabaseAdapter();
  }

  // Create Schema with proper Foreign Keys and Date Indexes
  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      dish_name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      estimated_weight_grams INTEGER NOT NULL,
      portion_multiplier REAL NOT NULL DEFAULT 1.0,
      image_path TEXT,
      thumbnail_path TEXT,
      ingredients_detected TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS meals_date_idx ON meals(date);

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      total_volume_kg REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS workout_sessions_date_idx ON workout_sessions(date);

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS exercises_workout_id_idx ON exercises(workout_id);
    CREATE INDEX IF NOT EXISTS exercises_name_idx ON exercises(name);

    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_kg REAL NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sets_exercise_id_idx ON sets(exercise_id);

    CREATE TABLE IF NOT EXISTS scanned_products (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      barcode TEXT,
      product_name TEXT NOT NULL,
      category TEXT,
      overall_safety_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      image_path TEXT,
      report_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS scanned_products_date_idx ON scanned_products(date);
    CREATE INDEX IF NOT EXISTS scanned_products_barcode_idx ON scanned_products(barcode);

    CREATE TABLE IF NOT EXISTS daily_goals (
      id TEXT PRIMARY KEY NOT NULL,
      calorie_target INTEGER NOT NULL,
      protein_target_grams REAL NOT NULL,
      carbs_target_grams REAL NOT NULL,
      fat_target_grams REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY NOT NULL,
      age INTEGER NOT NULL,
      sex TEXT NOT NULL,
      height_cm REAL NOT NULL,
      weight_kg REAL NOT NULL,
      activity_level TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS body_measurements (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS body_measurements_date_idx ON body_measurements(date);

    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      original_json TEXT NOT NULL,
      corrected_json TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS corrections_type_idx ON corrections(type);

    CREATE TABLE IF NOT EXISTS migrations_meta (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vision_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  try {
    await dbInstance.execAsync('ALTER TABLE meals ADD COLUMN thumbnail_path TEXT;');
  } catch {
    // The column is already present.
  }

  isInitialized = true;
  return dbInstance;
}

// -------------------------------------------------------------
// ACTIVITY DATES & CACHE
// -------------------------------------------------------------

let activityDatesCache: string[] | null = null;

export function invalidateActivityDatesCache(): void {
  activityDatesCache = null;
}

export async function dbGetActivityDates(): Promise<string[]> {
  if (activityDatesCache) return activityDatesCache;
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM meals
     UNION
     SELECT date FROM workout_sessions`
  );
  activityDatesCache = rows.map((row) => row.date).filter((date) => Boolean(date));
  return activityDatesCache;
}

export async function dbGetLibraryCounts(): Promise<{
  meals: number;
  mealsWithPhotos: number;
  workouts: number;
  products: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    meals: number;
    meals_with_photos: number;
    workouts: number;
    products: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM meals) AS meals,
      (SELECT COUNT(*) FROM meals WHERE image_path IS NOT NULL AND image_path != '') AS meals_with_photos,
      (SELECT COUNT(*) FROM workout_sessions) AS workouts,
      (SELECT COUNT(*) FROM scanned_products) AS products`
  );
  return {
    meals: Number(row?.meals ?? 0),
    mealsWithPhotos: Number(row?.meals_with_photos ?? 0),
    workouts: Number(row?.workouts ?? 0),
    products: Number(row?.products ?? 0),
  };
}

// -------------------------------------------------------------
// RE-EXPORT ENTITY REPOSITORIES
// -------------------------------------------------------------

export * from './repositories/mealsRepository';
export * from './repositories/workoutsRepository';
export * from './repositories/productsRepository';
export * from './repositories/goalsRepository';
export * from './repositories/measurementsRepository';
export * from './repositories/correctionsRepository';
