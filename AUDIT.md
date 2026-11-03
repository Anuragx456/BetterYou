# BetterYou Engineering Audit (AUDIT.md)

**Auditor:** Senior React Native/Expo Engineer  
**Date:** November 2026  
**Scope:** Architectural, Security, Data Layer, AI, and Scoring Audit across BetterYou codebase (`Expo SDK 58`, `React Native 0.88`, `React 19`, `Zustand v5`, `Gemini REST API`, `AsyncStorage`).

---

## Executive Summary

BetterYou presents a compelling offline-first health, lifting volume, and ingredient-screening concept. However, an in-depth codebase audit reveals substantial discrepancies between claims documented in `README.md` and the actual implementation in `src/`. 

Crucially:
1. **Security**: The Gemini API key is exposed via client-side environment variables (`EXPO_PUBLIC_GEMINI_API_KEY`) and user-provided keys are persisted in plaintext `AsyncStorage` rather than encrypted platform keystores (`expo-secure-store`).
2. **State Partitioning**: The claim that workout sets do not re-serialize historical data is **FALSE**; Zustand's `persist` middleware invokes serialization on *every* store update regardless of slicing.
3. **Storage & CursorWindow**: Images are referenced by temporary cache URIs that Android deletes, and historical records remain clustered in a monolithic JSON blob susceptible to SQLite `CursorWindowAllocationException`.
4. **Caching**: Image scan cache checks occur *after* expensive multimodal LLM network round-trips, eliminating expected token/latency savings.
5. **Scoring Engine**: While keyword matching is deterministic, generative LLM hallucinations are merged directly into the final score, and unverified marketing numbers populate the accuracy matrix.

---

## README Claim Verification Matrix

