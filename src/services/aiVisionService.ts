import {
  MealAnalysisResult,
  NovaGroup,
  NutriscoreGrade,
  ToxicityReport,
} from '../types';
import {
  getEffectiveApiKey,
  getEffectiveModel,
} from '../store/useSettingsStore';
import { recalculateToxicityReport, recomputeReportScoreAndRisk } from './barcodeService';
import {
  MealAnalysisAiSchema,
  ToxicityAnalysisAiSchema,
  GEMINI_MEAL_RESPONSE_SCHEMA,
  GEMINI_TOXICITY_RESPONSE_SCHEMA,
  validateMacroPlausibility,
  RawMealAnalysisAiOutput,
  RawToxicityAiOutput,
} from './aiSchemas';
import { enqueueOfflineScan } from './scanQueueService';
import {
  buildIngredientsVisionPrompt,
  buildMealTextPrompt,
  buildMealVisionPrompt,
  buildProductByNameOnlyPrompt,
  buildProductWithIngredientsPrompt,
} from './ai/promptBuilders';
import {
  callGeminiText,
  callGeminiVision,
  GeminiVisionOptions,
  geminiModelsInOrder,
  isGeminiModelMissingMessage,
  nextGeminiModelIndex,
  extractJsonString,
} from './ai/geminiTransport';
import {
  attemptRepairRetry,
  computeImageSignature,
  computeScanFingerprint,
  getMockMealAnalysis,
  getMockToxicityReport,
} from './ai/responseParsers';
import {
  clearAiVisionCaches,
  hashImageFile,
  hashImagePayload,
  mealImageHashCache,
  readPersistedVisionCache,
  SCAN_CACHE_TTL_MS,
  setBoundedCache,
  toxicityImageHashCache,
  toxicityScanCache,
  writePersistedVisionCache,
} from './ai/visionCache';

// Re-export transport functions and caches for external consumers and unit tests
export {
  clearAiVisionCaches,
  extractJsonString,
  geminiModelsInOrder,
  isGeminiModelMissingMessage,
  nextGeminiModelIndex,
  callGeminiVision,
  hashImagePayload,
  hashImageFile,
  type GeminiVisionOptions,
};

/**
 * Analyzes a meal photo using Gemini Vision to extract calorie & macro breakdown.
 */
