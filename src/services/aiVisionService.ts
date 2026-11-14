import {
  MealAnalysisResult,
  NovaGroup,
  NutriscoreGrade,
  ToxicityReport,
} from '../types';
import {
  getEffectiveApiKey,
  getEffectiveModel,
  getEffectiveProxyUrl,
} from '../store/useSettingsStore';
import { getSignedDeviceHeaders } from '../utils/secureStorage';
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
import { GeminiFeature, useGeminiUsageStore } from '../store/useGeminiUsageStore';

// In-memory Scan Cache (Fingerprint -> { report, timestamp }) with LRU bounds
const MAX_SCAN_CACHE_ENTRIES = 50;
const toxicityScanCache = new Map<string, { report: ToxicityReport; timestamp: number }>();
// In-memory Image Signature Cache (Image Hash -> { report/result, timestamp }) to eliminate duplicate network calls
const toxicityImageHashCache = new Map<string, { report: ToxicityReport; timestamp: number }>();
const mealImageHashCache = new Map<string, { result: MealAnalysisResult; timestamp: number }>();
const SCAN_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function setBoundedCache<K, V>(cache: Map<K, V>, key: K, value: V) {
  if (cache.size >= MAX_SCAN_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(key, value);
}

export function clearAiVisionCaches() {
  toxicityScanCache.clear();
  toxicityImageHashCache.clear();
  mealImageHashCache.clear();
}

export async function hashImagePayload(base64: string): Promise<string> {
  if (!base64) return '';
  // Hash a bounded sample. SHA-256 of a multi-hundred-KB base64 string blocks the JS thread.
  const sample =
    base64.length <= 2048
      ? base64
      : `${base64.length}:${base64.slice(0, 1024)}:${base64.slice(-1024)}`;
  try {
    const Crypto = await import('expo-crypto');
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sample);
  } catch {
    return '';
  }
}

/**
 * Native file digest. Avoids copying the vision base64 string into the hash.
 */
export async function hashImageFile(uri: string): Promise<string> {
  if (!uri || uri.startsWith('data:')) return '';
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    if (!file.exists) return '';
    return await file.digest('SHA-256');
  } catch {
    return '';
  }
}

const GEMINI_FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

export function geminiModelsInOrder(chosenModel: string): string[] {
  return [chosenModel, ...GEMINI_FALLBACK_MODELS.filter((model) => model !== chosenModel)];
}

export function isGeminiModelMissingMessage(message: string): boolean {
  return /not found|not supported|unknown model|invalid model|does not exist|is not available/i.test(message);
}

/**
 * After the chosen model, try one fallback. Keep walking the list only when a
 * model name itself does not exist.
 */
export function nextGeminiModelIndex(
  cursor: { index: number; realFallbackUsed: boolean; modelCount: number },
  outcome: 'missing' | 'failed'
): { index: number; realFallbackUsed: boolean } | null {
  const nextIndex = cursor.index + 1;
  if (nextIndex >= cursor.modelCount) return null;
  if (outcome === 'missing') {
    return { index: nextIndex, realFallbackUsed: cursor.realFallbackUsed };
  }
  if (cursor.realFallbackUsed) return null;
  return { index: nextIndex, realFallbackUsed: true };
}

async function readPersistedVisionCache<T>(key: string): Promise<T | null> {
  try {
    const { getDatabase } = await import('../db/client');
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ payload: string; created_at: number }>(
      'SELECT payload, created_at FROM vision_cache WHERE cache_key = ?',
      [key]
    );
    if (!row) return null;
    if (Date.now() - Number(row.created_at) > SCAN_CACHE_TTL_MS) {
      await db.runAsync('DELETE FROM vision_cache WHERE cache_key = ?', [key]);
      return null;
    }
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

async function writePersistedVisionCache(key: string, payload: unknown): Promise<void> {
  try {
    const { getDatabase } = await import('../db/client');
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO vision_cache (cache_key, payload, created_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(payload), Date.now()]
    );
    await db.runAsync(
      `DELETE FROM vision_cache WHERE cache_key NOT IN (
        SELECT cache_key FROM vision_cache ORDER BY created_at DESC LIMIT ${MAX_SCAN_CACHE_ENTRIES}
      )`
    );
  } catch {
    // The in-memory cache still serves this process.
  }
}

