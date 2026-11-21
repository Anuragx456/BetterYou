import { MIN_CALORIE_FLOOR, UserSex } from './nutritionTargets';

export interface BasicsValidationInput {
  sex: UserSex | null;
  ageStr: string;
  heightStr: string;
  weightStr: string;
}

export interface BasicsValidationResult {
  valid: boolean;
  errors: {
    sex?: string;
    age?: string;
    height?: string;
    weight?: string;
  };
}

export function validateBasics(input: BasicsValidationInput): BasicsValidationResult {
  const errors: BasicsValidationResult['errors'] = {};

  if (!input.sex) {
    errors.sex = 'Please select your biological sex.';
  }

  const age = parseInt(input.ageStr, 10);
  if (!input.ageStr.trim() || isNaN(age) || age < 12 || age > 110) {
    errors.age = 'Please enter a valid age between 12 and 110.';
  }

  const height = parseFloat(input.heightStr);
  if (!input.heightStr.trim() || isNaN(height) || height < 100 || height > 250) {
    errors.height = 'Please enter a valid height in cm (100–250 cm).';
  }

  const weight = parseFloat(input.weightStr);
  if (!input.weightStr.trim() || isNaN(weight) || weight < 30 || weight > 250) {
    errors.weight = 'Please enter a valid weight in kg (30–250 kg).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface TargetsValidationInput {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sex?: UserSex | null;
}

export function validateTargets(input: TargetsValidationInput): string | null {
  const floor = input.sex ? MIN_CALORIE_FLOOR[input.sex] : 1200;

  if (input.calories < floor) {
    return `Calories cannot be below the safety floor of ${floor} kcal for your sex.`;
  }
  if (input.calories < 1000 || input.calories > 6000) {
    return 'Calories must be between 1,000 and 6,000 kcal.';
  }
  if (input.protein < 30 || input.protein > 400) {
    return 'Protein must be between 30g and 400g.';
  }
  if (input.carbs < 0 || input.carbs > 800) {
    return 'Carbohydrates must be between 0g and 800g.';
  }
  if (input.fat < 20 || input.fat > 300) {
    return 'Fat must be between 20g and 300g.';
  }

  // Macro plausibility: 4*P + 4*C + 9*F within ±20% of calories
  const macroCalories = input.protein * 4 + input.carbs * 4 + input.fat * 9;
  const minPlausible = input.calories * 0.8;
  const maxPlausible = input.calories * 1.2;

  if (macroCalories < minPlausible || macroCalories > maxPlausible) {
    return `Macro calories (${macroCalories} kcal) must be within ±20% of total calories (${input.calories} kcal).`;
  }

  return null;
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0 || isNaN(heightCm) || isNaN(weightKg)) {
    return 0;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

export function cmToFtIn(cm: number): { ft: number; in: number } {
  if (!cm || cm <= 0 || isNaN(cm)) {
    return { ft: 0, in: 0 };
  }
  const totalInches = cm / 2.54;
  let ft = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, in: inches };
}

export function ftInToCm(ft: number, inches: number): number {
  const totalInches = (ft || 0) * 12 + (inches || 0);
  return Math.round(totalInches * 2.54);
}
