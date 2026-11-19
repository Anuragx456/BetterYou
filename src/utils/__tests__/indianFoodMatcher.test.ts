import { describe, expect, it } from 'bun:test';
import {
  findMatchingIndianDish,
  matchIndianFoodEstimate,
  UserMealCorrection,
} from '../indianFoodMatcher';

describe('Indian Food Database Matcher & Correction Loop (indianFoodMatcher.ts)', () => {
  it('fuzzy matches "butter chicken" to "Murgh Makhani (Butter Chicken)"', () => {
    const match = findMatchingIndianDish('butter chicken');
    expect(match).not.toBeNull();
    expect(match?.name).toBe('Murgh Makhani (Butter Chicken)');
    expect(match?.caloriesPer100g).toBe(165);
    expect(match?.source).toContain('IFCT 2017');
  });

  it('fuzzy matches aliases such as "dal makhani", "palak paneer", and "chole"', () => {
    expect(findMatchingIndianDish('dal makhani')?.id).toBe('dish_02');
    expect(findMatchingIndianDish('palak paneer')?.id).toBe('dish_05');
    expect(findMatchingIndianDish('chana masala')?.id).toBe('dish_06');
    expect(findMatchingIndianDish('kanda poha')?.id).toBe('dish_29');
  });

  it('flags deviation when Gemini estimate deviates by > 35% from IFCT reference', () => {
    // Murgh Makhani is 165 kcal/100g. For 300g portion: 165 * 3 = 495 kcal
    // If Gemini estimates 750 kcal: deviation = (750 - 495) / 495 = 51.5% (> 35%)
    const result = matchIndianFoodEstimate(
      'Butter Chicken with Gravy',
      300,
      750, // Gemini calories
      45,
      20,
      30
    );

    expect(result.isMatch).toBe(true);
    expect(result.provenance).toBe('from local database (IFCT 2017)');
    expect(result.referenceCalories).toBe(495);
    expect(result.isSignificantDeviation).toBe(true);
    expect(result.deviationMessage).toContain('Reference (IFCT 2017): ~495 kcal for 300g. Gemini estimated 750 kcal.');
    expect(result.deviationPercent).toBeGreaterThan(0.35);
  });

  it('does NOT flag deviation when Gemini estimate is within 35% of IFCT reference', () => {
    // For 300g Murgh Makhani: reference = 495 kcal
    // Gemini estimates 520 kcal: deviation = (520 - 495) / 495 = 5.0% (<= 35%)
    const result = matchIndianFoodEstimate(
      'Butter Chicken',
      300,
      520, // Gemini calories
      38,
      14,
      32
    );

    expect(result.isMatch).toBe(true);
    expect(result.provenance).toBe('from local database (IFCT 2017)');
    expect(result.referenceCalories).toBe(495);
    expect(result.isSignificantDeviation).toBe(false);
    expect(result.deviationMessage).toBeUndefined();
    expect(result.deviationPercent).toBeLessThanOrEqual(0.35);
  });

  it('prefers user past correction over IFCT database reference', () => {
    // User previously logged home-made butter chicken with less butter (350 kcal for 300g)
    const userCorrections: UserMealCorrection[] = [
      {
        dishName: 'Butter Chicken',
        portionGrams: 300,
        calories: 350,
        protein: 36,
        carbs: 12,
        fat: 16,
        timestamp: Date.now() - 5000,
      },
    ];

    const result = matchIndianFoodEstimate(
      'Butter Chicken',
      300,
      600, // Gemini estimate
      40,
      20,
      35,
      userCorrections
    );

    expect(result.isMatch).toBe(true);
    expect(result.provenance).toBe('from your past corrections');
    expect(result.referenceCalories).toBe(350); // From user correction, not IFCT 495!
    expect(result.isSignificantDeviation).toBe(true);
    expect(result.deviationMessage).toContain('Reference (from your past corrections): ~350 kcal for 300g. Gemini estimated 600 kcal.');
  });

  it('falls through cleanly to pure Gemini for unknown non-Indian dishes', () => {
    const result = matchIndianFoodEstimate(
      'Grilled Salmon with Quinoa & Asparagus',
      350,
      480,
      42,
      32,
      18
    );

    expect(result.isMatch).toBe(false);
    expect(result.provenance).toBe('AI estimate');
    expect(result.referenceCalories).toBe(480);
    expect(result.isSignificantDeviation).toBe(false);
    expect(result.deviationMessage).toBeUndefined();
  });
});
