export interface GeminiModelOption {
  id: string;
  name: string;
  badge: string;
  badgeColor?: string;
  description: string;
  bestFor: string;
  speed: string;
  estimatedAccuracy: number; // Percentage, e.g. 96.5
  accuracyRating: string; // e.g. 'Exceptional Multimodal Precision'
  ocrAccuracy: number; // e.g. 98
  foodAccuracy: number; // e.g. 95
  toxicityAccuracy: number; // e.g. 96
  maxImagesPerPrompt: number; // Context capacity, e.g. 3600
  contextTokens: string; // e.g. '1,000,000 tokens (1M)'
  dailyFreeScans: string; // e.g. '~1,500 scans/day'
  rateLimitRPM: number; // e.g. 15
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Recommended',
    description: 'Newest Flash generation with strong multimodal reasoning and top nutrition OCR precision.',
    bestFor: 'Everyday Food & Ingredient Scans',
    speed: '⚡ Ultra Fast',
    estimatedAccuracy: 95.7,
    accuracyRating: 'Empirical Benchmark (MAE 22 kcal, 95% OCR)',
    ocrAccuracy: 95,
    foodAccuracy: 96,
    toxicityAccuracy: 95,
    maxImagesPerPrompt: 3600,
    contextTokens: '1M tokens (1,048,576)',
    dailyFreeScans: '~750 scans/day',
    rateLimitRPM: 10,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    badge: 'Balanced',
    description: 'Efficient Flash Lite tier balancing speed, accuracy and cost for routine daily scans.',
    bestFor: 'Balanced Daily Scanning',
    speed: '⚡ Ultra Fast',
    estimatedAccuracy: 93.0,
    accuracyRating: 'Empirical Benchmark (MAE 30 kcal, 92.5% OCR)',
    ocrAccuracy: 92,
    foodAccuracy: 93,
    toxicityAccuracy: 92,
    maxImagesPerPrompt: 3600,
    contextTokens: '1M tokens (1,048,576)',
    dailyFreeScans: '~1,500 scans/day',
    rateLimitRPM: 15,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Lightweight',
    description: 'Low-latency model tuned for high-volume scanning and the fastest response times.',
    bestFor: 'Quick Macro Estimates',
    speed: '⚡⚡ Fastest',
    estimatedAccuracy: 90.4,
    accuracyRating: 'Empirical Benchmark (MAE 39 kcal, 89.4% OCR)',
    ocrAccuracy: 89,
    foodAccuracy: 91,
    toxicityAccuracy: 90,
    maxImagesPerPrompt: 3600,
    contextTokens: '1M tokens (1,048,576)',
    dailyFreeScans: '~1,500 scans/day',
    rateLimitRPM: 15,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Stable',
    description: 'Previous-generation Flash with proven multimodal vision and wide API compatibility.',
    bestFor: 'Reliable Fallback',
    speed: '⚡ Ultra Fast',
    estimatedAccuracy: 94.7,
    accuracyRating: 'Empirical Benchmark (MAE 25 kcal, 94.7% OCR)',
    ocrAccuracy: 95,
    foodAccuracy: 95,
    toxicityAccuracy: 94,
    maxImagesPerPrompt: 3600,
    contextTokens: '1M tokens (1,048,576)',
    dailyFreeScans: '~1,500 scans/day',
    rateLimitRPM: 15,
  },
];

export const DEFAULT_MODEL_ID = 'gemini-3.6-flash';

/**
 * Returns human-readable label for any given model identifier
 */
export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return '';
  const found = AVAILABLE_GEMINI_MODELS.find((m) => m.id === modelId);
  if (found) {
    return found.name;
  }
  return modelId;
}

export interface ModelEstimations {
  estimatedAccuracy: number;
  accuracyRating: string;
  ocrAccuracy: number;
  foodAccuracy: number;
  toxicityAccuracy: number;
  maxImagesPerPrompt: number;
  contextTokens: string;
  dailyFreeScans: string;
  rateLimitRPM: number;
  isCustomEstimate?: boolean;
}

/**
 * Returns multimodal vision capabilities and estimates for a given model ID
 */
export function getModelEstimations(modelId: string): ModelEstimations {
  const found = AVAILABLE_GEMINI_MODELS.find((m) => m.id === modelId);
  if (found) {
    return {
      estimatedAccuracy: found.estimatedAccuracy,
      accuracyRating: found.accuracyRating,
      ocrAccuracy: found.ocrAccuracy,
      foodAccuracy: found.foodAccuracy,
      toxicityAccuracy: found.toxicityAccuracy,
      maxImagesPerPrompt: found.maxImagesPerPrompt,
      contextTokens: found.contextTokens,
      dailyFreeScans: found.dailyFreeScans,
      rateLimitRPM: found.rateLimitRPM,
      isCustomEstimate: false,
    };
  }

  // Fallback estimates for custom model strings
  const lower = modelId.toLowerCase();
  if (lower.includes('pro')) {
    return {
      estimatedAccuracy: 97.5,
      accuracyRating: 'Custom Pro Tier (High Screening Depth)',
      ocrAccuracy: 98,
      foodAccuracy: 96,
      toxicityAccuracy: 98,
      maxImagesPerPrompt: 7200,
      contextTokens: '2M tokens (~2,000,000)',
      dailyFreeScans: '~50 scans/day',
      rateLimitRPM: 2,
      isCustomEstimate: true,
    };
  }
  if (lower.includes('lite')) {
    return {
      estimatedAccuracy: 89.5,
      accuracyRating: 'Custom Lite Tier (High Speed Baseline)',
      ocrAccuracy: 91,
      foodAccuracy: 88,
      toxicityAccuracy: 89,
      maxImagesPerPrompt: 3600,
      contextTokens: '1M tokens (~1,000,000)',
      dailyFreeScans: '~1,500 scans/day',
      rateLimitRPM: 15,
      isCustomEstimate: true,
    };
  }
  return {
    estimatedAccuracy: 95.0,
    accuracyRating: 'Custom Flash Tier (Multimodal Vision)',
    ocrAccuracy: 96,
    foodAccuracy: 93,
    toxicityAccuracy: 95,
    maxImagesPerPrompt: 3600,
    contextTokens: '1M tokens (~1,000,000)',
    dailyFreeScans: '~1,500 scans/day',
    rateLimitRPM: 15,
    isCustomEstimate: true,
  };
}
