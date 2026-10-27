/**
 * Centralized Theme Tokens - Dark Mode First
 * High-contrast, fitness & nutrition optimized design system
 */

export const colors = {
  // Base Backgrounds - Obsidian & Soft Charcoal
  background: '#0A0C10',
  backgroundSecondary: '#12151D',
  card: '#161922',
  cardElevated: '#1D222E',
  cardBorder: 'rgba(255, 255, 255, 0.08)',

  // Brand / Action Accents - Refined Emerald
  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#059669',
  primaryMuted: 'rgba(16, 185, 129, 0.12)',

  secondary: '#6366F1',
  secondaryLight: '#818CF8',
  secondaryMuted: 'rgba(99, 102, 241, 0.12)',

  // Nutrition Macro Tokens - Minimalist, Restrained Tones
  calories: '#F59E0B',
  caloriesMuted: 'rgba(245, 158, 11, 0.12)',
  protein: '#38BDF8',
  proteinMuted: 'rgba(56, 189, 248, 0.12)',
  carbs: '#34D399',
  carbsMuted: 'rgba(52, 211, 153, 0.12)',
  fat: '#F472B6',
  fatMuted: 'rgba(244, 114, 182, 0.12)',

  // Toxicity & Risk Scale
  safetyClean: '#10B981',   // 71-100 Score
  safetyModerate: '#F59E0B',// 40-70 Score
  safetyHighRisk: '#EF4444',// 0-39 Score

  // NOVA Food Processing Groups
  nova1: '#10B981',
  nova2: '#84CC16',
  nova3: '#F59E0B',
  nova4: '#EF4444',

  // Typography & Content - Clean, Crisp
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',     // Subtle supporting text
  textInverse: '#0A0C10',

  // Interactive & Surfaces
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  cardHover: '#1A1E29',
  primaryActive: '#059669',
  surfaceSubtle: 'rgba(255, 255, 255, 0.03)',
  hairline: 'rgba(255, 255, 255, 0.07)',

  // Status & Utility
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ThemeColors = typeof colors;

