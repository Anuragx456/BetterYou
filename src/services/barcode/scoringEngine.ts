import {
  HarmfulAdditive,
  IndianRegulatoryStandard,
  NovaGroup,
  NutriscoreGrade,
  RiskLevel,
  SupermarketCategory,
  TargetExposure,
  ToxicityReport,
} from '../../types';
import {
  parseOrderedIngredientsList,
  matchAdditiveRule,
  getClassCap,
} from '../ingredientNormalizer';
import additiveRulesData from '../../data/additiveRules.v1.json';

/**
 * Supermarket category classifier based on packaging terms and regulatory exposure
 */
export function detectSupermarketCategory(
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

export function getCategoryRegulatoryDetails(category: SupermarketCategory): {
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
export function getIndianMarketAlert(
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
export function computeSafeForTags(
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
  if (originalReport?.generatedBy) {
    newReport.generatedBy = originalReport.generatedBy;
  }
  newReport.allIngredients = cleanIngredients;

  return newReport;
}