| Claim | Status | File & Line Evidence | Summary of Finding |
| :--- | :---: | :--- | :--- |
| **1. Secure Key Storage** | **FALSE** | `src/store/useSettingsStore.ts:155-156`<br>`src/utils/storage.ts:16, 27`<br>`package.json:5-30` | User API keys are persisted as unencrypted plaintext JSON in standard `AsyncStorage`. `expo-secure-store` is neither installed nor utilized. No hardware-backed Keystore or Keychain protection. |
| **2. CursorWindow Fix** | **PARTIAL** | `src/app/(tabs)/meal-scan.tsx:65-66, 187`<br>`src/store/useFitnessStore.ts:104, 450-457` | Storing file URIs rather than raw base64 avoids multi-MB single entries. However, URIs point to OS `cacheDirectory` which Android deletes under memory pressure. Furthermore, all 300 meals and 150 workouts live in a single AsyncStorage key; large records still risk breaching the 2MB SQLite CursorWindow limit. |
| **3. State Partitioning** | **FALSE** | `src/store/useFitnessStore.ts:348-353, 448-457, 489-501`<br>`node_modules/zustand/esm/middleware.mjs:370-374` | Zustand's `persist` intercepts `setState` and unconditionally re-serializes `options.partialize({ ...get() })` on every mutation. Every set/rep keystroke in `activeWorkout` re-serializes all 300 meals and 150 workouts to `betteryou-fitness-storage`, in addition to a second write to `betteryou-active-workout`. |
| **4. Caching** | **PARTIAL** | `src/services/aiVisionService.ts:573-587`<br>`src/services/barcodeService.ts:1221-1250` | Barcode memory caching, negative caching, and offline presets are verified. However, in `analyzeIngredientsImage`, the fingerprint check against `toxicityScanCache` occurs *after* `await callGeminiVision(...)`. The full 10–15s network API call executes before the cache is queried, yielding zero network or cost savings on duplicate photo scans. |
| **5. Deterministic Scoring** | **PARTIAL** | `src/services/barcodeService.ts:741-789, 833-876`<br>`src/services/aiVisionService.ts:608-633` | Rule-based keyword deductions and empty-data caps (=50) are deterministic for fixed strings. However: (a) LLM-hallucinated additives and arbitrary severities are merged directly into the report via `recomputeReportScoreAndRisk`; (b) `recomputeReportScoreAndRisk` lacks the empty-data safeguard, resetting empty reports to 100; (c) offline presets hardcode arbitrary static scores; (d) repeated same-class additives lack deduction caps. |
| **6. Model Accuracy Table** | **FALSE** | `src/store/useSettingsStore.ts:24-93` | Benchmark accuracy metrics (e.g. 97.8% OCR, 96% Food Accuracy) are hardcoded marketing strings in `AVAILABLE_GEMINI_MODELS`. There is no evaluation harness, dataset, test split, or verification script in the repo. |
| **7. Shipped API Key Security** | **FALSE** | `src/services/aiVisionService.ts:71-74, 118`<br>`src/store/useSettingsStore.ts:165-171`<br>`app.json:2-53` | Any environment variable prefixed with `EXPO_PUBLIC_` is baked directly into the distributed client JavaScript bundle. The app communicates directly with Google's API with no server-side proxy, payload validation, or device rate-limiting. |
| **8. Offline-First Architecture** | **PARTIAL** | `src/store/useFitnessStore.ts:86-484`<br>`src/services/barcodeService.ts:882-1215`<br>`src/services/aiVisionService.ts:504-508, 654-659` | Local storage persists logged data offline, and 10 preset barcodes resolve offline. However, photo vision scanning completely fails offline (or silently returns static mocks). There is no persistent offline queue (NetInfo) to resume pending scans when network connectivity returns. |
| **9. Forensic / Clinical Claims** | **FALSE** | `src/services/barcodeService.ts:25-150, 400-495, 801-807`<br>`src/services/aiVisionService.ts:530-570` | Basic regular expression matching against ~30 additives is marketed as "forensic toxicological screening", "clinical verdicts", and "certifications". This introduces severe medical and regulatory liability without cited standards (EFSA, FSSAI, IARC, CDSCO). |
| **10. Frontend Performance** | **PARTIAL** | `src/app/(tabs)/workouts.tsx:49-70, 81-105`<br>`src/app/(tabs)/index.tsx:39-46` | Screens subscribe broadly to store states; workouts use unoptimized JS timers for rest countdowns and standard `FlatList` instead of `@shopify/flash-list`. Missing accessibility roles, labels, and 48dp touch targets on multiple interactive elements. |

---

## Deep-Dive Analysis of Core Claims

### 1. Key Storage & Secret Inlining (`EXPO_PUBLIC_GEMINI_API_KEY`)
- **Claim:** "Secure Key Storage: API keys entered into the app remain in isolated on-device storage and are never logged or exported."
- **Finding:** **FALSE**
- **Detailed Evidence:**
  1. `src/store/useSettingsStore.ts` stores user-provided keys in `customApiKey` which is persisted using `safeAsyncStorage` (`src/utils/storage.ts`), backed by `@react-native-async-storage/async-storage`.
  2. On Android, `AsyncStorage` writes unencrypted SQLite database records to `/data/data/<package>/databases/RKStorage`. Anyone with device access, adb backup, or rooted inspection can extract the key in plaintext.
  3. `package.json` contains no reference to `expo-secure-store` or native keystore encryption.
  4. The default API key is accessed via `process.env.EXPO_PUBLIC_GEMINI_API_KEY` (`src/store/useSettingsStore.ts:170`). In Expo, all `EXPO_PUBLIC_*` variables are embedded into the client bundle at build time, allowing trivial extraction using `strings` or reverse-engineering tools.
  5. Requests are sent directly from client to `https://generativelanguage.googleapis.com` (`src/services/aiVisionService.ts:113`), exposing the key in network traces and proxy logs.

---

