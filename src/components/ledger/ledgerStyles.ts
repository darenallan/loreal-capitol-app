import { colors, fonts, radius } from '../../theme';
import { StyleSheet } from 'react-native';
import { alpha } from '../../theme';

/** Styles partagés entre LedgerScreen.tsx et ses composants extraits (valeurs inchangées). */
export const sharedStyles = StyleSheet.create({
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 600,
    padding: 24,
    borderRadius: radius.lg,
  },
  modalEyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.serif,
    marginTop: 2,
  },
  modalDate: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
    fontFamily: fonts.sans,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultName: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  searchResultInfo: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  searchResultStock: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
});
