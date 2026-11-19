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
});
