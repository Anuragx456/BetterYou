/**
 * Prompt Builders for Gemini AI Nutrition Vision and Chemical Screening
 */

export function buildMealVisionPrompt(): string {
  return `You are a sports nutritionist and computer vision AI.
Analyze this meal photo thoroughly and estimate the dish name, portion weight in grams, total calories, and macronutrient split (protein, carbs, fat in grams).
Ensure estimates are thermodynamically plausible (4*P + 4*C + 9*F ≈ calories).
Return a valid JSON object matching the response schema.`;
}

export function buildIngredientsVisionPrompt(productNameHint?: string): string {
  return productNameHint
    ? `You are a consumer chemical safety and Indian supermarket packaging expert.
The user confirms this product is: "${productNameHint}".
Perform forensic OCR on this product package or ingredient label photo specifically for "${productNameHint}".
Detect all printed ingredients, INS/E-number additives, and deceptive Indian formulation traps.
Return a valid JSON object strictly matching the response schema.`
    : `You are a consumer chemical safety and Indian supermarket packaging expert.
Perform forensic OCR on this product package or ingredient label photo.
Detect all printed ingredients, INS/E-number additives, and deceptive Indian formulation traps (e.g. 80% mineral oil hair oils, transfluthrin vaporizers).
Return a valid JSON object strictly matching the response schema.`;
}

export function buildMealTextPrompt(description: string): string {
  return `You are an elite sports nutritionist and dietitian.
Analyze this user-described meal or food item: "${description}".
Estimate:
1. dishName: Concise descriptive name of the dish/meal.
2. estimatedWeightGrams: Approximate total weight of the portion in grams.
3. calories: Total kilocalories (kcal).
4. protein: Protein in grams.
5. carbs: Carbohydrates in grams.
6. fat: Fat in grams.
7. ingredientsDetected: Array of identified ingredients/components.

Return ONLY a valid JSON object matching this schema:
{
  "dishName": string,
  "estimatedWeightGrams": number,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "ingredientsDetected": string[]
}`;
}

export function buildProductWithIngredientsPrompt(
  cleanName: string,
  rawIngredients: string[]
): string {
  return `You are an expert consumer safety and regulatory compliance specialist evaluating Indian supermarket products.
Product Name: "${cleanName}"
Ingredients: "${rawIngredients.join(', ')}"

Provide ingredient risk screening for this Indian product.
Extract:
1. category: EXACTLY ONE OF: "Food & Beverages" | "Personal Care & Skincare" | "Hair Care" | "Oral Care" | "Household & Cleaning" | "Pest Control" | "Baby Care" | "Ayurveda & OTC"
2. harmfulIngredients: Array of { name, category, healthImpact, severity: "low" | "moderate" | "high" }
3. indianMarketAlert: A 1-2 sentence contextual Indian supermarket consumer alert exposing deceptive marketing or major health hazards, or null if clean.
4. cleanSummary: 1-2 sentence plain-language screening summary.

Return ONLY a valid JSON object matching the requested schema.`;
}

export function buildProductByNameOnlyPrompt(cleanName: string): string {
  return `You are an expert consumer safety and regulatory compliance specialist evaluating Indian supermarket products.
The user wants to analyze this product found in Indian markets: "${cleanName}".

Identify its typical packaging formulation, brand ingredients, and chemical profile:
1. productName: Full brand & product name (e.g. "Bajaj Almond Drops Non-Sticky Hair Oil").
2. category: EXACTLY ONE OF:
   "Food & Beverages" | "Personal Care & Skincare" | "Hair Care" | "Oral Care" | "Household & Cleaning" | "Pest Control" | "Baby Care" | "Ayurveda & OTC"
3. allIngredients: Array of typical ingredients, additives, E-numbers, and INS codes used in this product in India.
4. harmfulIngredients: Array of { name, category, healthImpact, severity: "low" | "moderate" | "high" }
5. indianMarketAlert: A 1-2 sentence contextual alert exposing deceptive marketing or null if clean.
6. novaGroup: If Food & Beverage, integer 1 to 4; otherwise null.
7. nutriscoreGrade: If Food & Beverage, "a" | "b" | "c" | "d" | "e"; otherwise null.
8. cleanSummary: 1-2 sentence plain-language screening summary.

Return ONLY a valid JSON object matching the requested schema.`;
}

export function buildRepairPrompt(
  zodError: string,
  rawText: string,
  schemaPrompt: string
): string {
  return `Your previous JSON response was malformed or failed validation constraints:
Validation Error: ${zodError}
Previous Output:
${rawText.slice(0, 400)}

Please output strictly valid JSON conforming to this specification:
${schemaPrompt}`;
}
