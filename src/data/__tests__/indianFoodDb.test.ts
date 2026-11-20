import { describe, expect, it } from 'bun:test';
import rawDb from '../indianFoodDb.json';
import type { IndianFoodItem } from '../../utils/indianFoodMatcher';

const db = rawDb as IndianFoodItem[];

describe('Indian Food Database Integrity & Provenance (indianFoodDb.json)', () => {
  it('contains at least 50 curated Indian food entries', () => {
    expect(db.length).toBeGreaterThanOrEqual(50);
  });

  it('(a) every entry has a valid confidence ("verified" | "estimate")', () => {
    for (const item of db) {
      expect(['verified', 'estimate']).toContain(item.confidence);
    }

    const verified = db.filter((i) => i.confidence === 'verified');
    const estimates = db.filter((i) => i.confidence === 'estimate');

    // Asserts both categories exist
    expect(verified.length).toBeGreaterThan(0);
    expect(estimates.length).toBeGreaterThan(0);

    // Verify key staples are flagged verified
    const roti = db.find((i) => i.id === 'dish_16');
    expect(roti?.confidence).toBe('verified');

    const rice = db.find((i) => i.id === 'dish_19');
    expect(rice?.confidence).toBe('verified');

    // Verify complex composite dishes are flagged estimate
    const butterChicken = db.find((i) => i.id === 'dish_01');
    expect(butterChicken?.confidence).toBe('estimate');

    const biryani = db.find((i) => i.id === 'dish_08');
    expect(biryani?.confidence).toBe('estimate');
  });

  it('(b) macros sum to <= servingSizeGrams + 5 (thermodynamic sanity)', () => {
    for (const item of db) {
      // Per 100g serving: protein + carbs + fat <= 100g + 5g allowance
      const macroSum100g = item.proteinPer100g + item.carbsPer100g + item.fatPer100g;
      expect(macroSum100g).toBeLessThanOrEqual(105);

      // Scaled to standard portion
      const portionScale = item.standardPortionGrams / 100;
      const totalPortionMacros = macroSum100g * portionScale;
      expect(totalPortionMacros).toBeLessThanOrEqual(item.standardPortionGrams + 5);
    }
  });

  it('(c) calories match Atwater energy factors within 20% (4*P + 4*C + 9*F ~ calories)', () => {
    for (const item of db) {
      const atwater = 4 * item.proteinPer100g + 4 * item.carbsPer100g + 9 * item.fatPer100g;
      const deviation = Math.abs(atwater - item.caloriesPer100g) / item.caloriesPer100g;

      expect(deviation).toBeLessThanOrEqual(0.20);
    }
  });

  it('(d) every entry has a non-empty source', () => {
    for (const item of db) {
      expect(typeof item.source).toBe('string');
      expect(item.source.trim().length).toBeGreaterThan(10);

      if (item.confidence === 'verified') {
        expect(item.source).toContain('IFCT 2017');
      } else {
        expect(item.source).toContain('composite recipe reference');
      }
    }
  });

  it('(e) no duplicate dish names or aliases across the dataset', () => {
    const seenNames = new Set<string>();
    const seenAliases = new Map<string, string>();

    for (const item of db) {
      const normalizedName = item.name.toLowerCase().trim();
      expect(seenNames.has(normalizedName)).toBe(false);
      seenNames.add(normalizedName);

      expect(Array.isArray(item.aliases)).toBe(true);
      expect(item.aliases.length).toBeGreaterThan(0);

      for (const alias of item.aliases) {
        const normalizedAlias = alias.toLowerCase().trim();
        const existingDish = seenAliases.get(normalizedAlias);
        expect(existingDish).toBeUndefined();
        seenAliases.set(normalizedAlias, item.name);
      }
    }
  });
});
