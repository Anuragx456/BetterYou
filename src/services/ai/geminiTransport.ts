import {
  getEffectiveApiKey,
  getEffectiveModel,
  getEffectiveProxyUrl,
} from '../../store/useSettingsStore';
import { GeminiFeature, useGeminiUsageStore } from '../../store/useGeminiUsageStore';
import { getSignedDeviceHeaders } from '../../utils/secureStorage';

export const GEMINI_FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

export function geminiModelsInOrder(chosenModel: string): string[] {
  return [chosenModel, ...GEMINI_FALLBACK_MODELS.filter((model) => model !== chosenModel)];
}

export function isGeminiModelMissingMessage(message: string): boolean {
  return /not found|not supported|unknown model|invalid model|does not exist|is not available/i.test(message);
}

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

export function parseBase64Image(input: string): { mimeType: string; base64Data: string } {
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

export function extractJsonString(rawText: string): string {
  const trimmed = rawText.trim();
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = trimmed.match(codeBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1).trim();
  }
  return trimmed;
}

export async function waitWithJitter(attempt: number, retryAfterSec?: number): Promise<void> {
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
  acceptText?: (text: string) => boolean;
}

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

  // 1. Direct BYOK Route
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
            if (response.status === 401 || response.status === 403) {
              throw new Error(`Gemini API Authentication Error (${response.status}). Please verify your custom API key.`);
            }

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

  // 2. Managed Proxy Route
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

export async function callGeminiText(
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
