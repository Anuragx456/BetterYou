import enJson from './locales/en.json';
import hiJson from './locales/hi.json';

export type SupportedLanguage = 'en' | 'hi';

export type Translations = typeof enJson;

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  en: enJson,
  hi: hiJson,
};

/**
 * Detects device language code (defaults to 'en').
 * Gracefully handles missing native modules in unlinked builds, Expo Go, or testing environments.
 */
export function getDeviceLanguage(): SupportedLanguage {
  try {
    // Dynamic require inside try/catch prevents app crash if native binary
    // does not yet have the ExpoLocalization native module compiled into it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = typeof require !== 'undefined' ? require('expo-localization') : null;
    const locales = Localization?.getLocales?.();
    if (Array.isArray(locales) && locales.length > 0) {
      const code = locales[0]?.languageCode;
      if (code === 'hi') return 'hi';
    }
  } catch {
    // Graceful fallback to English
  }
  return 'en';
}

let currentLanguage: SupportedLanguage = getDeviceLanguage();

export function setAppLanguage(lang: SupportedLanguage) {
  currentLanguage = lang;
}

export function getAppLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function t<K extends keyof Translations>(key: K): string {
  return TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || String(key);
}
