import {
  HarmfulAdditive,
  IndianRegulatoryStandard,
  NovaGroup,
  NutriscoreGrade,
  RiskLevel,
  SupermarketCategory,
  TargetExposure,
  ToxicityReport,
} from '../types';
import {
  parseOrderedIngredientsList,
  matchAdditiveRule,
  getClassCap,
} from './ingredientNormalizer';
import additiveRulesData from '../data/additiveRules.v1.json';

export class ProductNotFoundError extends Error {
  readonly barcode: string;
  constructor(barcode: string) {
    super(`Product with barcode "${barcode}" was not found in OpenFoodFacts or OpenBeautyFacts databases.`);
    this.name = 'ProductNotFoundError';
    this.barcode = barcode;
  }
}

/**
 * Supermarket category classifier based on packaging terms and regulatory exposure
 */
function detectSupermarketCategory(
  productName: string,
  ingredientsText: string
): SupermarketCategory {
  const combined = `${productName} ${ingredientsText}`.toLowerCase();

  if (
    combined.includes('mosquito') ||
    combined.includes('vaporizer') ||
    combined.includes('liquidator') ||
    combined.includes('coil') ||
    combined.includes('all out') ||
    combined.includes('good knight') ||
    combined.includes('baygon') ||
    combined.includes('hit spray') ||
    combined.includes('transfluthrin') ||
    combined.includes('prallethrin')
  ) {
    return 'Pest Control';
  }

  if (
    combined.includes('baby powder') ||
    combined.includes('baby oil') ||
    combined.includes('baby lotion') ||
    combined.includes('baby wash') ||
    combined.includes('diaper') ||
    combined.includes('johnson') ||
    combined.includes('sebamed')
  ) {
    return 'Baby Care';
  }

  if (
    combined.includes('toothpaste') ||
    combined.includes('mouthwash') ||
    combined.includes('tooth powder') ||
    combined.includes('colgate') ||
    combined.includes('sensodyne') ||
    combined.includes('dant kanti') ||
    combined.includes('close up') ||
    combined.includes('pepsodent') ||
    combined.includes('oral-b')
  ) {
    return 'Oral Care';
  }

  if (
    combined.includes('hair oil') ||
    combined.includes('shampoo') ||
    combined.includes('conditioner') ||
    combined.includes('hair dye') ||
    combined.includes('hair serum') ||
    combined.includes('almond drops') ||
    combined.includes('parachute') ||
    combined.includes('head & shoulders') ||
    combined.includes('pantene')
  ) {
    return 'Hair Care';
  }

  if (
    combined.includes('floor cleaner') ||
    combined.includes('toilet cleaner') ||
    combined.includes('dishwash') ||
    combined.includes('detergent') ||
    combined.includes('disinfectant') ||
    combined.includes('floor') ||
    combined.includes('lizol') ||
    combined.includes('harpic') ||
    combined.includes('colin') ||
    combined.includes('surf excel') ||
    combined.includes('ariel') ||
    combined.includes('vim')
  ) {
    return 'Household & Cleaning';
  }

  if (
    combined.includes('soap') ||
    combined.includes('cream') ||
    combined.includes('lotion') ||
    combined.includes('body wash') ||
    combined.includes('sunscreen') ||
    combined.includes('face wash') ||
    combined.includes('fair & lovely') ||
    combined.includes('glow & lovely') ||
    combined.includes('dettol') ||
    combined.includes('nivea') ||
    combined.includes('dove') ||
    combined.includes('ponds')
  ) {
    return 'Personal Care & Skincare';
  }

  if (
    combined.includes('chyawanprash') ||
    combined.includes('balm') ||
    combined.includes('churna') ||
    combined.includes('asava') ||
    combined.includes('zandu') ||
    combined.includes('dabur') ||
    combined.includes('baidyanath') ||
    combined.includes('patanjali')
  ) {
    return 'Ayurveda & OTC';
  }

  return 'Food & Beverages';
}

function getCategoryRegulatoryDetails(category: SupermarketCategory): {
  regulatoryStandard: IndianRegulatoryStandard;
  targetExposure: TargetExposure;
} {
  switch (category) {
    case 'Food & Beverages':
      return { regulatoryStandard: 'FSSAI', targetExposure: 'Ingestion' };
    case 'Personal Care & Skincare':
      return { regulatoryStandard: 'CDSCO', targetExposure: 'Dermal Absorption' };
    case 'Hair Care':
      return { regulatoryStandard: 'CDSCO', targetExposure: 'Dermal Absorption' };
    case 'Oral Care':
      return { regulatoryStandard: 'CDSCO', targetExposure: 'Mucous Membrane' };
    case 'Household & Cleaning':
      return { regulatoryStandard: 'BIS', targetExposure: 'General' };
    case 'Pest Control':
      return { regulatoryStandard: 'CIBRC', targetExposure: 'Inhalation' };
    case 'Baby Care':
      return { regulatoryStandard: 'CDSCO', targetExposure: 'Dermal Absorption' };
    case 'Ayurveda & OTC':
      return { regulatoryStandard: 'AYUSH', targetExposure: 'Ingestion' };
  }
}

/**
 * Generates an objective, evidence-based Indian supermarket market alert
 */
