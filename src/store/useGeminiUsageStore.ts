import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeAsyncStorage } from '../utils/storage';

export type GeminiFeature =
  | 'meal-vision'
  | 'meal-voice'
  | 'toxicity-scan'
  | 'toxicity-voice'
  | 'barcode-enrichment'
  | 'key-validation';

export interface GeminiApiRecord {
  id: string;
  timestamp: number; // Unix timestamp in ms
  feature: GeminiFeature;
  featureLabel: string;
  model: string;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  isCustomKey: boolean;
}

export interface GeminiUsageState {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalPromptTokens: number;
  totalCandidateTokens: number;
  totalTokens: number;
  records: GeminiApiRecord[];

  // Actions
  recordApiCall: (params: {
    feature: GeminiFeature;
    featureLabel?: string;
    model: string;
    promptTokens?: number;
    candidateTokens?: number;
    totalTokens?: number;
    durationMs?: number;
    status: 'success' | 'error';
    errorMessage?: string;
    isCustomKey: boolean;
  }) => void;
  clearUsage: () => void;
  syncFromStoreHistory: (mealsWithPhotos: number, mealsVoiceOrText: number, toxicityScans: number) => void;
}

const MAX_HISTORY_RECORDS = 100;

const FEATURE_NAMES: Record<GeminiFeature, string> = {
  'meal-vision': 'Plate Vision OCR',
  'meal-voice': 'Voice Meal Estimate',
  'toxicity-scan': 'Ingredient Label OCR',
  'toxicity-voice': 'Voice Product Screen',
  'barcode-enrichment': 'Barcode AI Enrichment',
  'key-validation': 'API Key Verification',
};

export const useGeminiUsageStore = create<GeminiUsageState>()(
  persist(
    (set, get) => ({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalPromptTokens: 0,
      totalCandidateTokens: 0,
      totalTokens: 0,
      records: [],

      recordApiCall: (params) => {
        const promptTokens = Math.max(0, Math.round(params.promptTokens || 0));
        const candidateTokens = Math.max(0, Math.round(params.candidateTokens || 0));
        const totalTokens = Math.max(promptTokens + candidateTokens, Math.round(params.totalTokens || 0));
        const isSuccess = params.status === 'success';

        const record: GeminiApiRecord = {
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          feature: params.feature,
          featureLabel: params.featureLabel || FEATURE_NAMES[params.feature] || params.feature,
          model: params.model,
          promptTokens,
          candidateTokens,
          totalTokens,
          durationMs: Math.max(50, Math.round(params.durationMs || 500)),
          status: params.status,
          errorMessage: params.errorMessage,
          isCustomKey: params.isCustomKey,
        };

        const currentRecords = get().records;
        const updatedRecords = [record, ...currentRecords].slice(0, MAX_HISTORY_RECORDS);

        set((state) => ({
          totalCalls: state.totalCalls + 1,
          successfulCalls: state.successfulCalls + (isSuccess ? 1 : 0),
          failedCalls: state.failedCalls + (isSuccess ? 0 : 1),
          totalPromptTokens: state.totalPromptTokens + promptTokens,
          totalCandidateTokens: state.totalCandidateTokens + candidateTokens,
          totalTokens: state.totalTokens + totalTokens,
          records: updatedRecords,
        }));
      },

      clearUsage: () => {
        set({
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalPromptTokens: 0,
          totalCandidateTokens: 0,
          totalTokens: 0,
          records: [],
        });
      },

      syncFromStoreHistory: (mealsWithPhotos, mealsVoiceOrText, toxicityScans) => {
        const state = get();
        // Only seed if zero records recorded yet
        if (state.totalCalls > 0 || state.records.length > 0) return;

        const totalScans = mealsWithPhotos + mealsVoiceOrText + toxicityScans;
        if (totalScans === 0) return;

        const estPromptTokens = mealsWithPhotos * 650 + mealsVoiceOrText * 200 + toxicityScans * 800;
        const estCandidateTokens = mealsWithPhotos * 280 + mealsVoiceOrText * 190 + toxicityScans * 350;
        const estTotalTokens = estPromptTokens + estCandidateTokens;

        set({
          totalCalls: totalScans,
          successfulCalls: totalScans,
          failedCalls: 0,
          totalPromptTokens: estPromptTokens,
          totalCandidateTokens: estCandidateTokens,
          totalTokens: estTotalTokens,
          records: [],
        });
      },
    }),
    {
      name: 'betteryou-gemini-usage-storage',
      storage: createJSONStorage(() => safeAsyncStorage),
    }
  )
);

/**
 * Calculates today's start timestamp (00:00:00 local time)
 */
function getStartOfTodayMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Computes live usage metrics and statistics for UI consumption
 */
export function getGeminiUsageSummary() {
  const state = useGeminiUsageStore.getState();
  const startOfToday = getStartOfTodayMs();

  const todayRecords = state.records.filter((r) => r.timestamp >= startOfToday);
  const todayCalls = todayRecords.length;
  const todayTokens = todayRecords.reduce((sum, r) => sum + r.totalTokens, 0);

  // Group by feature
  const featureBreakdown: Record<GeminiFeature, number> = {
    'meal-vision': 0,
    'meal-voice': 0,
    'toxicity-scan': 0,
    'toxicity-voice': 0,
    'barcode-enrichment': 0,
    'key-validation': 0,
  };

  for (const r of state.records) {
    featureBreakdown[r.feature] = (featureBreakdown[r.feature] || 0) + 1;
  }

  // Commercial retail cost equivalent (Google AI Studio standard rates: ~$0.15/1M tokens average)
  const commercialCost = (state.totalPromptTokens / 1_000_000) * 0.075 + (state.totalCandidateTokens / 1_000_000) * 0.30;
  const formattedCommercialValue = commercialCost < 0.01 ? '< $0.01' : `$${commercialCost.toFixed(2)}`;

  return {
    totalCalls: state.totalCalls,
    successfulCalls: state.successfulCalls,
    failedCalls: state.failedCalls,
    totalTokens: state.totalTokens,
    totalPromptTokens: state.totalPromptTokens,
    totalCandidateTokens: state.totalCandidateTokens,
    todayCalls,
    todayTokens,
    featureBreakdown,
    commercialCost,
    formattedCommercialValue,
    recentRecords: state.records.slice(0, 15),
  };
}
