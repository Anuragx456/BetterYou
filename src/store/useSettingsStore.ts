import {
  deleteSecureItem,
  SECURE_KEYS,
  setSecureItem,
} from '../utils/secureStorage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AVAILABLE_GEMINI_MODELS,
  DEFAULT_MODEL_ID,
  getModelDisplayName,
} from './geminiModels';
import {
  createSettingsPersistOptions,
  invalidateVisionCaches,
} from './settingsPersistence';

// Re-export all model definitions, metadata and estimators
export * from './geminiModels';
// Re-export validation, connectivity and proxy resolution
export * from './settingsValidation';
// Re-export persistence helpers
export { invalidateVisionCaches } from './settingsPersistence';

export type ColorScheme = 'light' | 'dark';

export interface SettingsState {
  // State
  customApiKey: string;
  selectedModel: string;
  isCustomModel: boolean;
  customModelName: string;
  colorScheme: ColorScheme;
  hasCompletedOnboarding: boolean;

  // Reminders (opt-in only, default disabled)
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  weeklyReviewEnabled: boolean;
  weeklyReviewTime: string;

  // Actions
  setCustomApiKey: (key: string) => void;
  clearCustomApiKey: () => void;
  setSelectedModel: (modelId: string) => void;
  setIsCustomModel: (isCustom: boolean) => void;
  setCustomModelName: (modelName: string) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setDailyReminderEnabled: (enabled: boolean) => void;
  setDailyReminderTime: (time: string) => void;
  setWeeklyReviewEnabled: (enabled: boolean) => void;
  setWeeklyReviewTime: (time: string) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      customApiKey: '',
      selectedModel: DEFAULT_MODEL_ID,
      isCustomModel: false,
      customModelName: '',
      colorScheme: 'light',
      hasCompletedOnboarding: false,
      dailyReminderEnabled: false,
      dailyReminderTime: '20:00',
      weeklyReviewEnabled: false,
      weeklyReviewTime: '19:00',

      setCustomApiKey: (key: string) => {
        const trimmed = key.trim();
        set({ customApiKey: trimmed });
        invalidateVisionCaches();
        if (trimmed) {
          setSecureItem(SECURE_KEYS.GEMINI_API_KEY, trimmed);
        } else {
          deleteSecureItem(SECURE_KEYS.GEMINI_API_KEY);
        }
      },

      clearCustomApiKey: () => {
        set({ customApiKey: '' });
        invalidateVisionCaches();
        deleteSecureItem(SECURE_KEYS.GEMINI_API_KEY);
      },

      setSelectedModel: (modelId: string) => {
        set({ selectedModel: modelId, isCustomModel: false });
        invalidateVisionCaches();
      },

      setIsCustomModel: (isCustom: boolean) => {
        set({ isCustomModel: isCustom });
        invalidateVisionCaches();
      },

      setCustomModelName: (modelName: string) => {
        set({ customModelName: modelName.trim(), isCustomModel: true });
        invalidateVisionCaches();
      },

      setColorScheme: (scheme) => {
        set({ colorScheme: scheme });
      },

      setHasCompletedOnboarding: (completed: boolean) => {
        set({ hasCompletedOnboarding: completed });
      },

      setDailyReminderEnabled: (enabled: boolean) => {
        set({ dailyReminderEnabled: enabled });
      },

      setDailyReminderTime: (time: string) => {
        set({ dailyReminderTime: time });
      },

      setWeeklyReviewEnabled: (enabled: boolean) => {
        set({ weeklyReviewEnabled: enabled });
      },

      setWeeklyReviewTime: (time: string) => {
        set({ weeklyReviewTime: time });
      },

      resetSettings: () => {
        deleteSecureItem(SECURE_KEYS.GEMINI_API_KEY);
        set({
          customApiKey: '',
          selectedModel: DEFAULT_MODEL_ID,
          isCustomModel: false,
          customModelName: '',
        });
        invalidateVisionCaches();
      },
    }),
    createSettingsPersistOptions((key) => {
      useSettingsStore.setState({ customApiKey: key });
    })
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
  return getModelDisplayName(modelId);
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
