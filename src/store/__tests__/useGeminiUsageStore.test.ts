import { beforeEach, describe, expect, it } from 'bun:test';
import {
  getGeminiUsageSummary,
  useGeminiUsageStore,
} from '../useGeminiUsageStore';

describe('Gemini Usage Store (useGeminiUsageStore.ts)', () => {
  beforeEach(() => {
    useGeminiUsageStore.getState().clearUsage();
  });

  it('initializes with clean zero values', () => {
    const summary = getGeminiUsageSummary();
    expect(summary.totalCalls).toBe(0);
    expect(summary.successfulCalls).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.recentRecords).toHaveLength(0);
  });

  it('records successful API call and updates running totals', () => {
    useGeminiUsageStore.getState().recordApiCall({
      feature: 'meal-vision',
      model: 'gemini-3.6-flash',
      promptTokens: 800,
      candidateTokens: 250,
      totalTokens: 1050,
      durationMs: 420,
      status: 'success',
      isCustomKey: true,
    });

    const state = useGeminiUsageStore.getState();
    expect(state.totalCalls).toBe(1);
    expect(state.successfulCalls).toBe(1);
    expect(state.failedCalls).toBe(0);
    expect(state.totalPromptTokens).toBe(800);
    expect(state.totalCandidateTokens).toBe(250);
    expect(state.totalTokens).toBe(1050);
    expect(state.records).toHaveLength(1);
    expect(state.records[0].feature).toBe('meal-vision');
    expect(state.records[0].isCustomKey).toBe(true);
  });

  it('records failed API call without breaking totals', () => {
    useGeminiUsageStore.getState().recordApiCall({
      feature: 'toxicity-scan',
      model: 'gemini-3.6-flash',
      durationMs: 300,
      status: 'error',
      errorMessage: 'Rate limit 429',
      isCustomKey: false,
    });

    const state = useGeminiUsageStore.getState();
    expect(state.totalCalls).toBe(1);
    expect(state.successfulCalls).toBe(0);
    expect(state.failedCalls).toBe(1);
    expect(state.records[0].status).toBe('error');
    expect(state.records[0].errorMessage).toBe('Rate limit 429');
  });

  it('syncs initial counts from historical meals and products when clean', () => {
    useGeminiUsageStore.getState().syncFromStoreHistory(5, 3, 2);

    const state = useGeminiUsageStore.getState();
    expect(state.totalCalls).toBe(10);
    expect(state.successfulCalls).toBe(10);
    expect(state.totalTokens).toBeGreaterThan(0);

    // Calling it again should NOT overwrite existing counts
    useGeminiUsageStore.getState().syncFromStoreHistory(10, 10, 10);
    expect(useGeminiUsageStore.getState().totalCalls).toBe(10);
  });

  it('computes usage summary and feature breakdown accurately', () => {
    useGeminiUsageStore.getState().recordApiCall({
      feature: 'meal-vision',
      model: 'gemini-3.6-flash',
      promptTokens: 500,
      candidateTokens: 100,
      status: 'success',
      isCustomKey: true,
    });

    useGeminiUsageStore.getState().recordApiCall({
      feature: 'meal-voice',
      model: 'gemini-3.6-flash',
      promptTokens: 200,
      candidateTokens: 100,
      status: 'success',
      isCustomKey: true,
    });

    const summary = getGeminiUsageSummary();
    expect(summary.totalCalls).toBe(2);
    expect(summary.todayCalls).toBe(2);
    expect(summary.featureBreakdown['meal-vision']).toBe(1);
    expect(summary.featureBreakdown['meal-voice']).toBe(1);
    expect(summary.featureBreakdown['toxicity-scan']).toBe(0);
  });

  it('clears usage completely on clearUsage', () => {
    useGeminiUsageStore.getState().recordApiCall({
      feature: 'key-validation',
      model: 'models-list',
      status: 'success',
      isCustomKey: true,
    });

    expect(useGeminiUsageStore.getState().totalCalls).toBe(1);
    useGeminiUsageStore.getState().clearUsage();
    expect(useGeminiUsageStore.getState().totalCalls).toBe(0);
    expect(useGeminiUsageStore.getState().records).toHaveLength(0);
  });
});
