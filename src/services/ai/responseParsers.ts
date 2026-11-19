import { MealAnalysisResult, ToxicityReport } from '../../types';
import { callGeminiVision } from './geminiTransport';
import { buildRepairPrompt } from './promptBuilders';

export function computeImageSignature(base64Image: string): string {
  const len = base64Image.length;
  if (len < 500) return base64Image;
  const head = base64Image.slice(0, 150);
  const mid = base64Image.slice(Math.floor(len / 2) - 75, Math.floor(len / 2) + 75);
  const tail = base64Image.slice(-150);
  return `${len}:${head}:${mid}:${tail}`;
}

export function computeScanFingerprint(name: string, ingredients: string[]): string {
  const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normIngredients = ingredients
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .sort()
    .join('|');
  return `${normName}:::${normIngredients}`;
}

export async function attemptRepairRetry<T>(
  rawText: string,
  zodError: string,
  schemaPrompt: string,
  base64Image: string,
  responseSchema: Record<string, unknown>,
  validator: (raw: unknown) => { success: boolean; data?: T }
): Promise<{ data: T; usedModel: string } | null> {
  try {
    const repairPrompt = buildRepairPrompt(zodError, rawText, schemaPrompt);

    const { text: repairedJson, usedModel } = await callGeminiVision(repairPrompt, base64Image, {
      responseSchema,
      timeoutMs: 25000,
      maxRetries: 1,
    });

    const parsedJson = JSON.parse(repairedJson);
    const validated = validator(parsedJson);
    if (validated.success && validated.data) {
      return { data: validated.data, usedModel };
    }
  } catch {
    // Repair failed, proceed to fallback
  }
  return null;
}

export function getMockMealAnalysis(): MealAnalysisResult {
  return {
    dishName: 'Grilled Chicken Breast with Quinoa & Mixed Greens',
    estimatedWeightGrams: 360,
    calories: 480,
    protein: 42,
    carbs: 36,
    fat: 16,
    isPlausible: true,
    plausibilityDeviation: 5,
    plausibilityWarning: null,
    ingredientsDetected: [
      'Grilled Chicken Breast',
      'Cooked Quinoa',
      'Baby Spinach & Arugula',
      'Cherry Tomatoes',
      'Sliced Avocado',
      'Extra Virgin Olive Oil',
    ],
  };
}

export function getMockToxicityReport(productHint?: string): ToxicityReport {
  const isImagePayload =
    typeof productHint === 'string' &&
    (productHint.startsWith('data:') ||
      productHint.startsWith('/9j/') ||
      productHint.startsWith('iVBORw') ||
      productHint.length > 100);

  const cleanHint = isImagePayload ? 'Inspected Supermarket Item' : (productHint?.trim() || 'Inspected Supermarket Item');
  const lowerHint = cleanHint.toLowerCase();

  if (lowerHint.includes('hair') || lowerHint.includes('almond') || lowerHint.includes('oil')) {
    return {
      productName: 'Commercial Hair Oil',
      overallSafetyScore: 42,
      riskLevel: 'Moderate',
      category: 'Hair Care',
      regulatoryStandard: 'CDSCO',
      targetExposure: 'Dermal Absorption',
      hazardRating: 'Moderate Hazard',
      cleanSummary: 'Mineral oil-heavy formulation (75-85% Light Liquid Paraffin) marketed as pure herbal hair oil.',
      indianMarketAlert: 'Hair Oil Trap: Contains 75-85% Light Liquid Paraffin (mineral oil filler). Provides minimal follicle nourishment compared to pure cold-pressed oils.',
      safeFor: ['External Use Only'],
      harmfulIngredients: [
        {
          name: 'Light Liquid Paraffin (Mineral Oil)',
          category: 'Petroleum Hydrocarbon Filler',
          healthImpact: 'Inert petroleum derivative that coats hair shafts without providing cellular lipid nutrition.',
          severity: 'moderate',
        },
        {
          name: 'Synthetic Perfume / Fragrance',
          category: 'Synthetic Aromatic Blend',
          healthImpact: 'Contains unlisted phthalates and sensitizers prone to causing contact dermatitis on sensitive scalps.',
          severity: 'low',
        },
      ],
    };
  }

  return {
    productName: cleanHint,
    overallSafetyScore: 50,
    riskLevel: 'Moderate',
    category: 'Food & Beverages',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    hazardRating: 'Moderate Hazard',
    cleanSummary: 'Moderately processed formulation with standard industrial stabilizers.',
    safeFor: ['Vegetarian'],
    harmfulIngredients: [
      {
        name: 'Preservative (INS 211 / Sodium Benzoate)',
        category: 'Chemical Preservative',
        healthImpact: 'Forms trace benzene in presence of ascorbic acid (Vitamin C).',
        severity: 'moderate',
      },
    ],
  };
}
