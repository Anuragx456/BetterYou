import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { createRateLimiter, RateLimiter } from './rateLimiter';
import { createDeviceStore, DeviceStore } from './deviceStore';
import { createAttestationVerifier } from './attestation';

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const GEMINI_FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

export const rateLimiter: RateLimiter = createRateLimiter();
export const deviceStore: DeviceStore = createDeviceStore();
export const attestationVerifier = createAttestationVerifier();

// Replay cache: signature -> timestamp
export const seenSignatures = new Map<string, number>();

// Registration rate limiter: IP/device -> count
const registrationRateLimits = new Map<string, { count: number; windowStart: number }>();

function isGeminiModelMissingMessage(message: string): boolean {
  return /not found|not supported|unknown model|invalid model|does not exist|is not available/i.test(message);
}

function geminiModelsInOrder(chosenModel: string): string[] {
  return [chosenModel, ...GEMINI_FALLBACK_MODELS.filter((model) => model !== chosenModel)];
}

export function checkRateLimit(deviceId: string, now: number = Date.now()) {
  return rateLimiter.check(deviceId, now);
}

export function resetRateLimits() {
  rateLimiter.reset();
  deviceStore.reset();
  seenSignatures.clear();
  registrationRateLimits.clear();
}

/**
 * Constant-time hex signature verification to prevent timing attacks.
 */
