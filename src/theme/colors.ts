/**
 * Centralized Theme Tokens - Modern Soft Fitness & Wellness Design System
 * Clean light palette inspired by Scandinavian health & fitness interfaces
 */

export const colors = {
  // Base Canvas & Surfaces - Light, Clean & Soft
  background: '#F7F8FA',
  backgroundSecondary: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  cardBorder: '#ECEEF2',
  cardHover: '#F1F3F6',

  // Brand / Action Accents - Signature Peach / Coral Salmon
  primary: '#FF7A59',
  primaryLight: '#FFA085',
  primaryDark: '#E05E3D',
  primaryMuted: '#FFEDE8',
  primaryActive: '#E05E3D',

  // Secondary Accents - Sky Blue
  secondary: '#0284C7',
  secondaryLight: '#38BDF8',
  secondaryMuted: '#E0F2FE',

  // Soft Bento & Pastel Surfaces
  softBlue: '#E0F2FE',
  softBlueText: '#0369A1',
  softBlueBorder: '#BAE6FD',

  softGreen: '#D8F3DC',
  softGreenText: '#1B4332',
  softGreenBorder: '#B7E4C7',

  softOrange: '#FFE8D6',
  softOrangeText: '#9C4221',
  softOrangeBorder: '#FFD7BA',

  heroBlue: '#DCEEFF',
  heroBlueDark: '#1E40AF',

  // High-contrast Dark Widgets (e.g., Interval Timer)
  charcoalWidget: '#181A20',
  charcoalWidgetCard: '#242730',

  // Nutrition Macro Tokens
  calories: '#FF7A59',
  caloriesMuted: '#FFEDE8',
  protein: '#0284C7',
  proteinMuted: '#E0F2FE',
  carbs: '#10B981',
  carbsMuted: '#D8F3DC',
  fat: '#F43F5E',
  fatMuted: '#FFE4E6',

  // Toxicity & Risk Scale
  safetyClean: '#10B981',   // 71-100 Score
  safetyModerate: '#F59E0B',// 40-70 Score
  safetyHighRisk: '#EF4444',// 0-39 Score

  // NOVA Food Processing Groups
  nova1: '#10B981',
  nova2: '#84CC16',
  nova3: '#F59E0B',
  nova4: '#EF4444',

  // Typography & Content - Clean, High Contrast
  text: '#181A20',
  textSecondary: '#717684',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Interactive & Surfaces
  borderSubtle: '#ECEEF2',
  surfaceSubtle: '#F3F4F6',
  hairline: '#E5E7EB',

  // Status & Utility
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#0284C7',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ThemeColors = typeof colors;
