import { describe, it, expect, beforeEach } from 'bun:test';
import {
  analyzeMealImage,
  analyzeIngredientsImage,
  extractJsonString,
  clearAiVisionCaches,
} from '../aiVisionService';

describe('AI Vision Service Hardening (aiVisionService.ts)', () => {
  beforeEach(() => {
    clearAiVisionCaches();
  });

  describe('extractJsonString', () => {
    it('extracts JSON from standard markdown code blocks', () => {
      const markdown = 'Here is the response:\n```json\n{"dishName":"Biryani","calories":650}\n```\nHope that helps!';
      const extracted = extractJsonString(markdown);
      expect(extracted).toBe('{"dishName":"Biryani","calories":650}');
    });

    it('extracts JSON using outermost brace boundaries', () => {
      const raw = 'Leading noise {"dishName":"Dosa","calories":220} trailing noise';
      const extracted = extractJsonString(raw);
      expect(extracted).toBe('{"dishName":"Dosa","calories":220}');
    });
  });

  describe('analyzeMealImage (Demo & Plausibility)', () => {
    it('returns structured demo meal with macro plausibility verified', async () => {
      const result = await analyzeMealImage('demo_sample');
      expect(result.dishName).toBe('Grilled Chicken Breast with Quinoa & Mixed Greens');
      expect(result.calories).toBe(480);
      expect(result.isPlausible).toBe(true);
      expect(result.ingredientsDetected.length).toBeGreaterThan(0);
      expect(result.generatedBy).toBe('offline-demo-mock');
    });

    it('rejects empty image inputs cleanly', async () => {
      expect(analyzeMealImage('')).rejects.toThrow('No image data was provided');
    });
  });

  describe('analyzeIngredientsImage (Demo & Caching)', () => {
    it('returns structured demo report for hair oil hint', async () => {
      const report = await analyzeIngredientsImage('almond hair oil demo');
      expect(report.productName).toBe('Commercial Hair Oil');
      expect(report.category).toBe('Hair Care');
      expect(report.overallSafetyScore).toBe(42);
      expect(report.indianMarketAlert).toContain('Hair Oil Trap');
      expect(report.harmfulIngredients.length).toBe(2);
    });

    it('caches results and returns identical report on repeated scan', async () => {
      const report1 = await analyzeIngredientsImage('almond hair oil demo');
      const report2 = await analyzeIngredientsImage('almond hair oil demo');
      expect(report1.overallSafetyScore).toBe(report2.overallSafetyScore);
      expect(report1.productName).toBe(report2.productName);
    });

    it('retries with different product name using productNameHint in options', async () => {
      const originalReport = await analyzeIngredientsImage('almond hair oil demo');
      expect(originalReport.productName).toBe('Commercial Hair Oil');

      const retriedReport = await analyzeIngredientsImage('almond hair oil demo', {
        productNameHint: 'Bajaj Almond Drops Non-Sticky Hair Oil',
        isExplicitDemo: true,
      });
      expect(retriedReport.productName).toBe('Bajaj Almond Drops Non-Sticky Hair Oil');
      expect(retriedReport.category).toBe('Hair Care');
    });
  });
});
