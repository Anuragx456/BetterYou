import { safeAsyncStorage } from '../utils/storage';
import {
  getSecureItem,
  SECURE_KEYS,
  setSecureItem,
} from '../utils/secureStorage';
import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { SettingsState } from './useSettingsStore';

/**
 * Invalidate vision and screening caches when model selection changes
 */
export function invalidateVisionCaches(): void {
  import('../services/aiVisionService')
    .then((vision) => {
      vision.clearAiVisionCaches();
    })
    .catch(() => {});
}

export type SettingsPersistOptions = PersistOptions<
  SettingsState,
  Pick<
    SettingsState,
    | 'selectedModel'
    | 'isCustomModel'
    | 'customModelName'
    | 'colorScheme'
    | 'hasCompletedOnboarding'
    | 'dailyReminderEnabled'
    | 'dailyReminderTime'
    | 'weeklyReviewEnabled'
    | 'weeklyReviewTime'
  >
>;

export function createSettingsPersistOptions(
  onHydrateCustomKey: (key: string) => void
): SettingsPersistOptions {
  return {
    name: 'betteryou-settings-storage',
    storage: createJSONStorage(() => safeAsyncStorage),
    partialize: (state) => ({
      // Strictly exclude customApiKey from unencrypted AsyncStorage
      selectedModel: state.selectedModel,
      isCustomModel: state.isCustomModel,
      customModelName: state.customModelName,
      colorScheme: state.colorScheme,
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      dailyReminderEnabled: state.dailyReminderEnabled,
      dailyReminderTime: state.dailyReminderTime,
      weeklyReviewEnabled: state.weeklyReviewEnabled,
      weeklyReviewTime: state.weeklyReviewTime,
    }),
    onRehydrateStorage: () => () => {
      // Hydrate custom API key from secure hardware-backed storage
      getSecureItem(SECURE_KEYS.GEMINI_API_KEY).then((secureKey) => {
        if (secureKey) {
          onHydrateCustomKey(secureKey);
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
                onHydrateCustomKey(legacy);
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
  };
}