/**
 * Computes a fast deterministic signature for an image payload
 * to detect repeated scans prior to any network dispatch.
 */
function computeImageSignature(base64Image: string): string {
  const len = base64Image.length;
  if (len < 500) return base64Image;
  const head = base64Image.slice(0, 150);
  const mid = base64Image.slice(Math.floor(len / 2) - 75, Math.floor(len / 2) + 75);
  const tail = base64Image.slice(-150);
  return `${len}:${head}:${mid}:${tail}`;
}

function computeScanFingerprint(name: string, ingredients: string[]): string {
  const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normIngredients = ingredients
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .sort()
    .join('|');
  return `${normName}:::${normIngredients}`;
}

/**
 * Extracts raw base64 data and mime type from either a pure base64 string or a data URI
 */
function parseBase64Image(input: string): { mimeType: string; base64Data: string } {
  const match = input.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      base64Data: match[2],
    };
  }
  if (input.startsWith('file://') || input.startsWith('http://') || input.startsWith('https://')) {
    throw new Error('Image data was provided as a raw file URI instead of base64 data.');
  }
  return {
    mimeType: 'image/jpeg',
    base64Data: input,
  };
}

/**
 * Strips markdown code blocks (```json ... ```) and extracts valid JSON objects
 */
export function extractJsonString(rawText: string): string {
  const trimmed = rawText.trim();
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = trimmed.match(codeBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Fallback: extract outermost JSON boundaries { ... }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1).trim();
  }
  return trimmed;
}

/**
 * Backoff wait with randomized jitter to mitigate thundering herd
 */
async function waitWithJitter(attempt: number, retryAfterSec?: number): Promise<void> {
  if (retryAfterSec && retryAfterSec > 0) {
    const ms = Math.min(retryAfterSec * 1000, 15000);
    await new Promise((r) => setTimeout(r, ms));
    return;
  }
  const baseDelay = 600;
  const maxDelay = 6000;
  const backoff = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  const jitter = Math.random() * 400;
  await new Promise((r) => setTimeout(r, backoff + jitter));
}

export interface GeminiVisionOptions {
  responseSchema?: Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
  feature?: GeminiFeature;
  /** When set, a model response that fails this check is not retried. The next model is tried. */
  acceptText?: (text: string) => boolean;
}

/**
 * Caller for Gemini Multimodal Vision:
 * Routes through secure BetterYou Proxy by default, or directly to Google AI Studio if user provides BYOK key.
 * Handles timeouts, 429 rate limits, exponential backoff with jitter, and model fallback chain.
 * Never logs API keys, raw auth headers, or secret credentials.
 */
