/**
 * Indian Food Database Matcher & Correction Feedback Loop
 *
 * Cross-references AI-detected dishes against the ICMR-NIN IFCT 2017 database
 * and past user corrections, detecting >35% thermodynamic / portion deviations.
 */

import indianFoodData from '../data/indianFoodDb.json';

export type FoodConfidence = 'verified' | 'estimate';

export interface IndianFoodItem {
  id: string;
  name: string;
  aliases: string[];
  standardPortionGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: string;
  confidence: FoodConfidence;
}

export interface UserMealCorrection {
  dishName: string;
  portionGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: number;
}

export type MatchProvenance =
  | 'from your past corrections'
  | 'from local database (IFCT 2017)'
  | 'from local database (estimate)'
  | 'AI estimate';

export interface IndianFoodMatchResult {
  isMatch: boolean;
  matchedDishName?: string;
  portionGrams: number;
  referenceCalories: number;
  referenceProtein: number;
  referenceCarbs: number;
  referenceFat: number;
  geminiCalories: number;
  deviationPercent: number; // e.g. 0.45 for 45%
  isSignificantDeviation: boolean; // deviation > 0.35
  deviationMessage?: string;
  provenance: MatchProvenance;
  confidence?: FoodConfidence;
}

const INDIAN_FOOD_DB = indianFoodData as IndianFoodItem[];

/**
 * Normalizes dish name for fuzzy string comparison
 */
export function normalizeDishName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[()[\]{},;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds the closest matching Indian dish from the database using alias & token overlap
 */
export function findMatchingIndianDish(detectedName: string): IndianFoodItem | null {
  if (!detectedName || !detectedName.trim()) return null;

  const cleanInput = normalizeDishName(detectedName);
  const inputTokens = new Set(cleanInput.split(' ').filter((t) => t.length > 2));

  let bestMatch: IndianFoodItem | null = null;
  let highestScore = 0;

  for (const item of INDIAN_FOOD_DB) {
    const cleanItemName = normalizeDishName(item.name);

    // Exact name or exact alias match
    if (cleanInput === cleanItemName) {
      return item;
    }

    for (const alias of item.aliases) {
      const cleanAlias = normalizeDishName(alias);
      if (cleanInput === cleanAlias) {
        return item;
      }
      // Substring containment
      if (cleanInput.includes(cleanAlias) || cleanAlias.includes(cleanInput)) {
        const score = cleanAlias.length / Math.max(cleanInput.length, cleanAlias.length);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = item;
        }
      }
    }

    // Token overlap matching
    const itemTokens = new Set([
      ...cleanItemName.split(' '),
      ...item.aliases.flatMap((a) => normalizeDishName(a).split(' ')),
    ].filter((t) => t.length > 2));

    let overlap = 0;
    for (const token of inputTokens) {
      if (itemTokens.has(token)) {
        overlap++;
      }
    }

    if (inputTokens.size > 0) {
      const tokenScore = overlap / inputTokens.size;
      if (tokenScore >= 0.5 && tokenScore > highestScore) {
        highestScore = tokenScore;
        bestMatch = item;
      }
    }
  }

  return highestScore >= 0.5 ? bestMatch : null;
}

/**
 * Searches user corrections for a previous correction matching this dish
 */
