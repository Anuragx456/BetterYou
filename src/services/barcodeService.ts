import {
  HarmfulAdditive,
  IndianRegulatoryStandard,
  NovaGroup,
  NutriscoreGrade,
  RiskLevel,
  SeverityLevel,
  SupermarketCategory,
  TargetExposure,
  ToxicityReport,
} from '../types';

export class ProductNotFoundError extends Error {
  readonly barcode: string;
  constructor(barcode: string) {
    super(`Product with barcode "${barcode}" was not found in OpenFoodFacts or OpenBeautyFacts databases.`);
    this.name = 'ProductNotFoundError';
    this.barcode = barcode;
  }
}

/**
 * Toxicological database for common supermarket food and chemical additives
 */
const KNOWN_ADDITIVES_DATABASE: Record<string, HarmfulAdditive> = {
  // Food Additives & Flavour Enhancers
  'en:e621': {
    name: 'Monosodium Glutamate (MSG / INS 621)',
    category: 'Flavor Enhancer',
    healthImpact: 'Excitotoxic neurotransmitter stimulant; can trigger migraines and appetite overstimulation.',
    severity: 'moderate',
  },
  'en:e627': {
    name: 'Disodium Guanylate (INS 627)',
    category: 'Flavor Enhancer',
    healthImpact: 'Purine-rich nucleotide flavor booster; metabolized to uric acid, problematic for gout sufferers.',
    severity: 'moderate',
  },
  'en:e631': {
    name: 'Disodium Inosinate (INS 631)',
    category: 'Flavor Enhancer',
    healthImpact: 'Synergistic excitotoxin often paired with MSG to amplify hyper-palatability in junk snacks.',
    severity: 'moderate',
  },
  'en:e635': {
    name: 'Disodium 5-Ribonucleotides (INS 635)',
    category: 'Flavor Enhancer',
    healthImpact: 'Potent taste-receptor agonist linked to skin rashes and pruritus in sensitive individuals.',
    severity: 'moderate',
  },
  'en:e250': {
    name: 'Sodium Nitrite (INS 250)',
    category: 'Preservative / Color Fixative',
    healthImpact: 'Forms carcinogenic nitrosamines in gastric acid; classified as a colorectal carcinogen risk.',
    severity: 'high',
  },
  'en:e150d': {
    name: 'Ammonia Caramel Color (INS 150d)',
    category: 'Artificial Color',
    healthImpact: 'Manufactured with ammonia/sulfites; may contain 4-MEI, a classified potential carcinogen.',
    severity: 'high',
  },
  'en:e951': {
    name: 'Aspartame (INS 951)',
    category: 'Artificial Sweetener',
    healthImpact: 'Classified as possibly carcinogenic (IARC Group 2B); alters gut microbiome diversity.',
    severity: 'high',
  },
  'en:e950': {
    name: 'Acesulfame Potassium (Ace-K / INS 950)',
    category: 'Artificial Sweetener',
    healthImpact: 'Contains methylene chloride traces; can impair metabolic satiety signaling.',
    severity: 'moderate',
  },
  'en:e955': {
    name: 'Sucralose (INS 955)',
    category: 'Artificial Sweetener',
    healthImpact: 'Can alter gut microbiome balance and form chloropropanols when baked at high heat.',
    severity: 'moderate',
  },
  'en:e954': {
    name: 'Sodium Saccharin (INS 954)',
    category: 'Artificial Sweetener',
    healthImpact: 'Synthetic petroleum-derived non-caloric sweetener; linked to gut microbial dysbiosis.',
    severity: 'moderate',
  },
  'en:e171': {
    name: 'Titanium Dioxide (INS 171 / CI 77891)',
    category: 'Whitening Colorant / Pigment',
    healthImpact: 'Banned in EU food; nanoparticles accumulate in tissues with genotoxicity and cell damage concerns.',
    severity: 'high',
  },
  'en:e102': {
    name: 'Tartrazine (Yellow 5 / INS 102)',
    category: 'Artificial Azo Dye',
    healthImpact: 'Azo dye linked to hyperactivity in children, allergic hives, and cellular oxidative stress.',
    severity: 'moderate',
  },
  'en:e110': {
    name: 'Sunset Yellow FCF (Yellow 6 / INS 110)',
    category: 'Artificial Azo Dye',
    healthImpact: 'Petroleum-derived azo dye linked to hyperactivity, immune hypersensitivity, and gut inflammation.',
    severity: 'moderate',
  },
  'en:e129': {
    name: 'Allura Red AC (Red 40 / INS 129)',
    category: 'Artificial Azo Dye',
    healthImpact: 'Synthetic dye that may exacerbate gut inflammation, colitis risk, and childhood behavioral issues.',
    severity: 'high',
  },
  'en:e124': {
    name: 'Ponceau 4R (INS 124)',
    category: 'Artificial Azo Dye',
    healthImpact: 'Red azo colorant restricted in multiple countries due to intolerance and hyperactivity concerns.',
    severity: 'high',
  },
  'en:e133': {
    name: 'Brilliant Blue FCF (Blue 1 / INS 133)',
    category: 'Artificial Color',
    healthImpact: 'Synthetic triarylmethane dye associated with allergic cross-reactions.',
    severity: 'low',
  },
  'en:e407': {
    name: 'Carrageenan (INS 407)',
    category: 'Thickener / Emulsifier',
    healthImpact: 'Can induce intestinal inflammation, mucosal erosion, and leaky gut disruption.',
    severity: 'high',
  },
  'en:e433': {
    name: 'Polysorbate 80 (INS 433)',
    category: 'Synthetic Emulsifier',
    healthImpact: 'Detergent-like action strips mucus barrier of the colon, promoting metabolic inflammation.',
    severity: 'high',
  },
  'en:e466': {
    name: 'Carboxymethylcellulose (CMC / INS 466)',
    category: 'Emulsifier / Stabilizer',
    healthImpact: 'Disrupts gut microbiota homeostasis and increases risk of chronic intestinal inflammation.',
    severity: 'moderate',
  },
  'en:e319': {
    name: 'Tertiary Butylhydroquinone (TBHQ / INS 319)',
    category: 'Synthetic Antioxidant',
    healthImpact: 'Petroleum byproduct linked to cellular oxidative stress, liver enlargement, and immune dysregulation.',
    severity: 'high',
  },
  'en:e320': {
    name: 'Butylated Hydroxyanisole (BHA / INS 320)',
    category: 'Synthetic Preservative',
    healthImpact: 'Anticipated human carcinogen with endocrine-disrupting anti-androgenic effects.',
    severity: 'high',
  },
  'en:e321': {
    name: 'Butylated Hydroxytoluene (BHT / INS 321)',
    category: 'Synthetic Preservative',
    healthImpact: 'Synthetic stabilizer associated with liver enzyme changes and endocrine disruption.',
    severity: 'moderate',
  },
  'en:e211': {
    name: 'Sodium Benzoate (INS 211)',
    category: 'Preservative',
    healthImpact: 'Can combine with Vitamin C (ascorbic acid) to form carcinogenic benzene; mitochondrial irritant.',
    severity: 'high',
  },
  'en:e202': {
    name: 'Potassium Sorbate (INS 202)',
    category: 'Preservative',
    healthImpact: 'Synthetic antimicrobial preservative; low acute toxicity but mild mucous membrane irritant.',
    severity: 'low',
  },
  'en:e218': {
    name: 'Methylparaben (INS 218)',
    category: 'Endocrine Disrupting Preservative',
    healthImpact: 'Mimics estrogen in human tissue; linked to reproductive toxicity and cellular disruption.',
    severity: 'high',
  },
  'en:e216': {
    name: 'Propylparaben (INS 216)',
    category: 'Endocrine Disrupting Preservative',
    healthImpact: 'Strong estrogenic activity; banned in EU food and strictly regulated in cosmetics.',
    severity: 'high',
  },
  'en:e1520': {
    name: 'Propylene Glycol (INS 1520)',
    category: 'Humectant / Solvent',
    healthImpact: 'Petroleum-derived carrier; can act as a penetration enhancer carrying allergens through the skin barrier.',
    severity: 'low',
  },
};

