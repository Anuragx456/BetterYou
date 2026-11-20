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
 * Computes a SHA-256 hash using the Web Crypto API or Node/Bun crypto fallback.
 */
export async function computeSha256Hex(data: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(data).digest('hex');
  } catch {
    // Fallback deterministic digest
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Computes HMAC-SHA256 hex digest using Web Crypto API or Node/Bun crypto.
 */
export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  try {
    const { createHmac } = await import('crypto');
    return createHmac('sha256', secret).update(message).digest('hex');
  } catch (err) {
    throw new Error(`HMAC-SHA256 calculation unsupported: ${String(err)}`);
  }
}

/**
 * Produces canonical HMAC-SHA256 signature over:
 * method + "\n" + path + "\n" + timestamp + "\n" + sha256(body)
 */
export async function computeRequestHmac(
  secret: string,
  method: string,
  path: string,
  timestamp: number | string,
  bodyString: string = ''
): Promise<string> {
  const bodyHash = await computeSha256Hex(bodyString);
  const canonicalString = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  return computeHmacSha256Hex(secret, canonicalString);
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
 * Retrieves or initializes a local fallback Device Secret.
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
      secret = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`.padEnd(64, '0');
    }
    await setSecureItem(SECURE_KEYS.DEVICE_SECRET, secret);
  }
  return secret;
}

/**
 * Registers device with the proxy server to receive a verified server-held per-device secret.
 */
export async function registerDeviceWithProxy(
  proxyUrl?: string,
  preferredDeviceId?: string
): Promise<{ deviceId: string; deviceSecret: string }> {
  const baseUrl = proxyUrl || process.env.EXPO_PUBLIC_PROXY_URL?.trim() || 'http://localhost:8787';
  const deviceId = preferredDeviceId || (await getOrCreateDeviceId());

  const res = await fetch(`${baseUrl}/v1/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Device registration failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { deviceId: string; deviceSecret: string };
  if (!data.deviceSecret) {
    throw new Error('Device registration returned invalid secret.');
  }

  await setSecureItem(SECURE_KEYS.DEVICE_ID, data.deviceId);
  await setSecureItem(SECURE_KEYS.DEVICE_SECRET, data.deviceSecret);
  return data;
}

/**
 * Cleans up any legacy plaintext authentication material from AsyncStorage
 */
export async function cleanupLegacyAuthMaterial(): Promise<void> {
  try {
    const { safeAsyncStorage } = await import('./storage');
    const legacyKeys = [
      'betteryou_device_secret',
      'betteryou-device-secret',
      'betteryou_insecure_auth_token',
    ];
    for (const k of legacyKeys) {
      await safeAsyncStorage.removeItem(k);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Generates signed authentication headers for proxy verification.
 * Client signs every /v1/* request with HMAC-SHA256 over:
 * method + "\n" + path + "\n" + timestamp + "\n" + sha256(body)
 */
export async function getSignedDeviceHeaders(
  method: string,
  path: string,
  bodyString: string = '',
  proxyUrl?: string
): Promise<{
  'x-device-id': string;
  'x-timestamp': string;
  'x-signature': string;
}> {
  // Purge any legacy unencrypted tokens from AsyncStorage
  cleanupLegacyAuthMaterial().catch(() => {});

  const deviceId = await getOrCreateDeviceId();
  let deviceSecret = await getSecureItem(SECURE_KEYS.DEVICE_SECRET);

  if (!deviceSecret) {
    try {
      const reg = await registerDeviceWithProxy(proxyUrl, deviceId);
      deviceSecret = reg.deviceSecret;
    } catch {
      deviceSecret = await getOrCreateDeviceSecret();
    }
  }

  const timestamp = Date.now();
  const signature = await computeRequestHmac(deviceSecret, method, path, timestamp, bodyString);

  return {
    'x-device-id': deviceId,
    'x-timestamp': String(timestamp),
    'x-signature': signature,
  };
}

/**
 * Rotates the device secret with the proxy server via authenticated POST /v1/devices/rotate.
 * Crucially: SecureStore is updated with the new secret ONLY AFTER the proxy server confirms with 200.
 */
export async function rotateDeviceSecretWithProxy(
  proxyUrl?: string
): Promise<{ deviceId: string; deviceSecret: string }> {
  const baseUrl = proxyUrl || process.env.EXPO_PUBLIC_PROXY_URL?.trim() || 'http://localhost:8787';
  const path = '/v1/devices/rotate';
  const signedHeaders = await getSignedDeviceHeaders('POST', path, '', proxyUrl);

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...signedHeaders,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Device secret rotation failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { deviceId: string; deviceSecret: string };
  if (!data.deviceSecret || data.deviceSecret.length < 32) {
    throw new Error('Device secret rotation returned invalid secret.');
  }

  // Store new secret in hardware-backed SecureStore only after server confirms
  await setSecureItem(SECURE_KEYS.DEVICE_SECRET, data.deviceSecret);
  return data;
}
