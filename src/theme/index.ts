/**
 * Capitol — Design tokens & Theme System
 * Thème dynamique Noir & Or / Crème & Or Royal avec mode automatique selon lever/coucher du soleil.
 */
import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { darkPalette, lightPalette, ThemeProvider, useAppTheme, ThemeMode, ColorPalette } from './ThemeContext';

export * from './ThemeContext';

/**
 * Palette par défaut statique (haute visibilité & fort contraste)
 */
export const colors = darkPalette;

export const gradients = {
  gold: ['#FFF2BF', '#E5C158', '#B08826'] as const,
  goldSoft: ['rgba(255,242,191,0.22)', 'rgba(229,193,88,0.10)', 'rgba(229,193,88,0)'] as const,
  glassTop: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.0)'] as const,
  fadeBottom: ['rgba(10,10,16,0)', 'rgba(10,10,16,0.95)'] as const,
};

/** Familles de polices chargées dans App.tsx */
export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  displaySemi: 'PlayfairDisplay_600SemiBold',
  displayItalic: 'PlayfairDisplay_400Regular_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  serif: 'PlayfairDisplay_700Bold',
  sans: 'Manrope_600SemiBold',
};

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 26, xxl: 32, pill: 999, full: 999 };

export const breakpoints = { tablet: 640, laptop: 1024, desktop: 1440 };

export const shadow = {
  soft: Platform.select<ViewStyle>({
    web: { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' } as any,
    default: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  }),
  deep: Platform.select<ViewStyle>({
    web: { boxShadow: '0 24px 48px -10px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)' } as any,
    default: { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  }),
  gold: Platform.select<ViewStyle>({
    web: { boxShadow: '0 10px 30px -6px rgba(229,193,88,0.45)' } as any,
    default: { shadowColor: '#E5C158', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  }),
  glowGold: Platform.select<ViewStyle>({
    web: { boxShadow: '0 10px 30px -6px rgba(229,193,88,0.45)' } as any,
    default: { shadowColor: '#E5C158', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  }),
  lg: Platform.select<ViewStyle>({
    web: { boxShadow: '0 24px 48px -10px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)' } as any,
    default: { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  }),
};

export const shadows = {
  sm: shadow.soft,
  md: shadow.deep,
  lg: shadow.deep,
  glowGold: shadow.gold,
};

export const theme = {
  colors,
  fonts,
  space,
  radius,
  shadows,
  shadow,
  breakpoints,
  gradients,
};

/** Préréglages typographiques pour haute lisibilité mobile */
export const type = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, color: colors.text, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.displaySemi, fontSize: 24, lineHeight: 30, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 15.5, lineHeight: 22, color: colors.textSecondary },
  caption: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 18, color: colors.textMuted },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.gold },
  number: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
}) as Record<'display' | 'h1' | 'h2' | 'title' | 'body' | 'caption' | 'eyebrow' | 'number', TextStyle>;

/** Choisit la famille Manrope correspondant au fontWeight demandé */
export function fontForWeight(weight?: TextStyle['fontWeight']): string {
  switch (String(weight ?? '400')) {
    case '800': case '900': return fonts.extrabold;
    case 'bold': case '700': return fonts.bold;
    case '600': return fonts.semibold;
    case '500': return fonts.medium;
    default: return fonts.regular;
  }
}

const TEXT_KEYS = ['fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'textAlign'];

/**
 * StyleSheet.create amélioré
 */
export function createStyles<T extends Record<string, any>>(styles: T): T {
  const out: Record<string, any> = {};
  for (const key of Object.keys(styles)) {
    const s = { ...styles[key] };
    const isText = TEXT_KEYS.some(k => k in s);
    if (isText && !s.fontFamily) {
      s.fontFamily = fontForWeight(s.fontWeight);
      if (Platform.OS !== 'web') delete s.fontWeight;
    }
    out[key] = s;
  }
  return StyleSheet.create(out) as T;
}

/** Format monétaire FCFA lisible : 1 245 000 */
export const formatMoney = (n: number | undefined | null) =>
  Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
