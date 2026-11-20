# BetterYou AI Proxy Server

Lightweight, high-performance API proxy built with [Bun](https://bun.sh) and [Hono](https://hono.dev).

## Purpose
- Holds the master `GEMINI_API_KEY` in server-side environment variables, ensuring zero secret leakage to client mobile bundles.
- Enforces strict payload caps (max 5MB body size, prompt length <= 4096 chars, supported image MIME types).
- Enforces per-device HMAC-SHA256 request authentication and timestamp replay protection (±5 min).
- Enforces device rate-limiting (15 requests/minute, 150 scans/day per device ID) with in-memory or Upstash Redis storage.
- Supports opt-in client BYOK (Bring Your Own Key), allowing users to bypass the proxy and communicate directly with Google AI Studio using their private key stored in `expo-secure-store`.

## Quick Start

### 1. Install Dependencies
```bash
cd server
bun install
```

### 2. Environment Configuration
Create `server/.env`:
```env
PORT=8787
GEMINI_API_KEY=your_actual_google_gemini_api_key_here

# Optional: Shared bootstrap check for device registration (REQUIRED in production, min 32 chars)
BOOTSTRAP_SECRET=

# Required in production when Upstash Redis is enabled: 32-byte AES-256-GCM encryption key
DEVICE_STORE_ENCRYPTION_KEY=

# Optional: Reverse proxy header trust (set to "true" behind Fly.io, Cloudflare, etc.)
TRUST_PROXY_HEADERS=true

# Optional: Upstash Redis for distributed rate-limiting & device records
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 3. Run Development Server
```bash
bun run dev
```

The proxy will run at `http://localhost:8787`. Health check is available at `http://localhost:8787/health`.

### 4. Run Tests
```bash
bun test
```

## Production Deployment

### Option A: Fly.io (Recommended)
```bash
cd server
fly launch --name betteryou-proxy --region bom
fly secrets set GEMINI_API_KEY=your_production_gemini_key
fly deploy
```
Copy the assigned URL (e.g. `https://betteryou-proxy.fly.dev`) and set `EXPO_PUBLIC_PROXY_URL` in `eas.json` or `.env`.

### Option B: Docker Container
```bash
cd server
docker build -t betteryou-proxy .
docker run -p 8787:8787 -e GEMINI_API_KEY=your_key -e PORT=8787 betteryou-proxy
```

### Option C: Railway / Render
Connect the repository and set the root directory to `server/`. Specify `bun run src/index.ts` as the start command and add the `GEMINI_API_KEY` secret.

## Authentication Architecture & Threat Model

### 1. Registration Flow (`POST /v1/devices/register`)
- On first launch, the mobile app calls `/v1/devices/register`.
- **Fail-Closed Production Rules**: If running in production (`NODE_ENV=production` or `PROXY_ENV=production`), `BOOTSTRAP_SECRET` must be set and $\ge 32$ characters, and `DEVICE_STORE_ENCRYPTION_KEY` must be set and exactly 32 bytes (64 hex characters or 32 raw bytes). If either is missing, registration is disabled with HTTP 503 Service Unavailable.
- **Constant-Time Verification**: Incoming bootstrap secrets (`x-bootstrap-secret` header or payload) are hashed with SHA-256 and compared using `crypto.timingSafeEqual` to eliminate timing side-channels without length leakage.
- The proxy generates a cryptographically secure random per-device secret (32 bytes / 64 hex characters) using `crypto.randomBytes(32)`.
- **At-Rest AES-256-GCM Encryption**: The Upstash Redis store never writes plaintext secrets to disk or cloud databases. Records are encrypted with AES-256-GCM using `DEVICE_STORE_ENCRYPTION_KEY`, storing `{ iv, ciphertext, authTag }`. Tampered ciphertext fails closed safely.
- **Honest Rate Limiting**: Client IP extraction from `x-forwarded-for` and `Fly-Client-IP` is strictly gated by `TRUST_PROXY_HEADERS=true` (safely set by reverse proxies like Fly.io). Without it, an un-spoofable global cap (100 registrations/hour) and per-deviceId cap (5 registrations/hour) protect the cluster in addition to client rate limiting.
- The client persists `deviceSecret` in hardware-backed `expo-secure-store` (Android Keystore / iOS Keychain), never in plaintext AsyncStorage.
- Re-registration generates a fresh secret and overwrites the previous record; the endpoint **never echoes or returns another device's existing secret**.

### 2. Device Secret Rotation (`POST /v1/devices/rotate`)
- When rotating credentials, an authenticated device calls `/v1/devices/rotate`.
- The request is authenticated by the existing HMAC-SHA256 middleware using the current device secret.
- Upon valid verification, the server generates a fresh 32-byte secret, updates the store atomically, and returns `{ deviceId, deviceSecret }`.
- The old secret is immediately invalidated; subsequent requests with the old secret are rejected.
- Client helper `rotateDeviceSecretWithProxy()` only overwrites the local SecureStore credential after the server confirms success.

### 3. Request Signing (`HMAC-SHA256`)
Every request to `/v1/*` must include:
- `x-device-id`: The registered device identifier.
- `x-timestamp`: The client timestamp in milliseconds.
- `x-signature`: The HMAC-SHA256 signature over the canonical payload:
  ```text
  METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)
  ```
The proxy verifies:
1. **Timestamp Freshness**: Rejects timestamps outside the ±5 minute window (HTTP 401).
2. **Replay Protection**: Caches seen signatures within the 5-minute replay window. Any duplicate signature is rejected with HTTP 401.
3. **Cryptographic Signature**: Computes the expected HMAC-SHA256 using the registered device secret and verifies against the incoming signature using constant-time comparison (`timingSafeEqual`) to prevent timing side-channels.
4. **Body Integrity**: Tampering with the HTTP body invalidates the SHA-256 body hash and causes signature verification to fail (HTTP 401).

### 3. Rate Limiter Abstraction
The proxy defines a `RateLimiter` interface with two implementations:
- `InMemoryRateLimiter`: Sliding window rate limiter for local development and single-instance deployments (default).
- `UpstashRedisRateLimiter`: Automatic distributed sliding-window limiter used when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. Enforces the same per-device limits (15 requests/min, 150 requests/day) across horizontal server instances without local process memory resets.

### 4. Honest Threat Model & Residual Risk Disclosure
> [!WARNING]
> **What this architecture PROVES:**
> - The caller possesses the per-device secret issued during registration.
> - The request has not been tampered with in transit (method, path, timestamp, and body are cryptographically bound by HMAC-SHA256).
> - The request has not been replayed from an earlier network trace (bounded by the 5-minute window and seen-signature cache).
> - A single rogue device cannot consume more than 15 requests/minute or 150 requests/day of upstream Gemini quota.
> - The upstream Google Gemini API key is never distributed to clients or exposed in reverse-engineered client JavaScript.
>
> **What this architecture DOES NOT PROVE:**
> - Without platform attestation actively enforced (Google Play Integrity on Android / Apple App Attest on iOS), an attacker who gains root or physical access to their own device can dump their device secret from memory and generate valid HMAC signatures from external scripts.
> - Rate limits prevent runaway quota burn per device, but Sybil attacks (registering thousands of devices) can only be defeated by enabling hardware attestation (`ENABLE_PLATFORM_ATTESTATION=true` backed by Google Play Console project credentials) or requiring authenticated user accounts.
