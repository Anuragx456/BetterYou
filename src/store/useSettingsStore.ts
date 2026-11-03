import { safeAsyncStorage } from '../utils/storage';
import {
  deleteSecureItem,
  getSecureItem,
  SECURE_KEYS,
  setSecureItem,
} from '../utils/secureStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
    estimatedAccuracy: 97.8,
    accuracyRating: 'Balanced Multimodal Precision',
    ocrAccuracy: 98,
    foodAccuracy: 96,
    toxicityAccuracy: 97,
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
    estimatedAccuracy: 94.5,
    accuracyRating: 'High Precision & Speed',
    ocrAccuracy: 95,
    foodAccuracy: 92,
    toxicityAccuracy: 93,
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
    estimatedAccuracy: 92.0,
    accuracyRating: 'Fast Baseline (Speed Focused)',
    ocrAccuracy: 93,
    foodAccuracy: 90,
    toxicityAccuracy: 91,
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
    estimatedAccuracy: 96.5,
    accuracyRating: 'Proven Multimodal Precision',
    ocrAccuracy: 98,
    foodAccuracy: 95,
    toxicityAccuracy: 96,
    maxImagesPerPrompt: 3600,
    contextTokens: '1M tokens (1,048,576)',
    dailyFreeScans: '~1,500 scans/day',
    rateLimitRPM: 15,
  },
];

export const DEFAULT_MODEL_ID = 'gemini-3.6-flash';

export interface SettingsState {
  // State
  customApiKey: string;
  selectedModel: string;
  isCustomModel: boolean;
  customModelName: string;

  // Actions
  setCustomApiKey: (key: string) => void;
  clearCustomApiKey: () => void;
  setSelectedModel: (modelId: string) => void;
  setIsCustomModel: (isCustom: boolean) => void;
  setCustomModelName: (modelName: string) => void;
  resetSettings: () => void;
}

/**
 * Safe AsyncStorage adapter for node / SSR / mobile environments
 */

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      customApiKey: '',
      selectedModel: DEFAULT_MODEL_ID,
      isCustomModel: false,
      customModelName: '',

      setCustomApiKey: (key: string) => {
        const trimmed = key.trim();
        set({ customApiKey: trimmed });
        if (trimmed) {
          setSecureItem(SECURE_KEYS.GEMINI_API_KEY, trimmed);
        } else {
          deleteSecureItem(SECURE_KEYS.GEMINI_API_KEY);
        }
      },

      clearCustomApiKey: () => {
        set({ customApiKey: '' });
        deleteSecureItem(SECURE_KEYS.GEMINI_API_KEY);
      },

      setSelectedModel: (modelId: string) => {
        set({ selectedModel: modelId, isCustomModel: false });
      },

      setIsCustomModel: (isCustom: boolean) => {
        set({ isCustomModel: isCustom });
      },

      setCustomModelName: (modelName: string) => {
        set({ customModelName: modelName.trim(), isCustomModel: true });
      },

      resetSettings: () => {
        deleteSecureItem(SECURE_KEYS.GEMINI_API_KEY);
        set({
          customApiKey: '',
          selectedModel: DEFAULT_MODEL_ID,
          isCustomModel: false,
          customModelName: '',
        });
      },
    }),
    {
      name: 'betteryou-settings-storage',
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state) => ({
        // Strictly exclude customApiKey from unencrypted AsyncStorage
        selectedModel: state.selectedModel,
        isCustomModel: state.isCustomModel,
        customModelName: state.customModelName,
      }),
      onRehydrateStorage: () => () => {
        // Hydrate custom API key from secure hardware-backed storage
        getSecureItem(SECURE_KEYS.GEMINI_API_KEY).then((secureKey) => {
          if (secureKey) {
            useSettingsStore.setState({ customApiKey: secureKey });
          }
        });

        // Migration: check for legacy plaintext key in AsyncStorage, migrate to SecureStore, and purge
        Promise.resolve(safeAsyncStorage.getItem('betteryou-settings-storage')).then((raw) => {
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed?.state?.customApiKey) {
                const legacy = parsed.state.customApiKey;
                setSecureItem(SECURE_KEYS.GEMINI_API_KEY, legacy).then(() => {
                  useSettingsStore.setState({ customApiKey: legacy });
                  delete parsed.state.customApiKey;
                  safeAsyncStorage.setItem('betteryou-settings-storage', JSON.stringify(parsed));
                });
              }
            } catch {
              // Ignore
            }
          }
        });
      },
    }
  )
);

