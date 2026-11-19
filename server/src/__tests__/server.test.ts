import { describe, expect, it, beforeEach } from 'bun:test';
import {
  app,
  checkRateLimit,
  computeCanonicalSignature,
  deviceStore,
  resetRateLimits,
} from '../index';

describe('BetterYou Proxy Server', () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.BOOTSTRAP_SECRET;
  });

  it('GET /health returns 200 and healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('betteryou-proxy');
  });

  it('Registers a device and issues a random 32-byte (64-hex) secret', async () => {
    const res = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test_dev_001' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.deviceId).toBe('test_dev_001');
    expect(typeof data.deviceSecret).toBe('string');
    expect(data.deviceSecret.length).toBe(64); // 32 bytes in hex

    // Verify record in store
    const record = await deviceStore.getDevice('test_dev_001');
    expect(record).not.toBeNull();
    expect(record?.secret).toBe(data.deviceSecret);
    expect(record?.secretHash.length).toBe(64);
  });

  it('Re-registration generates a fresh secret and never echoes existing secret', async () => {
    // First registration
    const res1 = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test_dev_rereg' }),
    });
    const data1 = await res1.json();

    // Second registration with same deviceId
    const res2 = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test_dev_rereg' }),
    });
    const data2 = await res2.json();

    expect(data1.deviceSecret).not.toBe(data2.deviceSecret);
    expect(data2.deviceSecret.length).toBe(64);
  });

  it('Enforces bootstrap secret on registration when configured', async () => {
    process.env.BOOTSTRAP_SECRET = 'super_secret_bootstrap';

    // Without secret -> 401
    const resDenied = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test_dev_boot' }),
    });
    expect(resDenied.status).toBe(401);

    // With matching header -> 201
    const resAllowed = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bootstrap-secret': 'super_secret_bootstrap',
      },
      body: JSON.stringify({ deviceId: 'test_dev_boot' }),
    });
    expect(resAllowed.status).toBe(201);
  });

  it('Rejects requests to /v1/* without device authentication headers', async () => {
    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Missing required device authentication headers');
  });

  it('Rejects requests with timestamps outside the ±5 minute window', async () => {
    const deviceId = 'test_dev_time';
    const regRes = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const { deviceSecret } = await regRes.json();

    const expiredTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const bodyStr = JSON.stringify({ prompt: 'test' });
    const signature = computeCanonicalSignature(
      deviceSecret,
      'POST',
      '/v1/vision/analyze',
      expiredTimestamp,
      bodyStr
    );

    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': deviceId,
        'x-timestamp': String(expiredTimestamp),
        'x-signature': signature,
        'Content-Type': 'application/json',
      },
      body: bodyStr,
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('timestamp expired');
  });

  it('Rejects invalid signature format (<64 hex chars or non-hex)', async () => {
    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': 'dev_test_123',
        'x-timestamp': String(Date.now()),
        'x-signature': 'short_invalid_sig',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'test' }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Invalid device signature format');
  });

  it('Rejects made-up 64-char forged signature (Acceptance Test)', async () => {
    // Attempting to forge signature with made-up characters
    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': 'unregistered_device',
        'x-timestamp': String(Date.now()),
        'x-signature': 'f'.repeat(64),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'test' }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('Rejects tampered body when signature was signed over different content', async () => {
    const deviceId = 'test_dev_tamper';
    const regRes = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const { deviceSecret } = await regRes.json();

    const timestamp = Date.now();
    const originalBody = JSON.stringify({ prompt: 'original prompt' });
    const signature = computeCanonicalSignature(
      deviceSecret,
      'POST',
      '/v1/vision/analyze',
      timestamp,
      originalBody
    );

    // Tamper with body in transit
    const tamperedBody = JSON.stringify({ prompt: 'tampered prompt' });

    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': deviceId,
        'x-timestamp': String(timestamp),
        'x-signature': signature,
        'Content-Type': 'application/json',
      },
      body: tamperedBody,
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('verification failed');
  });

  it('Rejects replayed requests with the same signature (Replay Attack)', async () => {
    const deviceId = 'test_dev_replay';
    const regRes = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const { deviceSecret } = await regRes.json();

    const timestamp = Date.now();
    const bodyStr = JSON.stringify({ prompt: 'valid prompt', imageBase64: '123' });
    const signature = computeCanonicalSignature(
      deviceSecret,
      'POST',
      '/v1/vision/analyze',
      timestamp,
      bodyStr
    );

    // Request 1: Passes auth (might fail on body validation or downstream key, but auth passes)
    const res1 = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': deviceId,
        'x-timestamp': String(timestamp),
        'x-signature': signature,
        'Content-Type': 'application/json',
      },
      body: bodyStr,
    });
    // Status is not 401 with replay error
    const data1 = await res1.json();
    expect(data1.error).not.toContain('Replay attack detected');

    // Request 2: Exactly identical signature within replay window -> 401 Replay attack detected
    const res2 = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': deviceId,
        'x-timestamp': String(timestamp),
        'x-signature': signature,
        'Content-Type': 'application/json',
      },
      body: bodyStr,
    });
    expect(res2.status).toBe(401);
    const data2 = await res2.json();
    expect(data2.error).toContain('Replay attack detected');
  });

  it('Enforces 15 requests per minute rate limit per device', async () => {
    const deviceId = 'device_rate_limit_test';
    const now = Date.now();

    for (let i = 0; i < 15; i++) {
      const result = await checkRateLimit(deviceId, now);
      expect(result.allowed).toBe(true);
    }

    // 16th request in the same minute should be blocked
    const blockedResult = await checkRateLimit(deviceId, now);
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.retryAfterSeconds).toBeGreaterThan(0);
    expect(blockedResult.reason).toContain('15 requests per minute');
  });

  it('Resets rate limit after the minute window elapses', async () => {
    const deviceId = 'device_window_reset_test';
    const t0 = 1000000;

    for (let i = 0; i < 15; i++) {
      await checkRateLimit(deviceId, t0);
    }
    const check1 = await checkRateLimit(deviceId, t0);
    expect(check1.allowed).toBe(false);

    // After 61 seconds
    const t1 = t0 + 61 * 1000;
    const check2 = await checkRateLimit(deviceId, t1);
    expect(check2.allowed).toBe(true);
  });

  it('Validates body payload structure on /v1/vision/analyze for authenticated device', async () => {
    process.env.GEMINI_API_KEY = 'test_dummy_key';
    const deviceId = 'dev_test_payload';

    // Register device first
    const regRes = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const { deviceSecret } = await regRes.json();

    const timestamp = Date.now();
    const bodyStr = JSON.stringify({ prompt: '', imageBase64: '' });
    const signature = computeCanonicalSignature(
      deviceSecret,
      'POST',
      '/v1/vision/analyze',
      timestamp,
      bodyStr
    );

    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': deviceId,
        'x-timestamp': String(timestamp),
        'x-signature': signature,
        'Content-Type': 'application/json',
      },
      body: bodyStr,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error).toContain('Invalid prompt');
  });
});