### 2. CursorWindow Bloat & Image Storage
- **Claim:** "Zero CursorWindow Bloat: Persistent storage saves only local filesystem URIs (`file://...`), never raw base64 data. This prevents Android SQLite `CursorWindowAllocationException` errors."
- **Finding:** **PARTIAL**
- **Detailed Evidence:**
  1. **Positive:** In `src/app/(tabs)/meal-scan.tsx:187`, `addMeal` is called with `imageUri: capturedImageUri ?? undefined`, which correctly avoids saving the multi-megabyte base64 string directly to the store.
  2. **Vulnerability 1 (Ephemeral Cache Loss):** `capturedImageUri` is populated from `photo.uri` or `optimized.uri` (`src/app/(tabs)/meal-scan.tsx:112, 116`), which are stored in the application's temporary cache directory (`cacheDirectory`). Android's low-memory daemon routinely purges cache directories, rendering historical meal images dead/broken links upon subsequent app launches.
  3. **Vulnerability 2 (Monolithic Array Serialization):** In `src/store/useFitnessStore.ts:104, 400, 416`, `meals` (sliced at 300), `workouts` (sliced at 150), and `scannedProducts` (sliced at 100) are grouped into a single JSON object. A single AsyncStorage row containing 300 meal objects with ingredient arrays and metadata can easily exceed Android's 2MB `CursorWindow` threshold, triggering crashes during store rehydration.

---

### 3. State Partitioning & Workout Serialization Bottlenecks
- **Claim:** "Active Workout Partition serialized to an isolated, lightweight key (`betteryou-active-workout`). Mutations to the active workout never re-serialize historical meal or workout records."
- **Finding:** **FALSE**
- **Detailed Evidence:**
  1. In `src/store/useFitnessStore.ts:448-457`, `useFitnessStore` is wrapped in Zustand's `persist` middleware.
  2. In `node_modules/zustand/esm/middleware.mjs:370-374`:
     ```js
     const setItem = () => {
       const state = options.partialize({ ...get() });
       return storage.setItem(options.name, { state, version: options.version });
     };
     const savedSetState = api.setState;
     api.setState = (...args) => {
       savedSetState(...args);
       return setItem();
     };
     ```
  3. Any state update via `set()`—including `updateSetInActiveExercise` (`src/store/useFitnessStore.ts:348`)—triggers `setItem()`, which executes `options.partialize({ ...get() })`.
  4. As a result, every set keystroke or completion checkbox toggle re-serializes all historical meals, past workouts, and scanned products into JSON and writes them to `betteryou-fitness-storage`.
  5. The store subscription (`src/store/useFitnessStore.ts:489-501`) *additionally* writes to `ACTIVE_WORKOUT_STORAGE_KEY`. This means the application actually performs **two** disk writes per keystroke instead of zero.

---

### 4. Caching Pipeline & API Inefficiencies
- **Claim:** "In-memory Scan Cache guarantees identical result for identical product... 0 network requests for repeated scans."
- **Finding:** **PARTIAL**
- **Detailed Evidence:**
  1. **Barcode Service (Verified):** `src/services/barcodeService.ts:1221-1250` implements `barcodeMemoryCache`, in-flight request deduplication via `inFlightLookups`, negative caching via `negativeBarcodeCache` (5-minute TTL), and offline presets.
  2. **AI Vision Cache (Inverted Execution):** In `src/services/aiVisionService.ts:573-587`:
     ```ts
     // Line 573: Gemini network call executes FIRST
     const { text: rawJson, usedModel } = await callGeminiVision(prompt, base64Image);
     const parsed = JSON.parse(rawJson) as RawToxicityAiOutput;

     // Line 583: Fingerprint computed AFTER network call completes
     const fingerprint = computeScanFingerprint(detectedName, detectedIngredients);
     const cached = toxicityScanCache.get(fingerprint);
     if (cached && Date.now() - cached.timestamp < SCAN_CACHE_TTL_MS) {
       return cached.report;
     }
     ```
     Because the cache is checked after calling Gemini Vision, the user and device still incur full latency (10–15s), bandwidth, and API quota on every repeated scan.
  3. The cache is in-memory only and is lost whenever the app is closed.

---

