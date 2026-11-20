# BetterYou Release & Deployment Guide

This document outlines the end-to-end production build, deployment, and Over-The-Air (OTA) update lifecycle for **BetterYou**.

---

## 1. Prerequisites & Manual Setup Steps (Action Required by You)

Before shipping to testers or public app stores, the following one-time manual steps must be completed:

### 1.1 Link Your EAS Project
1. Install or run EAS CLI:
   ```bash
   bunx eas-cli login
   ```
2. Initialize or link your project:
   ```bash
   bunx eas-cli project:init
   ```
3. Copy the assigned EAS Project ID from your Expo Dashboard and replace the `YOUR_EAS_PROJECT_ID_HERE` placeholders in `app.json`:
   ```json
   "updates": {
     "url": "https://u.expo.dev/<YOUR_ACTUAL_PROJECT_ID>"
   },
   "extra": {
     "eas": {
       "projectId": "<YOUR_ACTUAL_PROJECT_ID>"
     }
   }
   ```

### 1.2 Google Play Console & Apple App Store Connect
1. **Google Play Console**:
   - Create application `com.betteryou.app`.
   - Complete store listing using the draft copy in `docs/store-listing.md`.
   - Upload 5 required screenshots according to `screenshots/README.md`.
   - Setup upload key / Play App Signing via `bunx eas-cli credentials`.
2. **Apple App Store Connect**:
   - Register bundle identifier `com.betteryou.app`.
   - Upload screenshots and privacy questionnaire (Zero third-party trackers, local-first database).

---

## 2. Cloud Builds with EAS

All production builds are compiled in Expo Application Services (EAS) cloud builders.

### 2.1 Internal Preview Build (APK / TestFlight)
To generate an installable Android APK or iOS internal test build:
```bash
# Android APK for direct device installation
bunx eas-cli build --platform android --profile preview

# iOS Simulator / Ad-Hoc build
bunx eas-cli build --platform ios --profile preview
```

### 2.2 Production App Store Build (AAB / IPA)
To compile a signed Android App Bundle (AAB) or iOS IPA for store submission:
```bash
# Production Android App Bundle (.aab)
bunx eas-cli build --platform android --profile production

# Production iOS Archive (.ipa)
bunx eas-cli build --platform ios --profile production
```

### 2.3 Store Submission
Submit your production build directly to the stores:
```bash
# Submit to Google Play Internal / Closed Testing
bunx eas-cli submit --platform android

# Submit to Apple App Store Connect / TestFlight
bunx eas-cli submit --platform ios
```

---

## 3. Over-The-Air (OTA) Updates with `expo-updates`

BetterYou uses `expo-updates` configured with the `"runtimeVersion": { "policy": "appVersion" }` strategy. This ensures that JavaScript and asset updates are delivered seamlessly to users without requiring a full native binary re-compile or store review, while preventing binary version mismatches.

### 3.1 OTA Channel Architecture
- **Preview Channel (`preview`)**: Wired to internal testing builds.
- **Production Channel (`production`)**: Wired to public store releases.

### 3.2 Publishing an OTA Update
When fixing bugs, updating food databases, or refining UI components:
```bash
# Publish to preview testers
bunx eas-cli update --channel preview --message "fix: update food database and refine macro chips"

# Publish to production users
bunx eas-cli update --channel production --message "feat: weekly summary and stability improvements"
```

### 3.3 Safe In-App Update Gating
BetterYou checks for updates on launch via `src/utils/checkForUpdates.ts`:
- **Development & Expo Go Protection**: Checks are completely skipped in `__DEV__` or Expo Go.
- **Gym & Workout Safety**: Update checks and restarts are strictly blocked when the user has an active workout session in progress (`isMidWorkout === true`).
- **User Prompting**: When an update is downloaded, the user is prompted to restart at their convenience. The app **never** force-restarts mid-scan or mid-workout.

---

## 4. Running Maestro Golden Path Tests Locally

To run the automated Maestro E2E test suite locally on an active Android emulator or connected device:

1. Install Maestro CLI:
   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```
2. Start the app on your emulator:
   ```bash
   bunx expo start --android
   ```
3. Run the golden path flows:
   ```bash
   maestro test .maestro/
   ```
   Or run individual flows:
   ```bash
   maestro test .maestro/log-meal.yaml
   maestro test .maestro/workout-session.yaml
   maestro test .maestro/scan-barcode.yaml
   ```

---

## 5. Production Release Gate & Deployment Checklist

Before triggering a store build or merging to `main`, ensure every gate below is satisfied:

### 5.1 Proxy Server Deployment Checklist (Fly.io / Docker)
The proxy server enforces fail-closed registration and cryptographic store encryption in production:

1. **Deploy Proxy**:
   ```bash
   cd server
   fly deploy
   ```
2. **Configure Required Server Secrets**:
   ```bash
   # 1. Production Bootstrap Secret (must be >= 32 characters)
   fly secrets set BOOTSTRAP_SECRET="<generate-random-32-byte-hex-or-base64-string>"

   # 2. Store Encryption Key for AES-256-GCM (exactly 32 bytes hex or base64)
   fly secrets set DEVICE_STORE_ENCRYPTION_KEY="<generate-32-byte-encryption-key>"

   # 3. Google Gemini API Key
   fly secrets set GEMINI_API_KEY="<production-gemini-api-key>"

   # 4. Redis at Rest (Upstash)
   fly secrets set UPSTASH_REDIS_REST_URL="https://..."
   fly secrets set UPSTASH_REDIS_REST_TOKEN="..."

   # 5. Reverse Proxy Trust Header
   fly secrets set TRUST_PROXY_HEADERS="true"
   fly secrets set NODE_ENV="production"
   ```

### 5.2 Client EAS Project & Environment Checklist
1. **Link Project**:
   ```bash
   bunx eas-cli project:init
   ```
   Replace `YOUR_EAS_PROJECT_ID_HERE` in `app.json` (`expo.updates.url` and `expo.extra.eas.projectId`) with the assigned project UUID.
2. **Configure EAS Production Environment Variables**:
   ```bash
   # Set the production proxy URL for preview and production builds
   bunx eas-cli env:create --scope project --name EXPO_PUBLIC_PROXY_URL --value "https://betteryou-proxy.fly.dev" --type string
   ```
3. **Verify Config with Automated Validator**:
   ```bash
   # Strict mode (fails if any placeholders or localhost urls remain)
   node scripts/validate-release-config.mjs --strict
   ```

