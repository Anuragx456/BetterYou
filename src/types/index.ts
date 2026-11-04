/**
 * Core Type Contracts for BetterYou Application
 * Fitness, Nutrition Vision, and Ingredient Toxicity
 */

export interface MacroBreakdown {
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
}

export interface MealAnalysisResult extends MacroBreakdown {
  dishName: string;
  estimatedWeightGrams: number;
  confidenceScore?: number; // Deprecated trust signal
  isPlausible: boolean; // Thermodynamic macro consistency check (4P + 4C + 9F ~= kcal within 20%)
  plausibilityDeviation?: number; // Percentage deviation from calculated kcal
  plausibilityWarning?: string | null;
  ingredientsDetected: string[];
  generatedBy?: string;
  fallbackToManual?: boolean; // Set if schema validation or parsing failed and manual entry is needed
}

export interface MealLog {
  id: string;
  dishName: string;
  timestamp: string; // ISO 8601 string
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  estimatedWeightGrams: number;
  portionMultiplier: number;
  imageUri?: string;
  ingredientsDetected: string[];
  notes?: string;
  date?: string; // Local YYYY-MM-DD
}

export type RiskLevel = 'Safe' | 'Moderate' | 'High Risk';
export type SeverityLevel = 'low' | 'moderate' | 'high';
export type NovaGroup = 1 | 2 | 3 | 4;
export type NutriscoreGrade = 'a' | 'b' | 'c' | 'd' | 'e';

export type SupermarketCategory =
  | 'Food & Beverages'
  | 'Personal Care & Skincare'
  | 'Hair Care'
  | 'Oral Care'
  | 'Household & Cleaning'
  | 'Pest Control'
  | 'Baby Care'
  | 'Ayurveda & OTC';

export type TargetExposure =
  | 'Ingestion'
  | 'Dermal Absorption'
  | 'Inhalation'
  | 'Mucous Membrane'
  | 'General';

export type IndianRegulatoryStandard =
  | 'FSSAI'
  | 'CDSCO'
  | 'BIS'
  | 'AYUSH'
  | 'CIBRC'
  | 'EWG Verified / Clean';

export interface HarmfulAdditive {
  name: string;
  category: string; // e.g. "Preservative", "Petroleum Filler", "Synthetic Pyrethroid", "Industrial Oil", "Azo Dye"
  healthImpact: string; // 1 concise sentence explaining physiological harm or consumer hazard
  severity: SeverityLevel;
  rationale?: string; // Deep scientific rationale behind the screening flag
  source?: string; // Official regulatory body: EFSA, FSSAI, IARC, CDSCO, WHO, BIS, CIBRC
  sourceUrl?: string; // Direct URL to published scientific standard / monograph
  concentrationRank?: string; // Proxy rank of ingredient order (e.g. "Primary (Rank #1)", "Major (Rank #3)", "Minor Additive")
  deduction?: number; // Exact safety points deducted after class capping & concentration weighting
  additiveClass?: string;
}

export interface IngredientAnalysis {
  name: string;
  isHarmful: boolean;
  category?: string;
  healthImpact?: string;
  severity?: SeverityLevel;
}

export interface ToxicityReport {
  overallSafetyScore: number; // 0 to 100 (0-39 Red/High Risk, 40-70 Amber/Moderate, 71-100 Green/Safe)
  riskLevel: RiskLevel;
  generatedBy?: string; // Vision model identifier that produced this report
  harmfulIngredients: HarmfulAdditive[];
  cleanSummary: string;
  productName?: string;
  barcode?: string;
  category?: SupermarketCategory;
  indianMarketAlert?: string | null; // e.g. "Contains ~80% Light Liquid Paraffin (mineral oil)", "High Transfluthrin indoor inhalation risk"
  regulatoryStandard?: IndianRegulatoryStandard;
  targetExposure?: TargetExposure;
  hazardRating?: 'Low Hazard' | 'Moderate Hazard' | 'High Hazard' | null;
  safeFor?: string[]; // e.g. ["Paraben-Free", "Zero Mineral Oil", "Sulfate-Free", "Pet Safe", "Non-Comedogenic"]
  novaGroup?: NovaGroup | null;
  nutriscoreGrade?: NutriscoreGrade | null;
  allIngredients?: string[];
  hasInsufficientData?: boolean;
}

export interface ScannedProduct {
  id: string;
  barcode?: string;
  productName: string;
  report: ToxicityReport;
  scannedAt: string; // ISO 8601 string
  imageUrl?: string;
  imageUri?: string;
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
  rpe?: number; // 1 - 10
}

export interface ExerciseItem {
  id: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  title: string; // e.g., "Push Day", "Pull Day", "Leg Day", "Full Body"
  startedAt: string; // ISO 8601 string
  completedAt?: string; // ISO 8601 string
  durationSeconds: number;
  exercises: ExerciseItem[];
  totalVolumeKg: number; // Sum of (Weight * Reps) for completed sets
  notes?: string;
  date?: string;
}

export interface DailyGoals {
  calorieTarget: number;
  proteinTargetGrams: number;
  carbsTargetGrams: number;
  fatTargetGrams: number;
}
