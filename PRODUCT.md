# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users
Health-conscious individuals, fitness enthusiasts, and lifters who want automated nutrition tracking alongside uncompromising transparency regarding toxic food additives, endocrine disruptors, and ultra-processed foods (UPFs).

## Product Purpose
BetterYou empowers users to transform their health and physical performance by providing friction-free AI meal logging, rigorous volume tracking for workouts, and deep toxicological analysis of everyday grocery items and packaged foods. Success means users stay consistently on target with their daily calorie and macronutrient budgets, progress in their lifting volume, and avoid harmful industrial food additives without tedious manual lookups.

## Positioning
BetterYou is the only mobile wellness companion that marries sports nutrition and progressive overload tracking with forensic ingredient toxicology. While existing apps merely tally calories (ignoring harmful chemicals) or only scan barcodes (ignoring holistic fitness), BetterYou unifies calorie vision, heavy lifting volume, and chemical food safety into a single, high-contrast command dashboard.

## Operating Context
- **Kitchen, restaurant, or dining table:** Snapping photos of plates and bowls for instant calorie and macronutrient estimation with interactive portion scaling.
- **Grocery store & supermarket aisles:** Photographing back-of-pack ingredient labels on any product available in an Indian supermarket—including packaged foods & namkeens (FSSAI/NOVA), personal care & hair oils (CDSCO, mineral oil traps, parabens, sulfates), oral care (SLS canker sore triggers), home cleaning detergents (BIS, Benzalkonium chloride pet hazards), mosquito vaporizers & repellents (CIBRC, transfluthrin neurotoxins), baby care (talc inhalation), and Ayurvedic OTC supplements (AYUSH, hidden sugars and preservatives). Dedicated high-accuracy AI Forensic Label OCR avoids inaccurate/outdated crowdsourced barcode databases.
- **Gym floor:** Logging exercises, sets, weights, and reps with an automated floating countdown rest timer (60s/90s/120s) between sets.

## Capabilities and Constraints
- **Platform:** React Native / Expo SDK 58 Managed Workflow targeting iOS & Android (`adaptive`).
- **Nutrition AI:** Gemini 3.5 Flash multimodal food vision estimating dish name, gram portion weight, calories, and macronutrient split (Protein, Carbs, Fat) with real-time portion scaling (0.5x to 2.0x).
- **Ingredient Lab:** High-accuracy Ingredient Label OCR (Gemini Vision) supporting all Indian supermarket aisles (Foods, Cosmetics, Hair Oils, Cleaning, Pest Control, Baby Care, Ayurveda). Produces a 0-100 Safety Score, category-specific regulatory standards (FSSAI, CDSCO, BIS, CIBRC, AYUSH), contextual Indian market alerts (e.g. Light Liquid Paraffin traps, transfluthrin hazards), target exposure routes, and plain-language health impact breakdowns. Directly reads printed back-of-pack labels to eliminate crowdsourced barcode inaccuracies.
- **Strength Tracking:** Push, Pull, and Leg routine templates plus custom sessions, tracking completed volume `Sum(weightKg * reps)` with persistent storage.
- **Constraints:** Strict TypeScript, zero `any` types, dark-mode first design tokens, offline mock fallbacks for network resilience.

## Brand Commitments
- **Name:** BetterYou
- **Voice:** Authoritative, clinical yet encouraging, uncompromising on physical health and chemical purity.
- **Aesthetic:** High-contrast Dark Mode First (`#090B0E`), energized with electric emerald neon (`#10B981`), macro category tokens (Amber Calories, Sky Blue Protein, Mint Carbs, Rose Fat), and intuitive risk badges (`0-39` Red, `40-70` Amber, `71-100` Green).

## Evidence on Hand
- Implemented and passing complete 6-phase codebase:
  - `src/app/(tabs)/index.tsx`: Daily Command Dashboard
  - `src/app/(tabs)/meal-scan.tsx`: AI Food Vision with interactive portion multiplier
  - `src/app/(tabs)/toxicity-scan.tsx`: High-Accuracy Ingredient Label OCR
  - `src/app/(tabs)/workouts.tsx`: Volume Tracker with Auto-Rest Timer
  - `src/services/aiVisionService.ts` & `src/services/barcodeService.ts`: Live Gemini multimodal API + OpenFoodFacts
  - `src/store/useFitnessStore.ts`: AsyncStorage Zustand persistence

## Product Principles
1. **Total Transparency:** Never hide the true nature of food behind pure calorie numbers; expose ultra-processing and chemical additives.
2. **Zero-Friction Logging:** Use computer vision and barcode scanning to eliminate tedious typing of ingredients.
3. **Progressive Clarity:** Make daily energy balance and training volume immediately legible in high-contrast gauges.
4. **Resilient Autonomy:** Always provide graceful mock fallbacks and local storage persistence so the lifter never loses a workout on spotty gym Wi-Fi.

## Accessibility & Inclusion
- High-contrast dark mode design with minimum 4.5:1 contrast ratios.
- Clear visual hierarchy with dual encoding (color + text labels + icons) for toxicity and macronutrient splits.
- Generous touch targets (min 44x44 pt) optimized for one-handed thumb interaction during workouts and grocery shopping.
