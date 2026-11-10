import type { NetInfoState } from '@react-native-community/netinfo';
import { safeAsyncStorage } from '../utils/storage';
import { getFullImageUri } from '../utils/imageManager';
import { dbInsertMeal, dbInsertScannedProduct } from '../db/client';

export interface QueuedScanItem {
  id: string;
  type: 'meal' | 'toxicity';
  imagePath: string; // Relative path in documentDirectory or file URI
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed';
}

const SCAN_QUEUE_STORAGE_KEY = 'betteryou-pending-scan-queue';
let isProcessingQueue = false;
let isListenerInitialized = false;
let unsubscribeNetInfo: (() => void) | null = null;

type NetInfoType = typeof import('@react-native-community/netinfo');
let netInfoModule: NetInfoType | null = null;

async function getNetInfo(): Promise<NetInfoType | null> {
  if (netInfoModule) return netInfoModule;
  if (typeof window === 'undefined' && !(globalThis as Record<string, unknown>).nativeCallSyncHook) {
    return null;
  }
  try {
    netInfoModule = await import('@react-native-community/netinfo');
    return netInfoModule;
  } catch {
    return null;
  }
}

/**
 * Retrieves all currently queued pending scans from local storage
 */
export async function getQueuedScans(): Promise<QueuedScanItem[]> {
  try {
    const raw = await safeAsyncStorage.getItem(SCAN_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists the scan queue to local storage
 */
async function saveQueuedScans(items: QueuedScanItem[]): Promise<void> {
  await safeAsyncStorage.setItem(SCAN_QUEUE_STORAGE_KEY, JSON.stringify(items));
}

/**
 * Clears the queue (used for testing and diagnostics)
 */
export async function clearQueuedScans(): Promise<void> {
  await safeAsyncStorage.removeItem(SCAN_QUEUE_STORAGE_KEY);
}

/**
 * Enqueues a failed or offline scan for background retry when connectivity returns
 */
export async function enqueueOfflineScan(
  type: 'meal' | 'toxicity',
  imagePath: string,
  lastError?: string
): Promise<QueuedScanItem> {
  const scans = await getQueuedScans();
  const newItem: QueuedScanItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    imagePath,
    createdAt: Date.now(),
    attempts: 0,
    lastError,
    status: 'pending',
  };

  scans.push(newItem);
  await saveQueuedScans(scans);
  return newItem;
}

/**
 * Removes a completed item from the queue
 */
export async function removeQueuedScan(id: string): Promise<void> {
  const scans = await getQueuedScans();
  const filtered = scans.filter((s) => s.id !== id);
  await saveQueuedScans(filtered);
}

/**
 * Processes all pending queued scans if network connectivity is active.
 * Idempotent: prevents concurrent processing runs.
 */
export async function processOfflineScanQueue(): Promise<{
  processedCount: number;
  succeededCount: number;
  failedCount: number;
}> {
  if (isProcessingQueue) {
    return { processedCount: 0, succeededCount: 0, failedCount: 0 };
  }

  isProcessingQueue = true;
  let processedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;

  try {
    const NetInfo = await getNetInfo();
    if (NetInfo) {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        return { processedCount: 0, succeededCount: 0, failedCount: 0 };
      }
    }

    const scans = await getQueuedScans();
    if (scans.length === 0) {
      return { processedCount: 0, succeededCount: 0, failedCount: 0 };
    }

    for (const item of scans) {
      if (item.status === 'processing' || item.attempts >= 5) {
        continue;
      }

      processedCount++;
      item.status = 'processing';
      item.attempts += 1;
      await saveQueuedScans(scans);

      try {
        const fullUri = getFullImageUri(item.imagePath);
        if (!fullUri) {
          throw new Error('Image file not found on device.');
        }

        // Read file as base64 for vision processing
        let base64Data = '';
        if (typeof window !== 'undefined' || !(globalThis as Record<string, unknown>).nativeCallSyncHook) {
          try {
            const FileSystem = await import('expo-file-system');
            base64Data = await FileSystem.readAsStringAsync(fullUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch {
            base64Data = fullUri;
          }
        }

        const { analyzeMealImage, analyzeIngredientsImage } = await import('./aiVisionService');

        if (item.type === 'meal') {
          const result = await analyzeMealImage(base64Data);
          await dbInsertMeal({
            id: `meal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            dishName: result.dishName,
            calories: result.calories,
            protein: result.protein,
            carbs: result.carbs,
            fat: result.fat,
            estimatedWeightGrams: result.estimatedWeightGrams,
            portionMultiplier: 1.0,
            imageUri: item.imagePath,
            ingredientsDetected: result.ingredientsDetected,
          });
        } else {
          const report = await analyzeIngredientsImage(base64Data);
          await dbInsertScannedProduct({
            id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            scannedAt: new Date().toISOString(),
            productName: report.productName || 'Offline Scanned Item',
            imageUri: item.imagePath,
            report,
          });
        }

        await removeQueuedScan(item.id);
        succeededCount++;
      } catch (err: unknown) {
        failedCount++;
        item.status = 'failed';
        item.lastError = err instanceof Error ? err.message : String(err);
        await saveQueuedScans(scans);
      }
    }
  } finally {
    isProcessingQueue = false;
  }

  // If any scans succeeded and wrote to SQLite, refresh in-memory Zustand store
  if (succeededCount > 0) {
    try {
      const { useFitnessStore } = await import('../store/useFitnessStore');
      useFitnessStore.getState().loadDataFromDb().catch(() => {});
    } catch {
      // Safe fallback in isolated environments
    }
  }

  return { processedCount, succeededCount, failedCount };
}

/**
 * Initializes the NetInfo connectivity event listener to automatically
 * drain the scan queue when the device regains internet access.
 */
export async function initNetInfoQueueListener(): Promise<() => void> {
  if (isListenerInitialized && unsubscribeNetInfo) {
    return unsubscribeNetInfo;
  }

  const NetInfo = await getNetInfo();
  if (!NetInfo) {
    return () => {};
  }

  isListenerInitialized = true;
  unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      setTimeout(() => {
        processOfflineScanQueue().catch(() => {});
      }, 2000);
    }
  });

  return unsubscribeNetInfo;
}

/**
 * Stops the NetInfo queue listener
 */
export function stopNetInfoQueueListener(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
    isListenerInitialized = false;
  }
}