function getIndianMarketAlert(
  category: SupermarketCategory,
  harmfulIngredients: HarmfulAdditive[],
  ingredientsText: string
): string | null {
  const lower = ingredientsText.toLowerCase();

  if (category === 'Hair Care' && (lower.includes('light liquid paraffin') || lower.includes('mineral oil'))) {
    return 'Hair Formulation Notice: Contains Light Liquid Paraffin (mineral oil). Permitted by CDSCO; acts as an occlusive lubricant with lower biological lipid affinity than cold-pressed vegetable oils.';
  }

  if (category === 'Pest Control' && (lower.includes('transfluthrin') || lower.includes('prallethrin'))) {
    return 'Indoor Ventilation Advisory: Contains synthetic pyrethroids (Transfluthrin/Prallethrin, CIBRC registered). Adequate bedroom air circulation is recommended during overnight vaporization.';
  }

  if (category === 'Oral Care' && lower.includes('sodium lauryl sulfate')) {
    return 'Oral Mucosa Sensitivity Notice: Formulated with Sodium Lauryl Sulfate (SLS). Clinical research associates SLS with buccal membrane irritation in individuals prone to recurrent aphthous ulcers.';
  }

  if (category === 'Household & Cleaning' && (lower.includes('benzalkonium chloride') || lower.includes('bkc'))) {
    return 'Household Surface Notice: Contains Benzalkonium Chloride (quat disinfectant, BIS standard). Ensure floors dry completely before allowing domestic pets or infants contact with surfaces.';
  }

  if (category === 'Baby Care' && lower.includes('talc')) {
    return 'Pediatric Inhalation Caution: Formulated with cosmetic-grade talc. Pediatric health guidelines advise gentle application away from the face to prevent infant dust cloud inhalation.';
  }

  if (category === 'Ayurveda & OTC' && (lower.includes('methylparaben') || lower.includes('sodium benzoate'))) {
    return 'Formulation Notice: Herbal OTC syrup preserved with synthetic antimicrobial preservatives (parabens/benzoates) under AYUSH guidelines.';
  }

  if (harmfulIngredients.some((h) => h.severity === 'high')) {
    const topHigh = harmfulIngredients.find((h) => h.severity === 'high')!;
    return `Regulatory Notice: Contains ${topHigh.name}. Flagged by ${topHigh.source || 'regulatory standards'} for targeted consumer awareness.`;
  }

  return null;
}

/**
 * Computes safe-for claim tags based on category, score, and additives
 */
function computeSafeForTags(
  category: SupermarketCategory,
  score: number,
  harmfulIngredients: HarmfulAdditive[],
  hasInsufficientData: boolean = false
): string[] {
  if (hasInsufficientData) {
    return ['Unverified Ingredients'];
  }

  const tags: string[] = [];
  const lowerNames = harmfulIngredients.map((h) => h.name.toLowerCase()).join(' ');

  if (!lowerNames.includes('paraben')) {
    tags.push('Paraben-Free');
  }

  if (category === 'Food & Beverages') {
    if (!lowerNames.includes('palmolein') && !lowerNames.includes('palm oil')) {
      tags.push('Palm Oil-Free');
    }
    if (!lowerNames.includes('msg') && !lowerNames.includes('glutamate')) {
      tags.push('No Added MSG');
    }
  }

  if (category === 'Hair Care' || category === 'Personal Care & Skincare') {
    if (!lowerNames.includes('mineral oil') && !lowerNames.includes('paraffin')) {
      tags.push('Zero Mineral Oil');
    }
    if (!lowerNames.includes('sulfate') && !lowerNames.includes('sls')) {
      tags.push('Sulfate-Free');
    }
  }

  if (score >= 80 && harmfulIngredients.length === 0) {
    tags.push('Clean Formulation', 'No Flagged Additives');
  }

  return tags.length > 0 ? tags : ['Standard Formulation'];
}

/**
 * Analyzes ingredients and additives using the versioned additive rules,
 * accounting for ingredient order (concentration weighting) and same-class caps.
 */
