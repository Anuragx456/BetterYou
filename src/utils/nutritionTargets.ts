/**
 * BMR, TDEE, and Nutrition Targets Calculator
 *
 * Implements clinically validated Mifflin-St Jeor formula, activity multipliers,
 * goal adjustments (cut/maintain/bulk), and macro distribution targets.
 */

export type UserSex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very_active'
  | 'extra_active';

export type GoalType = 'cut' | 'maintain' | 'bulk';

export interface UserProfileInput {
  age: number;
  sex: UserSex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
}

export interface NutritionTargetsResult {
  bmr: number;
  tdee: number;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  isClampedForSafety: boolean;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export const MIN_CALORIE_FLOOR: Record<UserSex, number> = {
  female: 1200,
  male: 1500,
};

/**
 * Calculates Mifflin-St Jeor Basal Metabolic Rate (BMR)
 *
 * Men:   10 * weight (kg) + 6.25 * height (cm) - 5 * age + 5
 * Women: 10 * weight (kg) + 6.25 * height (cm) - 5 * age - 161
 */
export function calculateMifflinStJeorBmr(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: UserSex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE) based on activity multiplier
 */
export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
  return bmr * multiplier;
}

/**
 * Calculates complete calorie and macronutrient targets
 *
 * Calorie adjustments:
 *  - cut: TDEE - 500 kcal
 *  - maintain: TDEE
 *  - bulk: TDEE + 300 kcal
 *  - Clamped to safe floors: >= 1200 kcal (women), >= 1500 kcal (men)
 *
 * Macro split:
 *  - Protein: 1.8 g/kg bodyweight (or 2.0 g/kg on cut)
 *  - Fat: 25% of target calories (9 kcal/g)
 *  - Carbs: Remainder of target calories (4 kcal/g)
 *  - All rounded to whole grams
 */
export function calculateNutritionTargets(profile: UserProfileInput): NutritionTargetsResult {
  const bmr = calculateMifflinStJeorBmr(
    profile.weightKg,
    profile.heightCm,
    profile.age,
    profile.sex
  );

  const tdee = calculateTdee(bmr, profile.activityLevel);

  let rawTargetCalories: number;
  switch (profile.goalType) {
    case 'cut':
      rawTargetCalories = tdee - 500;
      break;
    case 'bulk':
      rawTargetCalories = tdee + 300;
      break;
    case 'maintain':
    default:
      rawTargetCalories = tdee;
      break;
  }

  const floor = MIN_CALORIE_FLOOR[profile.sex];
  const isClampedForSafety = rawTargetCalories < floor;
  const targetCalories = Math.round(Math.max(floor, rawTargetCalories));

  // Protein: 1.8 g/kg (or 2.0 g/kg on cut)
  const proteinMultiplier = profile.goalType === 'cut' ? 2.0 : 1.8;
  const proteinGrams = Math.round(profile.weightKg * proteinMultiplier);
  const proteinCalories = proteinGrams * 4;

  // Fat: 25% of target calories / 9 kcal/g
  const fatCalories = targetCalories * 0.25;
  const fatGrams = Math.round(fatCalories / 9);

  // Carbs: Remainder / 4 kcal/g
  const remainingCalories = targetCalories - (proteinCalories + fatGrams * 9);
  const carbsGrams = Math.max(0, Math.round(remainingCalories / 4));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: targetCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    isClampedForSafety,
  };
}
