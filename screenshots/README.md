# Play Store & App Store Screenshot Capture Checklist

This folder is reserved for real, unedited device captures of BetterYou running on a physical phone or high-density Android emulator.

> [!IMPORTANT]
> **Do not generate synthetic mockups or fake image files.** Capture genuine 1080x2400 (or 1170x2532 iOS) screenshots directly from the app using `adb exec-out screencap -p > screenshot.png` or the device screenshot shortcut.

---

## 5 Required Store Screenshots

### Screenshot 1: Command Dashboard (`01_dashboard.png`)
- **Route**: `src/app/(tabs)/index.tsx`
- **What to show**:
  - 7-day rolling calendar strip with logged activity indicators.
  - Calorie & macronutrient ring (Amber Calories, Sky Blue Protein, Mint Carbs, Rose Fat).
  - Daily workout volume card showing total kg lifted.
  - "Recent Scans" carousel with 2–3 inspected grocery items.
- **Key Caption**: *"Your All-in-One Nutrition & Lifting Command Center"*

---

### Screenshot 2: AI Plate Vision & Instant Macros (`02_meal_vision.png`)
- **Route**: `src/app/(tabs)/meal-scan.tsx`
- **What to show**:
  - Verification screen after snapping an Indian meal (e.g. Paneer Butter Masala with Roti).
  - Portion multiplier preset chips (`0.5x`, `1.0x`, `1.5x`, `2.0x`).
  - Thermodynamic plausibility badge with verified calories and macro breakdown chips.
- **Key Caption**: *"Instant Meal Vision with Real-Time Portion Multipliers"*

---

### Screenshot 3: Supermarket Ingredient Risk Screening (`03_ingredient_screening.png`)
- **Route**: `src/app/(tabs)/toxicity-scan.tsx` -> `ToxicityReportModal`
- **What to show**:
  - Full ingredient inspection report for a supermarket item (e.g. Kurkure or Mineral Hair Oil).
  - 0–100 Safety Score gauge and High/Moderate Risk status badge.
  - Indian Market Alert banner (e.g. "80% Mineral Oil formulation trap" or "Artificial coloring").
  - Flagged additives list with severity and regulatory context (FSSAI/CDSCO).
- **Key Caption**: *"Expose Ultra-Processing & Hidden Chemical Additives"*

---

### Screenshot 4: Strength Tracking with Floating Auto-Rest Timer (`04_workout_tracker.png`)
- **Route**: `src/app/(tabs)/workouts.tsx`
- **What to show**:
  - Active workout session (Push Day or Chest/Back) with multiple completed sets.
  - Checked set completion circles and total volume summation (`Sum(weight * reps)`).
  - Floating auto-rest countdown timer bar (`60s / 90s / 120s`).
  - Previous session reference values (`80kg × 10`).
- **Key Caption**: *"Log Sets & Reps with Smart Auto-Rest Timer"*

---

### Screenshot 5: Weekly Summary, Trends & 1RM Progression (`05_progress_trends.png`)
- **Route**: Dashboard -> Weekly Summary Modal / Exercise History
- **What to show**:
  - Weekly summary card showing total workouts, volume lifted, and average daily calories.
  - 28-day calorie intake vs target trend chart.
  - Exercise progression curve with estimated 1RM (Epley formula).
- **Key Caption**: *"Track Progressive Overload & Consistency Trends"*
