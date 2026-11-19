import { describe, expect, it } from 'bun:test';
import {
  ACTIVITY_MULTIPLIERS,
  calculateMifflinStJeorBmr,
  calculateNutritionTargets,
  calculateTdee,
  MIN_CALORIE_FLOOR,
  UserProfileInput,
} from '../nutritionTargets';

describe('Nutrition Targets & BMR/TDEE Calculator (nutritionTargets.ts)', () => {
  describe('Mifflin-St Jeor BMR Calculations', () => {
    it('calculates exact BMR for men', () => {
      // 70 kg, 175 cm, 25 years old male
      // BMR = 10 * 70 + 6.25 * 175 - 5 * 25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
      const bmr = calculateMifflinStJeorBmr(70, 175, 25, 'male');
      expect(bmr).toBeCloseTo(1673.75, 2);
    });

    it('calculates exact BMR for women', () => {
      // 60 kg, 162 cm, 30 years old female
      // BMR = 10 * 60 + 6.25 * 162 - 5 * 30 - 161 = 600 + 1012.5 - 150 - 161 = 1301.5
      const bmr = calculateMifflinStJeorBmr(60, 162, 30, 'female');
      expect(bmr).toBeCloseTo(1301.5, 2);
    });
  });

  describe('TDEE across all 5 activity levels', () => {
    const baseBmr = 1500;

    it('applies sedentary multiplier (1.2)', () => {
      expect(calculateTdee(baseBmr, 'sedentary')).toBe(1800);
      expect(ACTIVITY_MULTIPLIERS.sedentary).toBe(1.2);
    });

    it('applies light multiplier (1.375)', () => {
      expect(calculateTdee(baseBmr, 'light')).toBe(2062.5);
      expect(ACTIVITY_MULTIPLIERS.light).toBe(1.375);
    });

    it('applies moderate multiplier (1.55)', () => {
      expect(calculateTdee(baseBmr, 'moderate')).toBe(2325);
      expect(ACTIVITY_MULTIPLIERS.moderate).toBe(1.55);
    });

    it('applies very_active multiplier (1.725)', () => {
      expect(calculateTdee(baseBmr, 'very_active')).toBe(2587.5);
      expect(ACTIVITY_MULTIPLIERS.very_active).toBe(1.725);
    });

    it('applies extra_active multiplier (1.9)', () => {
      expect(calculateTdee(baseBmr, 'extra_active')).toBe(2850);
      expect(ACTIVITY_MULTIPLIERS.extra_active).toBe(1.9);
    });
  });

  describe('Goal-based Calorie Adjustments and Safety Floor Clamping', () => {
    it('calculates maintenance calories matching TDEE', () => {
      const profile: UserProfileInput = {
        age: 28,
        sex: 'male',
        heightCm: 180,
        weightKg: 75,
        activityLevel: 'moderate',
        goalType: 'maintain',
      };
      // BMR = 10*75 + 6.25*180 - 5*28 + 5 = 750 + 1125 - 140 + 5 = 1740
      // TDEE = 1740 * 1.55 = 2697
      const result = calculateNutritionTargets(profile);
      expect(result.bmr).toBe(1740);
      expect(result.tdee).toBe(2697);
      expect(result.calories).toBe(2697);
      expect(result.isClampedForSafety).toBe(false);
    });

    it('calculates cut target with -500 kcal and 2.0g/kg protein', () => {
      const profile: UserProfileInput = {
        age: 28,
        sex: 'male',
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'moderate',
        goalType: 'cut',
      };
      // BMR = 10*80 + 6.25*180 - 5*28 + 5 = 800 + 1125 - 140 + 5 = 1790
      // TDEE = 1790 * 1.55 = 2774.5 => round 2775
      // Target = 2774.5 - 500 = 2274.5 => round 2275
      const result = calculateNutritionTargets(profile);
      expect(result.calories).toBe(2275);
      // Cut protein = 80 * 2.0 = 160g
      expect(result.proteinGrams).toBe(160);
      // Fat = 2275 * 0.25 / 9 = 63.19 => 63g
      expect(result.fatGrams).toBe(63);
      // Carbs = (2275 - (160*4 + 63*9)) / 4 = (2275 - (640 + 567)) / 4 = 1068 / 4 = 267g
      expect(result.carbsGrams).toBe(267);
      expect(result.isClampedForSafety).toBe(false);
    });

    it('calculates bulk target with +300 kcal and 1.8g/kg protein', () => {
      const profile: UserProfileInput = {
        age: 24,
        sex: 'male',
        heightCm: 175,
        weightKg: 70,
        activityLevel: 'light',
        goalType: 'bulk',
      };
      // BMR = 10*70 + 6.25*175 - 5*24 + 5 = 700 + 1093.75 - 120 + 5 = 1678.75
      // TDEE = 1678.75 * 1.375 = 2308.28
      // Target = 2308.28 + 300 = 2608.28 => round 2608
      const result = calculateNutritionTargets(profile);
      expect(result.calories).toBe(2608);
      // Bulk protein = 70 * 1.8 = 126g
      expect(result.proteinGrams).toBe(126);
      expect(result.fatGrams).toBe(Math.round((2608 * 0.25) / 9));
      expect(result.isClampedForSafety).toBe(false);
    });

    it('enforces female calorie safety clamp at >= 1200 kcal/day', () => {
      // Petite sedentary older female on cut
      const profile: UserProfileInput = {
        age: 55,
        sex: 'female',
        heightCm: 150,
        weightKg: 45,
        activityLevel: 'sedentary',
        goalType: 'cut',
      };
      // BMR = 10*45 + 6.25*150 - 5*55 - 161 = 450 + 937.5 - 275 - 161 = 951.5
      // TDEE = 951.5 * 1.2 = 1141.8
      // Cut raw = 1141.8 - 500 = 641.8 kcal (dangerously low!)
      const result = calculateNutritionTargets(profile);
      expect(result.calories).toBe(MIN_CALORIE_FLOOR.female); // Clamped to 1200
      expect(result.isClampedForSafety).toBe(true);
      expect(result.proteinGrams).toBe(90); // 45 * 2.0 = 90g
      expect(result.carbsGrams).toBeGreaterThan(0);
    });

    it('enforces male calorie safety clamp at >= 1500 kcal/day', () => {
      // Very light sedentary older male on cut
      const profile: UserProfileInput = {
        age: 65,
        sex: 'male',
        heightCm: 155,
        weightKg: 48,
        activityLevel: 'sedentary',
        goalType: 'cut',
      };
      // BMR = 10*48 + 6.25*155 - 5*65 + 5 = 480 + 968.75 - 325 + 5 = 1128.75
      // TDEE = 1128.75 * 1.2 = 1354.5
      // Cut raw = 1354.5 - 500 = 854.5 kcal (dangerously low!)
      const result = calculateNutritionTargets(profile);
      expect(result.calories).toBe(MIN_CALORIE_FLOOR.male); // Clamped to 1500
      expect(result.isClampedForSafety).toBe(true);
      expect(result.proteinGrams).toBe(96); // 48 * 2.0 = 96g
    });
  });

  describe('Boundary Weights & Edge Cases', () => {
    it('handles heavy athlete profiles without numeric overflow', () => {
      const profile: UserProfileInput = {
        age: 26,
        sex: 'male',
        heightCm: 200,
        weightKg: 130,
        activityLevel: 'extra_active',
        goalType: 'bulk',
      };
      const result = calculateNutritionTargets(profile);
      expect(result.calories).toBeGreaterThan(4000);
      expect(result.proteinGrams).toBe(Math.round(130 * 1.8));
      expect(result.carbsGrams).toBeGreaterThan(100);
      expect(result.fatGrams).toBeGreaterThan(50);
    });

    it('ensures all macro values are non-negative whole numbers', () => {
      const profile: UserProfileInput = {
        age: 30,
        sex: 'female',
        heightCm: 165,
        weightKg: 58,
        activityLevel: 'light',
        goalType: 'maintain',
      };
      const result = calculateNutritionTargets(profile);
      expect(Number.isInteger(result.calories)).toBe(true);
      expect(Number.isInteger(result.proteinGrams)).toBe(true);
      expect(Number.isInteger(result.carbsGrams)).toBe(true);
      expect(Number.isInteger(result.fatGrams)).toBe(true);
      expect(result.proteinGrams).toBeGreaterThan(0);
      expect(result.carbsGrams).toBeGreaterThan(0);
      expect(result.fatGrams).toBeGreaterThan(0);
    });
  });
});
