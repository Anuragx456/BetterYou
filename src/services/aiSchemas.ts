import { z } from 'zod';
import type { SupermarketCategory } from '../types';

/**
 * Zod Schema for Gemini Meal Nutrition Output
 */
export const MealAnalysisAiSchema = z.object({
  dishName: z.string().min(1, 'Dish name is required').trim(),
  estimatedWeightGrams: z.coerce.number().min(0).default(100),
  calories: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
  ingredientsDetected: z
    .array(z.string().trim().min(1))
    .or(z.string().transform((str) => str.split(',').map((s) => s.trim()).filter(Boolean)))
    .default([]),
});

export type RawMealAnalysisAiOutput = z.infer<typeof MealAnalysisAiSchema>;

/**
 * Gemini Response Schema for generateContent API (Meal Nutrition)
 */
export const GEMINI_MEAL_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    dishName: { type: 'STRING', description: 'Concise name of the primary food dish' },
    estimatedWeightGrams: { type: 'INTEGER', description: 'Estimated portion weight in grams' },
    calories: { type: 'INTEGER', description: 'Total estimated energy in kilocalories (kcal)' },
    protein: { type: 'NUMBER', description: 'Estimated protein in grams' },
    carbs: { type: 'NUMBER', description: 'Estimated carbohydrates in grams' },
    fat: { type: 'NUMBER', description: 'Estimated fat in grams' },
    ingredientsDetected: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'List of visible individual food components and ingredients',
    },
  },
  required: ['dishName', 'estimatedWeightGrams', 'calories', 'protein', 'carbs', 'fat', 'ingredientsDetected'],
};

/**
 * Zod Schema for Harmful Additives detected in Supermarket Products
 */
export const HarmfulAdditiveAiSchema = z.object({
  name: z.string().min(1).trim(),
  category: z.string().trim().default('Consumer Chemical'),
  healthImpact: z.string().trim().default('Potential adverse health effects with chronic exposure.'),
  severity: z.enum(['high', 'moderate', 'low']).catch('moderate'),
});

export const VALID_SUPERMARKET_CATEGORIES: SupermarketCategory[] = [
  'Food & Beverages',
  'Personal Care & Skincare',
  'Hair Care',
  'Oral Care',
  'Household & Cleaning',
  'Pest Control',
  'Baby Care',
  'Ayurveda & OTC',
];

/**
 * Zod Schema for Gemini Supermarket Product & Ingredient Label Output
 */
export const ToxicityAnalysisAiSchema = z.object({
  productName: z.string().trim().min(1).default('Inspected Supermarket Item'),
  category: z
    .string()
    .transform((val): SupermarketCategory => {
      const match = VALID_SUPERMARKET_CATEGORIES.find(
        (c) => c.toLowerCase() === val.trim().toLowerCase()
      );
      return match || 'Food & Beverages';
    })
    .default('Food & Beverages'),
  allIngredients: z
    .array(z.string().trim().min(1))
    .or(z.string().transform((str) => str.split(',').map((s) => s.trim()).filter(Boolean)))
    .default([]),
  harmfulIngredients: z.array(HarmfulAdditiveAiSchema).default([]),
  indianMarketAlert: z.string().trim().nullable().optional().default(null),
  novaGroup: z.coerce.number().int().min(1).max(4).nullable().optional().default(null),
  nutriscoreGrade: z
    .string()
    .trim()
    .toLowerCase()
    .refine((g) => ['a', 'b', 'c', 'd', 'e'].includes(g), {
      message: 'Nutri-Score must be one of a, b, c, d, e',
    })
    .nullable()
    .optional()
    .catch(null),
  cleanSummary: z.string().trim().default(''),
});

export type RawToxicityAiOutput = z.infer<typeof ToxicityAnalysisAiSchema>;

/**
 * Gemini Response Schema for generateContent API (Ingredient Lab)
 */
export const GEMINI_TOXICITY_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    productName: { type: 'STRING', description: 'Commercial brand and product name' },
    category: {
      type: 'STRING',
      enum: VALID_SUPERMARKET_CATEGORIES,
      description: 'Supermarket aisle classification',
    },
    allIngredients: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Complete list of detected ingredients',
    },
    harmfulIngredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          category: { type: 'STRING' },
          healthImpact: { type: 'STRING' },
          severity: { type: 'STRING', enum: ['high', 'moderate', 'low'] },
        },
        required: ['name', 'category', 'healthImpact', 'severity'],
      },
    },
    indianMarketAlert: {
      type: 'STRING',
      description: 'Specific alert for common deceptive Indian supermarket formulations, or null',
    },
    novaGroup: { type: 'INTEGER', description: 'NOVA ultra-processing classification (1 to 4)' },
    nutriscoreGrade: { type: 'STRING', description: 'Nutri-Score grade (a, b, c, d, or e)' },
    cleanSummary: { type: 'STRING', description: '1-sentence factual summary of ingredients' },
  },
  required: ['productName', 'allIngredients'],
};

/**
 * Evaluates the thermodynamic plausibility of macronutrient energy values.
 * Standard Atwater general factors:
 *   Protein: ~4 kcal / g
 *   Carbohydrates: ~4 kcal / g
 *   Fat: ~9 kcal / g
 *
 * Flags outputs where reported calories deviate by more than 20% from (4P + 4C + 9F).
 */
export interface MacroPlausibilityResult {
  isPlausible: boolean;
  calculatedKcal: number;
  reportedKcal: number;
  deviationPercent: number;
  warning: string | null;
}

export function validateMacroPlausibility(
  calories: number,
  protein: number,
  carbs: number,
  fat: number
): MacroPlausibilityResult {
  const calculatedKcal = Math.round(protein * 4 + carbs * 4 + fat * 9);
  const reportedKcal = Math.round(calories);

  // If both values are zero or negative, trivially valid
  if (calculatedKcal <= 0 && reportedKcal <= 0) {
    return {
      isPlausible: true,
      calculatedKcal: 0,
      reportedKcal: 0,
      deviationPercent: 0,
      warning: null,
    };
  }

  const denominator = Math.max(calculatedKcal, reportedKcal, 1);
  const difference = Math.abs(reportedKcal - calculatedKcal);
  const deviationRatio = difference / denominator;
  const deviationPercent = Math.round(deviationRatio * 100);

  // Threshold: 20% allowance for dietary fiber, alcohol, rounding, and water content
  const isPlausible = deviationRatio <= 0.20;

  let warning: string | null = null;
  if (!isPlausible) {
    warning = `Reported calories (${reportedKcal} kcal) deviate by ${deviationPercent}% from macronutrient sum (${calculatedKcal} kcal based on 4P+4C+9F). Please review portion numbers.`;
  }

  return {
    isPlausible,
    calculatedKcal,
    reportedKcal,
    deviationPercent,
    warning,
  };
}
