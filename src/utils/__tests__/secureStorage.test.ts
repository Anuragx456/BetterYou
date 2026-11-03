import { describe, expect, it } from 'bun:test';
import {
  deleteSecureItem,
  getOrCreateDeviceId,
  getOrCreateDeviceSecret,
  getSecureItem,
  getSignedDeviceHeaders,
  SECURE_KEYS,
  setSecureItem,
} from '../secureStorage';

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
    expect(secret1.length).toBeGreaterThan(10);
    expect(secret1).toBe(secret2);
  });

  it('generates valid signed device headers for request authentication', async () => {
    const headers = await getSignedDeviceHeaders('POST', '/v1/vision/analyze', JSON.stringify({ prompt: 'hello' }));

    expect(headers['x-device-id']).toBeDefined();
    expect(headers['x-timestamp']).toBeDefined();
    expect(headers['x-signature']).toBeDefined();

    const timestampNum = parseInt(headers['x-timestamp'], 10);
    expect(isNaN(timestampNum)).toBe(false);
    expect(Math.abs(Date.now() - timestampNum)).toBeLessThan(5000); // within 5 seconds of now
    expect(headers['x-signature'].length).toBeGreaterThanOrEqual(32);
  });
});
