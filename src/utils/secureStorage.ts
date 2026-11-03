export const SECURE_KEYS = {
  GEMINI_API_KEY: 'betteryou_secure_gemini_api_key',
  DEVICE_ID: 'betteryou_device_id',
  DEVICE_SECRET: 'betteryou_device_secret',
} as const;

// In-memory fallback for web, node/SSR, and unit test environments
const secureMemoryFallback = new Map<string, string>();

let secureStoreModule: typeof import('expo-secure-store') | null = null;
let hasCheckedModule = false;

async function getSecureStore() {
  if (hasCheckedModule) return secureStoreModule;
  hasCheckedModule = true;

  // In headless Node/Bun test environments, skip native module loading
  if (typeof window === 'undefined' && !(globalThis as Record<string, unknown>).nativeCallSyncHook) {
    return null;
  }

  try {
    secureStoreModule = await import('expo-secure-store');
    const isAvail = await secureStoreModule.isAvailableAsync();
    if (!isAvail) {
      secureStoreModule = null;
    }
  } catch {
    secureStoreModule = null;
  }
  return secureStoreModule;
}

/**
 * Retrieves an encrypted item from hardware-backed Keystore / Keychain.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const store = await getSecureStore();
    if (!store) {
      return secureMemoryFallback.get(key) ?? null;
    }
    return await store.getItemAsync(key, {
      keychainAccessible: store.AFTER_FIRST_UNLOCK,
    });
  } catch {
    return secureMemoryFallback.get(key) ?? null;
  }
}

/**
 * Persists an encrypted item to hardware-backed Keystore / Keychain.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    secureMemoryFallback.set(key, value);
    const store = await getSecureStore();
    if (!store) {
      return;
    }
    await store.setItemAsync(key, value, {
      keychainAccessible: store.AFTER_FIRST_UNLOCK,
    });
  } catch {
    // Retained in memory fallback
  }
}

/**
 * Deletes an encrypted item from hardware-backed Keystore / Keychain.
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    secureMemoryFallback.delete(key);
    const store = await getSecureStore();
    if (!store) {
      return;
    }
    await store.deleteItemAsync(key);
  } catch {
    // Retained in memory fallback
  }
}

/**
 * Computes a SHA-256 hash using the standard Web Crypto API.
 */
async function computeSha256Hex(data: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Basic deterministic fallback
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Retrieves or initializes a unique, cryptographically random Device ID.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await getSecureItem(SECURE_KEYS.DEVICE_ID);
  if (!deviceId) {
    if (globalThis.crypto?.randomUUID) {
      deviceId = globalThis.crypto.randomUUID();
    } else {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    await setSecureItem(SECURE_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
}

/**
 * Retrieves or initializes a unique Device Secret for request signing.
 */
export async function getOrCreateDeviceSecret(): Promise<string> {
  let secret = await getSecureItem(SECURE_KEYS.DEVICE_SECRET);
  if (!secret) {
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(32);
      globalThis.crypto.getRandomValues(bytes);
      secret = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
      secret = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
    await setSecureItem(SECURE_KEYS.DEVICE_SECRET, secret);
  }
  return secret;
}

/**
 * Generates signed authentication headers for proxy verification.
 */
export async function getSignedDeviceHeaders(
  method: string,
  path: string,
  bodyString: string = ''
): Promise<{
  'x-device-id': string;
  'x-timestamp': string;
  'x-signature': string;
}> {
  const deviceId = await getOrCreateDeviceId();
  const deviceSecret = await getOrCreateDeviceSecret();
  const timestamp = Date.now();

  const bodyHash = await computeSha256Hex(bodyString);
  const payloadToSign = `${deviceId}:${timestamp}:${method.toUpperCase()}:${path}:${bodyHash}:${deviceSecret}`;
  const signature = await computeSha256Hex(payloadToSign);

  return {
    'x-device-id': deviceId,
    'x-timestamp': String(timestamp),
    'x-signature': signature,
  };
}
