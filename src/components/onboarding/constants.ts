import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ActivityLevel, GoalType } from '../../utils/nutritionTargets';

export const ACTIVITY_OPTIONS: {
  key: ActivityLevel;
  label: string;
  desc: string;
  multiplier: string;
}[] = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise, desk work', multiplier: '1.20x' },
  { key: 'light', label: 'Lightly Active', desc: 'Light exercise 1–3 days/week', multiplier: '1.38x' },
  { key: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3–5 days/week', multiplier: '1.55x' },
  { key: 'very_active', label: 'Very Active', desc: 'Hard training 6–7 days/week', multiplier: '1.73x' },
  { key: 'extra_active', label: 'Extra Active', desc: 'Intense daily training or physical job', multiplier: '1.90x' },
];

export const GOAL_OPTIONS: {
  key: GoalType;
  label: string;
  badge: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'cut', label: 'Cut (Fat Loss)', badge: '-500 kcal', desc: 'Caloric deficit, 2.0g/kg protein protection', icon: 'flame' },
  { key: 'maintain', label: 'Maintain (Recomp)', badge: 'TDEE', desc: 'Weight stability, body recomposition', icon: 'scale' },
  { key: 'bulk', label: 'Bulk (Muscle Gain)', badge: '+300 kcal', desc: 'Lean surplus for progressive overload', icon: 'barbell' },
];
