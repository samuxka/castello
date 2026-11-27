// ============================================================================
// CASTELLO DESIGN SYSTEM v1.0 — TOKENS OFICIAIS (MOBILE / EXPO)
// ============================================================================

export const colors = {
  brand: {
    50: '#EEF1FF',
    100: '#DCE4FF',
    200: '#B9C8FF',
    300: '#8FA6FF',
    400: '#5C7FFB',
    500: '#304CF0',
    600: '#0015D4',
    700: '#0112A3',
    800: '#010F6B',
    900: '#01083D',
    950: '#010106',
  },
  primary: '#0015D4',
  secondary: '#010F6B',
  accent: '#5C7FFB',
  black: '#010106',
  white: '#FFFFFF',
  gray: '#D2D8E4',
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  info: '#0015D4',
  infoBg: '#EEF1FF',
} as const;

export const typography = {
  fontFamily: 'Outfit',
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
  },
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const themes = {
  light: {
    background: '#F5F7FB',
    surface: '#FFFFFF',
    text: '#010106',
    textSecondary: '#64748B',
    border: '#D2D8E4',
    primary: '#0015D4',
    onPrimary: '#FFFFFF',
    primaryHover: '#0112A3',
    primarySubtle: '#EEF1FF',
  },
  dark: {
    background: '#010106',
    surface: '#111525',
    text: '#F1F4FA',
    textSecondary: '#AAB4C8',
    border: '#30374A',
    primary: '#5C7FFB',
    onPrimary: '#010106',
    primaryHover: '#8FA6FF',
    primarySubtle: '#010F6B',
  },
} as const;

export function getMobileThemeColors(isDark: boolean, customPrimary?: string) {
  const t = isDark ? themes.dark : themes.light;
  const activePrimary = customPrimary || t.primary;
  return {
    bg: t.background,
    card: t.surface,
    border: t.border,
    textMain: t.text,
    textMuted: t.textSecondary,
    primary: activePrimary,
    brandPrimary: colors.primary,
    deepBlue: colors.secondary,
    skyBlue: colors.accent,
    onPrimary: t.onPrimary,
    primaryHover: t.primaryHover,
    cardSubtle: t.primarySubtle,
    primaryBorder: isDark ? colors.brand[500] : colors.brand[200],
    badgeBg: t.primarySubtle,
    success: colors.success,
    successSubtle: isDark ? '#052E16' : colors.successBg,
    warning: colors.warning,
    warningSubtle: isDark ? '#451A03' : colors.warningBg,
    danger: colors.danger,
    dangerSubtle: isDark ? '#450A0A' : colors.dangerBg,
  };
}
