import {
  IndianRegulatoryStandard,
  MealAnalysisResult,
  NovaGroup,
  NutriscoreGrade,
  RiskLevel,
  SeverityLevel,
  SupermarketCategory,
  TargetExposure,
  ToxicityReport,
} from '../types';
import { getEffectiveApiKey, getEffectiveModel } from '../store/useSettingsStore';
import { recalculateToxicityReport } from './barcodeService';

// In-memory Scan Cache (Fingerprint -> { report, timestamp })
const toxicityScanCache = new Map<string, { report: ToxicityReport; timestamp: number }>();
const SCAN_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
  return {
    mimeType: 'image/jpeg',
    base64Data: input,
  };
}

/**
 * Strips markdown code blocks (```json ... ```) from LLM output
 */
function extractJsonString(rawText: string): string {
  const trimmed = rawText.trim();
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = trimmed.match(codeBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Generic caller for Gemini Multimodal REST API
 */
async function callGeminiVision(prompt: string, base64Image: string): Promise<{ text: string; usedModel: string }> {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const { mimeType, base64Data } = parseBase64Image(base64Image);

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
      temperature: 0.0,
    },
  };

  const chosenModel = getEffectiveModel();
  const fallbackCandidates = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  const modelsToTry = [chosenModel, ...fallbackCandidates.filter((m) => m !== chosenModel)];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const controller = new AbortController();
    // Vision calls on 3.x models routinely take 10–15s+ upstream; 45s avoids cancelling valid attempts
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini ${model} HTTP ${response.status}: ${errorText}`);
      }

      interface GeminiResponse {
        candidates?: {
          content?: {
            parts?: {
              text?: string;
            }[];
          };
        }[];
      }

      const result = (await response.json()) as GeminiResponse;
      const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        throw new Error(`Gemini ${model} returned empty text.`);
      }

      return { text: extractJsonString(candidateText), usedModel: model };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[aiVisionService] Model ${model} failed, trying next: ${lastError.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error('All Gemini models failed.');
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
    confidenceScore: 0.94,
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
  // If productHint is base64 image data or URI, ignore it to prevent accidental substring collisions
  const isImagePayload =
    Boolean(productHint) &&
    (productHint!.length > 40 ||
      productHint!.startsWith('data:') ||
      productHint!.includes(';base64,') ||
      productHint!.startsWith('/9j/'));
  const safeHint = isImagePayload ? '' : (productHint || '').trim();
  const lowerHint = safeHint.toLowerCase();

  if (lowerHint.includes('pure') || lowerHint.includes('mustard') || lowerHint.includes('clean_oil')) {
    return {
      productName: '100% Pure Cold-Pressed Kachi Ghani Mustard Oil',
      category: 'Food & Beverages',
      overallSafetyScore: 98,
      riskLevel: 'Safe',
      regulatoryStandard: 'FSSAI',
      targetExposure: 'Ingestion',
      novaGroup: 2,
      nutriscoreGrade: 'a',
      indianMarketAlert: null,
      safeFor: ['Paraben-Free', 'Palm Oil-Free', 'Zero Mineral Oil', 'Clean Label Certified'],
      cleanSummary: 'Single-ingredient, unrefined cold-pressed mustard oil rich in monounsaturated fats and natural antioxidants. Completely unadulterated.',
      harmfulIngredients: [],
      allIngredients: ['100% Pure Cold-Pressed Mustard Oil'],
    };
  }

  if (lowerHint.includes('hair') || lowerHint.includes('shampoo') || lowerHint.includes('hair_oil')) {
    return {
      productName: 'Herbal Infusion Hair Nourishing Oil',
      category: 'Hair Care',
      overallSafetyScore: 32,
      riskLevel: 'High Risk',
      regulatoryStandard: 'CDSCO',
      targetExposure: 'Dermal Absorption',
      hazardRating: 'High Hazard',
      indianMarketAlert: 'Indian Supermarket Trap: Contains ~78% Light Liquid Paraffin (mineral oil). Active herbal extracts account for under 2% of the bottle.',
      safeFor: ['Paraben-Free', 'Sulfate-Free'],
      cleanSummary: 'Product base consists predominantly of petroleum mineral oil (LLP) with synthetic fragrance and dye that can clog hair follicles.',
      harmfulIngredients: [
        {
          name: 'Light Liquid Paraffin (Mineral Oil)',
          category: 'Petroleum Filler Oil',
          healthImpact: 'Occlusive crude oil derivative that coats scalp pores without providing fatty acid nourishment.',
          severity: 'moderate',
        },
        {
          name: 'Tertiary Butylhydroquinone (TBHQ)',
          category: 'Synthetic Preservative',
          healthImpact: 'Petroleum antioxidant linked to cellular oxidative stress and potential dermal contact allergy.',
          severity: 'high',
        },
      ],
      allIngredients: ['Light Liquid Paraffin (78%)', 'Til Oil', 'Almond Extract (0.5%)', 'Fragrance', 'TBHQ', 'CI 47000'],
    };
  }

  if (lowerHint.includes('mosquito') || lowerHint.includes('vaporizer') || lowerHint.includes('pest')) {
    return {
      productName: 'Mosquito Liquid Vaporizer Refill',
      category: 'Pest Control',
      overallSafetyScore: 24,
      riskLevel: 'High Risk',
      regulatoryStandard: 'CIBRC',
      targetExposure: 'Inhalation',
      hazardRating: 'High Hazard',
      indianMarketAlert: 'Indoor Air Warning: Vaporizing synthetic pyrethroids (Transfluthrin) continuously overnight in closed bedrooms causes respiratory airway inflammation and morning migraines.',
      safeFor: ['Paraben-Free'],
      cleanSummary: 'Vaporizes synthetic pyrethroid neurotoxins into indoor air. Prolonged inhalation during sleep carries respiratory distress risks.',
      harmfulIngredients: [
        {
          name: 'Transfluthrin (0.88% w/w)',
          category: 'Synthetic Pyrethroid Neurotoxin',
          healthImpact: 'Voltage-gated sodium channel disruptor; chronic inhalation in enclosed spaces causes airway irritation and headaches.',
          severity: 'high',
        },
        {
          name: 'Deodorized Kerosene Solvent',
          category: 'Petroleum Distillate',
          healthImpact: 'Aerosolized hydrocarbons that irritate alveolar lung tissue.',
          severity: 'moderate',
        },
      ],
      allIngredients: ['Transfluthrin 0.88%', 'Deodorized Kerosene 98.12%', 'BHT 1.0%'],
    };
  }

  if (lowerHint.includes('toothpaste') || lowerHint.includes('oral') || lowerHint.includes('dent')) {
    return {
      productName: 'Total Active Amino Toothpaste',
      category: 'Oral Care',
      overallSafetyScore: 50,
      riskLevel: 'Moderate',
      regulatoryStandard: 'CDSCO',
      targetExposure: 'Mucous Membrane',
      hazardRating: 'Moderate Hazard',
      indianMarketAlert: 'Oral Mucosa Alert: Formulated with Sodium Lauryl Sulfate (SLS), a harsh foaming detergent known to strip protective buccal tissue and trigger canker sores.',
      safeFor: ['Paraben-Free', 'Zero Mineral Oil'],
      cleanSummary: 'Contains Sodium Lauryl Sulfate for high foam volume and synthetic sodium saccharin sweetener.',
      harmfulIngredients: [
        {
          name: 'Sodium Lauryl Sulfate (SLS)',
          category: 'Harsh Anionic Surfactant',
          healthImpact: 'Strips protective oral mucosa; leading trigger for recurrent aphthous stomatitis (canker sores).',
          severity: 'moderate',
        },
        {
          name: 'Titanium Dioxide (CI 77891)',
          category: 'Whitening Nanopigment',
          healthImpact: 'Added purely for paste whiteness; potential cellular toxicity on oral mucosa.',
          severity: 'high',
        },
      ],
      allIngredients: ['Calcium Carbonate', 'Sorbitol', 'Sodium Lauryl Sulfate', 'Silica', 'Titanium Dioxide', 'Sodium Saccharin'],
    };
  }

  if (lowerHint.includes('cleaner') || lowerHint.includes('floor') || lowerHint.includes('disinfectant')) {
    return {
      productName: 'Citrus Surface & Floor Disinfectant',
      category: 'Household & Cleaning',
      overallSafetyScore: 42,
      riskLevel: 'Moderate',
      regulatoryStandard: 'BIS',
      targetExposure: 'General',
      hazardRating: 'Moderate Hazard',
      indianMarketAlert: 'Pet & Toddler Warning: Contains Benzalkonium Chloride (Quat). Toxic to household cats (who lick paws) and irritates crawling infants.',
      safeFor: ['Paraben-Free', 'Bleach-Free'],
      cleanSummary: 'Quaternary ammonium-based floor cleaner effective against bacteria but dangerous for household pets and crawling toddlers.',
      harmfulIngredients: [
        {
          name: 'Benzalkonium Chloride (BKC 4.0% w/w)',
          category: 'Quaternary Disinfectant Surfactant',
          healthImpact: 'Known cause of occupational asthma; acute respiratory irritant and highly toxic to household pets.',
          severity: 'high',
        },
        {
          name: 'Synthetic Citrus Fragrance & Tartrazine',
          category: 'Artificial Fragrance & Color',
          healthImpact: 'Volatile organic compounds that can trigger contact allergies and airway irritation.',
          severity: 'moderate',
        },
      ],
      allIngredients: ['Benzalkonium Chloride Solution 4%', 'Non-ionic Surfactant', 'Tartrazine CI 19140', 'Perfume'],
    };
  }

  if (lowerHint.includes('baby') || lowerHint.includes('talc')) {
    return {
      productName: 'Gentle Talcum Baby Powder',
      category: 'Baby Care',
      overallSafetyScore: 34,
      riskLevel: 'High Risk',
      regulatoryStandard: 'CDSCO',
      targetExposure: 'Dermal Absorption',
      hazardRating: 'High Hazard',
      indianMarketAlert: 'Pediatric Safety Notice: Talc-based powders carry respiratory inhalation hazards for infant lungs; Indian pediatricians advise cornstarch-based alternatives.',
      safeFor: ['Paraben-Free', 'Sulfate-Free'],
      cleanSummary: 'Mineral talc dust base that poses significant pulmonary inhalation risks for infants.',
      harmfulIngredients: [
        {
          name: 'Talc (Hydrated Magnesium Silicate)',
          category: 'Mineral Dust / Absorbent',
          healthImpact: 'Fine particulate dust that causes infant pulmonary inflammation (talcosis).',
          severity: 'high',
        },
        {
          name: 'Synthetic Fragrance (Parfum)',
          category: 'Artificial Fragrance',
          healthImpact: 'Undisclosed chemical blend that can disrupt sensitive infant dermal barriers.',
          severity: 'moderate',
        },
      ],
      allIngredients: ['Talc', 'Fragrance'],
    };
  }

  // Default Indian Supermarket Snack / Food Mock
  return {
    productName: 'Masala Spiced Crispy Crunchies',
    category: 'Food & Beverages',
    overallSafetyScore: 35,
    riskLevel: 'High Risk',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 4,
    nutriscoreGrade: 'e',
    indianMarketAlert: 'Snack Aisle Alert: Deep-fried in high-heat Refined Palm Olein stabilized with TBHQ petroleum preservative.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Extensively ultra-processed snack with multiple synthetic flavor enhancers (MSG) and refined frying palm olein.',
    harmfulIngredients: [
      {
        name: 'Monosodium Glutamate (INS 621)',
        category: 'Flavor Enhancer',
        healthImpact: 'Excitotoxic additive that can trigger headaches and blood sugar volatility in sensitive individuals.',
        severity: 'moderate',
      },
      {
        name: 'Tertiary Butylhydroquinone (TBHQ)',
        category: 'Synthetic Preservative',
        healthImpact: 'Petroleum-derived preservative linked in animal studies to cellular oxidative damage and immune disruption.',
        severity: 'high',
      },
      {
        name: 'Refined Palm Olein',
        category: 'Industrial Frying Oil',
        healthImpact: 'Highly refined saturated oil prone to pro-inflammatory lipid oxidation products during industrial frying.',
        severity: 'moderate',
      },
    ],
    allIngredients: ['Rice Flour', 'Refined Palmolein', 'Corn Meal', 'Spices & Condiments', 'Iodised Salt', 'INS 621', 'INS 319'],
  };
}

// -------------------------------------------------------------
// Service Methods
// -------------------------------------------------------------

interface RawMealAiOutput {
  dishName?: string;
  estimatedWeightGrams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  confidenceScore?: number;
  ingredientsDetected?: string[];
}

interface RawToxicityAiOutput {
  productName?: string;
  category?: SupermarketCategory;
  overallSafetyScore?: number;
  riskLevel?: RiskLevel;
  indianMarketAlert?: string | null;
  regulatoryStandard?: IndianRegulatoryStandard;
  targetExposure?: TargetExposure;
  hazardRating?: 'Low Hazard' | 'Moderate Hazard' | 'High Hazard' | null;
  safeFor?: string[];
  novaGroup?: NovaGroup | null;
  nutriscoreGrade?: NutriscoreGrade | null;
  harmfulIngredients?: {
    name?: string;
    category?: string;
    healthImpact?: string;
    severity?: SeverityLevel;
  }[];
  cleanSummary?: string;
  allIngredients?: string[];
}

/**
 * Analyzes a meal photo using Gemini Vision to extract calorie & macro breakdown
 */
export async function analyzeMealImage(base64Image: string): Promise<MealAnalysisResult> {
  // If base64Image is empty or a mock trigger, return mock result immediately
  if (!base64Image || (base64Image.length < 50 && !base64Image.startsWith('data:') && !base64Image.startsWith('/9j/'))) {
    const mock = getMockMealAnalysis();
    mock.generatedBy = 'offline-demo-mock';
    return mock;
  }

  const prompt = `You are an elite sports nutritionist and computer vision AI.
Analyze this meal photo thoroughly.
Estimate:
1. dishName: Concise descriptive name of the dish.
2. estimatedWeightGrams: Approximate total weight of the portion in grams.
3. calories: Total kilocalories (kcal).
4. protein: Protein in grams.
5. carbs: Carbohydrates in grams.
6. fat: Fat in grams.
6. confidenceScore: Float from 0.0 to 1.0 representing your visual detection confidence.
7. ingredientsDetected: Array of identified ingredients.

Return ONLY a valid JSON object matching this exact schema:
{
  "dishName": string,
  "estimatedWeightGrams": number,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidenceScore": number,
  "ingredientsDetected": string[]
}`;

  try {
    const { text: rawJson, usedModel } = await callGeminiVision(prompt, base64Image);
    const parsed = JSON.parse(rawJson) as RawMealAiOutput;

    return {
      dishName: parsed.dishName || 'Identified Dish',
      estimatedWeightGrams: Math.max(10, Math.round(parsed.estimatedWeightGrams || 250)),
      calories: Math.max(0, Math.round(parsed.calories || 300)),
      protein: Math.max(0, Math.round(parsed.protein || 15)),
      carbs: Math.max(0, Math.round(parsed.carbs || 30)),
      fat: Math.max(0, Math.round(parsed.fat || 10)),
      confidenceScore: Math.min(1.0, Math.max(0.1, parsed.confidenceScore || 0.85)),
      ingredientsDetected: Array.isArray(parsed.ingredientsDetected)
        ? parsed.ingredientsDetected
        : ['Assorted Ingredients'],
      generatedBy: usedModel,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[aiVisionService] analyzeMealImage error: ${message}`);
    const effectiveKey = getEffectiveApiKey();
    if (!effectiveKey) {
      return getMockMealAnalysis();
    }
    throw new Error(`Meal Vision Analysis Failed (${message}). Please try taking another photo.`);
  }
}