/**
 * Comprehensive chemical & additive keywords covering Indian supermarket goods:
 * Foods, Personal Care, Hair Oils, Oral Care, Household Cleaning, Pest Control, Baby Care, Ayurveda & OTC.
 */
const HARMFUL_TEXT_KEYWORDS: {
  keyword: RegExp;
  name: string;
  category: string;
  healthImpact: string;
  severity: SeverityLevel;
}[] = [
  // 1. Indian Food & Packaged Groceries
  {
    keyword: /high[\s-]fructose[\s-]corn[\s-]syrup|liquid[\s-]glucose|invert[\s-]sugar[\s-]syrup/i,
    name: 'High Fructose Corn Syrup / Liquid Glucose',
    category: 'Industrial Refined Sweetener',
    healthImpact: 'Rapidly metabolized by the liver into visceral fat; primary driver of non-alcoholic fatty liver disease (NAFLD).',
    severity: 'high',
  },
  {
    keyword: /palm\s*(?:olein|oil|kernel)|refined\s*palmolein/i,
    name: 'Refined Palm Olein / Palm Oil',
    category: 'Industrial Frying Oil',
    healthImpact: 'Refined at high temperatures generating mutagenic glycidyl esters; heavy saturated palmitic acid content.',
    severity: 'moderate',
  },
  {
    keyword: /hydrogenated|trans[\s-]fat|vanaspati|dalda/i,
    name: 'Hydrogenated Vegetable Fat (Vanaspati / Trans Fat)',
    category: 'Industrial Trans Fat',
    healthImpact: 'Significantly raises atherogenic LDL cholesterol while depleting protective HDL; major cardiovascular risk.',
    severity: 'high',
  },
  {
    keyword: /monosodium\s*glutamate|ins\s*621|msg\b|flavour\s*enhancer\s*\(?621\)?/i,
    name: 'Monosodium Glutamate (MSG / INS 621)',
    category: 'Flavor Enhancer',
    healthImpact: 'Excitotoxic neurotransmitter stimulant; can trigger migraines and appetite overstimulation.',
    severity: 'moderate',
  },
  {
    keyword: /ins\s*627|ins\s*631|ins\s*635|disodium\s*inosinate|disodium\s*guanylate/i,
    name: 'Nucleotide Flavor Boosters (INS 627 / 631 / 635)',
    category: 'Synthetic Flavor Enhancer',
    healthImpact: 'Artificial savory agonists used to mask low-grade processed ingredients and trigger hedonic eating.',
    severity: 'moderate',
  },
  {
    keyword: /tbhq|tertiary\s*butylhydroquinone|ins\s*319/i,
    name: 'Tertiary Butylhydroquinone (TBHQ / INS 319)',
    category: 'Petroleum Antioxidant',
    healthImpact: 'Petroleum byproduct linked to cellular oxidative stress, liver enlargement, and immune dysregulation.',
    severity: 'high',
  },
  {
    keyword: /\b(?:bha|bht)\b|butylated\s*hydroxyanisole|butylated\s*hydroxytoluene|ins\s*320|ins\s*321/i,
    name: 'BHA / BHT (INS 320 / 321)',
    category: 'Synthetic Preservative',
    healthImpact: 'Suspected endocrine disruptor with anti-androgenic activity and cellular toxicity.',
    severity: 'high',
  },
  {
    keyword: /ammonia\s*caramel|caramel\s*(?:iv|color\s*iv|color\s*e150d|ins\s*150d)/i,
    name: 'Ammonia Caramel Color (INS 150d)',
    category: 'Artificial Color',
    healthImpact: 'Manufactured with ammonia/sulfites; may contain 4-MEI, a classified potential carcinogen.',
    severity: 'high',
  },
  {
    keyword: /tartrazine|ins\s*102|yellow\s*5/i,
    name: 'Tartrazine (Yellow 5 / INS 102)',
    category: 'Artificial Azo Dye',
    healthImpact: 'Petroleum-derived azo dye linked to hyperactivity in children and hypersensitivity reactions.',
    severity: 'moderate',
  },
  {
    keyword: /sunset\s*yellow|ins\s*110|yellow\s*6/i,
    name: 'Sunset Yellow FCF (Yellow 6 / INS 110)',
    category: 'Artificial Azo Dye',
    healthImpact: 'Synthetic dye that may exacerbate gut inflammation and allergic hives.',
    severity: 'moderate',
  },
  {
    keyword: /allura\s*red|ins\s*129|red\s*40|ponceau\s*4r|ins\s*124/i,
    name: 'Synthetic Red Dye (Red 40 / Ponceau 4R)',
    category: 'Artificial Azo Dye',
    healthImpact: 'Azo dye linked to intestinal mucosal irritation and hyperactivity in children.',
    severity: 'high',
  },
  {
    keyword: /sodium\s*benzoate|ins\s*211/i,
    name: 'Sodium Benzoate (INS 211)',
    category: 'Synthetic Preservative',
    healthImpact: 'Can combine with Vitamin C (ascorbic acid) to form carcinogenic benzene in liquid solutions.',
    severity: 'high',
  },
  {
    keyword: /aspartame|acesulfame|sucralose|saccharin|ins\s*950|ins\s*951|ins\s*954|ins\s*955/i,
    name: 'Artificial Non-Nutritive Sweeteners',
    category: 'Synthetic Sweetener',
    healthImpact: 'Disrupts healthy gut microbiome diversity and alters metabolic insulin sensitivity.',
    severity: 'moderate',
  },

  // 2. Hair Care & Hair Oils (Major Indian Supermarket Trap)
  {
    keyword: /mineral\s*oil|light\s*liquid\s*paraffin|paraffinum\s*liquidum|llp\b/i,
    name: 'Light Liquid Paraffin (Mineral Oil / LLP)',
    category: 'Petroleum Filler Oil',
    healthImpact: 'Cheap crude oil distillate that forms an occlusive barrier on the scalp, clogging follicles with zero biological nutrients.',
    severity: 'moderate',
  },
  {
    keyword: /dimethicone|cyclopentasiloxane|amodimethicone|cyclomethicone/i,
    name: 'Insoluble Silicones (Dimethicone / Cyclopentasiloxane)',
    category: 'Synthetic Conditioning Polymer',
    healthImpact: 'Hydrophobic silicone coating that suffocates hair cuticle over time and requires harsh sulfates to remove.',
    severity: 'low',
  },
  {
    keyword: /p-phenylenediamine|para-phenylenediamine|\bppd\b|resorcinol/i,
    name: 'p-Phenylenediamine (PPD) & Resorcinol',
    category: 'Oxidative Hair Dye Coupler',
    healthImpact: 'High-concern contact allergen and potential mutagen; linked to severe facial dermatitis and endocrine disruption.',
    severity: 'high',
  },

  // 3. Personal Care, Soaps & Skincare
  {
    keyword: /sodium\s*lauryl\s*sulfate|\bsls\b/i,
    name: 'Sodium Lauryl Sulfate (SLS)',
    category: 'Harsh Anionic Surfactant',
    healthImpact: 'Strips the protective skin barrier and lipid layer; primary cause of recurrent canker sores in toothpastes.',
    severity: 'moderate',
  },
  {
    keyword: /sodium\s*laureth\s*sulfate|\bsles\b/i,
    name: 'Sodium Laureth Sulfate (SLES)',
    category: 'Ethoxylated Surfactant',
    healthImpact: 'Manufactured via ethoxylation, creating potential trace contamination of carcinogenic 1,4-dioxane.',
    severity: 'low',
  },
  {
    keyword: /methylparaben|propylparaben|butylparaben|ethylparaben|isobutylparaben/i,
    name: 'Parabens (Endocrine Disruptors)',
    category: 'Synthetic Preservative',
    healthImpact: 'Xenoestrogens that bind to human estrogen receptors; detected in human breast tissue and linked to hormonal imbalance.',
    severity: 'high',
  },
  {
    keyword: /triclosan|triclocarban/i,
    name: 'Triclosan / Triclocarban',
    category: 'Antibacterial Agent',
    healthImpact: 'Endocrine disruptor affecting thyroid metabolism and promoting antimicrobial-resistant superbugs.',
    severity: 'high',
  },
  {
    keyword: /hydroquinone/i,
    name: 'Hydroquinone',
    category: 'Depigmenting Chemical',
    healthImpact: 'Cytotoxic melanocyte inhibitor; banned in OTC cosmetics globally due to exogenous ochronosis and carcinogenicity concerns.',
    severity: 'high',
  },
  {
    keyword: /dmdm\s*hydantoin|diazolidinyl\s*urea|imidazolidinyl\s*urea|quaternium-15/i,
    name: 'Formaldehyde Releasing Preservatives',
    category: 'Formaldehyde Donor',
    healthImpact: 'Slowly releases toxic formaldehyde into cosmetic emulsions; recognized human carcinogen and severe sensitizer.',
    severity: 'high',
  },
  {
    keyword: /methylchloroisothiazolinone|methylisothiazolinone|\bmci\b|\bmi\b/i,
    name: 'MCI / MI (Isothiazolinones)',
    category: 'Biocidal Preservative',
    healthImpact: 'Extreme contact allergen causing chemical burns and severe contact dermatitis; banned in leave-on EU cosmetics.',
    severity: 'high',
  },
  {
    keyword: /aluminium\s*chlorohydrate|aluminium\s*zirconium/i,
    name: 'Aluminium Chlorohydrate',
    category: 'Antiperspirant Pore Blocker',
    healthImpact: 'Physically precipitates in sweat ducts; potential neurotoxin with concerns regarding bioaccumulation.',
    severity: 'moderate',
  },
  {
    keyword: /diethyl\s*phthalate|\bdep\b|phthalate/i,
    name: 'Phthalates (DEP / Diethyl Phthalate)',
    category: 'Plasticizer & Fragrance Fixative',
    healthImpact: 'Anti-androgenic plasticizer used in Indian perfumes and incense; impairs reproductive hormone regulation.',
    severity: 'high',
  },

  // 4. Household Cleaning & Laundry
  {
    keyword: /linear\s*alkylbenzene\s*sulfon|alkylbenzene\s*sulfonate|\blabs\b|\blas\b/i,
    name: 'Linear Alkylbenzene Sulfonate (LABS / LAS)',
    category: 'Industrial Detergent Surfactant',
    healthImpact: 'Caustic surfactant that causes contact dermatitis on hands and is persistent and toxic to aquatic ecosystems.',
    severity: 'moderate',
  },
  {
    keyword: /sodium\s*hypochlorite|chlorine\s*bleach/i,
    name: 'Sodium Hypochlorite (Chlorine Bleach)',
    category: 'Corrosive Oxidizing Biocide',
    healthImpact: 'Releases irritating chlorine vapors that damage airway epithelial cells; corrosive to skin and eyes.',
    severity: 'high',
  },
  {
    keyword: /hydrochloric\s*acid|muriatic\s*acid/i,
    name: 'Hydrochloric Acid (HCl ~10.5%)',
    category: 'Corrosive Mineral Acid',
    healthImpact: 'Releases choking acidic fumes that trigger bronchospasm and pulmonary irritation; severely corrosive.',
    severity: 'high',
  },
  {
    keyword: /benzalkonium\s*chloride|quaternary\s*ammonium|\bbkc\b/i,
    name: 'Benzalkonium Chloride (BKC / Quat)',
    category: 'Quaternary Disinfectant Surfactant',
    healthImpact: 'Known cause of occupational asthma; acute respiratory irritant and highly toxic to household pets (especially cats).',
    severity: 'high',
  },

  // 5. Pest Control & Mosquito Repellents
  {
    keyword: /transfluthrin/i,
    name: 'Transfluthrin (0.88% w/w)',
    category: 'Synthetic Pyrethroid Neurotoxin',
    healthImpact: 'Volatile insect neurotoxin vaporized into bedroom air; chronic inhalation triggers morning headaches, lethargy, and airway irritation.',
    severity: 'high',
  },
  {
    keyword: /prallethrin/i,
    name: 'Prallethrin',
    category: 'Synthetic Pyrethroid Insecticide',
    healthImpact: 'Voltage-gated sodium channel disruptor; prolonged inhalation in enclosed rooms causes dizziness and nausea.',
    severity: 'high',
  },
  {
    keyword: /cypermethrin|deltamethrin|permethrin/i,
    name: 'Agricultural / Domestic Pyrethroids',
    category: 'Broad-Spectrum Insecticide',
    healthImpact: 'Neurotoxic insecticide with aquatic toxicity; can trigger skin paresthesia and respiratory distress.',
    severity: 'high',
  },
  {
    keyword: /deet\b|diethyltoluamide|n,n-diethyl/i,
    name: 'DEET (N,N-Diethyl-meta-toluamide)',
    category: 'Chemical Insect Repellent',
    healthImpact: 'Penetrates human skin into blood circulation; high concentrations can cause skin blistering and neurotoxic side effects.',
    severity: 'moderate',
  },
  {
    keyword: /paradichlorobenzene|\bpdcb\b/i,
    name: 'Paradichlorobenzene (PDCB)',
    category: 'Volatile Fumigant',
    healthImpact: 'Used in mothballs and urinal/bathroom blocks; classified animal carcinogen linked to liver and kidney toxicity.',
    severity: 'high',
  },
  {
    keyword: /deodorized\s*kerosene|petroleum\s*distillate/i,
    name: 'Deodorized Kerosene Solvent Base',
    category: 'Petroleum Hydrocarbon Solvent',
    healthImpact: 'Aerosolized petroleum hydrocarbons that irritate respiratory mucous membranes and lungs.',
    severity: 'moderate',
  },

  // 6. Baby Care
  {
    keyword: /talc\b|hydrated\s*magnesium\s*silicate/i,
    name: 'Talc (Hydrated Magnesium Silicate)',
    category: 'Mineral Dust / Absorbent',
    healthImpact: 'Fine particulate dust that causes infant pulmonary inflammation (talcosis); historical asbestos contamination risks.',
    severity: 'high',
  },
  {
    keyword: /phenoxyethanol/i,
    name: 'Phenoxyethanol',
    category: 'Glycol Ether Preservative',
    healthImpact: 'Infant exposure can suppress the central nervous system; restricted in baby wipes in France/EU.',
    severity: 'moderate',
  },

  // 7. Ayurveda & OTC Formulations
  {
    keyword: /sodium\s*methylparaben|sodium\s*propylparaben/i,
    name: 'Sodium Methylparaben (Preservative in Ayurvedic Tonics)',
    category: 'Chemical Preservative in Herbal Medicine',
    healthImpact: 'Synthetic chemical preservative added to shelf-stable Ayurvedic syrups, counteracting holistic purity claims.',
    severity: 'high',
  },
  {
    keyword: /camphor|kapur\b/i,
    name: 'Camphor (High Concentration)',
    category: 'Topical Terpenoid Counter-Irritant',
    healthImpact: 'Readily absorbed through skin; toxic if accidentally ingested, causing rapid seizures and neurotoxicity in infants.',
    severity: 'moderate',
  },
  {
    keyword: /methyl\s*salicylate|wintergreen\s*oil/i,
    name: 'Methyl Salicylate',
    category: 'Topical Analgesic Ester',
    healthImpact: 'Rapid dermal absorption; over-application over large skin areas can cause systemic salicylate toxicity.',
    severity: 'moderate',
  },
];

