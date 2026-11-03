import { describe, expect, it, beforeEach } from 'bun:test';
import { app, checkRateLimit, resetRateLimits } from '../index';

describe('BetterYou Proxy Server', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('GET /health returns 200 and healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('betteryou-proxy');
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
    const expiredTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': 'dev_test_123',
        'x-timestamp': String(expiredTimestamp),
        'x-signature': 'a'.repeat(64),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'test' }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('timestamp expired');
  });

  it('Rejects invalid signature format (<32 chars)', async () => {
    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': 'dev_test_123',
        'x-timestamp': String(Date.now()),
        'x-signature': 'short',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'test' }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Invalid device signature');
  });

  it('Enforces 15 requests per minute rate limit per device', () => {
    const deviceId = 'device_rate_limit_test';
    const now = Date.now();

    for (let i = 0; i < 15; i++) {
      const result = checkRateLimit(deviceId, now);
      expect(result.allowed).toBe(true);
    }

    // 16th request in the same minute should be blocked
    const blockedResult = checkRateLimit(deviceId, now);
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.retryAfterSeconds).toBeGreaterThan(0);
    expect(blockedResult.reason).toContain('15 requests per minute');
  });

  it('Resets rate limit after the minute window elapses', () => {
    const deviceId = 'device_window_reset_test';
    const t0 = 1000000;

    for (let i = 0; i < 15; i++) {
      checkRateLimit(deviceId, t0);
    }
    expect(checkRateLimit(deviceId, t0).allowed).toBe(false);

    // After 61 seconds
    const t1 = t0 + 61 * 1000;
    expect(checkRateLimit(deviceId, t1).allowed).toBe(true);
  });

  it('Validates body payload structure on /v1/vision/analyze', async () => {
    process.env.GEMINI_API_KEY = 'test_dummy_key';
    const res = await app.request('/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'x-device-id': 'dev_test_123',
        'x-timestamp': String(Date.now()),
        'x-signature': 'a'.repeat(64),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: '', imageBase64: '' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
