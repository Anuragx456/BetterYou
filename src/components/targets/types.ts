import type Ionicons from '@expo/vector-icons/Ionicons';

export type FitnessGoal = 'lean' | 'maintain' | 'gain';
export type ActivityLevel = 'walks' | 'moderate' | 'lifting';

export interface GoalOption {
  key: FitnessGoal;
  label: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface ActivityOption {
  key: ActivityLevel;
  label: string;
  frequency: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface SuggestedNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  explanation: string;
}

export const CALORIE_PRESETS = [1600, 1800, 2000, 2200, 2500, 2800];

export const GOAL_OPTIONS: GoalOption[] = [
  { key: 'lean', label: 'Get Lean', badge: 'Deficit (-450)', icon: 'flame-outline' },
  { key: 'maintain', label: 'Maintain', badge: 'Recomp (TDEE)', icon: 'scale-outline' },
  { key: 'gain', label: 'Gain Muscle', badge: 'Surplus (+350)', icon: 'barbell-outline' },
];

export const ACTIVITY_OPTIONS: ActivityOption[] = [
  { key: 'walks', label: 'Casual Walks', frequency: 'Light / 5k-8k steps', icon: 'walk-outline' },
  { key: 'moderate', label: 'Moderate Gym', frequency: '3-4 sessions / wk', icon: 'fitness-outline' },
  { key: 'lifting', label: 'Heavy Lifting', frequency: '5-6 sessions / wk', icon: 'barbell' },
];