/**
 * Resolves the active Gemini API key:
 * Returns the user's custom API key from SecureStore if configured, or empty string.
 * (Never returns or inlines client-side build environment variables)
 */
export function getEffectiveApiKey(): string {
  return useSettingsStore.getState().customApiKey?.trim() || '';
}

/**
 * Returns proxy URL for server-backed requests
 */
export function getEffectiveProxyUrl(): string {
  return process.env.EXPO_PUBLIC_PROXY_URL?.trim() || 'http://localhost:8787';
}

/**
 * Returns true if the client is routing through the proxy (default)
 */
export function isUsingProxy(): boolean {
  return !isUsingCustomKey();
}

/**
 * Resolves the active Gemini model identifier
 */
export function getEffectiveModel(): string {
  const { isCustomModel, customModelName, selectedModel } = useSettingsStore.getState();
  if (isCustomModel && customModelName.trim()) {
    return customModelName.trim();
  }
  // Catalogue may have changed (removed models): resolve stale saved picks to the default
  if (selectedModel && AVAILABLE_GEMINI_MODELS.some((m) => m.id === selectedModel)) {
    return selectedModel;
  }
  return DEFAULT_MODEL_ID;
}

/**
 * Returns human-readable label for the currently active model
 */
export function getActiveModelDisplayName(): string {
  const modelId = getEffectiveModel();
  const found = AVAILABLE_GEMINI_MODELS.find((m) => m.id === modelId);
  if (found) {
    return found.name;
  }
  return modelId;
}

/**
 * Returns true if an API key (custom or environment) is available
 */
export function hasActiveGeminiKey(): boolean {
  return Boolean(getEffectiveApiKey());
}

/**
 * Returns true if the user configured a custom key
 */
export function isUsingCustomKey(): boolean {
  return Boolean(useSettingsStore.getState().customApiKey?.trim());
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
      accuracyRating: 'Custom Pro Tier (High Forensic Depth)',
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

/**
 * Validates a Gemini API key by pinging the models list endpoint
 */
export async function validateGeminiApiKey(apiKeyToTest: string): Promise<{
  isValid: boolean;
  message: string;
  modelCount?: number;
  availableModels?: string[];
}> {
  const key = apiKeyToTest.trim();
  if (!key) {
    return {
      isValid: false,
      message: 'Please provide an API key to validate.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMsg = `Google API returned HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        }
      } catch {
        // Fallback to status text
      }
      return {
        isValid: false,
        message: errorMsg,
      };
    }

    interface ModelsResponse {
      models?: { name: string; displayName?: string }[];
    }

    const data = (await response.json()) as ModelsResponse;
    const modelsList = data.models || [];
    const modelNames = modelsList.map((m) => m.name.replace(/^models\//, ''));

    return {
      isValid: true,
      message: `API Key is valid and active! Found ${modelNames.length} accessible Gemini models.`,
      modelCount: modelNames.length,
      availableModels: modelNames,
    };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      isValid: false,
      message: isTimeout
        ? 'Connection timed out. Please check your internet connection.'
        : `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tests live multimodal connectivity with a specific model and API key,
 * or tests proxy server health if no custom key is provided.
 */
export async function testGeminiModelConnectivity(
  apiKey: string,
  modelId: string
): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const key = apiKey.trim();
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  // If no custom key, test proxy server health
  if (!key) {
    try {
      const proxyUrl = getEffectiveProxyUrl();
      const response = await fetch(`${proxyUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startTime;
      if (response.ok) {
        return {
          success: true,
          message: `Connected to BetterYou AI Proxy (${proxyUrl})! Latency: ${latencyMs}ms. Ready for scans.`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: `Proxy server returned HTTP ${response.status}`,
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        message: isTimeout
          ? 'Proxy health check timed out.'
          : `Cannot reach proxy server: ${err instanceof Error ? err.message : String(err)}. Ensure 'bun run server:start' is running.`,
        latencyMs,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // BYOK mode: Direct ping to Google AI Studio
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Ping. Reply with: OK' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1,
        },
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        }
      } catch {
        // Fallback
      }
      return {
        success: false,
        message: errorMsg,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `Direct BYOK connection to ${modelId} successful! Response time: ${latencyMs}ms`,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      success: false,
      message: isTimeout
        ? 'Model request timed out after 12s.'
        : `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
