import { DailyGoals } from '../../types';
import { getDatabase } from '../client';

export const DEFAULT_GOALS: DailyGoals = {
  calorieTarget: 2200,
  proteinTargetGrams: 160,
  carbsTargetGrams: 220,
  fatTargetGrams: 65,
};

export async function dbGetDailyGoals(): Promise<DailyGoals> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    calorie_target: number;
    protein_target_grams: number;
    carbs_target_grams: number;
    fat_target_grams: number;
  }>('SELECT * FROM daily_goals WHERE id = ?', ['default']);

  if (!row) {
    return DEFAULT_GOALS;
  }

  return {
    calorieTarget: row.calorie_target,
    proteinTargetGrams: row.protein_target_grams,
    carbsTargetGrams: row.carbs_target_grams,
    fatTargetGrams: row.fat_target_grams,
  };
}

export async function dbSetDailyGoals(goals: Partial<DailyGoals>): Promise<DailyGoals> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    calorie_target: number;
    protein_target_grams: number;
    carbs_target_grams: number;
    fat_target_grams: number;
  }>('SELECT * FROM daily_goals WHERE id = ?', ['default']);

  const current: DailyGoals = row
    ? {
        calorieTarget: row.calorie_target,
        proteinTargetGrams: row.protein_target_grams,
        carbsTargetGrams: row.carbs_target_grams,
        fatTargetGrams: row.fat_target_grams,
      }
    : DEFAULT_GOALS;

  const updated: DailyGoals = {
    ...current,
    ...goals,
  };

  await db.runAsync(
    `INSERT OR REPLACE INTO daily_goals (
      id, calorie_target, protein_target_grams, carbs_target_grams, fat_target_grams, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'default',
      updated.calorieTarget,
      updated.proteinTargetGrams,
      updated.carbsTargetGrams,
      updated.fatTargetGrams,
      Date.now(),
    ]
  );

  return updated;
}

export interface UserProfileData {
  id: string;
  age: number;
  sex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
  goalType: 'cut' | 'maintain' | 'bulk';
  updatedAt: string;
}

export async function dbGetUserProfile(): Promise<UserProfileData | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    age: number;
    sex: string;
    height_cm: number;
    weight_kg: number;
    activity_level: string;
    goal_type: string;
    updated_at: string;
  }>('SELECT * FROM user_profile WHERE id = ?', ['default']);

  if (!row) return null;

  return {
    id: row.id,
    age: row.age,
    sex: row.sex as 'male' | 'female',
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as UserProfileData['activityLevel'],
    goalType: row.goal_type as UserProfileData['goalType'],
    updatedAt: row.updated_at,
  };
}

export async function dbUpsertUserProfile(
  profile: Omit<UserProfileData, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string }
): Promise<UserProfileData> {
  const db = await getDatabase();
  const id = profile.id || 'default';
  const updatedAt = profile.updatedAt || new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO user_profile (
      id, age, sex, height_cm, weight_kg, activity_level, goal_type, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      profile.age,
      profile.sex,
      profile.heightCm,
      profile.weightKg,
      profile.activityLevel,
      profile.goalType,
      updatedAt,
    ]
  );

  return {
    id,
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    goalType: profile.goalType,
    updatedAt,
  };
}