export async function callGeminiVision(
  prompt: string,
  base64Image: string,
  options?: GeminiVisionOptions
): Promise<{ text: string; usedModel: string }> {
  const startTime = Date.now();
  const customKey = getEffectiveApiKey();
  const { mimeType, base64Data } = parseBase64Image(base64Image);
  const chosenModel = getEffectiveModel();
  const timeoutMs = options?.timeoutMs ?? 30000;
  const maxRetries = options?.maxRetries ?? 2;
  const responseSchema = options?.responseSchema;
  const feature: GeminiFeature = options?.feature || 'meal-vision';

  // 1. Direct BYOK Route (User-supplied key stored in hardware-backed SecureStore)
  if (customKey) {
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(responseSchema ? { responseSchema } : {}),
        temperature: 0.0,
        maxOutputTokens: 2048,
      },
    };

    const modelsToTry = geminiModelsInOrder(chosenModel);
    let lastError: Error | null = null;
    let lastInvalid: { text: string; usedModel: string } | null = null;
    let modelIndex = 0;
    let realFallbackUsed = false;
    const serializedBody = JSON.stringify(requestBody);

    while (modelIndex < modelsToTry.length) {
      const model = modelsToTry[modelIndex];
      let modelMissing = false;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': customKey,
            },
            body: serializedBody,
            signal: controller.signal,
          });

          if (!response.ok) {
            if (response.status === 404) {
              lastError = new Error(`Gemini ${model} returned HTTP 404`);
              modelMissing = true;
              break;
            }
            if (response.status === 400) {
              const errText = await response.text().catch(() => '');
              if (isGeminiModelMissingMessage(errText)) {
                lastError = new Error(`Gemini ${model} returned HTTP 400`);
                modelMissing = true;
                break;
              }
              throw new Error('Gemini API Authentication Error (400). Please verify your custom API key.');
            }
            // Fatal auth errors - do not retry
            if (response.status === 401 || response.status === 403) {
              throw new Error(`Gemini API Authentication Error (${response.status}). Please verify your custom API key.`);
            }

            // 429 Rate limit or 503 Overloaded: back off with jitter
            if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
              const retryAfterHeader = response.headers.get('retry-after');
              const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
              await waitWithJitter(attempt, isNaN(retryAfterSec || 0) ? undefined : retryAfterSec);
              continue;
            }

            throw new Error(`Gemini ${model} returned HTTP ${response.status}`);
          }

          interface GeminiResponse {
            candidates?: {
              content?: {
                parts?: { text?: string }[];
              };
            }[];
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              totalTokenCount?: number;
            };
          }

          const result = (await response.json()) as GeminiResponse;
          const parts = result.candidates?.[0]?.content?.parts || [];
          const candidateText = parts.map((p) => p.text || '').join('').trim();

          if (!candidateText) {
            throw new Error(`Gemini ${model} returned empty content.`);
          }

          const extracted = extractJsonString(candidateText);
          if (options?.acceptText && !options.acceptText(extracted)) {
            lastInvalid = { text: extracted, usedModel: model };
            break;
          }

          const durationMs = Date.now() - startTime;
          const usage = result.usageMetadata;
          const promptTokens = usage?.promptTokenCount ?? Math.round(prompt.length / 4 + 258);
          const candidateTokens = usage?.candidatesTokenCount ?? Math.round(candidateText.length / 4);
          const totalTokens = usage?.totalTokenCount ?? (promptTokens + candidateTokens);

          useGeminiUsageStore.getState().recordApiCall({
            feature,
            model,
            promptTokens,
            candidateTokens,
            totalTokens,
            durationMs,
            status: 'success',
            isCustomKey: true,
          });

          return { text: extracted, usedModel: model };
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (lastError.message.includes('Authentication Error')) {
            throw lastError;
          }
          if (attempt === maxRetries) {
            break;
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }

      const nextModel = nextGeminiModelIndex(
        { index: modelIndex, realFallbackUsed, modelCount: modelsToTry.length },
        modelMissing ? 'missing' : 'failed'
      );
      if (!nextModel) break;
      modelIndex = nextModel.index;
      realFallbackUsed = nextModel.realFallbackUsed;
    }

    if (lastInvalid && !lastError) {
      return lastInvalid;
    }

    useGeminiUsageStore.getState().recordApiCall({
      feature,
      model: chosenModel,
      durationMs: Date.now() - startTime,
      status: 'error',
      errorMessage: lastError?.message || 'All BYOK Gemini models failed.',
      isCustomKey: true,
    });

    throw lastError ?? new Error('All BYOK Gemini models failed.');
  }

  // 2. Managed Proxy Route (Zero shipped API keys; rate-limited & device-authenticated)
  const proxyUrl = getEffectiveProxyUrl();
  const proxyEndpoint = `${proxyUrl}/v1/vision/analyze`;
  const proxyPayload = JSON.stringify({
    prompt,
    imageBase64: base64Data,
    mimeType,
    model: chosenModel,
    responseSchema,
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const authHeaders = await getSignedDeviceHeaders('POST', '/v1/vision/analyze', proxyPayload);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(proxyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: proxyPayload,
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        if (attempt < maxRetries) {
          await waitWithJitter(attempt, isNaN(retryAfterSec || 0) ? undefined : retryAfterSec);
          continue;
        }
        throw new Error('Device rate limit reached (15 scans/min or daily quota). Please try again shortly.');
      }
      if (response.status === 413) {
        throw new Error('Image file is too large for processing. Please select a smaller photo.');
      }
      if (response.status === 401) {
        throw new Error('Device authentication failed with proxy server.');
      }
      if (!response.ok) {
        if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
          await waitWithJitter(attempt);
          continue;
        }
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Proxy error (HTTP ${response.status}).`);
      }

      interface ProxyVisionResponse {
        text?: string;
        usedModel?: string;
        error?: string;
      }

      const data = (await response.json()) as ProxyVisionResponse;
      if (!data.text) {
        throw new Error(data.error || 'Proxy returned empty response.');
      }

      const durationMs = Date.now() - startTime;
      useGeminiUsageStore.getState().recordApiCall({
        feature,
        model: data.usedModel || chosenModel,
        promptTokens: Math.round(prompt.length / 4 + 258),
        candidateTokens: Math.round((data.text || '').length / 4),
        totalTokens: Math.round(prompt.length / 4 + 258 + (data.text || '').length / 4),
        durationMs,
        status: 'success',
        isCustomKey: false,
      });

      return { text: extractJsonString(data.text), usedModel: data.usedModel || chosenModel };
    } catch (err: unknown) {
      if (attempt < maxRetries && !(err instanceof Error && err.message.includes('rate limit'))) {
        await waitWithJitter(attempt);
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      useGeminiUsageStore.getState().recordApiCall({
        feature,
        model: chosenModel,
        durationMs: Date.now() - startTime,
        status: 'error',
        errorMessage: msg,
        isCustomKey: false,
      });
      throw new Error(`Vision Service: ${msg}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  useGeminiUsageStore.getState().recordApiCall({
    feature,
    model: chosenModel,
    durationMs: Date.now() - startTime,
    status: 'error',
    errorMessage: 'Vision Service request failed after retries.',
    isCustomKey: false,
  });

  throw new Error('Vision Service request failed after retries.');
}

/**
 * Executes a single repair retry if initial output fails Zod validation constraints
 */
async function attemptRepairRetry<T>(
  rawText: string,
  zodError: string,
  schemaPrompt: string,
  base64Image: string,
  responseSchema: Record<string, unknown>,
  validator: (raw: unknown) => { success: boolean; data?: T }
): Promise<T | null> {
  try {
    const repairPrompt = `Your previous JSON response was malformed or failed validation constraints:
Validation Error: ${zodError}
Previous Output:
${rawText.slice(0, 400)}

Please output strictly valid JSON conforming to this specification:
${schemaPrompt}`;

    const { text: repairedJson } = await callGeminiVision(repairPrompt, base64Image, {
      responseSchema,
      timeoutMs: 25000,
      maxRetries: 1,
    });

    const parsedJson = JSON.parse(repairedJson);
    const validated = validator(parsedJson);
    if (validated.success && validated.data) {
      return validated.data;
    }
  } catch {
    // Repair failed, proceed to manual fallback
  }
  return null;
}

// -------------------------------------------------------------
// Fallback Mock Implementations
// -------------------------------------------------------------

function getMockMealAnalysis(): MealAnalysisResult {
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

function getMockToxicityReport(productHint?: string): ToxicityReport {
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

/**
 * Analyzes a meal photo using Gemini Vision to extract calorie & macro breakdown.
 * Uses structured output (responseSchema), validates with Zod, validates thermodynamic plausibility,
 * attempts one repair retry on failure, and falls back to manual entry.
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
  const imageSig = options?.imageHash || computeImageSignature(base64Image);
  const cached = mealImageHashCache.get(imageSig);
  if (cached && Date.now() - cached.timestamp < SCAN_CACHE_TTL_MS) {
    return cached.result;
  }
  const persistedMeal = await readPersistedVisionCache<MealAnalysisResult>(`meal:${imageSig}`);
  if (persistedMeal) {
    setBoundedCache(mealImageHashCache, imageSig, { result: persistedMeal, timestamp: Date.now() });
    return persistedMeal;
  }

  const prompt = `You are a sports nutritionist and computer vision AI.
Analyze this meal photo thoroughly and estimate the dish name, portion weight in grams, total calories, and macronutrient split (protein, carbs, fat in grams).
Ensure estimates are thermodynamically plausible (4*P + 4*C + 9*F ≈ calories).
Return a valid JSON object matching the response schema.`;

  let parsed: RawMealAnalysisAiOutput | null = null;
  let usedModelName = 'gemini-3.6-flash';

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
    usedModelName = usedModel;

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
      parsed = await attemptRepairRetry<RawMealAnalysisAiOutput>(
        rawJson,
        repairError,
        JSON.stringify(GEMINI_MEAL_RESPONSE_SCHEMA),
        base64Image,
        GEMINI_MEAL_RESPONSE_SCHEMA,
        (raw) => MealAnalysisAiSchema.safeParse(raw)
      );
    }
  } catch (err: unknown) {
    // If network failure and image path available, queue for retry
    if (options?.localImagePath) {
      await enqueueOfflineScan('meal', options.localImagePath, err instanceof Error ? err.message : String(err)).catch(() => {});
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Meal Vision Analysis Failed (${message}).`);
  }

  // If validation and repair both failed, trigger manual fallback
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

  // Thermodynamic plausibility check (4P + 4C + 9F ~= kcal within 20%)
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
 * via OCR + structured schema + Zod validation + deterministic toxicological evaluation.
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

  // 1. Check Image Hash Cache FIRST (incorporating productNameHint to avoid returning mismatched previous scan)
  const imageSig =
    (options?.imageHash || computeImageSignature(base64Image)) +
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

  const prompt = options?.productNameHint
    ? `You are a consumer chemical safety and Indian supermarket packaging expert.
The user confirms this product is: "${options.productNameHint}".
Perform forensic OCR on this product package or ingredient label photo specifically for "${options.productNameHint}".
Detect all printed ingredients, INS/E-number additives, and deceptive Indian formulation traps.
Return a valid JSON object strictly matching the response schema.`
    : `You are a consumer chemical safety and Indian supermarket packaging expert.
Perform forensic OCR on this product package or ingredient label photo.
Detect all printed ingredients, INS/E-number additives, and deceptive Indian formulation traps (e.g. 80% mineral oil hair oils, transfluthrin vaporizers).
Return a valid JSON object strictly matching the response schema.`;

  let parsed: RawToxicityAiOutput | null = null;
  let usedModelName = 'gemini-3.6-flash';

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
    usedModelName = usedModel;

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
      parsed = await attemptRepairRetry<RawToxicityAiOutput>(
        rawJson,
        repairError,
        JSON.stringify(GEMINI_TOXICITY_RESPONSE_SCHEMA),
        base64Image,
        GEMINI_TOXICITY_RESPONSE_SCHEMA,
        (raw) => ToxicityAnalysisAiSchema.safeParse(raw)
      );
    }
  } catch (err: unknown) {
    // If network failure, enqueue for background retry
    if (options?.localImagePath) {
      await enqueueOfflineScan('toxicity', options.localImagePath, err instanceof Error ? err.message : String(err)).catch(() => {});
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`AI OCR Scan Unsuccessful (${message}).`);
  }

  // If repair retry also failed, construct a safe fallback report capped at 50
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
  const fingerprint = computeScanFingerprint(detectedName, detectedIngredients);
  const cachedFingerprint = toxicityScanCache.get(fingerprint);
  if (cachedFingerprint && Date.now() - cachedFingerprint.timestamp < SCAN_CACHE_TTL_MS) {
    return cachedFingerprint.report;
  }

  // Ground scoring deterministically through the rule engine
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

  // Merge any additional Gemini-flagged additives
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

  // Save to both bounded image hash and text fingerprint caches
  setBoundedCache(toxicityScanCache, fingerprint, { report: baseReport, timestamp: Date.now() });
  setBoundedCache(toxicityImageHashCache, imageSig, { report: baseReport, timestamp: Date.now() });
  await writePersistedVisionCache(`tox:${imageSig}`, baseReport);

  return baseReport;
}

/**
 * Caller for Gemini Text-only Generation
 */
async function callGeminiText(
  prompt: string,
  feature: GeminiFeature = 'meal-voice'
): Promise<{ text: string; usedModel: string }> {
  const startTime = Date.now();
  const customKey = getEffectiveApiKey();
  const chosenModel = getEffectiveModel();

  if (customKey) {
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    const modelsToTry = geminiModelsInOrder(chosenModel);
    let lastError: Error | null = null;
    let modelIndex = 0;
    let realFallbackUsed = false;
    const serializedBody = JSON.stringify(requestBody);

    while (modelIndex < modelsToTry.length) {
      const model = modelsToTry[modelIndex];
      let modelMissing = false;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': customKey,
          },
          body: serializedBody,
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            modelMissing = true;
            throw new Error(`Gemini ${model} HTTP 404`);
          }
          if (response.status === 400) {
            const errText = await response.text().catch(() => '');
            if (isGeminiModelMissingMessage(errText)) {
              modelMissing = true;
              throw new Error(`Gemini ${model} HTTP 400`);
            }
            throw new Error('Gemini API Authentication Error (400). Please check your custom API key.');
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error(`Gemini API Authentication Error (${response.status}). Please check your custom API key.`);
          }
          throw new Error(`Gemini ${model} HTTP ${response.status}`);
        }

        interface GeminiResponse {
          candidates?: {
            content?: {
              parts?: { text?: string }[];
            };
          }[];
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        }

        const result = (await response.json()) as GeminiResponse;
        const parts = result.candidates?.[0]?.content?.parts || [];
        const candidateText = parts.map((p) => p.text || '').join('').trim();

        if (!candidateText) {
          throw new Error(`Gemini ${model} returned empty text.`);
        }

        const durationMs = Date.now() - startTime;
        const usage = result.usageMetadata;
        const promptTokens = usage?.promptTokenCount ?? Math.round(prompt.length / 4);
        const candidateTokens = usage?.candidatesTokenCount ?? Math.round(candidateText.length / 4);
        const totalTokens = usage?.totalTokenCount ?? (promptTokens + candidateTokens);

        useGeminiUsageStore.getState().recordApiCall({
          feature,
          model,
          promptTokens,
          candidateTokens,
          totalTokens,
          durationMs,
          status: 'success',
          isCustomKey: true,
        });

        return { text: extractJsonString(candidateText), usedModel: model };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.message.includes('Authentication Error')) {
          break;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      const nextModel = nextGeminiModelIndex(
        { index: modelIndex, realFallbackUsed, modelCount: modelsToTry.length },
        modelMissing ? 'missing' : 'failed'
      );
      if (!nextModel) break;
      modelIndex = nextModel.index;
      realFallbackUsed = nextModel.realFallbackUsed;
    }

    useGeminiUsageStore.getState().recordApiCall({
      feature,
      model: chosenModel,
      durationMs: Date.now() - startTime,
      status: 'error',
      errorMessage: lastError?.message || 'All BYOK Gemini text models failed.',
      isCustomKey: true,
    });

    throw lastError ?? new Error('All BYOK Gemini text models failed.');
  }

  // 2. Managed Proxy Route
  const proxyUrl = getEffectiveProxyUrl();
  const proxyEndpoint = `${proxyUrl}/v1/chat/analyze`;
  const proxyPayload = JSON.stringify({
    prompt,
    model: chosenModel,
  });

  const authHeaders = await getSignedDeviceHeaders('POST', '/v1/chat/analyze', proxyPayload);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: proxyPayload,
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new Error('Device rate limit reached. Please wait a moment before trying again.');
    }
    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.error || `Proxy error (HTTP ${response.status}).`);
    }

    interface ProxyTextResponse {
      text?: string;
      usedModel?: string;
      error?: string;
    }

    const data = (await response.json()) as ProxyTextResponse;
    if (!data.text) {
      throw new Error(data.error || 'Proxy returned empty text.');
    }

    const durationMs = Date.now() - startTime;
    useGeminiUsageStore.getState().recordApiCall({
      feature,
      model: data.usedModel || chosenModel,
      promptTokens: Math.round(prompt.length / 4),
      candidateTokens: Math.round((data.text || '').length / 4),
      totalTokens: Math.round(prompt.length / 4 + (data.text || '').length / 4),
      durationMs,
      status: 'success',
      isCustomKey: false,
    });

    return { text: extractJsonString(data.text), usedModel: data.usedModel || chosenModel };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    useGeminiUsageStore.getState().recordApiCall({
      feature,
      model: chosenModel,
      durationMs: Date.now() - startTime,
      status: 'error',
      errorMessage: msg,
      isCustomKey: false,
    });
    throw new Error(`Text Service: ${msg}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Analyzes a user-described meal string using Gemini to calculate macros and calories
 */
export async function analyzeMealText(mealDescription: string): Promise<MealAnalysisResult> {
  const trimmed = mealDescription.trim();
  if (!trimmed) {
    throw new Error('Please enter a meal description.');
  }

  const prompt = `You are an elite sports nutritionist and dietitian.
Analyze this user-described meal or food item: "${trimmed}".
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
      // Heuristic fallback for demo mode
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
  const cleanName = productName.trim() || 'Custom Product';
  const rawIngredients = (ingredientsText || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawIngredients.length > 0) {
    let baseReport = recalculateToxicityReport(cleanName, rawIngredients);
    baseReport.generatedBy = 'manual-input-recalculation';

    try {
      const prompt = `You are an expert consumer safety and regulatory compliance specialist evaluating Indian supermarket products.
Product Name: "${cleanName}"
Ingredients: "${rawIngredients.join(', ')}"

Provide ingredient risk screening for this Indian product.
Extract:
1. category: EXACTLY ONE OF: "Food & Beverages" | "Personal Care & Skincare" | "Hair Care" | "Oral Care" | "Household & Cleaning" | "Pest Control" | "Baby Care" | "Ayurveda & OTC"
2. harmfulIngredients: Array of { name, category, healthImpact, severity: "low" | "moderate" | "high" }
3. indianMarketAlert: A 1-2 sentence contextual Indian supermarket consumer alert exposing deceptive marketing or major health hazards, or null if clean.
4. cleanSummary: 1-2 sentence plain-language screening summary.

Return ONLY a valid JSON object matching the requested schema.`;
      const { text: rawJson, usedModel } = await callGeminiText(prompt, 'toxicity-voice');
      const parsed = JSON.parse(rawJson) as RawToxicityAiOutput;

      if (parsed.indianMarketAlert) baseReport.indianMarketAlert = parsed.indianMarketAlert;
      if (parsed.cleanSummary) baseReport.cleanSummary = parsed.cleanSummary;
      if (parsed.category) baseReport.category = parsed.category;
      baseReport.generatedBy = usedModel;
    } catch {
      // Keep deterministic report
    }
    return baseReport;
  }

  // If ONLY product name was provided (no ingredients typed):
  const prompt = `You are an expert consumer safety and regulatory compliance specialist evaluating Indian supermarket products.
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
    baseReport.generatedBy = usedModel;

    return baseReport;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[aiVisionService] analyzeProductText error: ${message}`);
    return recalculateToxicityReport(cleanName, [cleanName]);
  }
}
