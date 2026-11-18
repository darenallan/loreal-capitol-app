import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
import { PackagePlus, Trash2, Edit3 } from 'lucide-react-native';
import { formatMoney } from '../../ui';
import { sharedStyles } from './dashboardStyles';

export interface DeleteSaleModalProps {
  deleteSaleModalVisible: boolean;
  setDeleteSaleModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  saleToDelete: any;
  setSaleToDelete: React.Dispatch<any>;
  deleteSaleReason: string;
  setDeleteSaleReason: React.Dispatch<React.SetStateAction<string>>;
  isDeletingSale: boolean;
  executeDashboardDeleteSale: (restoreStock?: boolean, reopenInLedger?: boolean) => Promise<void>;
}

/** Modale de suppression / correction d'une vente. */
export default function DeleteSaleModal({
  deleteSaleModalVisible,
  setDeleteSaleModalVisible,
  saleToDelete,
  setSaleToDelete,
  deleteSaleReason,
  setDeleteSaleReason,
  isDeletingSale,
  executeDashboardDeleteSale,
}: DeleteSaleModalProps) {
  return (
    <Modal visible={deleteSaleModalVisible} animationType="fade" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, { maxWidth: 480, width: '94%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Trash2 color="#ff4444" size={20} />
            <Text style={[sharedStyles.modalTitle, { marginBottom: 0 }]}>Supprimer ou Corriger la Vente</Text>
          </View>

          {saleToDelete && (
            <>
              <View style={{ backgroundColor: '#251a1a', borderColor: '#ff4444', borderWidth: 1, borderRadius: 10, padding: 12, marginVertical: 10 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                  {saleToDelete.itemsFormatted || (typeof saleToDelete.items === 'string' ? saleToDelete.items : 'Articles vendus')}
                </Text>
                <Text style={{ color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginTop: 4 }}>
                  Montant : {formatMoney(saleToDelete.total || 0)} FCFA • {saleToDelete.payment_method || 'Espèces'}
                </Text>
              </View>

              <Text style={sharedStyles.fieldLabel}>Motif (optionnel)</Text>
              <TextInput
                style={[sharedStyles.input, { marginBottom: 12 }]}
                placeholder="Motif de la suppression / correction..."
                placeholderTextColor="#666"
                value={deleteSaleReason}
                onChangeText={setDeleteSaleReason}
              />

              <Text style={{ color: '#ccc', fontSize: 12, marginBottom: 10, fontWeight: '600' }}>
                Choisissez l'option souhaitée :
              </Text>

              <View style={{ gap: 10 }}>
                {/* Option Correction immédiate en Caisse */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#d4af37',
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isDeletingSale ? 0.6 : 1
                  }}
                  onPress={() => executeDashboardDeleteSale(true, true)}
                  disabled={isDeletingSale}
                >
                  <Edit3 color="#121212" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#121212', fontWeight: 'bold', fontSize: 13.5 }}>
                      ✏️ Supprimer & Corriger l'erreur de suite
                    </Text>
                    <Text style={{ color: '#222', fontSize: 11, marginTop: 2 }}>
                      Remet en stock et ouvre la Caisse avec ces articles prêts à corriger
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 1 : Entrer dans le stock */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#16A34A',
                    borderWidth: 1,
                    borderColor: '#4ADE80',
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isDeletingSale ? 0.6 : 1
                  }}
                  onPress={() => executeDashboardDeleteSale(true, false)}
                  disabled={isDeletingSale}
                >
                  <PackagePlus color="#fff" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13.5 }}>
                      1. Entrer dans le stock & Supprimer
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>
                      Annule la vente et remet automatiquement les articles en stock
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2 : Supprimer définitivement */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#dc2626',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.2)',
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isDeletingSale ? 0.6 : 1
                  }}
                  onPress={() => executeDashboardDeleteSale(false, false)}
                  disabled={isDeletingSale}
                >
                  <Trash2 color="#fff" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13.5 }}>
                      2. Supprimer définitivement (sans stock)
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>
                      Supprime définitivement la vente sans toucher au stock
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[sharedStyles.cancelBtn, { marginTop: 4, marginHorizontal: 0 }]}
                  onPress={() => {
                    if (!isDeletingSale) {
                      setDeleteSaleModalVisible(false);
                      setSaleToDelete(null);
                    }
                  }}
                  disabled={isDeletingSale}
                >
                  <Text style={sharedStyles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
