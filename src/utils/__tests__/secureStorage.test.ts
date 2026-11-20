import { describe, expect, it } from 'bun:test';
import {
  computeHmacSha256Hex,
  computeRequestHmac,
  computeSha256Hex,
  deleteSecureItem,
  getOrCreateDeviceId,
  getOrCreateDeviceSecret,
  getSecureItem,
  getSignedDeviceHeaders,
  SECURE_KEYS,
  setSecureItem,
} from '../secureStorage';
import { createHmac } from 'crypto';

describe('Secure Storage & Device Signing Utilities', () => {
  it('correctly persists and retrieves secure items in fallback memory store', async () => {
    const testKey = SECURE_KEYS.GEMINI_API_KEY;
    const testValue = 'secret_gemini_api_key_abc_123';

    await setSecureItem(testKey, testValue);
    const retrieved = await getSecureItem(testKey);
    expect(retrieved).toBe(testValue);

    await deleteSecureItem(testKey);
    const afterDelete = await getSecureItem(testKey);
    expect(afterDelete).toBeNull();
  });

  it('generates a stable device ID across multiple calls', async () => {
    const id1 = await getOrCreateDeviceId();
    const id2 = await getOrCreateDeviceId();

    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(10);
    expect(id1).toBe(id2);
  });

  it('generates a stable device secret across multiple calls', async () => {
    const secret1 = await getOrCreateDeviceSecret();
    const secret2 = await getOrCreateDeviceSecret();

    expect(typeof secret1).toBe('string');
    expect(secret1.length).toBe(64);
    expect(secret1).toBe(secret2);
  });

  it('produces a stable, verifiable HMAC for a fixed test secret/body/timestamp', async () => {
    const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const method = 'POST';
    const path = '/v1/vision/analyze';
    const timestamp = 1700000000000;
    const body = JSON.stringify({ prompt: 'test food scan', imageBase64: 'abc123xyz' });

    // Client calculation
    const hmacDirect = await computeHmacSha256Hex(testSecret, 'hello world');
    const expectedDirectHmac = createHmac('sha256', testSecret).update('hello world').digest('hex');
    expect(hmacDirect).toBe(expectedDirectHmac);
    const clientHmac = await computeRequestHmac(testSecret, method, path, timestamp, body);

    // Expected independent server HMAC
    const expectedBodyHash = await computeSha256Hex(body);
    const canonical = `${method}\n${path}\n${timestamp}\n${expectedBodyHash}`;
    const expectedHmac = createHmac('sha256', testSecret).update(canonical).digest('hex');

    expect(clientHmac).toBe(expectedHmac);
    expect(clientHmac.length).toBe(64);
  });

  it('generates valid signed device headers for request authentication', async () => {
    const headers = await getSignedDeviceHeaders('POST', '/v1/vision/analyze', JSON.stringify({ prompt: 'hello' }));

    expect(headers['x-device-id']).toBeDefined();
    expect(headers['x-timestamp']).toBeDefined();
    expect(headers['x-signature']).toBeDefined();

    const timestampNum = parseInt(headers['x-timestamp'], 10);
    expect(isNaN(timestampNum)).toBe(false);
    expect(Math.abs(Date.now() - timestampNum)).toBeLessThan(5000); // within 5 seconds of now
    expect(headers['x-signature'].length).toBe(64); // 64 hex characters (32 bytes HMAC-SHA256)
  });

  it('rotates device secret only after server confirms with 200', async () => {
    const { rotateDeviceSecretWithProxy } = await import('../secureStorage');
    const oldSecret = '1111222233334444555566667777888811112222333344445555666677778888';
    const newSecret = '9999888877776666555544443333222299998888777766665555444433332222';
    await setSecureItem(SECURE_KEYS.DEVICE_SECRET, oldSecret);

    const originalFetch = globalThis.fetch;

    // 1. Failure case: server returns 500 error
    globalThis.fetch = (async () => {
      return new Response('Internal Server Error', { status: 500 });
    }) as unknown as typeof fetch;

    try {
      await expect(rotateDeviceSecretWithProxy('http://mock-proxy:8787')).rejects.toThrow();
      // Old secret must NOT be changed
      const currentSecret = await getSecureItem(SECURE_KEYS.DEVICE_SECRET);
      expect(currentSecret).toBe(oldSecret);
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 2. Success case: server returns 200 with new secret
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/devices/rotate')) {
        return new Response(
          JSON.stringify({ deviceId: 'test_dev', deviceSecret: newSecret }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url);
    }) as unknown as typeof fetch;

    try {
      const result = await rotateDeviceSecretWithProxy('http://mock-proxy:8787');
      expect(result.deviceSecret).toBe(newSecret);

      // Now SecureStore has been updated to newSecret
      const updatedSecret = await getSecureItem(SECURE_KEYS.DEVICE_SECRET);
      expect(updatedSecret).toBe(newSecret);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