### 5. Toxicological Scoring Engine Rigor
- **Claim:** "Deterministic Scoring Grounding... verified toxicological engine... Data integrity guard caps empty data at 50."
- **Finding:** **PARTIAL**
- **Detailed Evidence:**
  1. **Arithmetic Correctness:** `src/services/barcodeService.ts:741-789` correctly implements deductions (NOVA 4: -30, Nutri-score E: -20, High severity additive: -18, Moderate: -9, Low: -4) and clamps between 5 and 100.
  2. **Hallucination Contamination:** In `src/services/aiVisionService.ts:608-633`, LLM-extracted `harmfulIngredients` with LLM-assigned severity strings (`high`, `moderate`, `low`) are appended into `baseReport.harmfulIngredients`, and `recomputeReportScoreAndRisk` is invoked. Thus, generative hallucinations directly alter the final score.
  3. **Guard Bypass:** `recomputeReportScoreAndRisk` (`src/services/barcodeService.ts:833-876`) starts with `let score = 100` and contains no check for `hasInsufficientData`. If called on a product with empty ingredients, it resets the score to 100 ("Safe"), bypassing the empty-data safeguard.
  4. **Preset Disconnect:** Offline presets (`src/services/barcodeService.ts:882-1215`) contain static pre-set scores (e.g. Kurkure=32, Maggi=38) rather than values computed by the rule engine.
  5. **Uncapped Cascades:** Multiple additives of the same class (e.g. 4 azo dyes or 3 parabens) stack uncapped -18 deductions, immediately collapsing the score to 5.

---

## Remediation Roadmap

The identified vulnerabilities map directly to the planned implementation phases:

1. **Phase 1 (Security - Blocking):**
   - Eliminate `EXPO_PUBLIC_GEMINI_API_KEY` from client builds.
   - Build a lightweight proxy (`/server` with Bun + Hono) managing secret keys, request size caps, device rate limiting, and device authentication.
   - Migrate client BYOK storage to `expo-secure-store` with zero logging.
   - Run gitleaks verification and verify `.env` is absent from git history.
2. **Phase 2 (Data Layer):**
   - Replace monolithic AsyncStorage arrays with `expo-sqlite` and `Drizzle ORM` (tables for `meals`, `workout_sessions`, `exercises`, `sets`, `scanned_products`, `daily_goals` with indexed `date`).
   - Write an idempotent, one-time resumable migration script.
   - Move camera and gallery captures to `FileSystem.documentDirectory` with relative path storage and orphan cleanup.
   - Confine Zustand strictly to UI/session state.
3. **Phase 3 (AI Pipeline Hardening):**
   - Implement Gemini structured output (`responseSchema`) with `Zod` validation, repair retry, and graceful manual fallback.
   - Add exponential backoff, jitter, 429 rate-limit handling, and offline request queuing with `NetInfo`.
   - Remove misleading `confidenceScore` and implement a macronutrient thermodynamic plausibility check ($4P + 4C + 9F \approx \text{kcal} \pm 20\%$).
   - Create an empirical evaluation harness with 50 ground-truth labeled images in `/evals`.
4. **Phase 4 (Scoring Engine Normalization):**
   - Migrate additive rules to versioned JSON with cited sources (EFSA, FSSAI, IARC, CDSCO).
   - Normalize ingredient names (synonyms, INS/E-numbers, multilingual Hindi/English).
   - Cap repeated same-class deductions and account for ingredient position/order.
   - Rebrand user copy from "forensic toxicology" to "ingredient risk screening".
5. **Phase 5 (Frontend Polish & Accessibility):**
   - Adopt `@shopify/flash-list` for lists.
   - Migrate animations to `react-native-reanimated`.
   - Ensure 48dp touch targets, TalkBack pass, high-contrast compliance, and background-safe rest timer.
6. **Phase 6 (Quality & Observability):**
   - Comprehensive test suite for migrations, store logic, mocked barcode resolution, and scoring rules.
   - CI pipeline (typecheck, lint, test, expo-doctor) on GitHub Actions.
   - Sentry error monitoring with PII scrubbing.
