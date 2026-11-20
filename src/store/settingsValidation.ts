import { useGeminiUsageStore } from './useGeminiUsageStore';

/**
 * Returns proxy URL for server-backed requests
 */
export function getEffectiveProxyUrl(): string {
  return process.env.EXPO_PUBLIC_PROXY_URL?.trim() || 'http://localhost:8787';
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

  const startTime = Date.now();
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
      useGeminiUsageStore.getState().recordApiCall({
        feature: 'key-validation',
        model: 'models-list-api',
        durationMs: Date.now() - startTime,
        status: 'error',
        errorMessage: errorMsg,
        isCustomKey: true,
      });
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

    useGeminiUsageStore.getState().recordApiCall({
      feature: 'key-validation',
      model: 'models-list-api',
      promptTokens: 10,
      candidateTokens: modelNames.length * 15,
      totalTokens: 10 + modelNames.length * 15,
      durationMs: Date.now() - startTime,
      status: 'success',
      isCustomKey: true,
    });

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
