/**
 * Shared color tokens. Screens read the active palette through useThemeColors()
 * so a settings toggle can rebuild styles.
 */

const lightColors = {
  background: '#F7F8FA',
  backgroundSecondary: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  cardBorder: '#ECEEF2',
  cardHover: '#F1F3F6',

  primary: '#FF7A59',
  primaryLight: '#FFA085',
  primaryDark: '#E05E3D',
  primaryActive: '#E05E3D',
  primaryMuted: '#FFEDE8',

  secondary: '#0284C7',
  secondaryLight: '#38BDF8',
  secondaryMuted: '#E0F2FE',

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

  charcoalWidget: '#181A20',
  charcoalWidgetCard: '#242730',

  calories: '#FF7A59',
  caloriesMuted: '#FFEDE8',
  protein: '#0284C7',
  proteinMuted: '#E0F2FE',
  carbs: '#10B981',
  carbsMuted: '#D8F3DC',
  fat: '#F43F5E',
  fatMuted: '#FFE4E6',

  safetyClean: '#10B981',
  safetyModerate: '#F59E0B',
  safetyHighRisk: '#EF4444',

  nova1: '#10B981',
  nova2: '#84CC16',
  nova3: '#F59E0B',
  nova4: '#EF4444',

  text: '#181A20',
  textSecondary: '#717684',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  borderSubtle: '#ECEEF2',
  surfaceSubtle: '#F3F4F6',
  hairline: '#E5E7EB',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#0284C7',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

const darkColors: { [K in keyof typeof lightColors]: string } = {
  background: '#0B0D12',
  backgroundSecondary: '#12151D',
  card: '#161922',
  cardElevated: '#1E222D',
  cardBorder: '#252A37',
  cardHover: '#292F3E',

  primary: '#FF7A59',
  primaryLight: '#FFA085',
  primaryDark: '#E05E3D',
  primaryActive: '#E05E3D',
  primaryMuted: '#38201A',

  secondary: '#38BDF8',
  secondaryLight: '#7DD3FC',
  secondaryMuted: '#0C2A3A',

  softBlue: '#0C2A3A',
  softBlueText: '#7DD3FC',
  softBlueBorder: '#164E63',

  softGreen: '#102B20',
  softGreenText: '#86EFAC',
  softGreenBorder: '#14532D',

  softOrange: '#382218',
  softOrangeText: '#FDBA74',
  softOrangeBorder: '#7C2D12',

  heroBlue: '#111D2D',
  heroBlueDark: '#93C5FD',

  charcoalWidget: '#161922',
  charcoalWidgetCard: '#1E222D',

  calories: '#FF7A59',
  caloriesMuted: '#38201A',
  protein: '#38BDF8',
  proteinMuted: '#0C2A3A',
  carbs: '#10B981',
  carbsMuted: '#102B20',
  fat: '#FB7185',
  fatMuted: '#38161E',

  safetyClean: '#10B981',
  safetyModerate: '#F59E0B',
  safetyHighRisk: '#EF4444',

  nova1: '#10B981',
  nova2: '#84CC16',
  nova3: '#F59E0B',
  nova4: '#EF4444',

  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',

  borderSubtle: '#252A37',
  surfaceSubtle: '#1C202B',
  hairline: '#202430',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const colors = lightColors;
export { lightColors, darkColors };
export type ThemeColors = { [K in keyof typeof lightColors]: string };