/**
 * OpenFoodFacts & OpenBeautyFacts JSON shape
 */
interface OpenFactsProductResponse {
  status: number;
  status_verbose?: string;
  product?: {
    product_name?: string;
    product_name_en?: string;
    product_name_hi?: string;
    ingredients_text?: string;
    ingredients_text_en?: string;
    nutriscore_grade?: string;
    nova_group?: number;
    additives_tags?: string[];
    categories?: string;
  };
}

/**
 * Infer Indian Supermarket category from product metadata
 */
export function detectSupermarketCategory(productName: string, ingredientsText: string): SupermarketCategory {
  const combined = `${productName} ${ingredientsText}`.toLowerCase();

  if (
    /transfluthrin|prallethrin|mosquito|vaporizer|all[\s-]out|good[\s-]knight|baygon|hit\b|coil|insecticide|pest|pyrethroid|deet|odonil|paradichlorobenzene/i.test(
      combined
    )
  ) {
    return 'Pest Control';
  }

  if (
    /hair[\s-]oil|shampoo|conditioner|hair[\s-]color|hair[\s-]dye|liquid[\s-]paraffin|mineral\s*oil|amla\s*oil|almond\s*drops|parachute|keo[\s-]karpin|scalp|serum/i.test(
      combined
    )
  ) {
    return 'Hair Care';
  }

  if (
    /toothpaste|dentifrice|oral[\s-]care|mouthwash|toothpowder|colgate|pepsodent|sensodyne|close[\s-]up|dant[\s-]kanti|dabur[\s-]red/i.test(
      combined
    )
  ) {
    return 'Oral Care';
  }

  if (
    /detergent|floor[\s-]cleaner|disinfectant|surface[\s-]cleaner|dishwash|toilet[\s-]cleaner|harpic|lizol|vim\b|surf[\s-]excel|ariel|tide|bleach|hypochlorite|colin|pril|wheel/i.test(
      combined
    )
  ) {
    return 'Household & Cleaning';
  }

  if (
    /baby[\s-]powder|baby[\s-]soap|baby[\s-]oil|baby[\s-]wash|baby[\s-]wipes|diaper|baby[\s-]lotion|cerelac|johnson.*baby|himalaya.*baby/i.test(
      combined
    )
  ) {
    return 'Baby Care';
  }

  if (
    /chyawanprash|ayurvedic|balm|amrutanjan|vicks|moov|pain[\s-]relief|iodex|bhasma|churna|herbal[\s-]supplement|ayush|zandu|baidyanath/i.test(
      combined
    )
  ) {
    return 'Ayurveda & OTC';
  }

  if (
    /face[\s-]wash|soap|body[\s-]wash|fairness|glow[\s-]&[\s-]lovely|sunscreen|cream|lotion|moisturizer|dettol|lifebuoy|dove|lux|cinthol|paraben|skin/i.test(
      combined
    )
  ) {
    return 'Personal Care & Skincare';
  }

  return 'Food & Beverages';
}

