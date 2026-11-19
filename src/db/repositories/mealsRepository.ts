import { MealLog } from '../../types';
import { getLocalDateString } from '../../utils/date';
import { getDatabase, invalidateActivityDatesCache } from '../client';

interface MealRow {
  id: string;
  date: string;
  dish_name: string;
  timestamp: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  estimated_weight_grams: number;
  portion_multiplier: number;
  image_path: string | null;
  thumbnail_path?: string | null;
  ingredients_detected: string;
  notes: string | null;
}

function mapMealRow(r: MealRow): MealLog {
  let ingredientsDetected: string[] = [];
  try {
    ingredientsDetected = JSON.parse(r.ingredients_detected);
  } catch {
    ingredientsDetected = [];
  }

  return {
    id: r.id,
    date: r.date,
    dishName: r.dish_name,
    timestamp: r.timestamp,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    estimatedWeightGrams: r.estimated_weight_grams,
    portionMultiplier: r.portion_multiplier,
    imageUri: r.image_path ?? undefined,
    thumbnailUri: r.thumbnail_path ?? undefined,
    ingredientsDetected,
    notes: r.notes ?? undefined,
  };
}

export async function dbInsertMeal(
  meal: Omit<MealLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<MealLog> {
  const db = await getDatabase();
  const id = meal.id || `meal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = meal.timestamp || new Date().toISOString();
  const date = meal.date || getLocalDateString(timestamp);
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO meals (
      id, date, dish_name, timestamp, calories, protein, carbs, fat,
      estimated_weight_grams, portion_multiplier, image_path, thumbnail_path, ingredients_detected, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      date,
      meal.dishName,
      timestamp,
      meal.calories,
      meal.protein,
      meal.carbs,
      meal.fat,
      meal.estimatedWeightGrams ?? 0,
      meal.portionMultiplier ?? 1.0,
      meal.imageUri ?? null,
      meal.thumbnailUri ?? null,
      JSON.stringify(meal.ingredientsDetected || []),
      meal.notes ?? null,
      now,
    ]
  );
  invalidateActivityDatesCache();

  return {
    id,
    date,
    dishName: meal.dishName,
    timestamp,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    estimatedWeightGrams: meal.estimatedWeightGrams,
    portionMultiplier: meal.portionMultiplier ?? 1.0,
    imageUri: meal.imageUri,
    thumbnailUri: meal.thumbnailUri,
    ingredientsDetected: meal.ingredientsDetected || [],
    notes: meal.notes,
  };
}

export async function dbGetMealsByDate(date: string): Promise<MealLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE date = ? ORDER BY timestamp DESC',
    [date]
  );

  return rows.map(mapMealRow);
}

export async function dbGetAllMeals(): Promise<MealLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MealRow>('SELECT * FROM meals ORDER BY timestamp DESC LIMIT 300');

  return rows.map(mapMealRow);
}

export async function dbDeleteMeal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM meals WHERE id = ?', [id]);
  invalidateActivityDatesCache();
}

export async function dbGetAllMealImagePaths(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ image_path: string | null }>(
    'SELECT image_path FROM meals WHERE image_path IS NOT NULL'
  );
  return rows.map((r) => r.image_path).filter((p): p is string => Boolean(p));
}
