import { StyleSheet } from 'react-native';

/** Styles partagés entre DashboardScreen.tsx et ses composants extraits (valeurs inchangées). */
export const sharedStyles = StyleSheet.create({
  // Modal (User)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333', maxHeight: '80%' },
  modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  fieldLabel: { color: '#d4af37', fontSize: 13, fontWeight: '600', marginBottom: 5 },
  input: { backgroundColor: '#2a2a2a', color: '#fff', height: 50, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#444' },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center', marginRight: 10, backgroundColor: '#333', borderRadius: 10 },
  cancelBtnText: { color: '#fff', fontWeight: 'bold' },
  saveBtn: { flex: 1, padding: 15, alignItems: 'center', marginLeft: 10, backgroundColor: '#d4af37', borderRadius: 10 },
  saveBtnText: { color: '#121212', fontWeight: 'bold' },
  // Breakdown Sections (Week, Month, Year)
  breakdownSection: {
    backgroundColor: '#1e1e1e',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  breakdownSectionTitle: {
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 'bold',
  },
  breakdownSectionSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  emptyDayText: {
    color: '#777',
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
    borderBottomColor: '#252525',
  },
  subSaleTime: {
    color: '#aaa',
    fontSize: 11,
  },
  subSaleItems: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  subSaleAmount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
