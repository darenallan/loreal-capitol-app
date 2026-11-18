import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { alpha, fonts, radius, space } from '../../theme';
import { ColorPalette, useAppTheme } from '../../theme/ThemeContext';
import type { PerfStore } from '../../db/services/analytics';

/** Zone tactile minimale. */
export const TOUCH = 44;

/** Couleur de série par boutique (identité stable, jamais selon le rang). */
export function storeColor(c: ColorPalette, store: PerfStore): string {
  return store === 'falaise' ? c.gold : c.info;
}

/** '+12,3 %' / '−4,0 %' */
export function formatPct(p: number | null, digits = 1): string {
  if (p === null || !isFinite(p)) return '—';
  const sign = p > 0 ? '+' : p < 0 ? '−' : '';
  return `${sign}${Math.abs(p).toFixed(digits).replace('.', ',')} %`;
}

/** Feuille de styles dépendant du thème (aucune couleur codée en dur : tokens uniquement). */
export function makePerfStyles(c: ColorPalette) {
  return StyleSheet.create({
    gap: { gap: space.md },
    row: { flexDirection: 'row', alignItems: 'center' },
    grid2: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    col: { flex: 1, minWidth: 0, gap: space.md },

    card: { padding: space.md, borderRadius: radius.xl, gap: space.sm },
    cardTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: c.textPrimary },
    cardSub: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: c.textTertiary },
    eyebrow: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: c.gold },

    label: { fontFamily: fonts.semibold, fontSize: 13, color: c.textSecondary },
    muted: { fontFamily: fonts.medium, fontSize: 12, color: c.textMuted },
    body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: c.textSecondary },
    strong: { fontFamily: fonts.bold, fontSize: 14, color: c.textPrimary },
    value: { fontFamily: fonts.extrabold, fontSize: 22, color: c.textPrimary, fontVariant: ['tabular-nums'] },
    valueSm: { fontFamily: fonts.bold, fontSize: 13, color: c.textPrimary, fontVariant: ['tabular-nums'] },
    num: { fontVariant: ['tabular-nums'] },

    up: { color: c.success },
    down: { color: c.danger },

    notice: {
      flexDirection: 'row', alignItems: 'flex-start', gap: space.xs,
      padding: space.sm, borderRadius: radius.md,
      backgroundColor: c.warningSoft, borderWidth: 1, borderColor: alpha(c.warning, 0.35),
    },
    noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: c.textSecondary },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },

    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 12, height: 12, borderRadius: 3 },

    // Barres horizontales
    barTrack: { flex: 1, height: 12, borderRadius: 4, backgroundColor: c.surface, overflow: 'hidden' },
    barFill: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
    barValue: { minWidth: 78, textAlign: 'right', fontFamily: fonts.bold, fontSize: 12.5, color: c.textPrimary, fontVariant: ['tabular-nums'] },

    // Listes
    listRow: { paddingVertical: space.sm, gap: 6 },
    rank: {
      width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.goldSofter, borderWidth: 1, borderColor: c.borderGold,
    },
    rankText: { fontFamily: fonts.extrabold, fontSize: 12, color: c.gold },
    stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 4 },

    // Contrôles
    chip: {
      minHeight: TOUCH, paddingHorizontal: 14, borderRadius: radius.pill,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderWidth: 1, borderColor: c.pillInactiveBorder, backgroundColor: c.pillInactiveBg,
    },
    chipActive: { backgroundColor: c.pillActiveBg, borderColor: c.pillActiveBg },
    chipText: { fontFamily: fonts.bold, fontSize: 13, color: c.pillInactiveText },
    chipTextActive: { color: c.pillActiveText },
    stepBtn: {
      width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.borderGold, backgroundColor: c.goldSofter,
    },
    stepValue: { minWidth: 36, textAlign: 'center', fontFamily: fonts.extrabold, fontSize: 18, color: c.textPrimary },
  });
}

export type PerfStyles = ReturnType<typeof makePerfStyles>;

export function usePerfStyles() {
  const { colors } = useAppTheme();
  const s = useMemo(() => makePerfStyles(colors), [colors]);
  return { s, c: colors };
}
