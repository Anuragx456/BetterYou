# BetterYou AI Proxy Server

Lightweight, high-performance API proxy built with [Bun](https://bun.sh) and [Hono](https://hono.dev).

## Purpose
- Holds the master `GEMINI_API_KEY` in server-side environment variables, ensuring zero secret leakage to client mobile bundles.
- Enforces strict payload caps (max 5MB body size, prompt length <= 4096 chars, supported image MIME types).
- Enforces device rate-limiting (15 requests/minute, 150 scans/day per device ID).
- Enforces device authentication with timestamp-based replay protection (±5 min).
- Supports opt-in client BYOK (Bring Your Own Key), allowing power users to bypass the proxy and communicate directly with Google AI Studio using their private key stored in `expo-secure-store`.

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

## App-to-Proxy Authentication & Residual Risk Disclosure

### Implemented Mechanism
1. **Device Identification**: Each client device generates a cryptographically random UUID stored in `expo-secure-store`.
2. **Replay Protection**: Outgoing requests include an `x-timestamp` header; requests differing by more than ±5 minutes from server clock time are rejected with HTTP 401.
3. **Cryptographic Signing**: Requests include an `x-signature` header containing a SHA-256 HMAC of `deviceId:timestamp:method:path:bodyHash:deviceSecret`.
4. **Rate Limiting**: The server enforces a sliding window rate limit of 15 requests per minute and 150 scans per day per device ID.

### Honest Residual Risk Disclosure
> [!WARNING]
> Without a hardware-attested token verified against Google Play Servers (such as **Google Play Integrity API** or **Apple DeviceCheck**), a motivated attacker with root access or decompilation tools can inspect the mobile client code, extract the client signing logic, and generate arbitrary valid request signatures.
>
> While this architecture successfully prevents:
> - Direct Google Gemini API key extraction from the app bundle (the master key is never shipped to clients).
> - Unauthorized replay attacks (prevented by the 5-minute replay window).
> - Single-device Denial of Service / quota exhaustion (capped by per-device sliding rate limits).
>
> It **cannot** mathematically guarantee that the requesting client is an untampered binary running on genuine non-rooted hardware. Full attestation requires Google Play Integrity integration backed by Google Play Console project keys.
