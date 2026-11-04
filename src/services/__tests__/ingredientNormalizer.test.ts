import { describe, it, expect } from 'bun:test';
import {
  normalizeIngredientString,
  parseOrderedIngredientsList,
  getConcentrationMetrics,
  matchAdditiveRule,
  getClassCap,
} from '../ingredientNormalizer';

describe('Ingredient Normalizer & Concentration Weighting (ingredientNormalizer.ts)', () => {
  describe('normalizeIngredientString', () => {
    it('normalizes percentages, E-numbers, and extraneous punctuation', () => {
      const raw = 'Antioxidant (TBHQ - INS 319) [0.02% w/w]';
      const normalized = normalizeIngredientString(raw);
      expect(normalized).toContain('tbhq');
      expect(normalized).toContain('ins 319');
      expect(normalized).not.toContain('%');
      expect(normalized).not.toContain('[');
    });

    it('maps Hindi and colloquial Indian market synonyms', () => {
      expect(normalizeIngredientString('Taad ka Tel (Fried)')).toContain('palmolein');
      expect(normalizeIngredientString('Refined Maida')).toContain('refined wheat flour');
      expect(normalizeIngredientString('Ajinomoto Seasoning')).toContain('monosodium glutamate');
      expect(normalizeIngredientString('Kapasiya Tel')).toContain('cottonseed oil');
    });
  });

  describe('parseOrderedIngredientsList', () => {
    it('correctly splits ordered ingredients while protecting nested parenthetical sub-lists', () => {
      const raw = 'Potatoes, Edible Vegetable Oil (Palmolein, Cottonseed Oil), Spices (Red Chilli, Salt, Cumin), TBHQ';
      const parsed = parseOrderedIngredientsList(raw);

      expect(parsed.length).toBe(4);
      expect(parsed[0]).toBe('Potatoes');
      expect(parsed[1]).toBe('Edible Vegetable Oil (Palmolein, Cottonseed Oil)');
      expect(parsed[2]).toBe('Spices (Red Chilli, Salt, Cumin)');
      expect(parsed[3]).toBe('TBHQ');
    });

    it('handles empty or single-item strings cleanly', () => {
      expect(parseOrderedIngredientsList('')).toEqual([]);
      expect(parseOrderedIngredientsList('Pure Cold-Pressed Mustard Oil')).toEqual(['Pure Cold-Pressed Mustard Oil']);
    });
  });

  describe('getConcentrationMetrics', () => {
    it('assigns 1.5x multiplier to the primary ingredient (index 0)', () => {
      const metrics = getConcentrationMetrics(0, 10);
      expect(metrics.multiplier).toBe(1.5);
      expect(metrics.rankLabel).toContain('Primary Constituent (Rank #1)');
    });

    it('assigns 1.25x multiplier to major ingredients in top 25%', () => {
      const metrics = getConcentrationMetrics(1, 10);
      expect(metrics.multiplier).toBe(1.25);
      expect(metrics.rankLabel).toContain('Major Constituent (Rank #2)');
    });

    it('assigns 0.7x multiplier to minor/trace ingredients near the end', () => {
      const metrics = getConcentrationMetrics(9, 10);
      expect(metrics.multiplier).toBe(0.7);
      expect(metrics.rankLabel).toContain('Minor / Trace Additive (Rank #10)');
    });
  });

  describe('matchAdditiveRule', () => {
    it('matches INS and E-numbers across versioned rules', () => {
      const match1 = matchAdditiveRule('INS 319', 3, 5);
      expect(match1).not.toBeNull();
      expect(match1?.rule.id).toBe('tbhq');
      expect(match1?.rule.source).toContain('EFSA');

      const match2 = matchAdditiveRule('Tartrazine (E 102)', 4, 8);
      expect(match2).not.toBeNull();
      expect(match2?.rule.id).toBe('tartrazine');
      expect(match2?.rule.additiveClass).toBe('artificial_color');
    });

    it('matches non-food household and personal care additives', () => {
      const matchBkc = matchAdditiveRule('Benzalkonium Chloride 2.45%', 0, 4);
      expect(matchBkc).not.toBeNull();
      expect(matchBkc?.rule.id).toBe('bkc');
      expect(matchBkc?.concentrationMultiplier).toBe(1.5);

      const matchTransfluthrin = matchAdditiveRule('Transfluthrin a.i. 1.6%', 0, 2);
      expect(matchTransfluthrin).not.toBeNull();
      expect(matchTransfluthrin?.rule.id).toBe('transfluthrin');
      expect(matchTransfluthrin?.rule.source).toContain('CIBRC');
    });

    it('returns null for non-harmful benign ingredients', () => {
      expect(matchAdditiveRule('Potatoes', 0, 5)).toBeNull();
      expect(matchAdditiveRule('Common Salt', 2, 5)).toBeNull();
      expect(matchAdditiveRule('Pure Water', 0, 5)).toBeNull();
    });
  });

  describe('getClassCap', () => {
    it('retrieves defined class caps from versioned JSON', () => {
      expect(getClassCap('artificial_color')).toBe(12);
      expect(getClassCap('flavor_enhancer')).toBe(14);
      expect(getClassCap('synthetic_antioxidant')).toBe(18);
    });
  });
});