export async function analyzeMealImage(
  base64Image: string,
  options?: { isExplicitDemo?: boolean; localImagePath?: string; imageHash?: string }
): Promise<MealAnalysisResult> {
  const isDemo = options?.isExplicitDemo || base64Image === 'demo_sample';
  if (!base64Image || isDemo) {
    if (isDemo) {
      const mock = getMockMealAnalysis();
      mock.generatedBy = 'offline-demo-mock';
      return mock;
    }
    throw new Error('No image data was provided for meal analysis. Please take a photo or choose from gallery.');
  }

  // 1. Check Image Hash Cache (0 network requests on repeated photo analysis)
  const chosenModel = getEffectiveModel();
  const imageSig = `${options?.imageHash || computeImageSignature(base64Image)}::model:${chosenModel}`;
  const cached = mealImageHashCache.get(imageSig);
  if (cached && Date.now() - cached.timestamp < SCAN_CACHE_TTL_MS) {
    return cached.result;
  }
  const persistedMeal = await readPersistedVisionCache<MealAnalysisResult>(`meal:${imageSig}`);
  if (persistedMeal) {
    setBoundedCache(mealImageHashCache, imageSig, { result: persistedMeal, timestamp: Date.now() });
    return persistedMeal;
  }

  const prompt = buildMealVisionPrompt();
  let parsed: RawMealAnalysisAiOutput | null = null;
  let usedModelName = chosenModel;

  try {
    const { text: rawJson, usedModel } = await callGeminiVision(prompt, base64Image, {
      responseSchema: GEMINI_MEAL_RESPONSE_SCHEMA,
      feature: 'meal-vision',
      acceptText: (text) => {
        try {
          return MealAnalysisAiSchema.safeParse(JSON.parse(text)).success;
        } catch {
          return false;
        }
      },
    });
    usedModelName = usedModel || chosenModel;

    let jsonParsed: unknown;
    try {
      jsonParsed = JSON.parse(rawJson);
    } catch {
      jsonParsed = null;
    }

    const zodResult = MealAnalysisAiSchema.safeParse(jsonParsed);
    if (zodResult.success) {
      parsed = zodResult.data;
    } else {
      // Attempt ONE repair retry
      const repairError = zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      const repaired = await attemptRepairRetry<RawMealAnalysisAiOutput>(
        rawJson,
        repairError,
        JSON.stringify(GEMINI_MEAL_RESPONSE_SCHEMA),
        base64Image,
        GEMINI_MEAL_RESPONSE_SCHEMA,
        (raw) => MealAnalysisAiSchema.safeParse(raw)
      );
      if (repaired) {
        parsed = repaired.data;
        usedModelName = repaired.usedModel || usedModelName;
      }
    }
  } catch (err: unknown) {
    if (options?.localImagePath) {
      await enqueueOfflineScan('meal', options.localImagePath, err instanceof Error ? err.message : String(err)).catch(() => {});
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Meal Vision Analysis Failed (${message}).`);
  }

  if (!parsed) {
    return {
      dishName: 'Unrecognized Dish',
      estimatedWeightGrams: 200,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      isPlausible: false,
      plausibilityWarning: 'Vision parser could not confirm nutritional estimates. Please enter meal details manually.',
      ingredientsDetected: [],
      generatedBy: 'manual-fallback',
      fallbackToManual: true,
    };
  }

  const plausibility = validateMacroPlausibility(
    parsed.calories,
    parsed.protein,
    parsed.carbs,
    parsed.fat
  );

  const result: MealAnalysisResult = {
    dishName: parsed.dishName,
    estimatedWeightGrams: Math.round(parsed.estimatedWeightGrams),
    calories: Math.round(parsed.calories),
    protein: Math.round(parsed.protein * 10) / 10,
    carbs: Math.round(parsed.carbs * 10) / 10,
    fat: Math.round(parsed.fat * 10) / 10,
    isPlausible: plausibility.isPlausible,
    plausibilityDeviation: plausibility.deviationPercent,
    plausibilityWarning: plausibility.warning,
    ingredientsDetected: parsed.ingredientsDetected,
    generatedBy: usedModelName,
  };

  setBoundedCache(mealImageHashCache, imageSig, { result, timestamp: Date.now() });
  await writePersistedVisionCache(`meal:${imageSig}`, result);
  return result;
}

/**
 * Analyzes any product package or ingredient label photo from an Indian Supermarket
 */
export async function analyzeIngredientsImage(
  base64Image: string,
  options?: { isExplicitDemo?: boolean; localImagePath?: string; productNameHint?: string; imageHash?: string }
): Promise<ToxicityReport> {
  const isDemo = options?.isExplicitDemo || (base64Image.length > 0 && base64Image.length < 50 && !base64Image.startsWith('data:') && !base64Image.startsWith('/9j/'));
  if (!base64Image || isDemo) {
    if (isDemo) {
      const demoHint = options?.productNameHint || base64Image;
      const demoReport = getMockToxicityReport(demoHint);
      if (options?.productNameHint) {
        demoReport.productName = options.productNameHint.trim();
      }
      demoReport.generatedBy = 'offline-demo-mock';
      return demoReport;
    }
    throw new Error('No image data was provided for ingredient analysis. Please take a photo or choose from gallery.');
  }

  // 1. Check Image Hash Cache FIRST
  const chosenModel = getEffectiveModel();
  const imageSig =
    `${options?.imageHash || computeImageSignature(base64Image)}::model:${chosenModel}` +
    (options?.productNameHint ? `::hint:${options.productNameHint.trim().toLowerCase()}` : '');
  const cachedImage = toxicityImageHashCache.get(imageSig);
  if (cachedImage && Date.now() - cachedImage.timestamp < SCAN_CACHE_TTL_MS) {
    return cachedImage.report;
  }
  const persistedReport = await readPersistedVisionCache<ToxicityReport>(`tox:${imageSig}`);
  if (persistedReport) {
    setBoundedCache(toxicityImageHashCache, imageSig, { report: persistedReport, timestamp: Date.now() });
    return persistedReport;
  }

  const prompt = buildIngredientsVisionPrompt(options?.productNameHint);
  let parsed: RawToxicityAiOutput | null = null;
  let usedModelName = chosenModel;

  try {
    const { text: rawJson, usedModel } = await callGeminiVision(prompt, base64Image, {
      responseSchema: GEMINI_TOXICITY_RESPONSE_SCHEMA,
      feature: 'toxicity-scan',
      acceptText: (text) => {
        try {
          return ToxicityAnalysisAiSchema.safeParse(JSON.parse(text)).success;
        } catch {
          return false;
        }
      },
    });
    usedModelName = usedModel || chosenModel;

    let jsonParsed: unknown;
    try {
      jsonParsed = JSON.parse(rawJson);
    } catch {
      jsonParsed = null;
    }

    const zodResult = ToxicityAnalysisAiSchema.safeParse(jsonParsed);
    if (zodResult.success) {
      parsed = zodResult.data;
    } else {
      // Attempt ONE repair retry
      const repairError = zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      const repaired = await attemptRepairRetry<RawToxicityAiOutput>(
        rawJson,
        repairError,
        JSON.stringify(GEMINI_TOXICITY_RESPONSE_SCHEMA),
        base64Image,
        GEMINI_TOXICITY_RESPONSE_SCHEMA,
        (raw) => ToxicityAnalysisAiSchema.safeParse(raw)
      );
      if (repaired) {
        parsed = repaired.data;
        usedModelName = repaired.usedModel || usedModelName;
      }
    }
  } catch (err: unknown) {
    if (options?.localImagePath) {
      await enqueueOfflineScan('toxicity', options.localImagePath, err instanceof Error ? err.message : String(err)).catch(() => {});
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`AI OCR Scan Unsuccessful (${message}).`);
  }

  if (!parsed) {
    return {
      productName: 'Unverified Packaging',
      overallSafetyScore: 50,
      riskLevel: 'Moderate',
      category: 'Food & Beverages',
      regulatoryStandard: 'FSSAI',
      targetExposure: 'Ingestion',
      hazardRating: 'Moderate Hazard',
      cleanSummary: 'AI could not reliably parse the ingredient label. Please inspect and enter ingredients manually.',
      harmfulIngredients: [],
      allIngredients: [],
      generatedBy: 'manual-fallback',
    };
  }

  const detectedName = options?.productNameHint?.trim() || parsed.productName || 'Inspected Supermarket Item';
  const detectedIngredients: string[] =
    parsed.allIngredients.length > 0
      ? parsed.allIngredients
      : parsed.harmfulIngredients.map((h) => h.name).filter(Boolean);

  // Check Text Fingerprint Cache
  const fingerprint = `${computeScanFingerprint(detectedName, detectedIngredients)}::model:${chosenModel}`;
  const cachedFingerprint = toxicityScanCache.get(fingerprint);
  if (cachedFingerprint && Date.now() - cachedFingerprint.timestamp < SCAN_CACHE_TTL_MS) {
    return cachedFingerprint.report;
  }

  let baseReport = recalculateToxicityReport(
    detectedName,
    detectedIngredients,
    {
      productName: detectedName,
      overallSafetyScore: 50,
      riskLevel: 'Moderate',
      harmfulIngredients: [],
      cleanSummary: parsed.cleanSummary || '',
      category: parsed.category,
      novaGroup: (parsed.novaGroup as NovaGroup) ?? null,
      nutriscoreGrade: (parsed.nutriscoreGrade as NutriscoreGrade) ?? null,
      indianMarketAlert: parsed.indianMarketAlert ?? null,
    }
  );

  if (Array.isArray(parsed.harmfulIngredients)) {
    const normalizeAdditiveName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existingNames = new Set(baseReport.harmfulIngredients.map((a) => normalizeAdditiveName(a.name)));
    for (const item of parsed.harmfulIngredients) {
      if (item.name) {
        const norm = normalizeAdditiveName(item.name);
        const alreadyExists = Array.from(existingNames).some(
          (ex) => ex.includes(norm) || norm.includes(ex)
        );
        if (!alreadyExists) {
          existingNames.add(norm);
          baseReport.harmfulIngredients.push({
            name: item.name,
            category: item.category || 'Consumer Chemical',
            healthImpact: item.healthImpact || 'Potential adverse health effects with chronic exposure.',
            severity: item.severity,
          });
        }
      }
    }
    baseReport = recomputeReportScoreAndRisk(baseReport);
  }

  if (parsed.indianMarketAlert) baseReport.indianMarketAlert = parsed.indianMarketAlert;
  if (parsed.cleanSummary) baseReport.cleanSummary = parsed.cleanSummary;
  baseReport.generatedBy = usedModelName;

  setBoundedCache(toxicityScanCache, fingerprint, { report: baseReport, timestamp: Date.now() });
  setBoundedCache(toxicityImageHashCache, imageSig, { report: baseReport, timestamp: Date.now() });
  await writePersistedVisionCache(`tox:${imageSig}`, baseReport);

  return baseReport;
}

/**
 * Analyzes a user-described meal string using Gemini to calculate macros and calories
 */
export async function analyzeMealText(mealDescription: string): Promise<MealAnalysisResult> {
  const trimmed = mealDescription.trim();
  if (!trimmed) {
    throw new Error('Please enter a meal description.');
  }

  const prompt = buildMealTextPrompt(trimmed);

  try {
    const { text: rawJson } = await callGeminiText(prompt, 'meal-voice');
    const parsed = JSON.parse(rawJson) as RawMealAnalysisAiOutput;

    const validated = MealAnalysisAiSchema.safeParse(parsed);
    const data = validated.success ? validated.data : parsed;

    const plausibility = validateMacroPlausibility(
      data.calories,
      data.protein,
      data.carbs,
      data.fat
    );

    return {
      dishName: data.dishName || trimmed,
      estimatedWeightGrams: Math.max(10, Math.round(data.estimatedWeightGrams || 250)),
      calories: Math.max(0, Math.round(data.calories || 300)),
      protein: Math.max(0, Math.round(data.protein || 15)),
      carbs: Math.max(0, Math.round(data.carbs || 30)),
      fat: Math.max(0, Math.round(data.fat || 10)),
      isPlausible: plausibility.isPlausible,
      plausibilityDeviation: plausibility.deviationPercent,
      plausibilityWarning: plausibility.warning,
      ingredientsDetected:
        Array.isArray(data.ingredientsDetected) && data.ingredientsDetected.length > 0
          ? data.ingredientsDetected
          : [trimmed],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[aiVisionService] analyzeMealText error: ${message}`);
    const effectiveKey = getEffectiveApiKey();
    if (!effectiveKey) {
      const lower = trimmed.toLowerCase();
      let calories = 350;
      let protein = 20;
      let carbs = 40;
      let fat = 12;

      if (lower.includes('egg') || lower.includes('omelet')) {
        calories = 280;
        protein = 22;
        carbs = 8;
        fat = 18;
      } else if (lower.includes('salad') || lower.includes('green')) {
        calories = 220;
        protein = 12;
        carbs = 18;
        fat = 12;
      } else if (lower.includes('chicken') || lower.includes('steak') || lower.includes('meat')) {
        calories = 460;
        protein = 44;
        carbs = 20;
        fat = 16;
      } else if (lower.includes('shake') || lower.includes('smoothie')) {
        calories = 340;
        protein = 32;
        carbs = 36;
        fat = 6;
      } else if (lower.includes('oat') || lower.includes('cereal') || lower.includes('porridge')) {
        calories = 380;
        protein = 16;
        carbs = 62;
        fat = 8;
      }

      const plausibility = validateMacroPlausibility(calories, protein, carbs, fat);
      return {
        dishName: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
        estimatedWeightGrams: 300,
        calories,
        protein,
        carbs,
        fat,
        isPlausible: plausibility.isPlausible,
        plausibilityDeviation: plausibility.deviationPercent,
        plausibilityWarning: plausibility.warning,
        ingredientsDetected: trimmed.split(/[,+&]+/).map((s) => s.trim()).filter(Boolean),
      };
    }
    throw new Error(`AI Meal Estimation Failed (${message}). Please try again.`);
  }
}

