import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

/** Styles partagés entre DashboardScreen.tsx et ses composants extraits (valeurs inchangées). */
export const sharedStyles = StyleSheet.create({
  // Modal (User)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.surfaceSolidHi, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, maxHeight: '80%' },
  modalTitle: { color: colors.gold, fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  fieldLabel: { color: colors.gold, fontSize: 13, fontWeight: '600', marginBottom: 5 },
  input: { backgroundColor: colors.surfaceStrong, color: '#fff', height: 50, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: colors.borderStrong },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center', marginRight: 10, backgroundColor: colors.surfaceStrong, borderRadius: 10 },
  cancelBtnText: { color: '#fff', fontWeight: 'bold' },
  saveBtn: { flex: 1, padding: 15, alignItems: 'center', marginLeft: 10, backgroundColor: colors.gold, borderRadius: 10 },
  saveBtnText: { color: colors.onGold, fontWeight: 'bold' },
  // Breakdown Sections (Week, Month, Year)
  breakdownSection: {
    backgroundColor: colors.surfaceSolidHi,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakdownSectionTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  breakdownSectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyDayText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  subSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subSaleTime: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  subSaleItems: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  subSaleAmount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