export function findUserCorrection(
  detectedName: string,
  userCorrections: UserMealCorrection[]
): UserMealCorrection | null {
  if (!detectedName || !userCorrections || userCorrections.length === 0) return null;

  const clean = normalizeDishName(detectedName);

  // Return the most recent correction matching the dish name
  const matched = userCorrections
    .filter((c) => {
      const cClean = normalizeDishName(c.dishName);
      return cClean === clean || cClean.includes(clean) || clean.includes(cClean);
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return matched[0] || null;
}

/**
 * Evaluates Gemini meal estimates against either past corrections or IFCT 2017 reference.
 * Flags deviations greater than 35% (> 0.35).
 */
export function matchIndianFoodEstimate(
  dishName: string,
  estimatedWeightGrams: number,
  geminiCalories: number,
  geminiProtein: number,
  geminiCarbs: number,
  geminiFat: number,
  userCorrections: UserMealCorrection[] = []
): IndianFoodMatchResult {
  const portionGrams = Math.max(10, Math.round(estimatedWeightGrams || 250));

  // 1. Check for User's Prior Correction first (highest priority)
  const priorCorrection = findUserCorrection(dishName, userCorrections);
  if (priorCorrection) {
    const scaleRatio = priorCorrection.portionGrams > 0 ? portionGrams / priorCorrection.portionGrams : 1.0;
    const refCalories = Math.round(priorCorrection.calories * scaleRatio);
    const refProtein = Math.round(priorCorrection.protein * scaleRatio * 10) / 10;
    const refCarbs = Math.round(priorCorrection.carbs * scaleRatio * 10) / 10;
    const refFat = Math.round(priorCorrection.fat * scaleRatio * 10) / 10;

    const deviationPercent = refCalories > 0 ? Math.abs(geminiCalories - refCalories) / refCalories : 0;
    const isSignificantDeviation = deviationPercent > 0.35;

    return {
      isMatch: true,
      matchedDishName: priorCorrection.dishName,
      portionGrams,
      referenceCalories: refCalories,
      referenceProtein: refProtein,
      referenceCarbs: refCarbs,
      referenceFat: refFat,
      geminiCalories,
      deviationPercent: Math.round(deviationPercent * 100) / 100,
      isSignificantDeviation,
      deviationMessage: isSignificantDeviation
        ? `Reference (from your past corrections): ~${refCalories} kcal for ${portionGrams}g. Gemini estimated ${geminiCalories} kcal.`
        : undefined,
      provenance: 'from your past corrections',
    };
  }

  // 2. Check Local Database (IFCT 2017 verified staples or curated composite recipes)
  const matchedDish = findMatchingIndianDish(dishName);
  if (matchedDish) {
    const scale = portionGrams / 100;
    const refCalories = Math.round(matchedDish.caloriesPer100g * scale);
    const refProtein = Math.round(matchedDish.proteinPer100g * scale * 10) / 10;
    const refCarbs = Math.round(matchedDish.carbsPer100g * scale * 10) / 10;
    const refFat = Math.round(matchedDish.fatPer100g * scale * 10) / 10;

    const deviationPercent = refCalories > 0 ? Math.abs(geminiCalories - refCalories) / refCalories : 0;
    const isSignificantDeviation = deviationPercent > 0.35;

    const isVerified = matchedDish.confidence === 'verified';
    const provenance: MatchProvenance = isVerified
      ? 'from local database (IFCT 2017)'
      : 'from local database (estimate)';
    const refLabel = isVerified ? 'Reference (IFCT 2017)' : 'Reference (recipe estimate)';

    return {
      isMatch: true,
      matchedDishName: matchedDish.name,
      portionGrams,
      referenceCalories: refCalories,
      referenceProtein: refProtein,
      referenceCarbs: refCarbs,
      referenceFat: refFat,
      geminiCalories,
      deviationPercent: Math.round(deviationPercent * 100) / 100,
      isSignificantDeviation,
      deviationMessage: isSignificantDeviation
        ? `${refLabel}: ~${refCalories} kcal for ${portionGrams}g. Gemini estimated ${geminiCalories} kcal.`
        : undefined,
      provenance,
      confidence: matchedDish.confidence,
    };
  }

  // 3. Fallback: Pure Gemini AI Estimate
  return {
    isMatch: false,
    portionGrams,
    referenceCalories: geminiCalories,
    referenceProtein: geminiProtein,
    referenceCarbs: geminiCarbs,
    referenceFat: geminiFat,
    geminiCalories,
    deviationPercent: 0,
    isSignificantDeviation: false,
    provenance: 'AI estimate',
  };
}