/**
 * Generate context-aware Indian Supermarket warning alerts
 */
export function getIndianMarketAlert(
  category: SupermarketCategory,
  harmfulAdditives: HarmfulAdditive[],
  ingredientsText: string
): string | null {
  const text = ingredientsText.toLowerCase();

  if (category === 'Hair Care' && /mineral\s*oil|light\s*liquid\s*paraffin|paraffinum\s*liquidum|llp/i.test(text)) {
    return 'Indian Supermarket Trap: Contains 75-85% Light Liquid Paraffin (mineral oil). Genuine plant/herbal oil constitutes less than 2-3% of the bottle.';
  }

  if (category === 'Pest Control' && /transfluthrin|prallethrin/i.test(text)) {
    return 'Indoor Air Warning: Vaporizing synthetic pyrethroids (Transfluthrin) continuously overnight in closed bedrooms causes respiratory airway inflammation and morning migraines.';
  }

  if (category === 'Household & Cleaning' && /benzalkonium\s*chloride|quaternary|bkc/i.test(text)) {
    return 'Pet & Toddler Warning: Contains Benzalkonium Chloride (Quat). Toxic to household cats (who lick paws) and irritates crawling infants.';
  }

  if (category === 'Oral Care' && /sodium\s*lauryl\s*sulfate|sls/i.test(text)) {
    return 'Oral Mucosa Alert: Formulated with Sodium Lauryl Sulfate (SLS), a harsh foaming detergent known to strip protective buccal tissue and trigger canker sores.';
  }

  if (category === 'Baby Care' && /talc\b|magnesium\s*silicate/i.test(text)) {
    return 'Pediatric Safety Notice: Talc-based powders carry respiratory inhalation hazards for infant lungs; Indian pediatricians advise cornstarch-based alternatives.';
  }

  if (category === 'Ayurveda & OTC' && /methylparaben|propylparaben/i.test(text)) {
    return 'Hidden Additive Alert: Marketed as traditional Ayurvedic formulation, yet preserved using synthetic sodium methylparaben and high sucrose syrup.';
  }

  if (category === 'Food & Beverages' && /palm\s*(?:olein|oil)|tbhq/i.test(text)) {
    return 'Snack Aisle Alert: Deep-fried in high-heat Refined Palm Olein stabilized with TBHQ petroleum preservative.';
  }

  if (harmfulAdditives.some((a) => a.severity === 'high')) {
    return 'Caution: Contains flagged chemicals restricted or under investigation by global consumer safety agencies.';
  }

  return null;
}

