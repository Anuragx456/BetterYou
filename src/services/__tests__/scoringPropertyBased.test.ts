import { describe, it, expect } from 'bun:test';
import {
  assert,
  property,
  string,
  option,
  integer,
  constantFrom,
  stringMatching,
} from 'fast-check';
import {
  analyzeIngredientsAndAdditives,
} from '../barcodeService';
import { getClassCap } from '../ingredientNormalizer';
import { NovaGroup, NutriscoreGrade } from '../../types';

describe('Property-Based Invariant Tests for Scoring Engine (fast-check)', () => {
  it('Property 1: Safety score is strictly bounded between 5 and 100 for all inputs', () => {
    assert(
      property(
        string(),
        string(),
        option(integer({ min: 1, max: 4 }), { nil: null }),
        option(constantFrom('a', 'b', 'c', 'd', 'e'), { nil: null }),
        (name, ingredients, nova, nutri) => {
          const report = analyzeIngredientsAndAdditives(
            name,
            ingredients,
            [],
            nova as NovaGroup | null,
            nutri as NutriscoreGrade | null
          );

          expect(report.overallSafetyScore).toBeGreaterThanOrEqual(5);
          expect(report.overallSafetyScore).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 2: Bucket risk levels match clamped score boundaries exactly', () => {
    assert(
      property(
        string(),
        string(),
        (name, ingredients) => {
          const report = analyzeIngredientsAndAdditives(name, ingredients);
          const score = report.overallSafetyScore;

          if (report.hasInsufficientData) {
            expect(report.overallSafetyScore).toBe(50);
            expect(report.riskLevel).toBe('Moderate');
          } else if (score >= 71) {
            expect(report.riskLevel).toBe('Safe');
            expect(report.hazardRating).toBe('Low Hazard');
          } else if (score >= 40) {
            expect(report.riskLevel).toBe('Moderate');
            expect(report.hazardRating).toBe('Moderate Hazard');
          } else {
            expect(report.riskLevel).toBe('High Risk');
            expect(report.hazardRating).toBe('High Hazard');
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it('Property 3: Empty or unreadable ingredient text is capped at 50', () => {
    assert(
      property(
        string(),
        stringMatching(/^\s*$/),
        (name, whitespaceOnly) => {
          const report = analyzeIngredientsAndAdditives(name, whitespaceOnly);
          expect(report.overallSafetyScore).toBe(50);
          expect(report.hasInsufficientData).toBe(true);
          expect(report.riskLevel).toBe('Moderate');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 4: Monotonicity - adding a recognized harmful additive never increases the score', () => {
    const harmfulAdditives = ['TBHQ', 'Sodium Nitrite', 'Tartrazine', 'Monosodium Glutamate', 'Benzalkonium Chloride'];

    assert(
      property(
        constantFrom(...harmfulAdditives),
        (additive) => {
          const baseIngredients = 'Wheat Flour, Water, Yeast, Salt, Sugar';
          const reportBase = analyzeIngredientsAndAdditives('Bread', baseIngredients);

          const contaminatedIngredients = `${baseIngredients}, ${additive}`;
          const reportContaminated = analyzeIngredientsAndAdditives('Bread', contaminatedIngredients);

          expect(reportContaminated.overallSafetyScore).toBeLessThanOrEqual(reportBase.overallSafetyScore);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5: Class Cap - stacking multiple same-class additives cannot exceed defined class cap', () => {
    const colors = [
      'Tartrazine (INS 102)',
      'Sunset Yellow (INS 110)',
      'Allura Red (INS 129)',
      'Ponceau 4R (INS 124)',
      'Brilliant Blue (INS 133)',
      'Ammonia Caramel (INS 150d)',
    ];

    const report = analyzeIngredientsAndAdditives(
      'Rainbow Candy',
      `Sugar, Glucose Syrup, ${colors.join(', ')}`
    );

    const colorItems = report.harmfulIngredients.filter((h) => h.additiveClass === 'artificial_color');
    const totalDeduction = colorItems.reduce((sum, h) => sum + (h.deduction ?? 0), 0);
    const colorCap = getClassCap('artificial_color');

    expect(totalDeduction).toBeLessThanOrEqual(colorCap);
  });
});
