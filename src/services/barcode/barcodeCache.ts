import { ToxicityReport } from '../../types';

export const barcodeMemoryCache = new Map<string, ToxicityReport>();
export const inFlightLookups = new Map<string, Promise<ToxicityReport>>();
export const negativeBarcodeCache = new Map<string, number>();
export const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearBarcodeCaches(): void {
  barcodeMemoryCache.clear();
  inFlightLookups.clear();
  negativeBarcodeCache.clear();
}