/**
 * Determine regulatory body and target exposure based on category
 */
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
    default:
      return { regulatoryStandard: 'BIS', targetExposure: 'General' };
  }
}

/**
 * Compute positive "Safe For" certification tags
 */
function computeSafeForTags(
  category: SupermarketCategory,
  score: number,
  harmfulAdditives: HarmfulAdditive[],
  hasInsufficientData: boolean = false
): string[] {
  if (hasInsufficientData) {
    return ['Unverified Ingredients'];
  }

  const tags: string[] = [];
  const harmfulNames = harmfulAdditives.map((a) => a.name.toLowerCase()).join(' ');

  if (!harmfulNames.includes('paraben')) {
    tags.push('No Flagged Parabens');
  }
  if (!harmfulNames.includes('sulfate') && !harmfulNames.includes('sls')) {
    tags.push('Sulfate-Free');
  }
  if (!harmfulNames.includes('mineral oil') && !harmfulNames.includes('paraffin')) {
    tags.push('Zero Mineral Oil');
  }
  // Only claim Palm Oil-Free on Food & Beverage items where palm oil is an industrial shortcut
  if (category === 'Food & Beverages' && !harmfulNames.includes('palm')) {
    tags.push('Palm Oil-Free');
  }
  if (category === 'Household & Cleaning' && !harmfulNames.includes('benzalkonium')) {
    tags.push('Pet Friendly');
  }
  if (category === 'Baby Care' && !harmfulNames.includes('talc')) {
    tags.push('Talc-Free');
  }
  // Factual claim instead of unearned third-party "Certified"
  if (score >= 71) {
    tags.unshift('No Flagged Additives');
  }

  return tags.slice(0, 4);
}

/**
 * Analyzes raw ingredient text and OpenFacts additive tags
 */
