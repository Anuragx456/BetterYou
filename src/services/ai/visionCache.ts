import { MealAnalysisResult, ToxicityReport } from '../../types';

export const MAX_SCAN_CACHE_ENTRIES = 50;
export const toxicityScanCache = new Map<string, { report: ToxicityReport; timestamp: number }>();
export const toxicityImageHashCache = new Map<string, { report: ToxicityReport; timestamp: number }>();
export const mealImageHashCache = new Map<string, { result: MealAnalysisResult; timestamp: number }>();
export const SCAN_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function setBoundedCache<K, V>(cache: Map<K, V>, key: K, value: V): void {
  if (cache.size >= MAX_SCAN_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(key, value);
}

export function clearAiVisionCaches(): void {
  toxicityScanCache.clear();
  toxicityImageHashCache.clear();
  mealImageHashCache.clear();
}

export async function hashImagePayload(base64: string): Promise<string> {
  if (!base64) return '';
  const sample =
    base64.length <= 2048
      ? base64
      : `${base64.length}:${base64.slice(0, 1024)}:${base64.slice(-1024)}`;
  try {
    const Crypto = await import('expo-crypto');
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sample);
  } catch {
    return '';
  }
}

export async function hashImageFile(uri: string): Promise<string> {
  if (!uri || uri.startsWith('data:')) return '';
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    if (!file.exists) return '';
    return await file.digest('SHA-256');
  } catch {
    return '';
  }
}

export async function readPersistedVisionCache<T>(key: string): Promise<T | null> {
  try {
    const { getDatabase } = await import('../../db/client');
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ payload: string; created_at: number }>(
      'SELECT payload, created_at FROM vision_cache WHERE cache_key = ?',
      [key]
    );
    if (!row) return null;
    if (Date.now() - Number(row.created_at) > SCAN_CACHE_TTL_MS) {
      await db.runAsync('DELETE FROM vision_cache WHERE cache_key = ?', [key]);
      return null;
    }
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export async function writePersistedVisionCache(key: string, payload: unknown): Promise<void> {
  try {
    const { getDatabase } = await import('../../db/client');
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO vision_cache (cache_key, payload, created_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(payload), Date.now()]
    );
    await db.runAsync(
      `DELETE FROM vision_cache WHERE cache_key NOT IN (
        SELECT cache_key FROM vision_cache ORDER BY created_at DESC LIMIT ${MAX_SCAN_CACHE_ENTRIES}
      )`
    );
  } catch {
    // Memory cache still serves this process.
  }
}
