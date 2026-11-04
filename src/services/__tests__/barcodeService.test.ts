import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  fetchProductByBarcode,
  recalculateToxicityReport,
  clearBarcodeCaches,
  ProductNotFoundError,
} from '../barcodeService';

describe('Barcode Resolver & Risk Screening Service (barcodeService.ts)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearBarcodeCaches();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearBarcodeCaches();
  });

  describe('Curated Offline Presets', () => {
    it('resolves offline preset for Maggi without network fetch', async () => {
      let fetchCalled = false;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        throw new Error('Network should not be contacted for offline preset');
      }) as any;

      const report = await fetchProductByBarcode('8901030005702');
      expect(fetchCalled).toBe(false);
      expect(report.productName).toContain('Maggi');
      expect(report.category).toBe('Food & Beverages');
      expect(report.harmfulIngredients.length).toBeGreaterThan(0);
    });

    it('resolves offline preset for Coca-Cola without network fetch', async () => {
      const report = await fetchProductByBarcode('5449000000996');
      expect(report.productName).toContain('Coca-Cola');
      expect(report.category).toBe('Food & Beverages');
      expect(report.novaGroup).toBe(4);
    });
  });

  describe('OpenFoodFacts / OpenBeautyFacts Resolver with Proper User-Agent', () => {
    it('sends compliant User-Agent header and parses OFF payload', async () => {
      const capturedHeaders: Record<string, string>[] = [];
      const mockOffBarcode = '8901234567890';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        if (init?.headers) {
          capturedHeaders.push(init.headers as Record<string, string>);
        }

        if (urlStr.includes('openfoodfacts')) {
          return new Response(
            JSON.stringify({
              status: 1,
              product: {
                product_name: 'Organic Whole Grain Oats',
                ingredients_text: 'Rolled oats, chia seeds, flax seeds',
                additives_tags: [],
                nova_group: 1,
                nutriscore_grade: 'a',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ status: 0 }), { status: 404 });
      }) as typeof fetch;

      const report = await fetchProductByBarcode(mockOffBarcode);

      // Verify User-Agent requirement
      expect(capturedHeaders.length).toBeGreaterThan(0);
      const userAgent = capturedHeaders[0]['User-Agent'];
      expect(userAgent).toBe(
        'BetterYouApp/1.0 (fitness-nutrition-risk-screening; contact@betteryou.app)'
      );

      // Verify parsed output
      expect(report.productName).toBe('Organic Whole Grain Oats');
      expect(report.novaGroup).toBe(1);
      expect(report.nutriscoreGrade).toBe('a');
      expect(report.overallSafetyScore).toBeGreaterThanOrEqual(90);
    });

    it('falls back to OpenBeautyFacts when OpenFoodFacts does not have product', async () => {
      const mockObfBarcode = '8909876543210';

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('openfoodfacts')) {
          return new Response(JSON.stringify({ status: 0 }), { status: 200 });
        }
        if (urlStr.includes('openbeautyfacts')) {
          return new Response(
            JSON.stringify({
              status: 1,
              product: {
                product_name: 'Gentle Baby Lotion',
                ingredients_text: 'Aqua, Mineral Oil, Methylparaben, Fragrance',
                additives_tags: ['en:e218'],
                nova_group: null,
                nutriscore_grade: null,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 0 }), { status: 404 });
      }) as typeof fetch;

      const report = await fetchProductByBarcode(mockObfBarcode);
      expect(report.productName).toBe('Gentle Baby Lotion');
      expect(report.category).toBe('Baby Care');
      expect(report.harmfulIngredients.some((h) => h.name.toLowerCase().includes('paraben'))).toBe(true);
    });
  });

  describe('In-Memory Caching & Deduplication', () => {
    it('returns from in-memory cache on second request without re-fetching', async () => {
      let callCount = 0;
      const testBarcode = '8905555444433';

      globalThis.fetch = (async (url: string | URL | Request) => {
        callCount++;
        if (url.toString().includes('openfoodfacts')) {
          return new Response(
            JSON.stringify({
              status: 1,
              product: {
                product_name: 'Cached Snack Bar',
                ingredients_text: 'Dates, Almonds, Cocoa',
                additives_tags: [],
                nova_group: 3,
                nutriscore_grade: 'b',
              },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ status: 0 }), { status: 404 });
      }) as typeof fetch;

      const report1 = await fetchProductByBarcode(testBarcode);
      expect(report1.productName).toBe('Cached Snack Bar');
      const initialCalls = callCount;

      // Second query should hit memory cache immediately
      const report2 = await fetchProductByBarcode(testBarcode);
      expect(report2.productName).toBe('Cached Snack Bar');
      expect(callCount).toBe(initialCalls);
    });

    it('deduplicates concurrent in-flight requests for the same barcode', async () => {
      let callCount = 0;
      const testBarcode = '8907777888899';

      globalThis.fetch = (async (url: string | URL | Request) => {
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        if (url.toString().includes('openfoodfacts')) {
          return new Response(
            JSON.stringify({
              status: 1,
              product: {
                product_name: 'Concurrent Protein Cookie',
                ingredients_text: 'Whey protein, Oats, Stevia',
                additives_tags: [],
                nova_group: 3,
              },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ status: 0 }), { status: 404 });
      }) as typeof fetch;

      const [res1, res2] = await Promise.all([
        fetchProductByBarcode(testBarcode),
        fetchProductByBarcode(testBarcode),
      ]);

      expect(res1.productName).toBe('Concurrent Protein Cookie');
      expect(res2.productName).toBe('Concurrent Protein Cookie');
      // OFF and OBF called once each for the single in-flight deduplicated promise
      expect(callCount).toBe(2);
    });
  });

  describe('Negative Caching', () => {
    it('caches not-found barcodes and avoids subsequent network polling', async () => {
      let fetchCount = 0;
      const unknownBarcode = '9999999999999';

      globalThis.fetch = (async () => {
        fetchCount++;
        return new Response(JSON.stringify({ status: 0 }), { status: 200 });
      }) as any;

      // First query: fails and gets added to negative cache
      await expect(fetchProductByBarcode(unknownBarcode)).rejects.toThrow(ProductNotFoundError);
      expect(fetchCount).toBeGreaterThan(0);
      const callsAfterFirst = fetchCount;

      // Second query: immediately throws ProductNotFoundError from negative cache without calling fetch
      await expect(fetchProductByBarcode(unknownBarcode)).rejects.toThrow(ProductNotFoundError);
      expect(fetchCount).toBe(callsAfterFirst);

      // After clearing cache, fetch is invoked again
      clearBarcodeCaches();
      await expect(fetchProductByBarcode(unknownBarcode)).rejects.toThrow(ProductNotFoundError);
      expect(fetchCount).toBeGreaterThan(callsAfterFirst);
    });
  });

  describe('recalculateToxicityReport', () => {
    it('recalculates risk screening accurately when ingredients are edited', () => {
      const originalReport = {
        productName: 'Custom Biscuit',
        overallSafetyScore: 80,
        novaGroup: 3 as const,
        nutriscoreGrade: 'c' as const,
        barcode: '1122334455',
      };

      const updated = recalculateToxicityReport(
        'Custom Biscuit',
        ['Wheat Flour', 'Sugar', 'Palm Oil', 'Tartrazine E102', 'Titanium Dioxide E171'],
        originalReport as any
      );

      expect(updated.productName).toBe('Custom Biscuit');
      expect(updated.barcode).toBe('1122334455');
      expect(updated.allIngredients?.length).toBe(5);
      // Tartrazine (E102) and Titanium Dioxide (E171) should be flagged
      expect(updated.harmfulIngredients.length).toBeGreaterThanOrEqual(2);
      expect(updated.overallSafetyScore).toBeLessThan(80);
    });
  });
});