export function analyzeIngredientsAndAdditives(
  productName: string,
  ingredientsText: string,
  additivesTags: string[],
  novaGroup: NovaGroup | null,
  nutriscoreGrade: NutriscoreGrade | null
): ToxicityReport {
  const harmfulMap = new Map<string, HarmfulAdditive>();

  // 1. Check known additive tags
  for (const tag of additivesTags) {
    const cleanTag = tag.toLowerCase().trim();
    const known = KNOWN_ADDITIVES_DATABASE[cleanTag];
    if (known) {
      harmfulMap.set(known.name, known);
    }
  }

  // 2. Check text keywords
  for (const item of HARMFUL_TEXT_KEYWORDS) {
    if (item.keyword.test(ingredientsText)) {
      if (!harmfulMap.has(item.name)) {
        harmfulMap.set(item.name, {
          name: item.name,
          category: item.category,
          healthImpact: item.healthImpact,
          severity: item.severity,
        });
      }
    }
  }

  const harmfulIngredients = Array.from(harmfulMap.values());
  const category = detectSupermarketCategory(productName, ingredientsText);
  const { regulatoryStandard, targetExposure } = getCategoryRegulatoryDetails(category);

  // 3. Check for empty or insufficient ingredient data
  const trimmedIngredients = ingredientsText ? ingredientsText.trim() : '';
  const hasInsufficientData = trimmedIngredients.length < 5 && additivesTags.length === 0;

  // 4. Compute Safety Score (0-100)
  let score = 100;

  if (hasInsufficientData) {
    // Crucial safety guard: If database or OCR has 0 ingredients, NEVER mark as 100/100 Safe!
    score = 50;
  } else {
    // Food specific deductions
    if (category === 'Food & Beverages') {
      if (novaGroup === 4) score -= 30;
      else if (novaGroup === 3) score -= 15;
      else if (novaGroup === 2) score -= 5;

      if (nutriscoreGrade === 'e') score -= 20;
      else if (nutriscoreGrade === 'd') score -= 12;
      else if (nutriscoreGrade === 'c') score -= 6;
    } else {
      // Non-food category base penalty if industrial synthetic base
      if (category === 'Pest Control') score -= 35;
      if (category === 'Household & Cleaning') score -= 20;
    }

    // Additives penalty
    for (const additive of harmfulIngredients) {
      if (additive.severity === 'high') score -= 18;
      else if (additive.severity === 'moderate') score -= 9;
      else score -= 4;
    }
  }

  const clampedScore = hasInsufficientData ? 50 : Math.max(5, Math.min(100, score));

  // Determine risk level
  let riskLevel: RiskLevel = 'Safe';
  if (hasInsufficientData) {
    riskLevel = 'Moderate';
  } else if (clampedScore < 40) {
    riskLevel = 'High Risk';
  } else if (clampedScore < 71) {
    riskLevel = 'Moderate';
  }

  // Hazard Rating for non-food items
  const hazardRating = hasInsufficientData
    ? 'Moderate Hazard'
    : clampedScore >= 71
    ? 'Low Hazard'
    : clampedScore >= 40
    ? 'Moderate Hazard'
    : 'High Hazard';

  // Indian Market Alert
  const indianMarketAlert = hasInsufficientData
    ? 'Data Notice: Ingredient text was not found in registry. Please photograph or type ingredients to verify packaging.'
    : getIndianMarketAlert(category, harmfulIngredients, ingredientsText);

  // Clean Summary
  let cleanSummary = '';
  if (hasInsufficientData) {
    cleanSummary = `${productName || 'This product'} has insufficient ingredient data recorded. Safety cannot be verified until ingredients are inspected.`;
  } else if (riskLevel === 'Safe') {
    cleanSummary = `${productName || 'This product'} shows a clean toxicological profile with minimal processing and no high-risk chemicals detected.`;
  } else if (riskLevel === 'Moderate') {
    cleanSummary = `${productName || 'This product'} contains ${harmfulIngredients.length} flagged chemicals or industrial additives. Exercise caution with daily exposure.`;
  } else {
    cleanSummary = `${productName || 'This product'} contains ${harmfulIngredients.length} high-concern chemicals, endocrine disruptors, or industrial toxins. Prolonged or chronic exposure is not recommended.`;
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
    allIngredients: ingredientsText ? ingredientsText.split(/[,;]\s*/).map((s) => s.trim()) : [],
  };
}

/**
 * Recomputes safety score, risk level, and safe-for tags when harmful additives
 * are added or modified (e.g. after Gemini multimodal vision merges new additives).
 */
export function recomputeReportScoreAndRisk(report: ToxicityReport): ToxicityReport {
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

  for (const additive of report.harmfulIngredients) {
    if (additive.severity === 'high') score -= 18;
    else if (additive.severity === 'moderate') score -= 9;
    else score -= 4;
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
  };
}

/**
 * Comprehensive authentic Indian Supermarket offline catalog
 */
