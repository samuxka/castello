// ============================================================================
// CASTELLO DESIGN SYSTEM v1.0 — TOKENS OFICIAIS (COMPARTILHADOS WEB & MOBILE)
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
  lineHeight: {
    caption: 16,
    body: 20,
    bodyLarge: 24,
    h4: 26,
    h3: 28,
    h2: 32,
    h1: 40,
    display: 58,
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
