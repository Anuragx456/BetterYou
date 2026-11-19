# Ground-Truth Photo Collection Guide for BetterYou AI Evals

This guide details the standard operating procedure (SOP) for capturing the 50 empirical benchmark photos (25 meals, 25 packaged supermarket products) required to run real accuracy evaluations in `evals/run-eval.ts`.

---

## 1. Directory Structure & File Naming Conventions

All captured photos must be saved under `evals/dataset/images/` in JPEG format using the exact IDs defined in `evals/dataset/manifest.json`:

```
evals/dataset/images/
├── meals/
│   ├── meal_01.jpg   # Butter Chicken with Naan
│   ├── meal_02.jpg   # Masala Dosa with Sambar & Chutney
│   ├── ...
│   └── meal_25.jpg   # Samosa Chaat
└── products/
    ├── prod_01.jpg   # Kurkure Masala Munch (Ingredient label)
    ├── prod_02.jpg   # Maggi 2-Minute Masala Noodles (Back label)
    ├── ...
    └── prod_25.jpg   # Bournvita Chocolate Nutrition Drink (Back label)
```

---

## 2. Meal Photography Protocol (25 Dishes)

### A. Ground-Truth Portion & Weight Measurement
1. **Calibrated Kitchen Scale**: Weigh the empty plate/bowl in grams and tare the scale.
2. **Weigh Total Dish**: Place the served meal on the scale and record the net weight in grams.
3. **Component Weighing (where practical)**:
   - For dishes with distinct components (e.g., Dal + Basmati Rice + Roti), weigh individual portions before combining to verify ground-truth calories and macros.
4. **Reference Nutrition**: Consult the Indian Food Composition Tables (IFCT 2017, National Institute of Nutrition, ICMR) to record ground-truth calories, protein, carbs, and fat per weighed portion.

### B. Lighting and Framing
- **Lighting**: Bright, neutral, diffused lighting (natural daylight near a window or 4000K–5000K LED). Avoid harsh single-point flash that washes out textures or casts deep hard shadows.
- **Camera Angle**: Capture at a **45-degree angle**, 30–45 cm from the dish, framed so the entire plate/bowl is visible with a small margin of tabletop.
- **Focus & Resolution**: Tap to focus on the center of the meal. Ensure standard smartphone resolution (1080p to 4K); the app will resize to 1024×1024 / 0.8 JPEG quality before inference.
- **Realistic Settings**: Use real serving dishes (steel thalis, ceramic bowls, melamine plates) rather than clinical white laboratory backdrops, matching how users actually eat.

---

## 3. Packaged Product Photography Protocol (25 Products)

### A. Back-of-Pack Label Legibility
- **Focus Area**: The photo must clearly frame the **Ingredients List**, **Nutrition Information Panel (NIP)**, and any allergen warnings or FSSAI license numbers.
- **Flatness & Glare**:
  - Smooth out flexible plastic pouches (e.g., chips, namkeen) with your hand to eliminate wrinkles and folds hiding text.
  - Tilt the package slightly to avoid direct ceiling light glare reflection on glossy film.
- **Legibility Verification**: Before saving, zoom into the image on your phone to confirm every printed E-number, INS code, and ingredient name is crisply legible to human eyes without blur.

### B. Barcodes & Front Pack
- The primary evaluation image for `evals/dataset/images/products/` should be the **ingredient statement** (back/side of pack).
- Ensure the product name printed on the packaging or front panel is either partially visible or clearly mapped to the ID in `manifest.json`.

---

## 4. Registering Photos in the Evaluation Manifest

Once you place photos into `evals/dataset/images/meals/` or `evals/dataset/images/products/`:

1. Open `evals/dataset/manifest.json`.
2. Update the corresponding `imageFile` property from `null` to the filename (e.g. `"imageFile": "meal_01.jpg"`).
3. Re-run the evaluation harness:
   ```bash
   bun run eval
   ```
4. The harness will automatically detect the presence of the images, score accuracy against ground truth, and generate a verified `evals/results.json`.
