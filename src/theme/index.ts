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
  // .gold-gradient-text de Stitch
  gold: ['#FFF0C2', '#E5C158', '#947221'] as const,
  goldSoft: ['rgba(255,240,194,0.18)', 'rgba(229,193,88,0.08)', 'rgba(229,193,88,0)'] as const,
  glassTop: ['rgba(245,240,230,0.08)', 'rgba(245,240,230,0.0)'] as const,
  fadeBottom: ['rgba(22,19,13,0)', 'rgba(22,19,13,0.95)'] as const,
};

/**
 * Familles de polices chargées dans App.tsx (design system Stitch) :
 * Bodoni Moda = serif de prestige (titres), Inter = interface, Space Grotesk = chiffres.
 */
export const fonts = {
  display: 'BodoniModa_700Bold',
  displaySemi: 'BodoniModa_600SemiBold',
  displayItalic: 'BodoniModa_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  serif: 'BodoniModa_700Bold',
  sans: 'Inter_600SemiBold',
  /** Montants et compteurs (--font-mono-numbers) */
  mono: 'SpaceGrotesk_600SemiBold',
  monoMedium: 'SpaceGrotesk_500Medium',
};

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 };
// Rayons Stitch : sm 6, md 10, lg 16. Les grandes cartes restent à 16-20.
export const radius = { xs: 6, sm: 6, md: 10, lg: 16, xl: 16, xxl: 20, pill: 999, full: 999 };

export const breakpoints = { tablet: 640, laptop: 1024, desktop: 1440 };

export const shadow = {
  // --shadow-prestige-card / card-dark de Stitch
  soft: Platform.select<ViewStyle>({
    web: { boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' } as any,
    default: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  }),
  deep: Platform.select<ViewStyle>({
    web: { boxShadow: '0 12px 32px -8px rgba(0,0,0,0.65), 0 0 1px 1px rgba(255,255,255,0.04)' } as any,
    default: { shadowColor: '#000', shadowOpacity: 0.65, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  }),
  // Halo or très discret (gold-glow Stitch), réservé au bouton principal
  gold: Platform.select<ViewStyle>({
    web: { boxShadow: '0 0 20px -3px rgba(229,193,88,0.2)' } as any,
    default: { shadowColor: '#E5C158', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  }),
  glowGold: Platform.select<ViewStyle>({
    web: { boxShadow: '0 0 20px -3px rgba(229,193,88,0.2)' } as any,
    default: { shadowColor: '#E5C158', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  }),
  /** --shadow-gold-focus : anneau de focus des champs */
  focus: Platform.select<ViewStyle>({
    web: { boxShadow: '0 0 0 2px rgba(229,193,88,0.35)' } as any,
    default: {},
  }),
  lg: Platform.select<ViewStyle>({
    web: { boxShadow: '0 12px 32px -8px rgba(0,0,0,0.65), 0 0 1px 1px rgba(255,255,255,0.04)' } as any,
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
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, color: colors.text, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: colors.text, letterSpacing: -0.45 },
  h2: { fontFamily: fonts.displaySemi, fontSize: 24, lineHeight: 30, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 15.5, lineHeight: 22, color: colors.textSecondary },
  caption: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 18, color: colors.textMuted },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.gold },
  number: { fontFamily: fonts.mono, fontSize: 30, color: colors.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
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

/**
 * Applique une opacité à une couleur de token (#RRGGBB ou rgba()).
 * Ex. alpha(colors.gold, 0.3) → 'rgba(229,193,88,0.3)'. Évite les rgba codés en dur.
 */
export function alpha(color: string, a: number): string {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const r = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return r ? `rgba(${r[1]},${r[2]},${r[3]},${a})` : color;
}

/** Taille de texte minimale pour une information lisible sur téléphone */
export const MIN_TEXT = 12;

/** Format monétaire FCFA lisible : 1 245 000 */
export const formatMoney = (n: number | undefined | null) =>
  Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
