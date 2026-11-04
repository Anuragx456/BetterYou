import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  computeOcrRecall,
  runEmpiricalEvaluation,
  EvalDataset,
} from '../run-eval';

describe('Evaluation Harness (evals/run-eval.ts)', () => {
  it('loads valid 50-item benchmark dataset metadata', () => {
    const raw = readFileSync(join(__dirname, '..', 'dataset', 'metadata.json'), 'utf8');
    const dataset = JSON.parse(raw) as EvalDataset;

    expect(dataset.version).toBe('1.0.0');
    expect(dataset.totalSamples).toBe(50);
    expect(dataset.meals.length).toBe(25);
    expect(dataset.products.length).toBe(25);

    // Verify first meal structure
    const meal1 = dataset.meals[0];
    expect(meal1.id).toBe('meal_01');
    expect(meal1.groundTruthCalories).toBeGreaterThan(0);
    expect(meal1.groundTruthProtein).toBeGreaterThan(0);
    expect(meal1.ingredients.length).toBeGreaterThan(0);

    // Verify first product structure
    const prod1 = dataset.products[0];
    expect(prod1.id).toBe('prod_01');
    expect(prod1.productName).toBe('Kurkure Masala Munch');
    expect(prod1.ingredients.length).toBeGreaterThan(0);
  });

  it('accurately calculates OCR ingredient recall percentage', () => {
    const groundTruth = ['Corn Meal', 'Rice Meal', 'Palmolein Oil', 'TBHQ'];
    const detectedFull = ['Corn Meal', 'Rice Meal', 'Palmolein Oil', 'TBHQ', 'Salt'];
    expect(computeOcrRecall(detectedFull, groundTruth)).toBe(1.0);

    const detectedPartial = ['Corn Meal', 'Rice Meal'];
    expect(computeOcrRecall(detectedPartial, groundTruth)).toBe(0.5);

    const detectedEmpty: string[] = [];
    expect(computeOcrRecall(detectedEmpty, groundTruth)).toBe(0.0);
  });

  it('runs empirical evaluation across all 4 models and reports MAE metrics', () => {
    const raw = readFileSync(join(__dirname, '..', 'dataset', 'metadata.json'), 'utf8');
    const dataset = JSON.parse(raw) as EvalDataset;

    const results = runEmpiricalEvaluation(dataset);
    expect(results.length).toBe(4);

    for (const r of results) {
      expect(r.maeCaloriesKcal).toBeGreaterThan(10);
      expect(r.maeCaloriesKcal).toBeLessThan(60);
      expect(r.ocrIngredientRecallPercent).toBeGreaterThan(80);
      expect(r.macroPlausibilityPassRate).toBeGreaterThanOrEqual(95);
    }
  });
});
