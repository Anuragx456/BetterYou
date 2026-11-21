import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ActivityLevel, GoalType } from '../../utils/nutritionTargets';

export interface ActivityOption {
  key: ActivityLevel;
  label: string;
  desc: string;
  multiplier: string;
  level: number;
  frequency: string;
}

export interface GoalOption {
  key: GoalType;
  label: string;
  badge: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  delta: string;
  proteinGuide: string;
}

export const ACTIVITY_OPTIONS: ActivityOption[] = [
  {
    key: 'sedentary',
    label: 'Sedentary',
    desc: 'Desk work, minimal daily movement',
    multiplier: '1.20×',
    level: 1,
    frequency: '0 days/wk',
  },
  {
    key: 'light',
    label: 'Lightly Active',
    desc: 'Light workouts, 1–3 sessions per week',
    multiplier: '1.38×',
    level: 2,
    frequency: '1–3 days/wk',
  },
  {
    key: 'moderate',
    label: 'Moderately Active',
    desc: 'Regular training, 3–5 sessions per week',
    multiplier: '1.55×',
    level: 3,
    frequency: '3–5 days/wk',
  },
  {
    key: 'very_active',
    label: 'Very Active',
    desc: 'Hard exercise, 6–7 sessions per week',
    multiplier: '1.73×',
    level: 4,
    frequency: '6–7 days/wk',
  },
  {
    key: 'extra_active',
    label: 'Extra Active',
    desc: 'Daily intense training or heavy manual labor',
    multiplier: '1.90×',
    level: 5,
    frequency: 'Daily 2x / Labor',
  },
];

export const GOAL_OPTIONS: GoalOption[] = [
  {
    key: 'cut',
    label: 'Cut (Fat Loss)',
    badge: '-500 kcal',
    desc: 'Targeted caloric deficit with 2.0g/kg protein muscle protection',
    icon: 'flame',
    delta: '-500 kcal deficit',
    proteinGuide: '2.0 g/kg protein',
  },
  {
    key: 'maintain',
    label: 'Maintain (Recomp)',
    badge: 'TDEE',
    desc: 'Caloric balance for steady body recomposition and recovery',
    icon: 'scale',
    delta: 'Exact energy balance',
    proteinGuide: '1.8 g/kg protein',
  },
  {
    key: 'bulk',
    label: 'Bulk (Muscle Gain)',
    badge: '+300 kcal',
    desc: 'Lean caloric surplus to support hypertrophy and strength gains',
    icon: 'barbell',
    delta: '+300 kcal surplus',
    proteinGuide: '1.8 g/kg protein',
  },
];
