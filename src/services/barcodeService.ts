/**
 * Barcode Service Barrel
 *
 * Modular architecture:
 * - src/services/barcode/presets.ts: Verified Indian Supermarket preset database
 * - src/services/barcode/scoringEngine.ts: Toxicological rules & safety score calculation
 * - src/services/barcode/barcodeCache.ts: Memory and negative caches with deduplication
 * - src/services/barcode/offResolver.ts: OpenFoodFacts & OpenBeautyFacts API fetcher
 * - src/services/barcode/types.ts: Error classes and API types
 */

export { ProductNotFoundError } from './barcode/types';
export type { OpenFactsProductResponse } from './barcode/types';

export { INDIAN_SUPERMARKET_PRESETS } from './barcode/presets';

export {
  detectSupermarketCategory,
  getCategoryRegulatoryDetails,
  getIndianMarketAlert,
  computeSafeForTags,
  analyzeIngredientsAndAdditives,
  recomputeReportScoreAndRisk,
  recalculateToxicityReport,
} from './barcode/scoringEngine';

export {
  barcodeMemoryCache,
  inFlightLookups,
  negativeBarcodeCache,
  clearBarcodeCaches,
} from './barcode/barcodeCache';

export { fetchProductByBarcode } from './barcode/offResolver';