/**
 * Analyzes any product package or ingredient label photo from an Indian Supermarket via OCR + deterministic toxicological evaluation
 */
export async function analyzeIngredientsImage(base64Image: string): Promise<ToxicityReport> {
  // If base64Image is empty or a short demo preset keyword, return instant mock
  if (
    !base64Image ||
    (base64Image.length < 50 &&
      !base64Image.startsWith('data:') &&
      !base64Image.startsWith('/9j/'))
  ) {
    const demoReport = getMockToxicityReport(base64Image);
    demoReport.generatedBy = 'offline-demo-mock';
    return demoReport;
  }

  const prompt = `You are an elite forensic toxicologist, biochemist, and Indian supermarket consumer safety expert.
Perform exhaustive OCR on this product package or ingredient label photo. It can be ANY product found in an Indian supermarket:
1. Food & Beverages: Namkeens, biscuits, noodles, cooking oils, dairy, sauces, packaged juices, health drinks.
2. Personal Care & Skincare: Soaps, face washes, fairness/anti-aging creams, body lotions, sunscreens, deodorants.
3. Hair Care: Hair oils (detect Light Liquid Paraffin traps), shampoos, conditioners, hair dyes (PPD, resorcinol).
4. Oral Care: Toothpastes, mouthwashes (SLS mucosal irritation, sodium saccharin, titanium dioxide).
5. Household & Cleaning: Detergents (LABS surfactants), floor cleaners (Benzalkonium Chloride/BKC pet hazards), bleaches, toilet cleaners.
6. Pest Control: Mosquito vaporizers, coils, sprays (Transfluthrin, prallethrin neurotoxins in bedroom air).
7. Baby Care: Baby powders (Talc inhalation hazards), baby washes, lotions, baby formula.
8. Ayurveda & OTC: Chyawanprash (high sugar), pain relief balms (camphor, methyl salicylate), herbal syrups with parabens.

Perform exhaustive OCR on all visible text.
Extract & Classify:
1. productName: Descriptive brand & name of the product.
2. category: Must be EXACTLY ONE OF:
   "Food & Beverages" | "Personal Care & Skincare" | "Hair Care" | "Oral Care" | "Household & Cleaning" | "Pest Control" | "Baby Care" | "Ayurveda & OTC"
3. allIngredients: Array of ALL detected ingredients, additives, E-numbers, and INS codes listed on the packaging.
4. harmfulIngredients: Array of objects with { name, category, healthImpact, severity: "low" | "moderate" | "high" }
5. indianMarketAlert: A 1-2 sentence contextual Indian supermarket consumer alert exposing deceptive marketing or major health hazards, or null if clean.
6. novaGroup: If Food & Beverage, integer 1 to 4; otherwise null.
7. nutriscoreGrade: If Food & Beverage, "a" | "b" | "c" | "d" | "e"; otherwise null.
8. cleanSummary: 1-2 sentence plain-language clinical verdict.

Return ONLY a valid JSON object matching this exact schema:
{
  "productName": string,
  "category": string,
  "allIngredients": string[],
  "harmfulIngredients": [
    {
      "name": string,
      "category": string,
      "healthImpact": string,
      "severity": "low" | "moderate" | "high"
    }
  ],
  "indianMarketAlert": string | null,
  "novaGroup": number | null,
  "nutriscoreGrade": string | null,
  "cleanSummary": string
}`;

  try {
    const { text: rawJson, usedModel } = await callGeminiVision(prompt, base64Image);
    const parsed = JSON.parse(rawJson) as RawToxicityAiOutput;

    const detectedName = parsed.productName?.trim() || 'Inspected Supermarket Item';
    const detectedIngredients: string[] =
      Array.isArray(parsed.allIngredients) && parsed.allIngredients.length > 0
        ? parsed.allIngredients.map((s) => s.trim()).filter(Boolean)
        : (parsed.harmfulIngredients || []).map((h) => h.name?.trim() || '').filter(Boolean);

    // 1. Check Scan Cache (guarantees identical result for identical product)
    const fingerprint = computeScanFingerprint(detectedName, detectedIngredients);
    const cached = toxicityScanCache.get(fingerprint);
    if (cached && Date.now() - cached.timestamp < SCAN_CACHE_TTL_MS) {
      return cached.report;
    }

    // 2. Deterministic Scoring Grounding
    // Instead of letting LLMs invent fluctuating random scores on each scan,
    // we pass the OCR ingredients into our verified toxicological engine
    const baseReport = recalculateToxicityReport(
      detectedName,
      detectedIngredients,
      {
        productName: detectedName,
        overallSafetyScore: 50,
        riskLevel: 'Moderate',
        harmfulIngredients: [],
        cleanSummary: parsed.cleanSummary || '',
        category: parsed.category,
        novaGroup: parsed.novaGroup ?? null,
        nutriscoreGrade: parsed.nutriscoreGrade ?? null,
        indianMarketAlert: parsed.indianMarketAlert ?? null,
      }
    );

    // Merge any additional Gemini-flagged additives that have specific clinical descriptions
    if (Array.isArray(parsed.harmfulIngredients)) {
      const existingNames = new Set(baseReport.harmfulIngredients.map((a) => a.name.toLowerCase()));
      for (const item of parsed.harmfulIngredients) {
        if (item.name && !existingNames.has(item.name.toLowerCase())) {
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

    // Prefer LLM contextual alert if provided, otherwise keep rule-based alert
    if (parsed.indianMarketAlert) {
      baseReport.indianMarketAlert = parsed.indianMarketAlert;
    }
    if (parsed.cleanSummary) {
      baseReport.cleanSummary = parsed.cleanSummary;
    }

    // Record provenance: which vision model generated this report
    baseReport.generatedBy = usedModel;

    // 3. Save to Cache
    toxicityScanCache.set(fingerprint, { report: baseReport, timestamp: Date.now() });

    return baseReport;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[aiVisionService] analyzeIngredientsImage error: ${message}`);

    const effectiveKey = getEffectiveApiKey();
    if (!effectiveKey) {
      // In demo mode without API key, return a predictable demo mock report
      const demoReport = getMockToxicityReport();
      demoReport.generatedBy = 'offline-demo-mock';
      return demoReport;
    }

    // With active key, throw so the user is informed to retry rather than silently receiving a wrong product
    throw new Error(
      `AI OCR Scan Unsuccessful (${message}). Please ensure packaging is well-lit and ingredients are clearly visible.`
    );
  }
}

/**
 * Generic caller for Gemini Text-only REST API
 */
async function callGeminiText(prompt: string): Promise<{ text: string; usedModel: string }> {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  };

  const chosenModel = getEffectiveModel();
  const fallbackCandidates = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  const modelsToTry = [chosenModel, ...fallbackCandidates.filter((m) => m !== chosenModel)];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini ${model} HTTP ${response.status}: ${errorText}`);
      }

      interface GeminiResponse {
        candidates?: {
          content?: {
            parts?: {
              text?: string;
            }[];
          };
        }[];
      }

      const result = (await response.json()) as GeminiResponse;
      const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        throw new Error(`Gemini ${model} returned empty text.`);
      }

      return { text: extractJsonString(candidateText), usedModel: model };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[aiVisionService] Text Model ${model} failed, trying next: ${lastError.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error('All Gemini text models failed.');
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
7. confidenceScore: Float from 0.0 to 1.0 representing estimation confidence.
8. ingredientsDetected: Array of identified ingredients/components.

Return ONLY a valid JSON object matching this exact schema:
{
  "dishName": string,
  "estimatedWeightGrams": number,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidenceScore": number,
  "ingredientsDetected": string[]
}`;

  try {
    const { text: rawJson } = await callGeminiText(prompt);
    const parsed = JSON.parse(rawJson) as RawMealAiOutput;

    return {
      dishName: parsed.dishName || trimmed,
      estimatedWeightGrams: Math.max(10, Math.round(parsed.estimatedWeightGrams || 250)),
      calories: Math.max(0, Math.round(parsed.calories || 300)),
      protein: Math.max(0, Math.round(parsed.protein || 15)),
      carbs: Math.max(0, Math.round(parsed.carbs || 30)),
      fat: Math.max(0, Math.round(parsed.fat || 10)),
      confidenceScore: Math.min(1.0, Math.max(0.1, parsed.confidenceScore || 0.9)),
      ingredientsDetected:
        Array.isArray(parsed.ingredientsDetected) && parsed.ingredientsDetected.length > 0
          ? parsed.ingredientsDetected
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

      return {
        dishName: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
        estimatedWeightGrams: 300,
        calories,
        protein,
        carbs,
        fat,
        confidenceScore: 0.88,
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

  // If user supplied both name and ingredients, calculate via deterministic engine first
  if (rawIngredients.length > 0) {
    const baseReport = recalculateToxicityReport(cleanName, rawIngredients);
    baseReport.generatedBy = 'manual-input-recalculation';

    // If Gemini key is available, enhance with forensic prompt
    const effectiveKey = getEffectiveApiKey();
    if (effectiveKey) {
      try {
        const prompt = `You are an elite forensic toxicologist and Indian supermarket consumer safety expert.
Product Name: "${cleanName}"
Ingredients: "${rawIngredients.join(', ')}"

Provide forensic analysis for this Indian product.
Extract:
1. category: EXACTLY ONE OF: "Food & Beverages" | "Personal Care & Skincare" | "Hair Care" | "Oral Care" | "Household & Cleaning" | "Pest Control" | "Baby Care" | "Ayurveda & OTC"
2. harmfulIngredients: Array of { name, category, healthImpact, severity: "low" | "moderate" | "high" }
3. indianMarketAlert: A 1-2 sentence contextual Indian supermarket consumer alert exposing deceptive marketing or major health hazards, or null if clean.
4. cleanSummary: 1-2 sentence plain-language clinical verdict.

Return ONLY a valid JSON object matching this exact schema:
{
  "category": string,
  "harmfulIngredients": [
    {
      "name": string,
      "category": string,
      "healthImpact": string,
      "severity": "low" | "moderate" | "high"
    }
  ],
  "indianMarketAlert": string | null,
  "cleanSummary": string
}`;
        const { text: rawJson, usedModel } = await callGeminiText(prompt);
        const parsed = JSON.parse(rawJson) as RawToxicityAiOutput;

        if (parsed.indianMarketAlert) baseReport.indianMarketAlert = parsed.indianMarketAlert;
        if (parsed.cleanSummary) baseReport.cleanSummary = parsed.cleanSummary;
        if (parsed.category) baseReport.category = parsed.category;
        baseReport.generatedBy = usedModel;
      } catch {
        // Fallback to deterministic report
      }
    }
    return baseReport;
  }

  // If ONLY product name was provided (no ingredients typed):
  const effectiveKey = getEffectiveApiKey();
  if (!effectiveKey) {
    const mock = getMockToxicityReport(cleanName);
    mock.productName = cleanName;
    mock.generatedBy = 'offline-demo-mock';
    return mock;
  }

  const prompt = `You are an elite forensic toxicologist and Indian supermarket consumer safety expert.
The user wants to analyze this product found in Indian markets: "${cleanName}".

Identify its typical packaging formulation, brand ingredients, and chemical profile:
1. productName: Full brand & product name (e.g. "Bajaj Almond Drops Non-Sticky Hair Oil").
2. category: EXACTLY ONE OF:
   "Food & Beverages" | "Personal Care & Skincare" | "Hair Care" | "Oral Care" | "Household & Cleaning" | "Pest Control" | "Baby Care" | "Ayurveda & OTC"
3. allIngredients: Array of typical ingredients, additives, E-numbers, and INS codes used in this product in India.
4. harmfulIngredients: Array of { name, category, healthImpact, severity: "low" | "moderate" | "high" }
5. indianMarketAlert: A 1-2 sentence contextual alert exposing deceptive marketing (e.g. mineral oil traps, hidden sugars, pyrethroid neurotoxins, SLS) or null if clean.
6. novaGroup: If Food & Beverage, integer 1 to 4; otherwise null.
7. nutriscoreGrade: If Food & Beverage, "a" | "b" | "c" | "d" | "e"; otherwise null.
8. cleanSummary: 1-2 sentence plain-language clinical verdict.

Return ONLY a valid JSON object matching this exact schema:
{
  "productName": string,
  "category": string,
  "allIngredients": string[],
  "harmfulIngredients": [
    {
      "name": string,
      "category": string,
      "healthImpact": string,
      "severity": "low" | "moderate" | "high"
    }
  ],
  "indianMarketAlert": string | null,
  "novaGroup": number | null,
  "nutriscoreGrade": string | null,
  "cleanSummary": string
}`;

  try {
    const { text: rawJson, usedModel } = await callGeminiText(prompt);
    const parsed = JSON.parse(rawJson) as RawToxicityAiOutput;

    const detectedName = parsed.productName?.trim() || cleanName;
    const detectedIngredients: string[] =
      Array.isArray(parsed.allIngredients) && parsed.allIngredients.length > 0
        ? parsed.allIngredients.map((s) => s.trim()).filter(Boolean)
        : (parsed.harmfulIngredients || []).map((h) => h.name?.trim() || '').filter(Boolean);

    const baseReport = recalculateToxicityReport(
      detectedName,
      detectedIngredients,
      {
        productName: detectedName,
        overallSafetyScore: 50,
        riskLevel: 'Moderate',
        harmfulIngredients: [],
        cleanSummary: parsed.cleanSummary || '',
        category: parsed.category,
        novaGroup: parsed.novaGroup ?? null,
        nutriscoreGrade: parsed.nutriscoreGrade ?? null,
        indianMarketAlert: parsed.indianMarketAlert ?? null,
      }
    );

    if (Array.isArray(parsed.harmfulIngredients)) {
      const existingNames = new Set(baseReport.harmfulIngredients.map((a) => a.name.toLowerCase()));
      for (const item of parsed.harmfulIngredients) {
        if (item.name && !existingNames.has(item.name.toLowerCase())) {
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
