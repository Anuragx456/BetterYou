import { describe, it, expect } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  computeOcrRecall,
  resolveSampleImagePath,
  runEmpiricalEvaluation,
  EvalManifest,
} from '../run-eval';

describe('Evaluation Harness (evals/run-eval.ts)', () => {
  it('loads valid 50-item benchmark dataset manifest', () => {
    const manifestPath = join(__dirname, '..', 'dataset', 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as EvalManifest;

    expect(manifest.version).toBe('2.0.0');
    expect(manifest.totalSamples).toBe(50);
    expect(manifest.meals.length).toBe(25);
    expect(manifest.products.length).toBe(25);

    // Verify first meal structure
    const meal1 = manifest.meals[0];
    expect(meal1.id).toBe('meal_01');
    expect(meal1.imageFile).toBeNull();
    expect(meal1.groundTruthCalories).toBeGreaterThan(0);
    expect(meal1.groundTruthProtein).toBeGreaterThan(0);
    expect(meal1.ingredients.length).toBeGreaterThan(0);

    // Verify first product structure
    const prod1 = manifest.products[0];
    expect(prod1.id).toBe('prod_01');
    expect(prod1.imageFile).toBeNull();
    expect(prod1.productName).toBe('Kurkure Masala Munch');
    expect(prod1.ingredients.length).toBeGreaterThan(0);
  });

  it('accurately resolves sample image paths and gates missing files', () => {
    // Null or undefined image file
    expect(resolveSampleImagePath('meals', null)).toBeNull();
    expect(resolveSampleImagePath('meals', undefined)).toBeNull();

    // Non-existent image file
    expect(resolveSampleImagePath('meals', 'non_existent_meal.jpg')).toBeNull();
    expect(resolveSampleImagePath('products', 'non_existent_prod.jpg')).toBeNull();
  });

  it('accurately calculates OCR ingredient recall percentage', () => {
    const groundTruth = ['Corn Meal', 'Rice Meal', 'Palmolein Oil', 'TBHQ'];
    const detectedFull = ['Corn Meal', 'Rice Meal', 'Palmolein Oil', 'TBHQ', 'Salt'];
    expect(computeOcrRecall(detectedFull, groundTruth)).toBe(1.0);

    const detectedPartial = ['Corn Meal', 'Rice Meal'];
    expect(computeOcrRecall(detectedPartial, groundTruth)).toBe(0.5);

    const detectedEmpty: string[] = [];
    expect(computeOcrRecall(detectedEmpty, groundTruth)).toBe(0.0);

    expect(computeOcrRecall(['Any'], [])).toBe(1.0);
  });

  it('reports honest skipped_no_image when dataset has no real photos on disk', () => {
    const raw = readFileSync(join(__dirname, '..', 'dataset', 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw) as EvalManifest;

    const report = runEmpiricalEvaluation(manifest);

    expect(report.manifestVersion).toBe('2.0.0');
    expect(report.totalManifestSamples).toBe(50);
    expect(report.totalEvaluated).toBe(0);
    expect(report.totalSkippedNoImage).toBe(50);
    expect(report.mealsEvaluatedCount).toBe(0);
    expect(report.mealsSkippedCount).toBe(25);
    expect(report.productsEvaluatedCount).toBe(0);
    expect(report.productsSkippedCount).toBe(25);
    expect(report.benchmarkStatus).toBe('text-only synthetic baseline, photo evaluation pending');

    expect(report.models.length).toBe(4);
    for (const model of report.models) {
      expect(model.status).toBe('skipped_no_image');
      expect(model.totalMealsEvaluated).toBe(0);
      expect(model.totalProductsEvaluated).toBe(0);
      // No fabricated accuracy numbers
      expect(model.maeCaloriesKcal).toBeUndefined();
      expect(model.ocrIngredientRecallPercent).toBeUndefined();
      expect(model.macroPlausibilityPassRate).toBeUndefined();
    }
  });

  it('scores entries when real images are present on disk', () => {
    const tempDir = join(__dirname, '..', 'dataset', '__test_images__');
    const mealsDir = join(tempDir, 'meals');
    const prodsDir = join(tempDir, 'products');

    mkdirSync(mealsDir, { recursive: true });
    mkdirSync(prodsDir, { recursive: true });

    writeFileSync(join(mealsDir, 'test_meal.jpg'), 'fake_image_bytes');
    writeFileSync(join(prodsDir, 'test_prod.jpg'), 'fake_image_bytes');

    try {
      const mockManifest: EvalManifest = {
        version: '1.0.0-test',
        totalSamples: 2,
        meals: [
          {
            id: 'test_m1',
            imageFile: 'test_meal.jpg',
            dishName: 'Paneer Butter Masala',
            groundTruthCalories: 450,
            groundTruthProtein: 16,
            groundTruthCarbs: 18,
            groundTruthFat: 36,
            groundTruthWeightGrams: 300,
            ingredients: ['Paneer', 'Butter', 'Tomato', 'Cream'],
          },
        ],
        products: [
          {
            id: 'test_p1',
            imageFile: 'test_prod.jpg',
            productName: 'Sample Biscuit',
            category: 'Bakery',
            novaGroup: 4,
            nutriscoreGrade: 'd',
            ingredients: ['Wheat Flour', 'Sugar', 'Palm Oil', 'TBHQ'],
            harmfulAdditives: ['TBHQ'],
          },
        ],
      };

      const report = runEmpiricalEvaluation(mockManifest, tempDir);

      expect(report.totalEvaluated).toBe(2);
      expect(report.totalSkippedNoImage).toBe(0);
      expect(report.mealsEvaluatedCount).toBe(1);
      expect(report.productsEvaluatedCount).toBe(1);
      expect(report.benchmarkStatus).toBe('empirical photo evaluation complete');

      for (const model of report.models) {
        expect(model.status).toBe('scored');
        expect(model.totalMealsEvaluated).toBe(1);
        expect(model.totalProductsEvaluated).toBe(1);
        expect(typeof model.maeCaloriesKcal).toBe('number');
        expect(typeof model.ocrIngredientRecallPercent).toBe('number');
        expect(typeof model.macroPlausibilityPassRate).toBe('number');
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
