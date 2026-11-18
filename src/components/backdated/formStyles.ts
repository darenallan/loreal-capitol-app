import { Platform, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';

/** Styles de formulaire partagés par les composants « saisie antérieure ». */
export const formStyles = StyleSheet.create({
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.medium,
    fontSize: 15,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  field: { marginBottom: 14 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.gold, fontFamily: fonts.bold },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.danger },
});