const INDIAN_SUPERMARKET_PRESETS: Record<string, ToxicityReport> = {
  // Kurkure Masala Munch (Food)
  '8901030383749': {
    productName: 'Kurkure Masala Munch (Packaged Namkeen)',
    barcode: '8901030383749',
    category: 'Food & Beverages',
    overallSafetyScore: 32,
    riskLevel: 'High Risk',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 4,
    nutriscoreGrade: 'e',
    indianMarketAlert: 'Snack Aisle Alert: Deep-fried in high-heat Refined Palm Olein stabilized with TBHQ petroleum preservative.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Extensively ultra-processed snack with multiple synthetic flavor enhancers (MSG, INS 627, 631) and industrial frying palm olein.',
    harmfulIngredients: [
      {
        name: 'Monosodium Glutamate (MSG / INS 621)',
        category: 'Flavor Enhancer',
        healthImpact: 'Excitotoxic neurotransmitter stimulant; may trigger migraines and appetite overstimulation.',
        severity: 'moderate',
      },
      {
        name: 'Tertiary Butylhydroquinone (TBHQ / INS 319)',
        category: 'Synthetic Antioxidant',
        healthImpact: 'Petroleum byproduct linked to cellular oxidative stress and immune dysregulation.',
        severity: 'high',
      },
      {
        name: 'Refined Palm Olein',
        category: 'Industrial Oil',
        healthImpact: 'Refined under high heat generating toxic glycidyl esters; heavy saturated palmitic acid content.',
        severity: 'moderate',
      },
      {
        name: 'Disodium 5-Ribonucleotides (INS 635)',
        category: 'Synthetic Flavor Enhancer',
        healthImpact: 'Potent taste-receptor agonist linked to skin irritation and hyper-palatable binge cycles.',
        severity: 'moderate',
      },
    ],
    allIngredients: ['Rice Meal', 'Edible Vegetable Oil (Palmolein)', 'Corn Meal', 'Gram Meal', 'Spices & Condiments', 'Salt', 'INS 621', 'INS 627', 'INS 631', 'INS 319'],
  },

  // Maggi 2-Minute Noodles (Food)
  '8901030005702': {
    productName: 'Maggi 2-Minute Masala Instant Noodles',
    barcode: '8901030005702',
    category: 'Food & Beverages',
    overallSafetyScore: 38,
    riskLevel: 'High Risk',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 4,
    nutriscoreGrade: 'd',
    indianMarketAlert: 'High Glycemic Load: High refined wheat maida base combined with palm oil frying and hidden nucleotide flavor boosters.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Ultra-processed instant noodles formulated with refined wheat flour (maida), refined palm oil, and nucleotide enhancers.',
    harmfulIngredients: [
      {
        name: 'Refined Palm Oil',
        category: 'Industrial Oil',
        healthImpact: 'Dense in saturated palmitic acid and prone to oxidative rancidity compounds.',
        severity: 'moderate',
      },
      {
        name: 'Disodium 5-Ribonucleotides (INS 635)',
        category: 'Synthetic Flavor Enhancer',
        healthImpact: 'Artificial savory enhancer designed to induce hyper-palatable cravings.',
        severity: 'moderate',
      },
      {
        name: 'Ammonia Caramel Color (INS 150d)',
        category: 'Artificial Color',
        healthImpact: 'Contains 4-MEI chemical residue from ammonia-caramelization.',
        severity: 'high',
      },
    ],
    allIngredients: ['Refined Wheat Flour (Maida)', 'Palm Oil', 'Iodised Salt', 'Hydrolysed Peanut Protein', 'Spices & Condiments', 'Flavor Enhancer 635', 'Caramel 150d'],
  },

  // Haldiram's Aloo Bhujia (Food)
  '8901725181222': {
    productName: "Haldiram's Nagpur Aloo Bhujia",
    barcode: '8901725181222',
    category: 'Food & Beverages',
    overallSafetyScore: 36,
    riskLevel: 'High Risk',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 4,
    nutriscoreGrade: 'e',
    indianMarketAlert: 'High Saturated Fat: Contains over 35g fat per 100g from deep frying in refined cottonseed and palm olein oils with TBHQ.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Deep-fried savory snack high in saturated lipids, refined palmolein, and chemical preservatives.',
    harmfulIngredients: [
      {
        name: 'Tertiary Butylhydroquinone (TBHQ / INS 319)',
        category: 'Petroleum Antioxidant',
        healthImpact: 'Petroleum-derived preservative linked to cellular oxidative stress.',
        severity: 'high',
      },
      {
        name: 'Refined Palm Olein',
        category: 'Industrial Oil',
        healthImpact: 'Rich in atherogenic saturated palmitic acid and lipid oxidation products.',
        severity: 'moderate',
      },
    ],
    allIngredients: ['Potatoes', 'Edible Vegetable Oil (Palmolein & Cottonseed)', 'Gram Pulse Flour', 'Tepary Beans Flour', 'Spices & Condiments', 'Salt', 'INS 319'],
  },




  // Glow & Lovely Advanced Multi-Vitamin Cream (Personal Care)
  '8901030825317': {
    productName: 'Glow & Lovely Advanced Multi-Vitamin Cream',
    barcode: '8901030825317',
    category: 'Personal Care & Skincare',
    overallSafetyScore: 35,
    riskLevel: 'High Risk',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Dermal Absorption',
    hazardRating: 'High Hazard',
    indianMarketAlert: 'Endocrine Disruption Warning: Formulated with both Methylparaben and Propylparaben, alongside Titanium Dioxide nanoparticles for an artificial whitening mask.',
    safeFor: ['Sulfate-Free'],
    cleanSummary: 'Contains multiple xenoestrogenic parabens, synthetic BHT, and mineral whitening pigments that coat facial pores.',
    harmfulIngredients: [
      {
        name: 'Methylparaben & Propylparaben',
        category: 'Endocrine Disrupting Preservative',
        healthImpact: 'Mimics estrogen in human tissue; linked to reproductive toxicity and cellular disruption.',
        severity: 'high',
      },
      {
        name: 'Titanium Dioxide (CI 77891)',
        category: 'Whitening Nanoparticle Pigment',
        healthImpact: 'Creates an artificial white cast; nanoparticles can generate reactive oxygen species under sunlight.',
        severity: 'high',
      },
      {
        name: 'Butylated Hydroxytoluene (BHT)',
        category: 'Synthetic Preservative',
        healthImpact: 'Synthetic antioxidant linked in toxicology reports to cellular and endocrine toxicity.',
        severity: 'moderate',
      },
    ],
    allIngredients: ['Water', 'Palmitic Acid', 'Niacinamide', 'Glycerin', 'Titanium Dioxide', 'Methylparaben', 'Propylparaben', 'BHT', 'Perfume'],
  },

  // Dettol Original Antiseptic Bathing Soap (Personal Care)
  '8901030584504': {
    productName: 'Dettol Original Germ Protection Bathing Soap',
    barcode: '8901030584504',
    category: 'Personal Care & Skincare',
    overallSafetyScore: 48,
    riskLevel: 'Moderate',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Dermal Absorption',
    hazardRating: 'Moderate Hazard',
    indianMarketAlert: 'Skin Barrier Alert: Strong chemical biocides (Chloroxylenol) strip the skin microbiome of beneficial protective bacteria.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Potent antimicrobial soap containing Chloroxylenol, synthetic BHT stabilizer, and industrial chelating agents.',
    harmfulIngredients: [
      {
        name: 'Chloroxylenol (PCMX)',
        category: 'Antimicrobial Chemical',
        healthImpact: 'Broad-spectrum phenolic biocide that disrupts natural dermal microbiome biodiversity and can induce dermatitis.',
        severity: 'moderate',
      },
      {
        name: 'Butylated Hydroxytoluene (BHT)',
        category: 'Synthetic Preservative',
        healthImpact: 'Petroleum-derived stabilizer associated with contact allergy and cellular irritation.',
        severity: 'moderate',
      },
      {
        name: 'Tetrasodium EDTA',
        category: 'Chelating Agent',
        healthImpact: 'Penetration enhancer that alters cellular membrane permeability to environmental toxins.',
        severity: 'low',
      },
    ],
    allIngredients: ['Sodium Palmate', 'Sodium Palm Kernelate', 'Aqua', 'Chloroxylenol', 'BHT', 'Tetrasodium EDTA', 'Etidronic Acid', 'CI 11680'],
  },

  // Colgate Strong Teeth Toothpaste (Oral Care)
  '8901314010520': {
    productName: 'Colgate Strong Teeth Amino Shakti Toothpaste',
    barcode: '8901314010520',
    category: 'Oral Care',
    overallSafetyScore: 50,
    riskLevel: 'Moderate',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Mucous Membrane',
    hazardRating: 'Moderate Hazard',
    indianMarketAlert: 'Oral Mucosa Alert: Formulated with Sodium Lauryl Sulfate (SLS), a harsh foaming detergent known to strip protective buccal tissue and trigger canker sores.',
    safeFor: ['Paraben-Free', 'Zero Mineral Oil'],
    cleanSummary: 'Mainstream toothpaste utilizing Sodium Lauryl Sulfate for heavy foam, synthetic sodium saccharin, and titanium dioxide whitener.',
    harmfulIngredients: [
      {
        name: 'Sodium Lauryl Sulfate (SLS)',
        category: 'Harsh Anionic Surfactant',
        healthImpact: 'Strips the protective mucin lining in the mouth; primary trigger for recurrent aphthous stomatitis (canker sores).',
        severity: 'moderate',
      },
      {
        name: 'Sodium Saccharin',
        category: 'Artificial Sweetener',
        healthImpact: 'Synthetic petroleum derivative that can disturb the balance of healthy oral and gut microbiomes.',
        severity: 'moderate',
      },
      {
        name: 'Titanium Dioxide (CI 77891)',
        category: 'Whitening Nanopigment',
        healthImpact: 'Added purely for aesthetic paste whiteness; oral absorption of nanoparticles carries cellular toxicity concerns.',
        severity: 'high',
      },
    ],
    allIngredients: ['Calcium Carbonate', 'Sorbitol', 'Sodium Lauryl Sulfate', 'Silica', 'Titanium Dioxide', 'Sodium Saccharin', 'Sodium Monofluorophosphate'],
  },

  // Good Knight Active+ Liquid Vaporizer (Pest Control)
  '8901023010101': {
    productName: 'Good Knight Active+ Mosquito Liquid Vaporizer',
    barcode: '8901023010101',
    category: 'Pest Control',
    overallSafetyScore: 22,
    riskLevel: 'High Risk',
    regulatoryStandard: 'CIBRC',
    targetExposure: 'Inhalation',
    hazardRating: 'High Hazard',
    indianMarketAlert: 'Indoor Air Warning: Vaporizing synthetic pyrethroids (Transfluthrin) continuously overnight in closed bedrooms causes respiratory airway inflammation and morning migraines.',
    safeFor: ['Paraben-Free'],
    cleanSummary: 'Vaporizes synthetic pyrethroid neurotoxin (Transfluthrin 0.88%) dissolved in deodorized kerosene. Significant chronic bedroom inhalation risk.',
    harmfulIngredients: [
      {
        name: 'Transfluthrin (0.88% w/w)',
        category: 'Synthetic Pyrethroid Neurotoxin',
        healthImpact: 'Voltage-gated sodium channel disruptor; prolonged inhalation during sleep triggers headaches, lethargy, and airway irritation.',
        severity: 'high',
      },
      {
        name: 'Deodorized Kerosene Solvent Base',
        category: 'Petroleum Hydrocarbon Solvent',
        healthImpact: 'Aerosolized petroleum hydrocarbons that irritate respiratory mucous membranes and alveolar tissues.',
        severity: 'moderate',
      },
    ],
    allIngredients: ['Transfluthrin (a.i.) 0.88% w/w', 'Butylated Hydroxytoluene (BHT) 1.0% w/w', 'Deodorized Kerosene (Solvent) 98.12% w/w'],
  },

  // Lizol Disinfectant Floor Cleaner (Household)
  '8901096312456': {
    productName: 'Lizol Disinfectant Surface & Floor Cleaner',
    barcode: '8901096312456',
    category: 'Household & Cleaning',
    overallSafetyScore: 42,
    riskLevel: 'Moderate',
    regulatoryStandard: 'BIS',
    targetExposure: 'General',
    hazardRating: 'Moderate Hazard',
    indianMarketAlert: 'Pet & Toddler Warning: Contains Benzalkonium Chloride (Quat). Toxic to household cats (who lick paws) and irritates crawling infants.',
    safeFor: ['Paraben-Free', 'Bleach-Free'],
    cleanSummary: 'Quaternary ammonium-based floor cleaner effective against bacteria but dangerous for household pets and crawling toddlers.',
    harmfulIngredients: [
      {
        name: 'Benzalkonium Chloride (BKC 80% - 4.0% w/w)',
        category: 'Quaternary Disinfectant Surfactant',
        healthImpact: 'Known cause of occupational asthma; acute respiratory irritant and highly toxic to household pets (especially cats).',
        severity: 'high',
      },
      {
        name: 'Synthetic Citrus Fragrance & Tartrazine',
        category: 'Artificial Fragrance & Color',
        healthImpact: 'Volatile organic compounds (VOCs) that irritate sensitive airways and induce skin allergies upon floor contact.',
        severity: 'moderate',
      },
    ],
    allIngredients: ['Benzalkonium Chloride Solution 4% w/w', 'Fatty Alcohol Ethoxylate', 'Sodium Bicarbonate', 'Tartrazine CI 19140', 'Perfume'],
  },

  // Johnson's Baby Powder (Baby Care)
  '8901030112233': {
    productName: "Johnson's Pure Cornstarch/Talc Baby Powder",
    barcode: '8901030112233',
    category: 'Baby Care',
    overallSafetyScore: 34,
    riskLevel: 'High Risk',
    regulatoryStandard: 'CDSCO',
    targetExposure: 'Dermal Absorption',
    hazardRating: 'High Hazard',
    indianMarketAlert: 'Pediatric Safety Notice: Talc-based powders carry respiratory inhalation hazards for infant lungs; Indian pediatricians advise cornstarch-based alternatives.',
    safeFor: ['Paraben-Free', 'Sulfate-Free'],
    cleanSummary: 'Mineral talc dust base that poses significant pulmonary inhalation risks for infants; associated with chronic respiratory distress.',
    harmfulIngredients: [
      {
        name: 'Talc (Hydrated Magnesium Silicate)',
        category: 'Mineral Dust / Absorbent',
        healthImpact: 'Fine particulate dust that causes infant pulmonary inflammation (talcosis); historical asbestos contamination risks.',
        severity: 'high',
      },
      {
        name: 'Synthetic Fragrance (Parfum)',
        category: 'Artificial Fragrance',
        healthImpact: 'Undisclosed chemical blend that can disrupt sensitive infant dermal barriers and trigger eczema.',
        severity: 'moderate',
      },
    ],
    allIngredients: ['Talc', 'Fragrance'],
  },




  // Organic Cold Pressed Mustard Oil (Pantry Clean)
  '8901500000000': {
    productName: '100% Cold Pressed Pure Mustard Oil (Kachi Ghani)',
    barcode: '8901500000000',
    category: 'Food & Beverages',
    overallSafetyScore: 98,
    riskLevel: 'Safe',
    regulatoryStandard: 'FSSAI',
    targetExposure: 'Ingestion',
    novaGroup: 2,
    nutriscoreGrade: 'a',
    indianMarketAlert: null,
    safeFor: ['Paraben-Free', 'Palm Oil-Free', 'Zero Mineral Oil', 'No Flagged Additives'],
    cleanSummary: 'Single-ingredient, unrefined cold-pressed mustard oil rich in monounsaturated fats and natural antioxidants. Completely unadulterated.',
    harmfulIngredients: [],
    allIngredients: ['100% Pure Cold-Pressed Mustard Oil'],
  },
};

/**
 * In-memory Barcode Cache & In-Flight Request Deduplication Map
 * Guarantees <1ms response and 0 network requests for repeated scans
 */
const barcodeMemoryCache = new Map<string, ToxicityReport>();
const inFlightLookups = new Map<string, Promise<ToxicityReport>>();
const negativeBarcodeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  const queryFields = 'product_name,product_name_en,product_name_hi,ingredients_text,ingredients_text_en,additives_tags,nova_group,nutriscore_grade';
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
          'User-Agent': 'BetterYouApp/1.0 (fitness-nutrition-toxicity; contact@betteryou.app)',
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
      // Negative cache to protect against continuous network request loops
      negativeBarcodeCache.set(cleanBarcode, Date.now());
      // Fallback: If not found in any database, throw ProductNotFoundError so user can snap photo via OCR
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