export function analyzeIngredientsAndAdditives(
  productName: string,
  ingredientsText: string,
  additivesTags: string[] = [],
  novaGroup: NovaGroup | null = null,
  nutriscoreGrade: NutriscoreGrade | null = null
): ToxicityReport {
  const category = detectSupermarketCategory(productName, ingredientsText);
  const { regulatoryStandard, targetExposure } = getCategoryRegulatoryDetails(category);

  // 1. Parse ordered ingredients list
  const orderedIngredients = parseOrderedIngredientsList(ingredientsText);
  const totalCount = orderedIngredients.length;
  const trimmed = ingredientsText ? ingredientsText.trim() : '';
  const hasInsufficientData = trimmed.length < 5 && additivesTags.length === 0 && orderedIngredients.length === 0;

  const harmfulMap = new Map<string, HarmfulAdditive>();
  const classCumulativeDeductions = new Map<string, number>();

  if (!hasInsufficientData) {
    // A. Match ordered text ingredients
    for (let i = 0; i < orderedIngredients.length; i++) {
      const rawIngredient = orderedIngredients[i];
      const match = matchAdditiveRule(rawIngredient, i, totalCount);

      if (match) {
        const { rule, concentrationMultiplier, concentrationRank } = match;
        if (!harmfulMap.has(rule.id)) {
          const cls = rule.additiveClass;
          const cap = getClassCap(cls);
          const currentClassDeduction = classCumulativeDeductions.get(cls) || 0;

          const baseDeduction = rule.severity === 'high' ? 18 : rule.severity === 'moderate' ? 9 : 4;
          const weightedDeduction = Math.round(baseDeduction * concentrationMultiplier);
          const remainingCap = Math.max(0, cap - currentClassDeduction);
          const effectiveDeduction = Math.min(weightedDeduction, remainingCap);

          classCumulativeDeductions.set(cls, currentClassDeduction + effectiveDeduction);

          harmfulMap.set(rule.id, {
            name: rule.canonicalName,
            category: rule.additiveClass,
            healthImpact: rule.rationale,
            severity: rule.severity,
            rationale: rule.rationale,
            source: rule.source,
            sourceUrl: rule.sourceUrl,
            concentrationRank,
            deduction: effectiveDeduction,
            additiveClass: cls,
          });
        }
      }
    }

    // B. Match OpenFoodFacts additives_tags (e.g. "en:e319")
    const allRules = additiveRulesData.rules;
    for (const tag of additivesTags) {
      const cleanTag = tag.toLowerCase().replace(/^en:/, '').replace(/[^a-z0-9]/g, '');
      const matchedRule = allRules.find(
        (r) =>
          r.id === cleanTag ||
          r.aliases.some((a) => a.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTag)
      );

      if (matchedRule && !harmfulMap.has(matchedRule.id)) {
        const cls = matchedRule.additiveClass;
        const cap = getClassCap(cls);
        const currentClassDeduction = classCumulativeDeductions.get(cls) || 0;

        const baseDeduction = matchedRule.severity === 'high' ? 18 : matchedRule.severity === 'moderate' ? 9 : 4;
        const remainingCap = Math.max(0, cap - currentClassDeduction);
        const effectiveDeduction = Math.min(baseDeduction, remainingCap);

        classCumulativeDeductions.set(cls, currentClassDeduction + effectiveDeduction);

        harmfulMap.set(matchedRule.id, {
          name: matchedRule.canonicalName,
          category: matchedRule.additiveClass,
          healthImpact: matchedRule.rationale,
          severity: matchedRule.severity as any,
          rationale: matchedRule.rationale,
          source: matchedRule.source,
          sourceUrl: matchedRule.sourceUrl,
          concentrationRank: 'Packaged Additive Tag',
          deduction: effectiveDeduction,
          additiveClass: cls,
        });
      }
    }
  }

  const harmfulIngredients = Array.from(harmfulMap.values());

  // 2. Compute Overall Safety Score (5 to 100)
  let score = 100;

  if (hasInsufficientData) {
    score = 50;
  } else {
    // Food processing penalties (NOVA and Nutri-Score)
    if (category === 'Food & Beverages') {
      if (novaGroup === 4) score -= 30;
      else if (novaGroup === 3) score -= 15;
      else if (novaGroup === 2) score -= 5;

      if (nutriscoreGrade === 'e') score -= 20;
      else if (nutriscoreGrade === 'd') score -= 12;
      else if (nutriscoreGrade === 'c') score -= 6;
    } else {
      // Non-food category base penalties
      if (category === 'Pest Control') score -= 35;
      if (category === 'Household & Cleaning') score -= 20;
    }

    // Sum effective class-capped additive deductions
    for (const additive of harmfulIngredients) {
      score -= additive.deduction ?? (additive.severity === 'high' ? 18 : additive.severity === 'moderate' ? 9 : 4);
    }
  }

  const clampedScore = hasInsufficientData ? 50 : Math.max(5, Math.min(100, score));

  let riskLevel: RiskLevel = 'Safe';
  if (hasInsufficientData) {
    riskLevel = 'Moderate';
  } else if (clampedScore < 40) {
    riskLevel = 'High Risk';
  } else if (clampedScore < 71) {
    riskLevel = 'Moderate';
  }

  const hazardRating = hasInsufficientData
    ? 'Moderate Hazard'
    : clampedScore >= 71
    ? 'Low Hazard'
    : clampedScore >= 40
    ? 'Moderate Hazard'
    : 'High Hazard';

  const indianMarketAlert = hasInsufficientData
    ? 'Data Notice: Ingredient text was not found in registry. Please photograph or type ingredients to verify packaging.'
    : getIndianMarketAlert(category, harmfulIngredients, ingredientsText);

  let cleanSummary = '';
  if (hasInsufficientData) {
    cleanSummary = `${productName || 'This product'} has insufficient ingredient data recorded. Risk screening requires visible ingredients.`;
  } else if (riskLevel === 'Safe') {
    cleanSummary = `${productName || 'This product'} shows a clean ingredient screening profile with minimal processing and no high-risk additives flagged.`;
  } else if (riskLevel === 'Moderate') {
    cleanSummary = `${productName || 'This product'} contains ${harmfulIngredients.length} flagged ingredients or industrial additives. Review highlighted rationales for exposure context.`;
  } else {
    cleanSummary = `${productName || 'This product'} contains ${harmfulIngredients.length} high-concern ingredients or heavy ultra-processing. Consider clean alternatives.`;
  }

  const safeFor = computeSafeForTags(category, clampedScore, harmfulIngredients, hasInsufficientData);

  return {
    overallSafetyScore: clampedScore,
    riskLevel,
    harmfulIngredients,
    cleanSummary,
    productName: productName || 'Unknown Product',
    category,
    indianMarketAlert,
    regulatoryStandard,
    targetExposure,
    hazardRating,
    safeFor,
    novaGroup: category === 'Food & Beverages' ? novaGroup : null,
    nutriscoreGrade: category === 'Food & Beverages' ? nutriscoreGrade : null,
    allIngredients: orderedIngredients.length > 0 ? orderedIngredients : (ingredientsText ? ingredientsText.split(/[,;]\s*/).map((s) => s.trim()) : []),
    hasInsufficientData,
  };
}

/**
 * Recomputes safety score and risk level when ingredients or additives are modified.
 * Correctly preserves the insufficient data guard and enforces class caps.
 */
