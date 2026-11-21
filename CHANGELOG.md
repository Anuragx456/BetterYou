# Changelog

All notable changes to the **BetterYou** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Caveats Closed Post-Sprint-3 (Audit Caveats Milestone)
#### Added
- **Fail-Closed Device Registration & Secret Rotation (Task A)**:
  - Enforced production fail-closed requirement on `POST /v1/devices/register` (returns HTTP 503 if `BOOTSTRAP_SECRET` is missing or $<32$ characters, or if `DEVICE_STORE_ENCRYPTION_KEY` is missing in production).
  - Implemented constant-time bootstrap secret comparison via SHA-256 + `crypto.timingSafeEqual`.
  - Added honest reverse proxy rate limiting gated by `TRUST_PROXY_HEADERS=true` (with 100/hr global registration cap and 5/hr per-deviceId cap).
  - Redesigned `DeviceStore` to use a single representation and encrypted Upstash/Redis storage at rest using AES-256-GCM (`DEVICE_STORE_ENCRYPTION_KEY`).
  - Added authenticated `POST /v1/devices/rotate` endpoint with client helper `rotateDeviceSecretWithProxy`.
- **Atomic Backup Restore with Nested Savepoints & Store Rehydration (Task B)**:
  - Upgraded SQLite database adapter with `withTransactionAsync<T>` supporting real SQLite transactions and nested `SAVEPOINT`s.
  - Added pre-restore snapshot rollback on fault injection for both `replace` and `merge` strategies.
  - Automated post-restore Zustand store rehydration (`useFitnessStore.getState().refreshLoadedData()`) and added fault-injection tests.
- **Decomposition of Remaining 9 God Files & Automated Size Guard (Task C)**:
  - Modularized all 9 remaining oversized source files down to $\le 600$ lines: `src/services/barcodeService.ts` (1,146 $\to$ 34 lines), `src/app/onboarding.tsx` (1,098 $\to$ 225 lines), `src/app/nutrition-target.tsx` (977 $\to$ 272 lines), `src/components/ToxicityReportModal.tsx` (919 $\to$ 393 lines), `src/app/ai-settings.tsx` (840 $\to$ 328 lines), `src/store/useFitnessStore.ts` (837 $\to$ 534 lines), `src/components/GeminiUsageSection.tsx` (827 $\to$ 374 lines), `src/components/VoiceInputModal.tsx` (770 $\to$ 385 lines), `src/store/useSettingsStore.ts` (634 $\to$ 195 lines).
  - Added `scripts/check-file-size.mjs` size guard script wired into CI.
- **CI Trigger Expansion, Stable testIDs & Android Emulator Runner (Task D)**:
  - Added `fix/**` and `feat/**` branch push triggers to `.github/workflows/ci.yml`.
  - Added stable `testID` props across tab bars, meal inputs/saves, workout start/finish, set completion, and barcode/scan views.
  - Updated Maestro Golden Path flows (`log-meal.yaml`, `workout-session.yaml`, `scan-barcode.yaml`) with ID-based selectors.
  - Added non-blocking Android emulator runner job to CI (`reactivecircus/android-emulator-runner@v2`).
- **Release Configuration Validator & Production Deployment Checklist (Task E)**:
  - Created `scripts/validate-release-config.mjs` with `--strict` mode (enforced on main/master) and `--allow-placeholders` mode.
  - Configured preview and production profiles in `eas.json` to point to `https://betteryou-proxy.fly.dev`.
  - Documented complete production deployment checklist in `RELEASE.md`.
- **Indian Food Database Provenance Audit & Integrity Tests (Task F)**:
  - Audited all 50 dishes in `src/data/indianFoodDb.json` with `"confidence": "verified" | "estimate"` and honest source attribution.
  - Updated `src/utils/indianFoodMatcher.ts` and `MealVerificationCard.tsx` to distinguish between `"from local database (IFCT 2017)"` and `"from local database (estimate)"`.
  - Added `src/data/__tests__/indianFoodDb.test.ts` verifying Atwater factors ($\le 20\%$), thermodynamic macro sums ($\le 105$g), and alias uniqueness.
- **Stageshow Onboarding Revamp & Enhanced User Experience**:
  - Revamped the 4-step onboarding flow (`src/app/onboarding.tsx`, `StepBasics.tsx`, `StepActivityGoal.tsx`, `StepTargetCustomizer.tsx`, `StepSummaryCompletion.tsx`) using `stageshow` craft, restraint, and framing principles.
  - Implemented segmented stage navigator with tactile back control, step pills, and responsive skip navigation.
  - Added live BMI calculation feedback, interactive activity meters, visual macro proportion energy bars, and a celebratory on-device SQLite Metabolic Blueprint card.
  - Extracted modular `TargetStepperRow` component keeping all source files strictly $\le 600$ lines.
  - Added unit test suite in `src/components/onboarding/__tests__/onboarding.test.ts` (suite total: 261 passing tests).

