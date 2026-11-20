import { NovaGroup, NutriscoreGrade, ToxicityReport } from '../../types';
import { ProductNotFoundError, OpenFactsProductResponse } from './types';
import { INDIAN_SUPERMARKET_PRESETS } from './presets';
import {
  barcodeMemoryCache,
  inFlightLookups,
  negativeBarcodeCache,
  NEGATIVE_CACHE_TTL_MS,
} from './barcodeCache';
import { analyzeIngredientsAndAdditives } from './scoringEngine';

/**
 * Fetches product metadata and ingredients from OpenFoodFacts and OpenBeautyFacts APIs
 */
export async function fetchProductByBarcode(barcode: string): Promise<ToxicityReport> {
  const cleanBarcode = barcode.trim();

  // 1. Instant check against verified offline presets (<1ms response time)
  if (INDIAN_SUPERMARKET_PRESETS[cleanBarcode]) {
    return { ...INDIAN_SUPERMARKET_PRESETS[cleanBarcode] };
  }

  // 2. Instant check against in-memory barcode cache (<1ms response time)
  if (barcodeMemoryCache.has(cleanBarcode)) {
    return barcodeMemoryCache.get(cleanBarcode)!;
  }

  // Check negative cache to prevent rapid polling of unregistered barcodes
  const negativeTimestamp = negativeBarcodeCache.get(cleanBarcode);
  if (negativeTimestamp && Date.now() - negativeTimestamp < NEGATIVE_CACHE_TTL_MS) {
    throw new ProductNotFoundError(cleanBarcode);
  }

  // 3. Deduplicate concurrent in-flight requests for the same barcode
  if (inFlightLookups.has(cleanBarcode)) {
    return inFlightLookups.get(cleanBarcode)!;
  }

  // 4. Parallel multi-database lookup with field filtering (~2KB instead of ~80KB per query)
  const queryFields =
    'product_name,product_name_en,product_name_hi,ingredients_text,ingredients_text_en,additives_tags,nova_group,nutriscore_grade';
  const endpoints = [
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json?fields=${queryFields}`,
    `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json?fields=${queryFields}`,
  ];

  const fetchEndpoint = async (url: string): Promise<ToxicityReport> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'BetterYouApp/1.0 (fitness-nutrition-risk-screening; contact@betteryou.app)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as OpenFactsProductResponse;
      if (data.status === 1 && data.product) {
        const prod = data.product;
        const productName =
          prod.product_name ||
          prod.product_name_en ||
          prod.product_name_hi ||
          `Product (${cleanBarcode})`;
        const ingredientsText = prod.ingredients_text || prod.ingredients_text_en || '';
        const additivesTags = Array.isArray(prod.additives_tags) ? prod.additives_tags : [];

        const rawNova = prod.nova_group;
        const novaGroup: NovaGroup | null =
          rawNova === 1 || rawNova === 2 || rawNova === 3 || rawNova === 4 ? rawNova : null;

        const rawNutri = prod.nutriscore_grade?.toLowerCase();
        const nutriscoreGrade: NutriscoreGrade | null =
          rawNutri === 'a' || rawNutri === 'b' || rawNutri === 'c' || rawNutri === 'd' || rawNutri === 'e'
            ? rawNutri
            : null;

        const report = analyzeIngredientsAndAdditives(
          productName,
          ingredientsText,
          additivesTags,
          novaGroup,
          nutriscoreGrade
        );

        report.barcode = cleanBarcode;
        return report;
      }
      throw new Error('Product not found in this database');
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const lookupPromise = (async () => {
    try {
      const report = await Promise.any(endpoints.map((ep) => fetchEndpoint(ep)));
      barcodeMemoryCache.set(cleanBarcode, report);
      return report;
    } catch {
      negativeBarcodeCache.set(cleanBarcode, Date.now());
      throw new ProductNotFoundError(cleanBarcode);
    } finally {
      inFlightLookups.delete(cleanBarcode);
    }
  })();

  inFlightLookups.set(cleanBarcode, lookupPromise);
  return lookupPromise;
}
