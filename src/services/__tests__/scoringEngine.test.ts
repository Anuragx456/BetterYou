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

  it('applies concentration position weighting (primary vs trace ingredient)', () => {
    // Primary ingredient (index 0) gets 1.5x multiplier
    const reportPrimary = analyzeIngredientsAndAdditives(
      'Hair Oil A',
      'Light Liquid Paraffin, Perfume',
      []
    );
    // Trace ingredient (near end of long list) gets 0.7x multiplier
    const reportTrace = analyzeIngredientsAndAdditives(
      'Hair Oil B',
      'Almond Oil, Sesame Oil, Coconut Oil, Amla, Bhringraj, Brahmi, Methi, Neem, Jatamansi, Light Liquid Paraffin',
      []
    );

    const primaryDeduction = reportPrimary.harmfulIngredients.find((h) => h.name.includes('Light Liquid Paraffin'))?.deduction ?? 0;
    const traceDeduction = reportTrace.harmfulIngredients.find((h) => h.name.includes('Light Liquid Paraffin'))?.deduction ?? 0;

    expect(primaryDeduction).toBeGreaterThan(traceDeduction);
    expect(reportPrimary.overallSafetyScore).toBeLessThan(reportTrace.overallSafetyScore);
  });

  it('enforces same-class deduction caps (e.g. artificial colors capped at 12)', () => {
    // Product with 4 different artificial colors
    const reportColors = analyzeIngredientsAndAdditives(
      'Multi-Color Candy',
      'Sugar, Glucose, Tartrazine (INS 102), Sunset Yellow (INS 110), Allura Red (INS 129), Brilliant Blue (INS 133)',
      [],
      null,
      null
    );

    const colorItems = reportColors.harmfulIngredients.filter((h) => h.category === 'artificial_color');
    expect(colorItems.length).toBeGreaterThanOrEqual(3);

    const totalColorDeductions = colorItems.reduce((acc, h) => acc + (h.deduction ?? 0), 0);
    expect(totalColorDeductions).toBeLessThanOrEqual(12); // Class cap for artificial colors is 12
  });

  it('preserves empty-data safeguard in recomputeReportScoreAndRisk', () => {
    const emptyReport = analyzeIngredientsAndAdditives('Unknown Box', '', [], null, null);
    expect(emptyReport.overallSafetyScore).toBe(50);
    expect(emptyReport.hasInsufficientData).toBe(true);

    const recomputed = recomputeReportScoreAndRisk(emptyReport);
    expect(recomputed.overallSafetyScore).toBe(50);
    expect(recomputed.riskLevel).toBe('Moderate');
  });

  it('includes per-ingredient why, source citation, and concentration rank', () => {
    const report = analyzeIngredientsAndAdditives(
      'Spicy Potato Chips',
      'Potatoes, Palmolein Oil, Salt, TBHQ',
      [],
      null,
      null
    );

    const tbhq = report.harmfulIngredients.find((h) => h.name.includes('TBHQ'));
    expect(tbhq).toBeDefined();
    expect(tbhq?.rationale).toBeDefined();
    expect(tbhq?.source).toContain('EFSA');
    expect(tbhq?.sourceUrl).toContain('https://');
    expect(tbhq?.concentrationRank).toBeDefined();
    expect(tbhq?.deduction).toBeGreaterThan(0);
  });
});