/**
 * Analyzes a manually entered product name and optional ingredients text
 */
export async function analyzeProductText(
  productName: string,
  ingredientsText?: string
): Promise<ToxicityReport> {
  const chosenModel = getEffectiveModel();
  const cleanName = productName.trim() || 'Custom Product';
  const rawIngredients = (ingredientsText || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawIngredients.length > 0) {
    let baseReport = recalculateToxicityReport(cleanName, rawIngredients);
    baseReport.generatedBy = chosenModel;

    try {
      const prompt = buildProductWithIngredientsPrompt(cleanName, rawIngredients);
      const { text: rawJson, usedModel } = await callGeminiText(prompt, 'toxicity-voice');
      const parsed = JSON.parse(rawJson) as RawToxicityAiOutput;

      if (parsed.indianMarketAlert) baseReport.indianMarketAlert = parsed.indianMarketAlert;
      if (parsed.cleanSummary) baseReport.cleanSummary = parsed.cleanSummary;
      if (parsed.category) baseReport.category = parsed.category;
      baseReport.generatedBy = usedModel || chosenModel;
    } catch {
      baseReport.generatedBy = chosenModel;
    }
    return baseReport;
  }

  const prompt = buildProductByNameOnlyPrompt(cleanName);

  try {
    const { text: rawJson, usedModel } = await callGeminiText(prompt, 'toxicity-voice');
    const parsed = JSON.parse(rawJson) as RawToxicityAiOutput;

    const detectedName = parsed.productName?.trim() || cleanName;
    const detectedIngredients: string[] =
      Array.isArray(parsed.allIngredients) && parsed.allIngredients.length > 0
        ? parsed.allIngredients.map((s) => s.trim()).filter(Boolean)
        : (parsed.harmfulIngredients || []).map((h) => h.name?.trim() || '').filter(Boolean);

    let baseReport = recalculateToxicityReport(
      detectedName,
      detectedIngredients,
      {
        productName: detectedName,
        overallSafetyScore: 50,
        riskLevel: 'Moderate',
        harmfulIngredients: [],
        cleanSummary: parsed.cleanSummary || '',
        category: parsed.category,
        novaGroup: (parsed.novaGroup as NovaGroup) ?? null,
        nutriscoreGrade: (parsed.nutriscoreGrade as NutriscoreGrade) ?? null,
        indianMarketAlert: parsed.indianMarketAlert ?? null,
      }
    );

    if (Array.isArray(parsed.harmfulIngredients)) {
      const normalizeAdditiveName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existingNames = new Set(baseReport.harmfulIngredients.map((a) => normalizeAdditiveName(a.name)));
      for (const item of parsed.harmfulIngredients) {
        if (item.name) {
          const norm = normalizeAdditiveName(item.name);
          const alreadyExists = Array.from(existingNames).some(
            (ex) => ex.includes(norm) || norm.includes(ex)
          );
          if (!alreadyExists) {
            existingNames.add(norm);
            baseReport.harmfulIngredients.push({
              name: item.name,
              category: item.category || 'Consumer Chemical',
              healthImpact: item.healthImpact || 'Potential adverse health effects with chronic exposure.',
              severity:
                item.severity === 'high' || item.severity === 'moderate' || item.severity === 'low'
                  ? item.severity
                  : 'moderate',
            });
          }
        }
      }
      baseReport = recomputeReportScoreAndRisk(baseReport);
    }

    if (parsed.indianMarketAlert) baseReport.indianMarketAlert = parsed.indianMarketAlert;
    if (parsed.cleanSummary) baseReport.cleanSummary = parsed.cleanSummary;
    baseReport.generatedBy = usedModel || chosenModel;

    return baseReport;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[aiVisionService] analyzeProductText error: ${message}`);
    const fallback = recalculateToxicityReport(cleanName, [cleanName]);
    fallback.generatedBy = chosenModel;
    return fallback;
  }
}
