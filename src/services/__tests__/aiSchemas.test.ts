import { describe, it, expect } from 'bun:test';
import {
  MealAnalysisAiSchema,
  ToxicityAnalysisAiSchema,
  validateMacroPlausibility,
} from '../aiSchemas';

describe('AI Output Validation with Zod (aiSchemas.ts)', () => {
  describe('MealAnalysisAiSchema', () => {
    it('successfully parses valid meal JSON', () => {
      const input = {
        dishName: 'Paneer Butter Masala with 2 Roti',
        estimatedWeightGrams: 350,
        calories: 540,
        protein: 22.5,
        carbs: 48,
        fat: 28,
        ingredientsDetected: ['Paneer', 'Butter', 'Tomato gravy', 'Whole wheat flour'],
      };

      const result = MealAnalysisAiSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dishName).toBe('Paneer Butter Masala with 2 Roti');
        expect(result.data.calories).toBe(540);
        expect(result.data.protein).toBe(22.5);
      }
    });

    it('coerces string numbers and cleans string arrays', () => {
      const input = {
        dishName: '  Oatmeal with Almonds  ',
        estimatedWeightGrams: '250',
        calories: '320',
        protein: '12',
        carbs: '45.5',
        fat: '8',
        ingredientsDetected: 'Rolled oats, Almonds, Milk',
      };

      const result = MealAnalysisAiSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dishName).toBe('Oatmeal with Almonds');
        expect(result.data.estimatedWeightGrams).toBe(250);
        expect(result.data.calories).toBe(320);
        expect(result.data.ingredientsDetected).toEqual(['Rolled oats', 'Almonds', 'Milk']);
      }
    });

    it('rejects empty dish name or negative calorie counts', () => {
      const invalidInput = {
        dishName: '',
        estimatedWeightGrams: 100,
        calories: -50,
        protein: 10,
        carbs: 20,
        fat: 5,
        ingredientsDetected: [],
      };

      const result = MealAnalysisAiSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('ToxicityAnalysisAiSchema', () => {
    it('validates comprehensive product and additive breakdown', () => {
      const input = {
        productName: 'Kurkure Masala Munch',
        category: 'Food & Beverages',
        allIngredients: ['Corn meal', 'Rice meal', 'Edible vegetable oil', 'Palmolein', 'TBHQ (E319)'],
        harmfulIngredients: [
          {
            name: 'TBHQ (E319)',
            category: 'Synthetic Antioxidant',
            healthImpact: 'Linked to immune system alterations at high doses.',
            severity: 'high',
          },
        ],
        indianMarketAlert: 'High palmolein oil content (~33%) and industrial TBHQ antioxidant.',
        novaGroup: 4,
        nutriscoreGrade: 'e',
        cleanSummary: 'Ultra-processed corn snack with industrial antioxidant TBHQ.',
      };

      const result = ToxicityAnalysisAiSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productName).toBe('Kurkure Masala Munch');
        expect(result.data.novaGroup).toBe(4);
        expect(result.data.harmfulIngredients.length).toBe(1);
        expect(result.data.harmfulIngredients[0].severity).toBe('high');
      }
    });

    it('falls back to safe defaults when optional fields are invalid', () => {
      const input = {
        productName: 'Herbal Hair Oil',
        category: 'Unknown Custom Category',
        allIngredients: ['Light Liquid Paraffin', 'Perfume'],
        harmfulIngredients: [
          {
            name: 'Light Liquid Paraffin',
            severity: 'unrecognized_severity',
          },
        ],
        nutriscoreGrade: 'invalid_grade',
      };

      const result = ToxicityAnalysisAiSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('Food & Beverages'); // fallback
        expect(result.data.harmfulIngredients[0].severity).toBe('moderate'); // fallback
        expect(result.data.nutriscoreGrade).toBeNull(); // catch null
      }
    });
  });

  describe('Macro Thermodynamic Plausibility Check (validateMacroPlausibility)', () => {
    it('flags plausible macronutrients within 20% limit', () => {
      // 30g P * 4 = 120, 50g C * 4 = 200, 20g F * 9 = 180 -> sum = 500 kcal
      const result = validateMacroPlausibility(510, 30, 50, 20);
      expect(result.isPlausible).toBe(true);
      expect(result.calculatedKcal).toBe(500);
      expect(result.reportedKcal).toBe(510);
      expect(result.warning).toBeNull();
    });

    it('flags implausible macronutrients exceeding 20% limit', () => {
      // 10g P * 4 = 40, 10g C * 4 = 40, 2g F * 9 = 18 -> sum = 98 kcal
      // Reported = 450 kcal (4.5x higher)
      const result = validateMacroPlausibility(450, 10, 10, 2);
      expect(result.isPlausible).toBe(false);
      expect(result.calculatedKcal).toBe(98);
      expect(result.deviationPercent).toBeGreaterThan(50);
      expect(result.warning).toContain('deviate by');
    });

    it('handles zero values cleanly without division by zero', () => {
      const result = validateMacroPlausibility(0, 0, 0, 0);
      expect(result.isPlausible).toBe(true);
      expect(result.calculatedKcal).toBe(0);
      expect(result.warning).toBeNull();
    });
  });
});