export function verifySignatureConstantTime(expectedHex: string, actualHex: string): boolean {
  if (expectedHex.length !== actualHex.length) return false;
  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const actualBuf = Buffer.from(actualHex, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Computes canonical request HMAC-SHA256 signature
 */
export function computeCanonicalSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string | number,
  bodyString: string = ''
): string {
  const bodyHash = createHash('sha256').update(bodyString).digest('hex');
  const canonicalString = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  return createHmac('sha256', secret).update(canonicalString).digest('hex');
}

export const app = new Hono();

// Enable CORS for mobile clients
app.use('*', cors());

// Health Check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'betteryou-proxy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Device Registration Endpoint
// Issues a random cryptographically secure per-device secret (≥32 bytes)
app.post('/v1/devices/register', async (c) => {
  const now = Date.now();

  // 1. Configurable shared bootstrap check
  const configuredBootstrapSecret = process.env.BOOTSTRAP_SECRET?.trim();
  if (configuredBootstrapSecret) {
    const incomingBootstrap =
      c.req.header('x-bootstrap-secret') ||
      (await c.req.raw
        .clone()
        .json()
        .then((b) => b?.bootstrapSecret)
        .catch(() => ''));

    if (incomingBootstrap !== configuredBootstrapSecret) {
      return c.json(
        { error: 'Unauthorized: Invalid or missing registration bootstrap secret.' },
        401
      );
    }
  }

  // 2. Strict Rate Limiting for Device Registration (max 5 per minute per client)
  const clientIdentifier =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('cf-connecting-ip') ||
    'local_client';

  let regEntry = registrationRateLimits.get(clientIdentifier);
  if (!regEntry || now - regEntry.windowStart > 60000) {
    regEntry = { count: 0, windowStart: now };
    registrationRateLimits.set(clientIdentifier, regEntry);
  }

  if (regEntry.count >= 5) {
    c.header('Retry-After', '60');
    return c.json(
      { error: 'Too many device registration requests. Please wait 1 minute.' },
      429
    );
  }
  regEntry.count += 1;

  // 3. Platform Attestation verification (if enabled)
  let body: {
    deviceId?: string;
    platform?: 'android' | 'ios' | 'web';
    attestationToken?: string;
    bootstrapSecret?: string;
  } = {};

  try {
    body = await c.req.json();
  } catch {
    // Body is optional
  }

  const attestationResult = await attestationVerifier.verify(
    body.attestationToken,
    body.deviceId || 'register'
  );
  if (!attestationResult.valid) {
    return c.json(
      { error: `Platform attestation failed: ${attestationResult.error || 'untrusted environment'}` },
      403
    );
  }

  // 4. Generate device ID and cryptographically secure secret (32 bytes = 64 hex chars)
  const deviceId =
    body.deviceId && /^[a-zA-Z0-9_-]{8,64}$/.test(body.deviceId)
      ? body.deviceId
      : `dev_${randomUUID ? randomUUID() : randomBytes(16).toString('hex')}`;

  const secretBytes = randomBytes(32);
  const deviceSecret = secretBytes.toString('hex');

  // Register in device store (stores secret and secret hash)
  // Crucially: never echoes or returns another device's existing secret
  await deviceStore.registerDevice(deviceId, deviceSecret);

  return c.json(
    {
      deviceId,
      deviceSecret,
      issuedAt: new Date(now).toISOString(),
    },
    201
  );
});

// Device Auth & Rate-Limit Middleware for /v1/* routes (excluding /v1/devices/register)
app.use('/v1/*', async (c, next) => {
  if (c.req.path === '/v1/devices/register') {
    return next();
  }

  const deviceId = c.req.header('x-device-id');
  const timestampStr = c.req.header('x-timestamp');
  const signature = c.req.header('x-signature');

  if (!deviceId || !timestampStr || !signature) {
    return c.json(
      {
        error: 'Missing required device authentication headers (x-device-id, x-timestamp, x-signature).',
      },
      401
    );
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return c.json({ error: 'Invalid x-timestamp header.' }, 400);
  }

  // Replay protection: check within 5 minutes
  const now = Date.now();
  if (Math.abs(now - timestamp) > REPLAY_WINDOW_MS) {
    return c.json(
      {
        error: 'Request timestamp expired or out of allowed window (±5 minutes).',
      },
      401
    );
  }

  // Signature format: HMAC-SHA256 hex string must be exactly 64 hex characters
  if (signature.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(signature)) {
    return c.json({ error: 'Invalid device signature format (must be 64 hex characters).' }, 401);
  }

  // Replay check: reject already-seen signatures
  if (seenSignatures.has(signature)) {
    return c.json(
      { error: 'Replay attack detected: request signature has already been used.' },
      401
    );
  }

  // Periodic pruning of seen signatures older than replay window
  if (seenSignatures.size > 2000) {
    const cutoff = now - REPLAY_WINDOW_MS;
    for (const [sig, t] of seenSignatures.entries()) {
      if (t < cutoff) {
        seenSignatures.delete(sig);
      }
    }
  }

  // Lookup registered device
  const device = await deviceStore.getDevice(deviceId);
  if (!device) {
    return c.json(
      { error: 'Device not registered. Please register device via POST /v1/devices/register.' },
      401
    );
  }

  // Extract raw body to verify signature
  const rawBody =
    c.req.method === 'GET' || c.req.method === 'HEAD'
      ? ''
      : await c.req.raw.clone().text().catch(() => '');

  const expectedSignature = computeCanonicalSignature(
    device.secret,
    c.req.method,
    c.req.path,
    timestampStr,
    rawBody
  );

  const isValid = verifySignatureConstantTime(expectedSignature, signature);
  if (!isValid) {
    return c.json({ error: 'Invalid device signature: verification failed.' }, 401);
  }

  // Mark signature as seen for replay protection
  seenSignatures.set(signature, now);

  // Enforce device rate limits
  const rateResult = await rateLimiter.check(deviceId, now);
  if (!rateResult.allowed) {
    c.header('Retry-After', String(rateResult.retryAfterSeconds ?? 60));
    return c.json(
      {
        error: rateResult.reason,
        retryAfter: rateResult.retryAfterSeconds,
      },
      429
    );
  }

  await next();
});

// Multimodal Vision Proxy Endpoint
app.post('/v1/vision/analyze', async (c) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return c.json(
      {
        error: 'Server misconfiguration: GEMINI_API_KEY is not set on the proxy.',
      },
      500
    );
  }

  const contentLength = parseInt(c.req.header('content-length') || '0', 10);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return c.json({ error: 'Payload exceeds maximum limit of 5MB.' }, 413);
  }

  let body: {
    prompt?: string;
    imageBase64?: string;
    mimeType?: string;
    model?: string;
    responseSchema?: Record<string, unknown>;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  const { prompt, imageBase64, mimeType = 'image/jpeg', model = 'gemini-3.6-flash', responseSchema } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.length > 4096) {
    return c.json({ error: 'Invalid prompt: must be string <= 4096 chars.' }, 400);
  }

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return c.json({ error: 'Missing imageBase64 data.' }, 400);
  }

  // Reject oversized base64 payloads
  if (imageBase64.length > 7 * 1024 * 1024) {
    return c.json({ error: 'Image base64 exceeds maximum allowed size.' }, 413);
  }

  const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validMimes.includes(mimeType)) {
    return c.json({ error: `Invalid mimeType: must be one of ${validMimes.join(', ')}.` }, 400);
  }

  // Forward to Gemini upstream
  const uniqueModels = geminiModelsInOrder(model);
  let lastError = 'Upstream Gemini error';
  let lastStatus = 502;

  const geminiPayload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      ...(responseSchema ? { responseSchema } : {}),
      temperature: 0.0,
      maxOutputTokens: 2048,
    },
  };

  const serializedBody = JSON.stringify(geminiPayload);
  geminiPayload.contents[0].parts.length = 0;
  body.imageBase64 = undefined;
  let realFallbackUsed = false;

  for (const m of uniqueModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: serializedBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        lastStatus = response.status === 429 ? 429 : 502;
        const errText = await response.text();
        lastError = `Gemini upstream ${response.status}: ${errText.slice(0, 200)}`;
        const modelMissing = response.status === 404 || isGeminiModelMissingMessage(errText);
        if ((response.status === 400 || response.status === 401 || response.status === 403) && !modelMissing) {
          return c.json({ error: `Gemini API Authentication Error (${response.status})` }, 502);
        }
        if (!modelMissing && realFallbackUsed) break;
        if (!modelMissing) realFallbackUsed = true;
        continue;
      }

      interface GeminiResult {
        candidates?: {
          content?: {
            parts?: { text?: string }[];
          };
        }[];
      }

      const result = (await response.json()) as GeminiResult;
      const parts = result.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || '').join('').trim();

      if (!text) {
        lastError = 'Gemini returned empty candidate content.';
        if (realFallbackUsed) break;
        realFallbackUsed = true;
        continue;
      }

      return c.json({
        text,
        usedModel: m,
      });
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timeout);
    }
  }

  return c.json({ error: lastError }, lastStatus as 429 | 502);
});

