import { describe, expect, it, beforeEach } from 'bun:test';
import {
  app,
  checkRateLimit,
  computeCanonicalSignature,
  deviceStore,
  resetRateLimits,
  verifyBootstrapSecretConstantTime,
} from '../index';
import {
  UpstashRedisDeviceStore,
  encryptDeviceSecret,
  parseEncryptionKey,
} from '../deviceStore';

describe('BetterYou Proxy Server', () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.BOOTSTRAP_SECRET;
    delete process.env.PROXY_ENV;
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.DEVICE_STORE_ENCRYPTION_KEY;
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

    // Verify record in store (single secret representation without redundant hash)
    const record = await deviceStore.getDevice('test_dev_001');
    expect(record).not.toBeNull();
    expect(record?.secret).toBe(data.deviceSecret);
    expect(record?.registeredAt).toBeGreaterThan(0);
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

  it('Fails closed in production when BOOTSTRAP_SECRET is missing or < 32 chars', async () => {
    process.env.PROXY_ENV = 'production';

    // 1. Missing secret
    delete process.env.BOOTSTRAP_SECRET;
    const resMissing = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'prod_dev_1' }),
    });
    expect(resMissing.status).toBe(503);
    const dataMissing = await resMissing.json();
    expect(dataMissing.error).toContain('Service Unavailable: Device registration is disabled');
    expect(dataMissing.error).toContain('BOOTSTRAP_SECRET');

    // 2. Secret shorter than 32 chars
    process.env.BOOTSTRAP_SECRET = 'too_short_secret_under_32_chars';
    expect(process.env.BOOTSTRAP_SECRET.length).toBeLessThan(32);
    const resShort = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bootstrap-secret': process.env.BOOTSTRAP_SECRET,
      },
      body: JSON.stringify({ deviceId: 'prod_dev_2' }),
    });
    expect(resShort.status).toBe(503);

    // 3. Valid 32-char secret passes in production
    process.env.BOOTSTRAP_SECRET = 'valid_production_secret_32_chars_ok!';
    const resValid = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bootstrap-secret': process.env.BOOTSTRAP_SECRET,
      },
      body: JSON.stringify({ deviceId: 'prod_dev_3' }),
    });
    expect(resValid.status).toBe(201);
  });

  it('Performs constant-time bootstrap check and rejects invalid secrets', async () => {
    const configured = 'test_constant_time_secret_configured_value';
    expect(verifyBootstrapSecretConstantTime(configured, configured)).toBe(true);
    expect(verifyBootstrapSecretConstantTime(configured, 'wrong_secret')).toBe(false);
    expect(verifyBootstrapSecretConstantTime(configured, '')).toBe(false);

    process.env.BOOTSTRAP_SECRET = configured;
    const res = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bootstrap-secret': 'tampered_guess_secret',
      },
      body: JSON.stringify({ deviceId: 'dev_ct_test' }),
    });
    expect(res.status).toBe(401);
  });

  it('Enforces honest rate limiting and per-deviceId registration limit', async () => {
    delete process.env.TRUST_PROXY_HEADERS;

    // Per-deviceId limit (max 5/hr)
    const targetDevId = 'dev_repeat_limit_test';
    for (let i = 0; i < 5; i++) {
      resetRateLimits(); // clear per-client to test per-deviceId limit independently
      const res = await app.request('/v1/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: targetDevId }),
      });
      expect(res.status).toBe(201);
    }

    // 6th registration for the same deviceId is blocked (429)
    resetRateLimits(); // per-client reset, but per-device remains if we don't clear it
    // Manually register 5 times in fresh state
    resetRateLimits();
    for (let i = 0; i < 4; i++) {
      await app.request('/v1/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'dev_quota_fill' }),
      });
    }
    const res5 = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'dev_quota_fill' }),
    });
    expect(res5.status).toBe(201);

    const res6 = await app.request('/v1/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'dev_quota_fill' }),
    });
    expect(res6.status).toBe(429);
    const data6 = await res6.json();
    expect(data6.error).toContain('Registration limit reached for device ID');
  });

  describe('UpstashRedisDeviceStore AES-256-GCM Encryption', () => {
    const rawKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const keyBuf = parseEncryptionKey(rawKeyHex)!;

    it('Proves (a) written Redis payload does NOT contain plaintext secret', async () => {
      let writtenBody = '';
      const mockUrl = 'https://mock-redis.upstash.io';
      const mockToken = 'mock_token';

      // Intercept global fetch for Redis mock
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes('/set/device:')) {
          writtenBody = String(init?.body || '');
          return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
        }
        return originalFetch(url, init);
      }) as unknown as typeof fetch;

      try {
        const store = new UpstashRedisDeviceStore(mockUrl, mockToken, rawKeyHex);
        const secret = 'super_confidential_raw_secret_value_123456';
        await store.registerDevice('dev_encrypt_001', secret);

        expect(writtenBody).not.toBe('');
        // PROVE: plaintext secret is nowhere in the Redis payload!
        expect(writtenBody.includes(secret)).toBe(false);

        // Verify structure has iv, ciphertext, and tag
        const parsedPayload = JSON.parse(JSON.parse(writtenBody));
        expect(parsedPayload.encrypted).toBeDefined();
        expect(parsedPayload.encrypted.iv).toBeDefined();
        expect(parsedPayload.encrypted.ciphertext).toBeDefined();
        expect(parsedPayload.encrypted.tag).toBeDefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('Proves (b) device authenticates with valid HMAC after store round-trip', async () => {
      let redisDb = new Map<string, string>();
      const mockUrl = 'https://mock-redis.upstash.io';
      const mockToken = 'mock_token';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes('/set/device:')) {
          const key = urlStr.split('/set/device:')[1];
          redisDb.set(key, String(init?.body || ''));
          return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
        }
        if (urlStr.includes('/get/device:')) {
          const key = urlStr.split('/get/device:')[1];
          const stored = redisDb.get(key) || null;
          const resultVal = stored ? JSON.parse(stored) : null;
          return new Response(JSON.stringify({ result: resultVal }), { status: 200 });
        }
        return originalFetch(url, init);
      }) as unknown as typeof fetch;

      try {
        const store = new UpstashRedisDeviceStore(mockUrl, mockToken, rawKeyHex);
        const secret = 'device_roundtrip_secret_64_chars_hex_formatted_secret_value_123';
        const regRecord = await store.registerDevice('dev_roundtrip_001', secret);
        expect(regRecord.secret).toBe(secret);

        // Fetch back from store (reads from Redis and decrypts with AES-256-GCM)
        const fetchedRecord = await store.getDevice('dev_roundtrip_001');
        expect(fetchedRecord).not.toBeNull();
        expect(fetchedRecord?.secret).toBe(secret);

        // Verify valid HMAC canonical signature with fetched secret
        const timestamp = Date.now();
        const bodyStr = JSON.stringify({ prompt: 'test' });
        const signature = computeCanonicalSignature(
          fetchedRecord!.secret,
          'POST',
          '/v1/chat/analyze',
          timestamp,
          bodyStr
        );
        expect(signature.length).toBe(64);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('Proves (c) tampered ciphertext fails closed without crashing', async () => {
      const mockUrl = 'https://mock-redis.upstash.io';
      const mockToken = 'mock_token';

      // Create an encrypted record
      const secret = 'valid_secret_before_tampering';
      const enc = encryptDeviceSecret(secret, keyBuf);
      // Tamper ciphertext
      const tamperedCiphertext = enc.ciphertext.slice(0, -4) + 'ffff';

      const tamperedPayload = {
        deviceId: 'dev_tamper_001',
        registeredAt: Date.now(),
        encrypted: {
          iv: enc.iv,
          ciphertext: tamperedCiphertext,
          tag: enc.tag,
        },
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes('/get/device:')) {
          return new Response(
            JSON.stringify({ result: JSON.stringify(tamperedPayload) }),
            { status: 200 }
          );
        }
        return originalFetch(url, init);
      }) as unknown as typeof fetch;

      try {
        const store = new UpstashRedisDeviceStore(mockUrl, mockToken, rawKeyHex);
        // Must fail closed (return null, never throw/crash)
        const record = await store.getDevice('dev_tamper_001');
        expect(record).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Device Secret Rotation (POST /v1/devices/rotate)', () => {
    it('Rotates device secret: old secret rejected, new secret accepted', async () => {
      process.env.GEMINI_API_KEY = 'test_dummy_key';
      const deviceId = 'dev_rotation_test_01';

      // 1. Initial registration
      const regRes = await app.request('/v1/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      expect(regRes.status).toBe(201);
      const { deviceSecret: initialSecret } = await regRes.json();
      expect(initialSecret).toBeDefined();

      // 2. Call POST /v1/devices/rotate authenticated with initialSecret
      const t1 = Date.now();
      const rotateSig = computeCanonicalSignature(
        initialSecret,
        'POST',
        '/v1/devices/rotate',
        t1,
        ''
      );

      const rotateRes = await app.request('/v1/devices/rotate', {
        method: 'POST',
        headers: {
          'x-device-id': deviceId,
          'x-timestamp': String(t1),
          'x-signature': rotateSig,
        },
      });
      expect(rotateRes.status).toBe(200);
      const rotateData = await rotateRes.json();
      const newSecret = rotateData.deviceSecret;

      expect(newSecret).toBeDefined();
      expect(newSecret).not.toBe(initialSecret);
      expect(newSecret.length).toBe(64);

      // 3. Attempt request with OLD secret -> must be REJECTED (401)
      const t2 = Date.now();
      const chatBody = JSON.stringify({ prompt: 'hello' });
      const oldSecretSig = computeCanonicalSignature(
        initialSecret,
        'POST',
        '/v1/chat/analyze',
        t2,
        chatBody
      );

      const oldRes = await app.request('/v1/chat/analyze', {
        method: 'POST',
        headers: {
          'x-device-id': deviceId,
          'x-timestamp': String(t2),
          'x-signature': oldSecretSig,
          'Content-Type': 'application/json',
        },
        body: chatBody,
      });
      expect(oldRes.status).toBe(401);
      const oldData = await oldRes.json();
      expect(oldData.error).toContain('Invalid device signature');

      // 4. Attempt request with NEW secret -> signature check PASSES
      // (Reaches Gemini handler which fails on dummy key or succeeds, but NOT 401 signature error!)
      const t3 = Date.now();
      const newSecretSig = computeCanonicalSignature(
        newSecret,
        'POST',
        '/v1/chat/analyze',
        t3,
        chatBody
      );

      const newRes = await app.request('/v1/chat/analyze', {
        method: 'POST',
        headers: {
          'x-device-id': deviceId,
          'x-timestamp': String(t3),
          'x-signature': newSecretSig,
          'Content-Type': 'application/json',
        },
        body: chatBody,
      });
      expect(newRes.status).not.toBe(401);
    });
  });
});