export function recomputeReportScoreAndRisk(report: ToxicityReport): ToxicityReport {
  // Preserve empty-data safeguard
  if (report.hasInsufficientData && (!report.allIngredients || report.allIngredients.length === 0)) {
    return {
      ...report,
      overallSafetyScore: 50,
      riskLevel: 'Moderate',
      hazardRating: 'Moderate Hazard',
    };
  }

  const category = report.category || 'Food & Beverages';
  let score = 100;

  if (category === 'Food & Beverages') {
    if (report.novaGroup === 4) score -= 30;
    else if (report.novaGroup === 3) score -= 15;
    else if (report.novaGroup === 2) score -= 5;

    if (report.nutriscoreGrade === 'e') score -= 20;
    else if (report.nutriscoreGrade === 'd') score -= 12;
    else if (report.nutriscoreGrade === 'c') score -= 6;
  } else {
    if (category === 'Pest Control') score -= 35;
    if (category === 'Household & Cleaning') score -= 20;
  }

  const classCumulativeDeductions = new Map<string, number>();

  for (const additive of report.harmfulIngredients) {
    const cls = additive.additiveClass || additive.category || 'other';
    const cap = getClassCap(cls);
    const currentClassDeduction = classCumulativeDeductions.get(cls) || 0;

    const baseDeduction =
      additive.deduction !== undefined
        ? additive.deduction
        : additive.severity === 'high'
        ? 18
        : additive.severity === 'moderate'
        ? 9
        : 4;

    const remainingCap = Math.max(0, cap - currentClassDeduction);
    const effectiveDeduction = Math.min(baseDeduction, remainingCap);

    classCumulativeDeductions.set(cls, currentClassDeduction + effectiveDeduction);
    score -= effectiveDeduction;
  }

  const clampedScore = Math.max(5, Math.min(100, score));

  let riskLevel: RiskLevel = 'Safe';
  if (clampedScore < 40) {
    riskLevel = 'High Risk';
  } else if (clampedScore < 71) {
    riskLevel = 'Moderate';
  }

  const hazardRating =
    clampedScore >= 71 ? 'Low Hazard' : clampedScore >= 40 ? 'Moderate Hazard' : 'High Hazard';

  const safeFor = computeSafeForTags(category, clampedScore, report.harmfulIngredients);

  return {
    ...report,
    overallSafetyScore: clampedScore,
    riskLevel,
    hazardRating,
    safeFor,
    hasInsufficientData: false,
  };
}

/**
 * Authentic Indian Supermarket offline catalog with objective, factual regulatory screening copy
 */
