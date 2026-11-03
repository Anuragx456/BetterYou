import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface RateLimitEntry {
  windowStart: number;
  count: number;
  dailyWindowStart: number;
  dailyCount: number;
}

// In-memory rate limiting state per device ID
const rateLimitStore = new Map<string, RateLimitEntry>();
const MINUTE_LIMIT = 15;
const DAILY_LIMIT = 150;
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export function checkRateLimit(deviceId: string, now: number = Date.now()): {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
} {
  let entry = rateLimitStore.get(deviceId);
  if (!entry) {
    entry = {
      windowStart: now,
      count: 0,
      dailyWindowStart: now,
      dailyCount: 0,
    };
    rateLimitStore.set(deviceId, entry);
  }

  // Reset 1-minute window
  if (now - entry.windowStart > 60 * 1000) {
    entry.windowStart = now;
    entry.count = 0;
  }

  // Reset 24-hour window
  if (now - entry.dailyWindowStart > 24 * 60 * 60 * 1000) {
    entry.dailyWindowStart = now;
    entry.dailyCount = 0;
  }

  // Check 1-minute rate limit
  if (entry.count >= MINUTE_LIMIT) {
    const retryAfter = Math.ceil((60 * 1000 - (now - entry.windowStart)) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfter),
      reason: 'Rate limit exceeded: 15 requests per minute allowed per device.',
    };
  }

  // Check 24-hour quota
  if (entry.dailyCount >= DAILY_LIMIT) {
    const retryAfter = Math.ceil((24 * 60 * 60 * 1000 - (now - entry.dailyWindowStart)) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfter),
      reason: 'Daily quota exceeded: 150 requests per day allowed per device.',
    };
  }

  entry.count += 1;
  entry.dailyCount += 1;
  return { allowed: true };
}

export function resetRateLimits() {
  rateLimitStore.clear();
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

// Device Auth & Rate-Limit Middleware for /v1/* routes
app.use('/v1/*', async (c, next) => {
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

  // Signature minimum length validation (HMAC SHA-256 is 64 hex characters)
  if (signature.length < 32) {
    return c.json({ error: 'Invalid device signature format.' }, 401);
  }

  // Enforce device rate limits
  const rateResult = checkRateLimit(deviceId, now);
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
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  const { prompt, imageBase64, mimeType = 'image/jpeg', model = 'gemini-3.6-flash' } = body;

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
  const candidateModels = [model, 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  const uniqueModels = Array.from(new Set(candidateModels));
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
      temperature: 0.0,
      maxOutputTokens: 1024,
    },
  };

  const serializedBody = JSON.stringify(geminiPayload);

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
        // If auth error, don't keep retrying other models with same invalid key
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          return c.json({ error: `Gemini API Authentication Error (${response.status})` }, 502);
        }
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

  const candidateModels = [model, 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  const uniqueModels = Array.from(new Set(candidateModels));
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
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          return c.json({ error: `Gemini API Authentication Error (${response.status})` }, 502);
        }
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
