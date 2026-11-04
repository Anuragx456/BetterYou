import additiveRulesData from '../data/additiveRules.v1.json';
import { SeverityLevel } from '../types';

export interface AdditiveRule {
  id: string;
  canonicalName: string;
  additiveClass: string;
  severity: SeverityLevel;
  aliases: string[];
  rationale: string;
  source: string;
  sourceUrl: string;
}

export interface MatchedAdditiveResult {
  rule: AdditiveRule;
  originalIngredient: string;
  normalizedName: string;
  positionIndex: number;
  totalIngredients: number;
  concentrationMultiplier: number;
  concentrationRank: string;
}

const HINDI_SYNONYM_MAP: Record<string, string> = {
  'taad ka tel': 'palmolein',
  'palm oil': 'palmolein',
  'edible vegetable oil (palmolein)': 'palmolein',
  'maida': 'refined wheat flour',
  'besan': 'gram flour',
  'ajinomoto': 'monosodium glutamate',
  'til ka tel': 'sesame oil',
  'dalda': 'vanaspati',
  'kapasiya tel': 'cottonseed oil',
  'rai ka tel': 'mustard oil',
  'sarson ka tel': 'mustard oil',
};

/**
 * Normalizes an ingredient string by removing noise, bracketed percentages,
 * and mapping Indian multilingual variants and INS/E-number conventions.
 */
export function normalizeIngredientString(raw: string): string {
  if (!raw) return '';
  let str = raw.toLowerCase().trim();

  // Strip percentage amounts, e.g. "(76.8% w/w)", "(46%)", "33%"
  str = str.replace(/\(?\b\d+(?:\.\d+)?%\s*(?:w\/w|v\/v)?\)?/gi, ' ');

  // Normalize INS and E-number hyphens and spaces: "ins-319", "ins 319", "e-102"
  str = str.replace(/\b(ins|e)[\s-]+(\d+[a-z]?)/gi, '$1 $2');

  // Strip trailing punctuation and excessive whitespace
  str = str.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  // Check direct Hindi synonym mapping
  for (const [hindi, canonical] of Object.entries(HINDI_SYNONYM_MAP)) {
    if (str.includes(hindi)) {
      str = str.replace(hindi, canonical);
    }
  }

  return str;
}

/**
 * Splits raw ingredients packaging text into ordered individual ingredients,
 * correctly protecting parenthetical nested lists:
 * e.g. "Potatoes, Edible Vegetable Oil (Palmolein, Cottonseed), Salt"
 */
export function parseOrderedIngredientsList(rawText: string): string[] {
  if (!rawText || typeof rawText !== 'string') return [];

  const items: string[] = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];

    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth++;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    if ((char === ',' || char === ';' || char === '\n') && parenDepth === 0 && bracketDepth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        items.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const lastTrimmed = current.trim();
  if (lastTrimmed.length > 0) {
    items.push(lastTrimmed);
  }

  return items;
}

/**
 * Calculates concentration multiplier based on ingredient list order.
 * By Indian (FSSAI) and international labeling regulations, ingredients
 * MUST be listed in descending order of in-going weight/concentration.
 */
export function getConcentrationMetrics(
  index: number,
  totalIngredients: number
): { multiplier: number; rankLabel: string } {
  if (totalIngredients <= 1) {
    return { multiplier: 1.0, rankLabel: 'Primary Ingredient' };
  }

  const relativePos = index / totalIngredients;

  if (index === 0) {
    return { multiplier: 1.5, rankLabel: 'Primary Constituent (Rank #1)' };
  }
  if (index <= 2 || relativePos <= 0.25) {
    return { multiplier: 1.25, rankLabel: `Major Constituent (Rank #${index + 1})` };
  }
  if (relativePos <= 0.70) {
    return { multiplier: 1.0, rankLabel: `Secondary Formulation (Rank #${index + 1})` };
  }
  return { multiplier: 0.7, rankLabel: `Minor / Trace Additive (Rank #${index + 1})` };
}

/**
 * Matches an ingredient against the versioned additive rules database.
 */
export function matchAdditiveRule(
  rawIngredient: string,
  index: number = 0,
  totalIngredients: number = 1
): MatchedAdditiveResult | null {
  const normalized = normalizeIngredientString(rawIngredient);
  if (!normalized || normalized.length < 2) return null;

  const rules = additiveRulesData.rules as AdditiveRule[];

  for (const rule of rules) {
    // Check if ID matches
    if (normalized === rule.id || normalized.includes(rule.id)) {
      const { multiplier, rankLabel } = getConcentrationMetrics(index, totalIngredients);
      return {
        rule,
        originalIngredient: rawIngredient,
        normalizedName: normalized,
        positionIndex: index,
        totalIngredients,
        concentrationMultiplier: multiplier,
        concentrationRank: rankLabel,
      };
    }

    // Check all rule aliases
    for (const alias of rule.aliases) {
      const normAlias = normalizeIngredientString(alias);
      if (
        normalized === normAlias ||
        normalized.includes(normAlias) ||
        (normAlias.length > 3 && normalized.startsWith(normAlias))
      ) {
        const { multiplier, rankLabel } = getConcentrationMetrics(index, totalIngredients);
        return {
          rule,
          originalIngredient: rawIngredient,
          normalizedName: normalized,
          positionIndex: index,
          totalIngredients,
          concentrationMultiplier: multiplier,
          concentrationRank: rankLabel,
        };
      }
    }
  }

  return null;
}

export function getAllAdditiveRules(): AdditiveRule[] {
  return additiveRulesData.rules as AdditiveRule[];
}

export function getClassCap(additiveClass: string): number {
  const caps = additiveRulesData.classCaps as Record<string, number>;
  return caps[additiveClass] ?? 18;
}