export const INDIAN_SUPERMARKET_PRESETS: Record<string, ToxicityReport> = {
  // 1. Kurkure Masala Munch (Food)
  '8901030383749': {
    productName: 'Kurkure Masala Munch (Packaged Namkeen)',
    barcode: '8901030383749',
    category: 'Food & Beverages',
    overallSafetyScore: 9,
    riskLevel: 'High Risk',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 4,
    nutriscoreGrade: 'e',
    indianMarketAlert: 'Frying Oil Advisory: Fried in refined palmolein oil and stabilized with permitted antioxidant TBHQ (INS 319).',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Ultra-processed savory snack (NOVA 4) combining refined palm olein with multiple synthetic flavor enhancers and industrial antioxidant TBHQ.',
    harmfulIngredients: [
      {
        name: 'TBHQ (Tertiary Butylhydroquinone / INS 319)',
        category: 'synthetic_antioxidant',
        healthImpact: 'Synthetic phenolic antioxidant permitted by FSSAI; subject to strict daily intake limits by EFSA.',
        severity: 'high',
        rationale: 'Synthetic phenolic antioxidant used to prolong oil shelf-life. EFSA and FSSAI permit strictly limited doses.',
        source: 'EFSA / FSSAI',
        sourceUrl: 'https://www.efsa.europa.eu/en/efsajournal/pub/3794',
        concentrationRank: 'Minor Additive (INS 319)',
        deduction: 18,
        additiveClass: 'synthetic_antioxidant',
      },
      {
        name: 'Monosodium Glutamate (MSG / INS 621)',
        category: 'flavor_enhancer',
        healthImpact: 'Purified umami flavor enhancer permitted under FSSAI limits; may cause sensitivity reactions in select subsets.',
        severity: 'moderate',
        rationale: 'Flavor enhancer that stimulates umami taste receptors; evaluated as safe at permitted levels by JECFA.',
        source: 'FSSAI / EFSA',
        sourceUrl: 'https://www.efsa.europa.eu/en/efsajournal/pub/4910',
        concentrationRank: 'Minor Additive',
        deduction: 9,
        additiveClass: 'flavor_enhancer',
      },
      {
        name: 'Disodium 5-Ribonucleotides (INS 635)',
        category: 'flavor_enhancer',
        healthImpact: 'Nucleotide flavor enhancer paired with MSG to amplify taste receptor stimulation.',
        severity: 'moderate',
        rationale: 'Synergistic flavor enhancer blend; capped by class limits.',
        source: 'FSSAI',
        sourceUrl: 'https://fssai.gov.in/',
        concentrationRank: 'Minor Additive',
        deduction: 5, // Class cap for flavor enhancers = 14 (9 + 5)
        additiveClass: 'flavor_enhancer',
      },
      {
        name: 'Palmolein / Refined Palm Oil',
        category: 'refined_tropical_fat',
        healthImpact: 'High-saturated tropical oil used for high-temperature commercial fry stability.',
        severity: 'moderate',
        rationale: 'High in saturated palmitic acid (~50%); consumption should be balanced with unsaturated fats.',
        source: 'FSSAI / WHO',
        sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
        concentrationRank: 'Major Constituent (Rank #2)',
        deduction: 9,
        additiveClass: 'refined_tropical_fat',
      },
    ],
    allIngredients: ['Rice Meal', 'Edible Vegetable Oil (Palmolein)', 'Corn Meal', 'Gram Meal', 'Spices & Condiments', 'Salt', 'INS 621', 'INS 627', 'INS 631', 'INS 319'],
    hasInsufficientData: false,
  },

  // 2. Maggi 2-Minute Noodles (Food)
  '8901030005702': {
    productName: 'Maggi 2-Minute Masala Instant Noodles',
    barcode: '8901030005702',
    category: 'Food & Beverages',
    overallSafetyScore: 28,
    riskLevel: 'High Risk',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 4,
    nutriscoreGrade: 'd',
    indianMarketAlert: 'Refined Carbohydrate & Oil Advisory: Formulated with refined wheat flour (maida) and palm oil frying base.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Ultra-processed instant noodles formulated with refined wheat flour (maida), fractionated palm oil, and nucleotide enhancers.',
    harmfulIngredients: [
      {
        name: 'Palmolein / Refined Palm Oil',
        category: 'refined_tropical_fat',
        healthImpact: 'High in saturated palmitic fatty acids; standard industrial frying oil.',
        severity: 'moderate',
        rationale: 'Saturated lipid base used for rapid noodle shelf dehydration.',
        source: 'FSSAI / WHO',
        sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
        concentrationRank: 'Major Constituent (Rank #2)',
        deduction: 9,
        additiveClass: 'refined_tropical_fat',
      },
      {
        name: "Disodium 5'-Ribonucleotides (INS 635)",
        category: 'flavor_enhancer',
        healthImpact: 'Nucleotide flavor booster providing intense savory taste.',
        severity: 'moderate',
        rationale: '50/50 blend of disodium inosinate and guanylate.',
        source: 'FSSAI',
        sourceUrl: 'https://fssai.gov.in/',
        concentrationRank: 'Minor Additive',
        deduction: 9,
        additiveClass: 'flavor_enhancer',
      },
      {
        name: 'Caramel Color IV (Sulfite Ammonia Caramel / INS 150d)',
        category: 'artificial_color',
        healthImpact: 'Manufactured with ammonia and sulfites; may carry trace 4-MEI.',
        severity: 'high',
        rationale: 'Classified under IARC Group 2B with specific daily intake limits.',
        source: 'IARC / EFSA',
        sourceUrl: 'https://monographs.iarc.who.int/',
        concentrationRank: 'Minor Additive',
        deduction: 12, // Class cap for artificial color = 12
        additiveClass: 'artificial_color',
      },
    ],
    allIngredients: ['Refined Wheat Flour (Maida)', 'Palm Oil', 'Iodised Salt', 'Hydrolysed Peanut Protein', 'Spices & Condiments', 'Flavor Enhancer 635', 'Caramel 150d'],
    hasInsufficientData: false,
  },

  // 3. Haldiram's Aloo Bhujia (Food)
  '8901725181222': {
    productName: "Haldiram's Nagpur Aloo Bhujia",
    barcode: '8901725181222',
    category: 'Food & Beverages',
    overallSafetyScore: 23,
    riskLevel: 'High Risk',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 4,
    nutriscoreGrade: 'e',
    indianMarketAlert: 'High Lipid Density: Contains over 35% total fat from deep frying in palmolein and cottonseed oils.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Traditional deep-fried potato & pulse namkeen with high saturated fat density and permitted synthetic antioxidant TBHQ.',
    harmfulIngredients: [
      {
        name: 'TBHQ (Tertiary Butylhydroquinone / INS 319)',
        category: 'synthetic_antioxidant',
        healthImpact: 'Synthetic phenolic antioxidant used to stabilize frying oil against rancidity.',
        severity: 'high',
        rationale: 'Subject to strict acceptable daily intake limits by EFSA and FSSAI.',
        source: 'EFSA / FSSAI',
        sourceUrl: 'https://www.efsa.europa.eu/en/efsajournal/pub/3794',
        concentrationRank: 'Minor Additive',
        deduction: 18,
        additiveClass: 'synthetic_antioxidant',
      },
      {
        name: 'Palmolein / Refined Palm Oil',
        category: 'refined_tropical_fat',
        healthImpact: 'Refined tropical oil rich in saturated fatty acids.',
        severity: 'moderate',
        rationale: 'Permitted frying medium; moderate dietary moderation advised.',
        source: 'FSSAI / WHO',
        sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
        concentrationRank: 'Major Constituent (Rank #2)',
        deduction: 9,
        additiveClass: 'refined_tropical_fat',
      },
    ],
    allIngredients: ['Potatoes', 'Edible Vegetable Oil (Palmolein & Cottonseed)', 'Gram Pulse Flour', 'Tepary Beans Flour', 'Spices & Condiments', 'Salt', 'INS 319'],
    hasInsufficientData: false,
  },

  // 4. Glow & Lovely Advanced Multi-Vitamin Cream (Personal Care)
  '8901030825317': {
    productName: 'Glow & Lovely Advanced Multi-Vitamin Cream',
    barcode: '8901030825317',
    category: 'Personal Care & Skincare',
    overallSafetyScore: 53,
    riskLevel: 'Moderate',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Dermal Absorption',
    hazardRating: 'Moderate Hazard',
    indianMarketAlert: 'Preservative & Pigment Screening: Formulated with parabens and titanium dioxide pigment for optical radiance masking.',
    safeFor: ['Sulfate-Free'],
    cleanSummary: 'Cosmetic facial cream combining topical niacinamide with CDSCO-permitted paraben preservatives and titanium dioxide mineral pigment.',
    harmfulIngredients: [
      {
        name: 'Methylparaben (Preservative)',
        category: 'preservative',
        healthImpact: 'Antimicrobial preservative permitted under CDSCO limits; subject to strict cumulative concentration caps.',
        severity: 'moderate',
        rationale: 'Weak estrogenic affinity observed in in-vitro biological testing.',
        source: 'EU SCCS / CDSCO',
        sourceUrl: 'https://ec.europa.eu/health/scientific_committees/consumer_safety/docs/sccs_o_132.pdf',
        concentrationRank: 'Minor Formulation Ingredient',
        deduction: 9,
        additiveClass: 'preservative',
      },
      {
        name: 'Propylparaben (Preservative)',
        category: 'preservative',
        healthImpact: 'Longer chain paraben preservative regulated under tighter global cosmetic ceilings.',
        severity: 'high',
        rationale: 'Class capped alongside methylparaben under total paraben ceiling.',
        source: 'EU SCCS / CDSCO',
        sourceUrl: 'https://ec.europa.eu/health/scientific_committees/consumer_safety/docs/sccs_o_132.pdf',
        concentrationRank: 'Minor Formulation Ingredient',
        deduction: 11, // Class cap for preservative = 20 (9 + 11)
        additiveClass: 'preservative',
      },
      {
        name: 'Titanium Dioxide (INS 171 / CI 77891)',
        category: 'nano_whitener',
        healthImpact: 'Mineral pigment providing immediate visual white cast; CDSCO permitted in topical cosmetics.',
        severity: 'high',
        rationale: 'Safe for intact dermal application; distinct from European oral ingestion restrictions.',
        source: 'CDSCO / CIR',
        sourceUrl: 'https://www.cir-safety.org/',
        concentrationRank: 'Secondary Formulation',
        deduction: 18,
        additiveClass: 'nano_whitener',
      },
      {
        name: 'BHT (Butylated Hydroxytoluene / INS 321)',
        category: 'synthetic_antioxidant',
        healthImpact: 'Lipid antioxidant stabilizer preventing cosmetic oil rancidity.',
        severity: 'moderate',
        rationale: 'Permitted within cosmetic safety limits by CIR and CDSCO.',
        source: 'CIR / CDSCO',
        sourceUrl: 'https://www.cir-safety.org/',
        concentrationRank: 'Trace Stabilizer',
        deduction: 9,
        additiveClass: 'synthetic_antioxidant',
      },
    ],
    allIngredients: ['Water', 'Palmitic Acid', 'Niacinamide', 'Glycerin', 'Titanium Dioxide', 'Methylparaben', 'Propylparaben', 'BHT', 'Perfume'],
    hasInsufficientData: false,
  },

  // 5. Dettol Original Antiseptic Bathing Soap (Personal Care)
  '8901030584504': {
    productName: 'Dettol Original Germ Protection Bathing Soap',
    barcode: '8901030584504',
    category: 'Personal Care & Skincare',
    overallSafetyScore: 78,
    riskLevel: 'Safe',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Dermal Absorption',
    hazardRating: 'Low Hazard',
    indianMarketAlert: 'Antimicrobial Screening: Formulated with active biocide Chloroxylenol (PCMX) for targeted pathogen control.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Topical cleansing bar utilizing active biocide Chloroxylenol alongside standard saponified palm oil base and BHT stabilizer.',
    harmfulIngredients: [
      {
        name: 'Chloroxylenol (PCMX Disinfectant)',
        category: 'industrial_disinfectant',
        healthImpact: 'Broad-spectrum phenolic antimicrobial biocide; may cause contact dryness on eczema-prone skin.',
        severity: 'moderate',
        rationale: 'Effective topical antibacterial agent; rinse-off application mitigates prolonged dermal exposure.',
        source: 'CDSCO / US EPA',
        sourceUrl: 'https://cdsco.gov.in/',
        concentrationRank: 'Active Constituent',
        deduction: 9,
        additiveClass: 'industrial_disinfectant',
      },
      {
        name: 'BHT (Butylated Hydroxytoluene / INS 321)',
        category: 'synthetic_antioxidant',
        healthImpact: 'Antioxidant stabilizer used to prevent soap base degradation.',
        severity: 'moderate',
        rationale: 'Cosmetic preservative with established safe rinse-off profile.',
        source: 'CIR',
        sourceUrl: 'https://www.cir-safety.org/',
        concentrationRank: 'Trace Stabilizer',
        deduction: 9,
        additiveClass: 'synthetic_antioxidant',
      },
      {
        name: 'Tetrasodium EDTA',
        category: 'chelating_agent',
        healthImpact: 'Chelating agent used to bind hard water mineral ions.',
        severity: 'low',
        rationale: 'Cosmetic stabilizer with low skin permeability.',
        source: 'CIR',
        sourceUrl: 'https://www.cir-safety.org/',
        concentrationRank: 'Trace Additive',
        deduction: 4,
        additiveClass: 'chelating_agent',
      },
    ],
    allIngredients: ['Sodium Palmate', 'Sodium Palm Kernelate', 'Aqua', 'Chloroxylenol', 'BHT', 'Tetrasodium EDTA', 'Etidronic Acid', 'CI 11680'],
    hasInsufficientData: false,
  },

  // 6. Colgate Strong Teeth Toothpaste (Oral Care)
  '8901314010520': {
    productName: 'Colgate Strong Teeth Amino Shakti Toothpaste',
    barcode: '8901314010520',
    category: 'Oral Care',
    overallSafetyScore: 62,
    riskLevel: 'Moderate',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Mucous Membrane',
    hazardRating: 'Moderate Hazard',
    indianMarketAlert: 'Oral Detergent Notice: Formulated with Sodium Lauryl Sulfate (SLS), which may cause mucosal sensitivity in individuals prone to mouth ulcers.',
    safeFor: ['Paraben-Free', 'Zero Mineral Oil'],
    cleanSummary: 'Standard anti-cavity dentifrice combining calcium carbonate and sodium monofluorophosphate with SLS foaming surfactant.',
    harmfulIngredients: [
      {
        name: 'Sodium Lauryl Sulfate (SLS)',
        category: 'surfactant',
        healthImpact: 'Anionic foaming surfactant associated with mucosal irritation and recurrent canker sores.',
        severity: 'moderate',
        rationale: 'Primary detergent responsible for toothpaste foam; sensitive users frequently benefit from SLS-free formulations.',
        source: 'CDSCO / CIR',
        sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/10518866/',
        concentrationRank: 'Secondary Formulation',
        deduction: 11, // Weighted for mucosal exposure
        additiveClass: 'surfactant',
      },
      {
        name: 'Sodium Saccharin (INS 954)',
        category: 'artificial_sweetener',
        healthImpact: 'Non-caloric sweetener used to mask chalky calcium carbonate taste.',
        severity: 'moderate',
        rationale: 'Petroleum-derived sweetener approved for oral hygiene formulations.',
        source: 'FSSAI / EFSA',
        sourceUrl: 'https://www.efsa.europa.eu/en/efsajournal/pub/4580',
        concentrationRank: 'Minor Additive',
        deduction: 9,
        additiveClass: 'artificial_sweetener',
      },
      {
        name: 'Titanium Dioxide (INS 171 / CI 77891)',
        category: 'nano_whitener',
        healthImpact: 'Mineral pigment added for toothpaste paste opacity and whiteness.',
        severity: 'high',
        rationale: 'Non-functional cosmetic whitener; oral toothpaste ingestion is minimal when properly rinsed.',
        source: 'CDSCO / EFSA',
        sourceUrl: 'https://www.efsa.europa.eu/en/efsajournal/pub/6585',
        concentrationRank: 'Minor Mineral Pigment',
        deduction: 18,
        additiveClass: 'nano_whitener',
      },
    ],
    allIngredients: ['Calcium Carbonate', 'Sorbitol', 'Sodium Lauryl Sulfate', 'Silica', 'Titanium Dioxide', 'Sodium Saccharin', 'Sodium Monofluorophosphate'],
    hasInsufficientData: false,
  },

  // 7. Good Knight Active+ Liquid Vaporizer (Pest Control)
  '8901023010101': {
    productName: 'Good Knight Active+ Mosquito Liquid Vaporizer',
    barcode: '8901023010101',
    category: 'Pest Control',
    overallSafetyScore: 47,
    riskLevel: 'Moderate',
    regulatoryStandard: 'CIBRC',
    targetExposure: 'Inhalation',
    hazardRating: 'Moderate Hazard',
    indianMarketAlert: 'Bedroom Inhalation Notice: Vaporizes active synthetic pyrethroid (Transfluthrin) in a deodorized kerosene solvent base. Adequate room ventilation advised.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Household spatial insecticide registered under CIBRC standards utilizing Transfluthrin pyrethroid for mosquito knockdown.',
    harmfulIngredients: [
      {
        name: 'Transfluthrin (Synthetic Neurotoxic Pyrethroid)',
        category: 'synthetic_pyrethroid',
        healthImpact: 'Volatile pyrethroid insect neurotoxin; prolonged continuous breathing in enclosed rooms can trigger airway hypersensitivity.',
        severity: 'high',
        rationale: 'CIBRC registered domestic pesticide; recommended for ventilated space use.',
        source: 'CIBRC / WHO',
        sourceUrl: 'http://cibrc.nic.in/',
        concentrationRank: 'Active Insecticide Agent (1.6% w/w)',
        deduction: 18,
        additiveClass: 'synthetic_pyrethroid',
      },
    ],
    allIngredients: ['Transfluthrin (a.i.) 0.88% w/w', 'Butylated Hydroxytoluene (BHT) 1.0% w/w', 'Deodorized Kerosene (Solvent) 98.12% w/w'],
    hasInsufficientData: false,
  },

  // 8. Lizol Disinfectant Floor Cleaner (Household)
  '8901096312456': {
    productName: 'Lizol Disinfectant Surface & Floor Cleaner',
    barcode: '8901096312456',
    category: 'Household & Cleaning',
    overallSafetyScore: 58,
    riskLevel: 'Moderate',
    regulatoryStandard: 'BIS',
    targetExposure: 'General',
    hazardRating: 'Moderate Hazard',
    indianMarketAlert: 'Household Surface Advisory: Contains Benzalkonium Chloride (quat disinfectant, BIS standard). Ensure wet surfaces dry before pet or infant contact.',
    safeFor: ['Paraben-Free', 'Bleach-Free'],
    cleanSummary: 'Cationic quaternary ammonium disinfectant surface cleaner conforming to BIS antibacterial standards.',
    harmfulIngredients: [
      {
        name: 'Benzalkonium Chloride (BKC / Quaternary Ammonium)',
        category: 'industrial_disinfectant',
        healthImpact: 'Cationic disinfectant surfactant; toxic to household felines via paw licking and irritating to crawling toddlers.',
        severity: 'high',
        rationale: 'BIS approved hard surface antimicrobial sanitizer; wet residue carries contact risks.',
        source: 'BIS / US EPA',
        sourceUrl: 'https://standardsbis.bsbedge.com/',
        concentrationRank: 'Active Antimicrobial Agent',
        deduction: 18,
        additiveClass: 'industrial_disinfectant',
      },
      {
        name: 'Tartrazine (Synthetic Yellow 5 / INS 102)',
        category: 'artificial_color',
        healthImpact: 'Synthetic dye added for product citrus color identity.',
        severity: 'moderate',
        rationale: 'Subject to class capping for synthetic dyes.',
        source: 'EFSA',
        sourceUrl: 'https://www.efsa.europa.eu/en/efsajournal/pub/1331',
        concentrationRank: 'Trace Dye',
        deduction: 4,
        additiveClass: 'artificial_color',
      },
    ],
    allIngredients: ['Benzalkonium Chloride Solution 4% w/w', 'Fatty Alcohol Ethoxylate', 'Sodium Bicarbonate', 'Tartrazine CI 19140', 'Perfume'],
    hasInsufficientData: false,
  },

  // 9. Johnson's Baby Powder (Baby Care)
  '8901030112233': {
    productName: "Johnson's Pure Cornstarch/Talc Baby Powder",
    barcode: '8901030112233',
    category: 'Baby Care',
    overallSafetyScore: 73,
    riskLevel: 'Safe',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Dermal Absorption',
    hazardRating: 'Low Hazard',
    indianMarketAlert: 'Pediatric Application Notice: Formulated with cosmetic-grade talc. Pediatric health guidelines advise gentle application away from infant nasal passages.',
    safeFor: ['Paraben-Free', 'Sulfate-Free'],
    cleanSummary: 'Mineral talc absorbent powder registered with CDSCO; pediatric guidelines advise caution against loose powder cloud inhalation.',
    harmfulIngredients: [
      {
        name: 'Purified Talc (Hydrated Magnesium Silicate)',
        category: 'pulmonary_inhalant',
        healthImpact: 'Mineral absorbent; acute particulate inhalation in infants can cause respiratory coughing or pneumonitis.',
        severity: 'high',
        rationale: 'CDSCO registered topical absorbent; pediatric safety guidelines recommend minimizing airborne dust.',
        source: 'CDSCO / AAP',
        sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/2237092/',
        concentrationRank: 'Primary Constituent (Rank #1)',
        deduction: 27, // 18 * 1.5x concentration multiplier = 27
        additiveClass: 'pulmonary_inhalant',
      },
    ],
    allIngredients: ['Talc', 'Fragrance'],
    hasInsufficientData: false,
  },

  // 10. Organic Cold Pressed Mustard Oil (Pantry Clean)
  '8901500000000': {
    productName: '100% Cold Pressed Pure Mustard Oil (Kachi Ghani)',
    barcode: '8901500000000',
    category: 'Food & Beverages',
    overallSafetyScore: 95,
    riskLevel: 'Safe',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 2,
    nutriscoreGrade: 'a',
    indianMarketAlert: null,
    safeFor: ['Paraben-Free', 'Palm Oil-Free', 'Zero Mineral Oil', 'No Flagged Additives'],
    cleanSummary: 'Single-ingredient, unrefined cold-pressed mustard oil rich in monounsaturated fats and natural plant antioxidants. Completely unadulterated.',
    harmfulIngredients: [],
    allIngredients: ['100% Pure Cold-Pressed Mustard Oil'],
    hasInsufficientData: false,
  },
};

