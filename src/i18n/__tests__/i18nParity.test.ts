import { describe, expect, it } from 'bun:test';
import enJson from '../locales/en.json';
import hiJson from '../locales/hi.json';
import {
  getAppLanguage,
  setAppLanguage,
  t,
} from '../index';

describe('i18n Key Parity & Localization Completeness', () => {
  it('en.json and hi.json have identical keys with zero divergence', () => {
    const enKeys = Object.keys(enJson).sort();
    const hiKeys = Object.keys(hiJson).sort();

    expect(enKeys).toEqual(hiKeys);
    expect(enKeys.length).toBeGreaterThan(30);

    const missingInHi = enKeys.filter((key) => !(key in hiJson));
    const extraInHi = hiKeys.filter((key) => !(key in enJson));

    expect(missingInHi).toEqual([]);
    expect(extraInHi).toEqual([]);
  });

  it('no translation string in en or hi is empty or whitespace-only', () => {
    for (const value of Object.values(enJson)) {
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }

    for (const value of Object.values(hiJson)) {
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('Hindi translations accurately cover the 4 core tabs and flows', () => {
    // 1. Workouts (कसरत, सेट, वजन, विश्राम)
    expect(hiJson.navWorkouts).toContain('कसरत');
    expect(hiJson.setLabel).toBe('सेट');
    expect(hiJson.weightKg).toContain('वजन');
    expect(hiJson.restTimer).toContain('विश्राम');

    // 2. Meals (भोजन, कैलोरी, प्रोटीन, कार्ब्स, वसा)
    expect(hiJson.navMealScan).toContain('भोजन');
    expect(hiJson.caloriesLabel).toBe('कैलोरी');
    expect(hiJson.proteinLabel).toBe('प्रोटीन');
    expect(hiJson.carbsLabel).toBe('कार्ब्स');
    expect(hiJson.fatLabel).toBe('वसा');

    // 3. Toxicity scan (हानिकारक, सुरक्षित, मध्यम जोखिम, सामग्री)
    expect(hiJson.safeAndClean).toBe('सुरक्षित');
    expect(hiJson.moderateRisk).toBe('मध्यम जोखिम');
    expect(hiJson.highRisk).toBe('हानिकारक');
    expect(hiJson.ingredientsBreakdown).toContain('सामग्री');

    // 4. Dashboard and Settings
    expect(hiJson.navDashboard).toBe('डैशबोर्ड');
    expect(hiJson.settingsTitle).toBe('सेटिंग्स');
  });

  it('t() helper reacts to runtime language changes and falls back to en', () => {
    setAppLanguage('en');
    expect(getAppLanguage()).toBe('en');
    expect(t('save')).toBe('Save');
    expect(t('remaining')).toBe('Remaining');

    setAppLanguage('hi');
    expect(getAppLanguage()).toBe('hi');
    expect(t('save')).toBe('सहेजें');
    expect(t('remaining')).toBe('शेष कैलोरी');

    // Reset back to English
    setAppLanguage('en');
    expect(getAppLanguage()).toBe('en');
  });
});
