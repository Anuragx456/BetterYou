import { describe, expect, it } from 'bun:test';
import {
  calculateBmi,
  cmToFtIn,
  ftInToCm,
  validateBasics,
  validateTargets,
} from '../onboardingValidation';

describe('onboardingValidation', () => {
  describe('validateBasics', () => {
    it('returns invalid and errors for all fields when input is empty', () => {
      const result = validateBasics({
        sex: null,
        ageStr: '',
        heightStr: '',
        weightStr: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.sex).toBe('Please select your biological sex.');
      expect(result.errors.age).toBeDefined();
      expect(result.errors.height).toBeDefined();
      expect(result.errors.weight).toBeDefined();
    });

    it('returns invalid when fields are out of allowed ranges', () => {
      // Age too low / high
      expect(
        validateBasics({
          sex: 'male',
          ageStr: '11',
          heightStr: '175',
          weightStr: '70',
        }).valid
      ).toBe(false);
      expect(
        validateBasics({
          sex: 'male',
          ageStr: '111',
          heightStr: '175',
          weightStr: '70',
        }).valid
      ).toBe(false);

      // Height too low / high
      expect(
        validateBasics({
          sex: 'female',
          ageStr: '25',
          heightStr: '99',
          weightStr: '60',
        }).valid
      ).toBe(false);
      expect(
        validateBasics({
          sex: 'female',
          ageStr: '25',
          heightStr: '251',
          weightStr: '60',
        }).valid
      ).toBe(false);

      // Weight too low / high
      expect(
        validateBasics({
          sex: 'male',
          ageStr: '30',
          heightStr: '180',
          weightStr: '29',
        }).valid
      ).toBe(false);
      expect(
        validateBasics({
          sex: 'male',
          ageStr: '30',
          heightStr: '180',
          weightStr: '251',
        }).valid
      ).toBe(false);

      // Sex unselected
      expect(
        validateBasics({
          sex: null,
          ageStr: '30',
          heightStr: '180',
          weightStr: '75',
        }).valid
      ).toBe(false);
    });

    it('returns valid: true and no errors for valid profile inputs', () => {
      const result = validateBasics({
        sex: 'male',
        ageStr: '26',
        heightStr: '175',
        weightStr: '72',
      });

      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });
  });

  describe('validateTargets', () => {
    it('rejects calories below the biological sex safety floor', () => {
      // Female floor is 1200
      const femaleBelow = validateTargets({
        calories: 1100,
        protein: 100,
        carbs: 100,
        fat: 35,
        sex: 'female',
      });
      expect(femaleBelow).toContain('below the safety floor of 1200 kcal');

      // Male floor is 1500
      const maleBelow = validateTargets({
        calories: 1400,
        protein: 120,
        carbs: 140,
        fat: 40,
        sex: 'male',
      });
      expect(maleBelow).toContain('below the safety floor of 1500 kcal');
    });

    it('rejects calories or macros outside allowed boundary limits', () => {
      // Calories over 6000
      expect(
        validateTargets({
          calories: 6500,
          protein: 300,
          carbs: 800,
          fat: 200,
          sex: 'male',
        })
      ).toContain('between 1,000 and 6,000 kcal');

      // Protein under 30g
      expect(
        validateTargets({
          calories: 2000,
          protein: 20,
          carbs: 300,
          fat: 70,
          sex: 'male',
        })
      ).toContain('Protein must be between 30g and 400g');

      // Carbs over 800g
      expect(
        validateTargets({
          calories: 4500,
          protein: 150,
          carbs: 850,
          fat: 50,
          sex: 'male',
        })
      ).toContain('Carbohydrates must be between 0g and 800g');

      // Fat under 20g
      expect(
        validateTargets({
          calories: 1800,
          protein: 140,
          carbs: 250,
          fat: 15,
          sex: 'male',
        })
      ).toContain('Fat must be between 20g and 300g');
    });

    it('rejects implausible macro distributions not within ±20% of calories', () => {
      // Macros yield 420 kcal, but target is 2000 kcal (< 80%)
      const tooLow = validateTargets({
        calories: 2000,
        protein: 30,
        carbs: 30,
        fat: 20,
        sex: 'male',
      });
      expect(tooLow).toContain('must be within ±20% of total calories');

      // Macros yield 3750 kcal, but target is 2000 kcal (> 120%)
      const tooHigh = validateTargets({
        calories: 2000,
        protein: 200,
        carbs: 400,
        fat: 150,
        sex: 'male',
      });
      expect(tooHigh).toContain('must be within ±20% of total calories');
    });

    it('accepts valid, plausible targets', () => {
      // 150*4 + 250*4 + 60*9 = 600 + 1000 + 540 = 2140 kcal (within ±20% of 2200)
      const valid = validateTargets({
        calories: 2200,
        protein: 150,
        carbs: 250,
        fat: 60,
        sex: 'male',
      });
      expect(valid).toBeNull();
    });
  });

  describe('calculateBmi', () => {
    it('calculates BMI correctly and rounds to 1 decimal place', () => {
      // 70 / (1.75 * 1.75) = 22.857... -> 22.9
      expect(calculateBmi(70, 175)).toBe(22.9);

      // Underweight: 45 / (1.70 * 1.70) = 15.57... -> 15.6
      expect(calculateBmi(45, 170)).toBe(15.6);

      // Overweight: 90 / (1.75 * 1.75) = 29.38... -> 29.4
      expect(calculateBmi(90, 175)).toBe(29.4);
    });

    it('handles zero and invalid inputs safely', () => {
      expect(calculateBmi(0, 175)).toBe(0);
      expect(calculateBmi(70, 0)).toBe(0);
      expect(calculateBmi(-10, 175)).toBe(0);
    });
  });

  describe('cmToFtIn and ftInToCm', () => {
    it('performs round-trip conversion (175 cm ≈ 5 ft 9 in)', () => {
      const ftIn = cmToFtIn(175);
      expect(ftIn).toEqual({ ft: 5, in: 9 });

      const cm = ftInToCm(5, 9);
      expect(cm).toBe(175);
    });

    it('converts edge cases and handles invalid inputs safely', () => {
      expect(cmToFtIn(0)).toEqual({ ft: 0, in: 0 });
      expect(ftInToCm(0, 0)).toBe(0);

      // 6 ft 0 in = 72 * 2.54 = 182.88 -> 183 cm
      expect(ftInToCm(6, 0)).toBe(183);
      expect(cmToFtIn(183)).toEqual({ ft: 6, in: 0 });
    });
  });
});