const barcodeMemoryCache = new Map<string, ToxicityReport>();
const inFlightLookups = new Map<string, Promise<ToxicityReport>>();
const negativeBarcodeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearBarcodeCaches(): void {
  barcodeMemoryCache.clear();
  inFlightLookups.clear();
  negativeBarcodeCache.clear();
}

interface OpenFactsProductResponse {
  status: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    product_name_hi?: string;
    ingredients_text?: string;
    ingredients_text_en?: string;
    additives_tags?: string[];
    nova_group?: number;
    nutriscore_grade?: string;
  };
}

/**
 * Fetches product metadata and ingredients from OpenFoodFacts and OpenBeautyFacts APIs
 */
export async function fetchProductByBarcode(barcode: string): Promise<ToxicityReport> {
  const cleanBarcode = barcode.trim();

  // 1. Instant check against verified offline presets (<1ms response time)
  if (INDIAN_SUPERMARKET_PRESETS[cleanBarcode]) {
    return { ...INDIAN_SUPERMARKET_PRESETS[cleanBarcode] };
  }

  // 2. Instant check against in-memory barcode cache (<1ms response time)
  if (barcodeMemoryCache.has(cleanBarcode)) {
    return barcodeMemoryCache.get(cleanBarcode)!;
  }

  // Check negative cache to prevent rapid polling of unregistered barcodes
  const negativeTimestamp = negativeBarcodeCache.get(cleanBarcode);
  if (negativeTimestamp && Date.now() - negativeTimestamp < NEGATIVE_CACHE_TTL_MS) {
    throw new ProductNotFoundError(cleanBarcode);
  }

  // 3. Deduplicate concurrent in-flight requests for the same barcode
  if (inFlightLookups.has(cleanBarcode)) {
    return inFlightLookups.get(cleanBarcode)!;
  }

  // 4. Parallel multi-database lookup with field filtering (~2KB instead of ~80KB per query)
  const queryFields =
    'product_name,product_name_en,product_name_hi,ingredients_text,ingredients_text_en,additives_tags,nova_group,nutriscore_grade';
  const endpoints = [
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json?fields=${queryFields}`,
    `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json?fields=${queryFields}`,
  ];

  const fetchEndpoint = async (url: string): Promise<ToxicityReport> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'BetterYouApp/1.0 (fitness-nutrition-risk-screening; contact@betteryou.app)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as OpenFactsProductResponse;
      if (data.status === 1 && data.product) {
        const prod = data.product;
        const productName =
          prod.product_name ||
          prod.product_name_en ||
          prod.product_name_hi ||
          `Product (${cleanBarcode})`;
        const ingredientsText = prod.ingredients_text || prod.ingredients_text_en || '';
        const additivesTags = Array.isArray(prod.additives_tags) ? prod.additives_tags : [];

        const rawNova = prod.nova_group;
        const novaGroup: NovaGroup | null =
          rawNova === 1 || rawNova === 2 || rawNova === 3 || rawNova === 4 ? rawNova : null;

        const rawNutri = prod.nutriscore_grade?.toLowerCase();
        const nutriscoreGrade: NutriscoreGrade | null =
          rawNutri === 'a' || rawNutri === 'b' || rawNutri === 'c' || rawNutri === 'd' || rawNutri === 'e'
            ? rawNutri
            : null;

        const report = analyzeIngredientsAndAdditives(
          productName,
          ingredientsText,
          additivesTags,
          novaGroup,
          nutriscoreGrade
        );

        report.barcode = cleanBarcode;
        return report;
      }
      throw new Error('Product not found in this database');
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const lookupPromise = (async () => {
    try {
      const report = await Promise.any(endpoints.map((ep) => fetchEndpoint(ep)));
      barcodeMemoryCache.set(cleanBarcode, report);
      return report;
    } catch {
      negativeBarcodeCache.set(cleanBarcode, Date.now());
      throw new ProductNotFoundError(cleanBarcode);
    } finally {
      inFlightLookups.delete(cleanBarcode);
    }
  })();

  inFlightLookups.set(cleanBarcode, lookupPromise);
  return lookupPromise;
}

/**
 * Recalculates a ToxicityReport when the user edits the ingredients list or product name
 */
export function recalculateToxicityReport(
  productName: string,
  ingredients: string[],
  originalReport?: ToxicityReport | null
): ToxicityReport {
  const cleanName = productName.trim() || 'Custom Product';
  const cleanIngredients = ingredients.map((s) => s.trim()).filter(Boolean);
  const ingredientsText = cleanIngredients.join(', ');

  const newReport = analyzeIngredientsAndAdditives(
    cleanName,
    ingredientsText,
    [],
    originalReport?.novaGroup ?? null,
    originalReport?.nutriscoreGrade ?? null
  );

  if (originalReport?.barcode) {
    newReport.barcode = originalReport.barcode;
  }
  newReport.allIngredients = cleanIngredients;

  return newReport;
}
