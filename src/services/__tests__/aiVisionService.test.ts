import { describe, it, expect, beforeEach } from 'bun:test';
import {
  analyzeMealImage,
  analyzeIngredientsImage,
  extractJsonString,
  clearAiVisionCaches,
  geminiModelsInOrder,
  nextGeminiModelIndex,
  isGeminiModelMissingMessage,
} from '../aiVisionService';

describe('AI Vision Service Hardening (aiVisionService.ts)', () => {
  beforeEach(async () => {
    clearAiVisionCaches();
    try {
      const { getDatabase } = await import('../../db/client');
      const db = await getDatabase();
      await db.runAsync('DELETE FROM vision_cache');
    } catch {
      // The vision cache table is created with the database.
    }
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

    it('serves a repeated meal photo from the persisted cache without a second fetch', async () => {
      const originalFetch = globalThis.fetch;
      let calls = 0;
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const urlStr = String(input);
        if (urlStr.includes('/v1/devices/register')) {
          return new Response(
            JSON.stringify({ deviceId: 'test_dev_cache', deviceSecret: 'c'.repeat(64) }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        }
        calls += 1;
        const body = {
          text: JSON.stringify({
            dishName: 'Cache Bowl',
            estimatedWeightGrams: 300,
            calories: 400,
            protein: 30,
            carbs: 40,
            fat: 12,
            ingredientsDetected: ['Rice'],
          }),
          usedModel: 'gemini-3.6-flash',
        };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as unknown as typeof fetch;

      try {
        const image = 'A'.repeat(600);
        const first = await analyzeMealImage(image);
        clearAiVisionCaches();
        const second = await analyzeMealImage(image);
        expect(first.dishName).toBe('Cache Bowl');
        expect(second.dishName).toBe(first.dishName);
        expect(second.calories).toBe(first.calories);
        expect(calls).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
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

    it('uses the model selected in settings for product screening analysis and isolates cache across models', async () => {
      const { useSettingsStore } = await import('../../store/useSettingsStore');
      const originalFetch = globalThis.fetch;
      const requestedModels: string[] = [];

      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        let sentModel = 'unknown';
        if (init?.body) {
          try {
            const parsedBody = JSON.parse(String(init.body));
            sentModel = parsedBody.model || 'unknown';
          } catch {
            // ignore
          }
        }
        requestedModels.push(sentModel);

        const body = {
          text: JSON.stringify({
            productName: 'Screened Green Tea',
            category: 'Food & Beverages',
            allIngredients: ['Green Tea Leaves'],
            harmfulIngredients: [],
            overallSafetyScore: 95,
            cleanSummary: 'Pure clean green tea.',
          }),
          usedModel: sentModel,
        };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as unknown as typeof fetch;

      try {
        const testImage = 'B'.repeat(600);

        // 1. Scan with Default Model (gemini-3.6-flash)
        useSettingsStore.getState().setSelectedModel('gemini-3.6-flash');
        const report1 = await analyzeIngredientsImage(testImage);
        expect(report1.generatedBy).toBe('gemini-3.6-flash');
        expect(requestedModels[0]).toBe('gemini-3.6-flash');

        // 2. User switches to Gemini 3.5 Flash Lite in Settings
        useSettingsStore.getState().setSelectedModel('gemini-3.5-flash-lite');

        // 3. Scan same item under new model: must invoke the new model, NOT return stale gemini-3.6-flash cache
        const report2 = await analyzeIngredientsImage(testImage);
        expect(report2.generatedBy).toBe('gemini-3.5-flash-lite');
        expect(requestedModels[1]).toBe('gemini-3.5-flash-lite');

        // Restore default
        useSettingsStore.getState().resetSettings();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

describe('Gemini fallback budget', () => {
  it('keeps the chosen model first and does not duplicate it', () => {
    expect(geminiModelsInOrder('gemini-2.5-flash')).toEqual([
      'gemini-2.5-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
    ]);
  });

  it('allows one real fallback, then stops unless the model is missing', () => {
    const first = nextGeminiModelIndex({ index: 0, realFallbackUsed: false, modelCount: 3 }, 'failed');
    expect(first).toEqual({ index: 1, realFallbackUsed: true });
    expect(
      nextGeminiModelIndex({ index: 1, realFallbackUsed: true, modelCount: 3 }, 'failed')
    ).toBeNull();
    const missing = nextGeminiModelIndex({ index: 1, realFallbackUsed: true, modelCount: 3 }, 'missing');
    expect(missing).toEqual({ index: 2, realFallbackUsed: true });
  });

  it('recognizes a missing-model response without treating every 400 as missing', () => {
    expect(isGeminiModelMissingMessage('models/gemini-x is not found')).toBe(true);
    expect(isGeminiModelMissingMessage('API key not valid')).toBe(false);
  });
});