// Text-Only Proxy Endpoint
app.post('/v1/chat/analyze', async (c) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return c.json(
      {
        error: 'Server misconfiguration: GEMINI_API_KEY is not set on the proxy.',
      },
      500
    );
  }

  let body: { prompt?: string; model?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  const { prompt, model = 'gemini-3.6-flash' } = body;
  if (!prompt || typeof prompt !== 'string' || prompt.length > 4096) {
    return c.json({ error: 'Invalid prompt: must be string <= 4096 chars.' }, 400);
  }

  const uniqueModels = geminiModelsInOrder(model);
  let lastError = 'Upstream Gemini error';
  let lastStatus = 502;

  const geminiPayload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  };

  const serializedBody = JSON.stringify(geminiPayload);
  let realFallbackUsed = false;

  for (const m of uniqueModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: serializedBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        lastStatus = response.status === 429 ? 429 : 502;
        const errText = await response.text();
        lastError = `Gemini upstream ${response.status}: ${errText.slice(0, 200)}`;
        const modelMissing = response.status === 404 || isGeminiModelMissingMessage(errText);
        if ((response.status === 400 || response.status === 401 || response.status === 403) && !modelMissing) {
          return c.json({ error: `Gemini API Authentication Error (${response.status})` }, 502);
        }
        if (!modelMissing && realFallbackUsed) break;
        if (!modelMissing) realFallbackUsed = true;
        continue;
      }

      interface GeminiResult {
        candidates?: {
          content?: {
            parts?: { text?: string }[];
          };
        }[];
      }

      const result = (await response.json()) as GeminiResult;
      const parts = result.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || '').join('').trim();

      if (!text) {
        lastError = 'Gemini returned empty candidate content.';
        if (realFallbackUsed) break;
        realFallbackUsed = true;
        continue;
      }

      return c.json({
        text,
        usedModel: m,
      });
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timeout);
    }
  }

  return c.json({ error: lastError }, lastStatus as 429 | 502);
});

export default {
  port: parseInt(process.env.PORT || '8787', 10),
  fetch: app.fetch,
};