---

### Sprint 3 — Code Health, E2E Tests & Documentation (P2)
#### Added
- **Maestro Golden Path E2E Suite**: Created automated flows in `.maestro/`:
  - `log-meal.yaml`: Meal AI capture, macro verification, portion scaling, and dashboard calorie reflection.
  - `workout-session.yaml`: Workout session startup, exercise selection, set logging with weight/reps, and workout history.
  - `scan-barcode.yaml`: Ingredient Lab barcode and printed label hazard screening with risk badge verification.
- **Maestro CI Automation**: Added non-blocking Maestro E2E step to `.github/workflows/ci.yml`.
- **Complete English & Hindi (i18n) Parity**: Added full key parity between `src/i18n/locales/en.json` and `src/i18n/locales/hi.json` covering workouts (कसरत, सेट, वजन, रेप्स, विश्राम), meals (भोजन, कैलोरी, प्रोटीन, कार्ब्स, वसा), toxicity screening (हानिकारक, सुरक्षित, मध्यम जोखिम, सामग्री), dashboard, and settings.
- **i18n Parity Unit Test**: Added `src/i18n/__tests__/i18nParity.test.ts` to assert zero key divergence and non-empty strings.
- **Audit Remediation Tracking**: Renamed `AUDIT.md` to `docs/AUDIT-2026-11.md` with a comprehensive executive remediation matrix.

#### Changed
- **God-File Architectural Decomposition (Sprint 3 Initial Pass)**:
  - `src/db/client.ts` decomposed from 1195 to 385 lines by extracting `src/db/repositories/` (`mealsRepository.ts`, `workoutsRepository.ts`, `productsRepository.ts`, `goalsRepository.ts`, `measurementsRepository.ts`, `correctionsRepository.ts`).
  - `src/services/aiVisionService.ts` decomposed from 1408 to 557 lines by extracting `src/services/ai/` (`geminiTransport.ts`, `promptBuilders.ts`, `responseParsers.ts`, `visionCache.ts`).
  - `src/app/(tabs)/index.tsx` decomposed from 1818 to 537 lines by extracting `src/components/dashboard/` (`CalorieHeroCard.tsx`, `WeekStrip.tsx`, `TrainingCard.tsx`, `MealFeed.tsx`, `RecentScans.tsx`, `AllScansModal.tsx`).
  - `src/app/(tabs)/workouts.tsx` decomposed from 2487 to 218 lines by extracting `src/components/workouts/` (`ActiveWorkoutView.tsx`, `FloatingRestTimer.tsx`, `RoutineTemplates.tsx`, `ActiveExerciseCard.tsx`, `ActiveSetRow.tsx`, `WorkoutHistoryCard.tsx`, `AddExerciseSheet.tsx`) and hooks (`useActiveWorkout.ts`, `useRestTimer.ts`).
  - `src/app/(tabs)/toxicity-scan.tsx` decomposed from 1805 to 439 lines by extracting `src/components/scan/` (`ScanViewfinder.tsx`, `ScannedProductReportView.tsx`, `SafetyScoreGaugeHero.tsx`, `HarmfulIngredientItem.tsx`, `StandardsDisclosureCard.tsx`) and `useToxicityScanner.ts`.
  - `src/app/(tabs)/meal-scan.tsx` decomposed from 1518 to 245 lines by extracting `src/components/meal/` (`MealViewfinder.tsx`, `MealVerificationCard.tsx`, `MealMacroPills.tsx`, `MealDeviationCard.tsx`, `MealPortionStepper.tsx`) and `useMealScanner.ts`.
  - `src/app/(tabs)/settings.tsx` decomposed from 1292 to 539 lines by extracting `src/components/settings/` (`AiIntelligenceSection.tsx`, `AppearanceSection.tsx`, `DataBackupSection.tsx`, `NutritionGoalsSection.tsx`, `RemindersSection.tsx`, `SystemHealthSection.tsx`).
  - *(Correction)*: While primary tab screens were split, nine secondary god files (`barcodeService.ts`, `onboarding.tsx`, `nutrition-target.tsx`, `ToxicityReportModal.tsx`, `ai-settings.tsx`, `useFitnessStore.ts`, `GeminiUsageSection.tsx`, `VoiceInputModal.tsx`, `useSettingsStore.ts`) remained over 600 lines at the end of Sprint 3. Their complete modular decomposition was completed in the subsequent audit-caveats remediation, bringing every source file across `src/` to <= 600 lines.
