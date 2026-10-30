import { describe, expect, it } from 'bun:test';
import {
  analyzeIngredientsAndAdditives,
  recomputeReportScoreAndRisk,
} from '../barcodeService';

describe('Toxicity Scoring Engine', () => {
  it('caps score at 50 for empty or unreadable ingredient data', () => {
    const reportEmpty = analyzeIngredientsAndAdditives('Mystery Product', '', [], null, null);
    expect(reportEmpty.overallSafetyScore).toBe(50);
    expect(reportEmpty.riskLevel).toBe('Moderate');
    expect(reportEmpty.safeFor).toContain('Unverified Ingredients');
    expect(reportEmpty.cleanSummary).toContain('insufficient ingredient data');
  });

  it('drops "Certified" and uses factual statements', () => {
    const reportClean = analyzeIngredientsAndAdditives(
      'Organic Oats',
      'Whole grain rolled oats',
      [],
      1,
      'a'
    );
    expect(reportClean.overallSafetyScore).toBeGreaterThanOrEqual(71);
    expect(reportClean.safeFor).not.toContain('Clean Label Certified');
    expect(reportClean.safeFor).toContain('No Flagged Additives');
  });

  it('does not emit Palm Oil-Free on non-food cleaning products', () => {
    const reportCleaner = analyzeIngredientsAndAdditives(
      'Floor Disinfectant Wash',
      'Aqua, surfactants, fragrance',
      [],
      null,
      null
    );
    expect(reportCleaner.category).toBe('Household & Cleaning');
    expect(reportCleaner.safeFor).not.toContain('Palm Oil-Free');
  });

  it('recomputes safety score and risk when new additives are merged', () => {
    const baseReport = analyzeIngredientsAndAdditives(
      'Snack Biscuit',
      'Wheat flour, sugar, vegetable oil',
      [],
      3,
      'c'
    );
    const originalScore = baseReport.overallSafetyScore;

    // Simulate Gemini multimodal vision detecting hazardous additives
    baseReport.harmfulIngredients.push(
      {
        name: 'TBHQ (INS 319)',
        category: 'Petroleum Preservative',
        healthImpact: 'Synthetic antioxidant linked to cellular toxicity.',
        severity: 'high',
      },
      {
        name: 'Titanium Dioxide (INS 171)',
        category: 'Whitening Colorant',
        healthImpact: 'Nanoparticle genotoxicity concern.',
        severity: 'high',
      }
    );

    const updated = recomputeReportScoreAndRisk(baseReport);
    expect(updated.overallSafetyScore).toBeLessThan(originalScore);
    expect(updated.overallSafetyScore).toBeLessThanOrEqual(50);
    expect(updated.riskLevel).not.toBe('Safe');
  });
});
