import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { alpha, fonts, radius, space } from '../../theme';
import { ColorPalette, useAppTheme } from '../../theme/ThemeContext';
import type { CashDiffTone } from '../../db/services/cashClosing';

/** Styles partagés de la clôture de caisse, recalculés selon le thème (sombre / clair). */
function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: { gap: space.sm },
    eyebrow: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', color: c.gold },
    title: { fontFamily: fonts.displaySemi, fontSize: 20, color: c.textPrimary },
    body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: c.textSecondary },
    caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: c.textMuted },
    strong: { fontFamily: fonts.bold, color: c.textPrimary },
    label: {
      fontFamily: fonts.bold,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: c.textSecondary,
      marginBottom: 6,
    },
    input: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.inputBorder,
      backgroundColor: c.inputBg,
      color: c.inputText,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontFamily: fonts.semibold,
      fontSize: 16,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
    },
    inputDisabled: { opacity: 0.6 },
    inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
    field: { gap: 2 },
    hint: { fontFamily: fonts.medium, fontSize: 12.5, color: c.textMuted, marginTop: 4 },
    error: { fontFamily: fonts.semibold, fontSize: 13, color: c.danger },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.xs },
    amount: { fontFamily: fonts.extrabold, fontSize: 15, color: c.textPrimary, fontVariant: ['tabular-nums'] },
    amountLg: { fontFamily: fonts.extrabold, fontSize: 24, color: c.textPrimary, fontVariant: ['tabular-nums'] },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chip: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    dayPill: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.borderGold,
      backgroundColor: c.goldSofter,
    },
    dayText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: c.textPrimary, textTransform: 'capitalize' },
    chipActive: { borderColor: c.gold, backgroundColor: c.goldSoft },
    chipText: { fontFamily: fonts.semibold, fontSize: 13, color: c.textSecondary },
    chipTextActive: { color: c.gold, fontFamily: fonts.bold },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: c.infoSoft,
    },
    noticeText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: c.info },
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as any) : null),
    },
    modalCard: { width: '100%', maxWidth: 460, gap: space.sm },
    modalActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: space.xs },
    modalBtn: { flex: 1, minWidth: 130 },
  });
}

export type CashStyles = ReturnType<typeof makeStyles>;

export function useCashStyles(): { s: CashStyles; c: ColorPalette } {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return { s, c: colors };
}

/** Couleurs (texte / fond / bordure) associées au ton d'un écart. */
export function toneColors(c: ColorPalette, tone: CashDiffTone) {
  const fg = tone === 'success' ? c.success : tone === 'warning' ? c.warning : c.danger;
  const bg = tone === 'success' ? c.successSoft : tone === 'warning' ? c.warningSoft : c.dangerSoft;
  return { fg, bg, border: alpha(fg, 0.4) };
}

/** « +1 500 F », « −200 F », « 0 F » */
export function formatSigned(n: number, formatMoney: (n: number) => string): string {
  const r = Math.round(Number(n) || 0);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${formatMoney(Math.abs(r))} F`;
}