- **Documentation Realignment**: Updated `README.md` with accurate filesystem tree, real setup instructions (`bun install`), and honest benchmark table.

---

### Sprint 2 — Product Features & Retention Drivers (P1)
#### Added
- **Onboarding Flow & BMR/TDEE Calculator**:
  - Implemented Mifflin-St Jeor formula in `src/utils/nutritionTargets.ts` across 5 activity multipliers and 3 goal adjustments (cut -500 kcal, maintain, bulk +300 kcal).
  - Enforced clinical calorie safety floors ($\ge 1200$ kcal for females, $\ge 1500$ kcal for males).
  - Added 4-step onboarding screen in `src/app/onboarding.tsx` with recalculate mode accessible from Settings.
  - Persisted user profile in SQLite `user_profile` table via Drizzle ORM.
- **Bodyweight Tracking & Progress Trends**:
  - Added `body_measurements` table in Drizzle SQLite schema with CRUD methods in `src/db/client.ts`.
  - Implemented 7-day and 30-day moving averages and weight deltas in `src/utils/nutritionAnalytics.ts`.
  - Added Epley 1RM formula in `src/utils/workoutAnalytics.ts` with auto-calculated estimated 1RM for strength sets.
  - Built pure SVG trend charts (`WeightTrendSvgChart.tsx`, `CalorieIntakeSvgChart.tsx`) and `BodyweightCard.tsx` on Dashboard.
- **Correction Feedback Loop & Curated Indian Food Database**:
  - Bundled `src/data/indianFoodDb.json` with 50 common Indian dishes based on IFCT 2017 reference values.
  - Built fuzzy matcher in `src/utils/indianFoodMatcher.ts` with $>35\%$ deviation detection and user correction overrides.
  - Added `corrections` SQLite table to remember user macro customizations for future scans.
  - Added deviation alert banner and verification card provenance tags (`from your past corrections`, `from local database (IFCT 2017)`).
- **Weekly Summary, Reminders & Notifications**:
  - Pure metrics aggregator in `src/services/weeklySummaryService.ts` computing total lifting volume, average daily calories vs target, and weight change.
  - Implemented opt-in notification scheduling in `src/services/notificationService.ts` (daily meal reminder at 8:00 PM, Sunday recap at 7:00 PM).
  - Added `WeeklySummaryModal.tsx` with Sunday recap dashboard pill and Settings notification controls.

---

### Sprint 1 — Ship-Blockers (P0)
#### Added
- **Hardened Edge Proxy Authentication**:
  - Implemented per-device cryptographic registration flow via `POST /v1/devices/register` issuing a random 32-byte secret.
  - Enforced client request signing using HMAC-SHA256 over method, path, timestamp, and body digest.
  - Constant-time verification (`crypto.timingSafeEqual`) on proxy server with $\pm 5$ min timestamp gating and replay cache.
  - Pluggable `RateLimiter` interface supporting `InMemoryRateLimiter` and `UpstashRedisRateLimiter`.
  - `AttestationVerifier` interface with dev no-op implementation and Play Integrity / App Attest production slots.
  - Client credentials migration from `AsyncStorage` to encrypted `expo-secure-store`.
- **Atomic Backup Import & Restore**:
  - Implemented Zod-validated `parseAndValidateBackup` rejecting unknown future schema versions.
  - Atomic transactional `importBackup` supporting `"merge"` (skip duplicates) and `"replace"` (wipe and restore) strategies.
  - Added Settings UI with `expo-document-picker` and destructive-action confirmation dialogs.
  - Graceful handling of missing local image files.
- **OTA Updates & Release Operations**:
  - Configured `expo-updates` with runtime policy `appVersion`.
  - Created `src/utils/checkForUpdates.ts` to safely gate updates during app launch (preventing mid-workout and mid-scan restarts).
  - Created `RELEASE.md`, `docs/store-listing.md`, and `screenshots/README.md`.
- **Honest Evaluation Harness**:
  - Restructured evals dataset into `evals/dataset/images/{meals,products}` and `manifest.json`.
  - Updated `evals/run-eval.ts` to gate scoring strictly on real photos on disk, reporting `skipped_no_image` with zero fabricated metrics when photos are pending.
  - Created `evals/COLLECTING.md` photography guide.
