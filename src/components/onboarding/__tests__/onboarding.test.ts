import { describe, it, expect } from 'bun:test';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from '../constants';
import { ACTIVITY_MULTIPLIERS, calculateNutritionTargets } from '../../../utils/nutritionTargets';

describe('Onboarding Flow & Stageshow Components (constants.ts & onboarding)', () => {
  describe('ACTIVITY_OPTIONS Configuration & Metadata', () => {
    it('contains all 5 standard physiological activity tiers', () => {
      expect(ACTIVITY_OPTIONS).toHaveLength(5);
      const keys = ACTIVITY_OPTIONS.map((o) => o.key);
      expect(keys).toEqual(['sedentary', 'light', 'moderate', 'very_active', 'extra_active']);
    });

    it('has monotonically increasing intensity levels (1 to 5)', () => {
      ACTIVITY_OPTIONS.forEach((opt, idx) => {
        expect(opt.level).toBe(idx + 1);
        expect(opt.frequency.length).toBeGreaterThan(0);
        expect(opt.desc.length).toBeGreaterThan(0);
      });
    });

    it('matches the mathematical activity multipliers from nutritionTargets.ts', () => {
      ACTIVITY_OPTIONS.forEach((opt) => {
        const mathVal = ACTIVITY_MULTIPLIERS[opt.key];
        const formattedMultiplier = `${mathVal.toFixed(2)}×`;
        expect(opt.multiplier).toBe(formattedMultiplier);
      });
    });
  });

  describe('GOAL_OPTIONS Configuration & Metadata', () => {
    it('covers cut, maintain, and bulk with clinical rationale', () => {
      expect(GOAL_OPTIONS).toHaveLength(3);
      const keys = GOAL_OPTIONS.map((g) => g.key);
      expect(keys).toEqual(['cut', 'maintain', 'bulk']);
    });

    it('assigns appropriate badges and protein guidelines for each goal', () => {
      const cut = GOAL_OPTIONS.find((g) => g.key === 'cut')!;
      expect(cut.badge).toBe('-500 kcal');
      expect(cut.proteinGuide).toContain('2.0 g/kg');

      const maintain = GOAL_OPTIONS.find((g) => g.key === 'maintain')!;
      expect(maintain.badge).toBe('TDEE');
      expect(maintain.proteinGuide).toContain('1.8 g/kg');

      const bulk = GOAL_OPTIONS.find((g) => g.key === 'bulk')!;
      expect(bulk.badge).toBe('+300 kcal');
      expect(bulk.proteinGuide).toContain('1.8 g/kg');
    });
  });

  describe('Live Feedback & Thermodynamic Checks', () => {
    it('calculates accurate BMI classifications for user stats', () => {
      const calculateBmi = (weightKg: number, heightCm: number) => {
        const heightM = heightCm / 100;
        const bmi = weightKg / (heightM * heightM);
        return Math.round(bmi * 10) / 10;
      };

      // 70 kg, 175 cm => BMI 22.9 (Healthy)
      expect(calculateBmi(70, 175)).toBe(22.9);

      // 50 kg, 175 cm => BMI 16.3 (Underweight)
      expect(calculateBmi(50, 175)).toBe(16.3);

      // 85 kg, 175 cm => BMI 27.8 (Overweight)
      expect(calculateBmi(85, 175)).toBe(27.8);

      // 100 kg, 175 cm => BMI 32.7 (Elevated)
      expect(calculateBmi(100, 175)).toBe(32.7);
    });

    it('computes consistent macronutrient proportions for StepTargetCustomizer', () => {
      const targets = calculateNutritionTargets({
        age: 26,
        sex: 'male',
        heightCm: 175,
        weightKg: 72,
        activityLevel: 'moderate',
        goalType: 'cut',
      });

      const proteinKcal = targets.proteinGrams * 4;
      const carbsKcal = targets.carbsGrams * 4;
      const fatKcal = targets.fatGrams * 9;
      const totalKcal = proteinKcal + carbsKcal + fatKcal;

      // Total macro energy must match target calories within rounding margin (<= 15 kcal)
      expect(Math.abs(totalKcal - targets.calories)).toBeLessThanOrEqual(15);

      const proteinPct = Math.round((proteinKcal / totalKcal) * 100);
      const carbsPct = Math.round((carbsKcal / totalKcal) * 100);
      const fatPct = Math.round((fatKcal / totalKcal) * 100);

      expect(proteinPct + carbsPct + fatPct).toBeGreaterThanOrEqual(99);
      expect(proteinPct + carbsPct + fatPct).toBeLessThanOrEqual(101);
    });
  });
});
