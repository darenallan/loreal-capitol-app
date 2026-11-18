import React from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Trash2, Edit3, Check } from 'lucide-react-native';
import { colors, radius, formatMoney } from '../../theme';
import { GlassCard } from '../../ui';
import { sharedStyles } from './ledgerStyles';
import { alpha } from '../../theme';

export interface DeleteSaleModalProps {
  deleteSaleModalVisible: boolean;
  setDeleteSaleModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  saleToDelete: any;
  setSaleToDelete: React.Dispatch<any>;
  isDeletingSale: boolean;
  executeDeleteSale: (restoreStock?: boolean, reopenForCorrection?: boolean) => Promise<void>;
}

/** Modale de suppression / correction immédiate d'une vente. */
export default function DeleteSaleModal({
  deleteSaleModalVisible,
  setDeleteSaleModalVisible,
  saleToDelete,
  setSaleToDelete,
  isDeletingSale,
  executeDeleteSale,
}: DeleteSaleModalProps) {
  return (
    <Modal visible={deleteSaleModalVisible} animationType="fade" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <GlassCard style={[sharedStyles.modalCard, { width: '100%', maxWidth: 480, alignSelf: 'center' }]} glow="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Trash2 color={colors.danger} size={18} />
            <Text style={[sharedStyles.modalEyebrow, { color: colors.danger }]}>OPTIONS DE SUPPRESSION & CORRECTION</Text>
          </View>
          <Text style={sharedStyles.modalTitle}>Supprimer ou Corriger cette Vente ?</Text>

          {saleToDelete && (
            <>
              <View style={{
                backgroundColor: alpha(colors.danger, 0.06),
                borderColor: alpha(colors.danger, 0.3),
                borderWidth: 1,
                borderRadius: radius.sm,
                padding: 12,
                marginVertical: 12
              }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                  {saleToDelete.items || 'Articles vendus'}
                </Text>
                <Text style={{ color: colors.goldLight, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                  Montant : {formatMoney(saleToDelete.total || 0)} FCFA • {saleToDelete.payment_method || 'Espèces'}
                </Text>
                {saleToDelete.client_name ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    Client : {saleToDelete.client_name}
                  </Text>
                ) : null}
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: '600' }}>
                Choisissez l'option souhaitée :
              </Text>

              <View style={{ gap: 10 }}>
                {/* Option Correction Immédiate */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.gold,
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderRadius: radius.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isDeletingSale ? 0.6 : 1,
                    cursor: 'pointer' as any
                  }}
                  onPress={() => executeDeleteSale(true, true)}
                  disabled={isDeletingSale}
                >
                  {isDeletingSale ? (
                    <ActivityIndicator size="small" color={colors.onGold} />
                  ) : (
                    <Edit3 color={colors.onGold} size={18} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onGold, fontWeight: '800', fontSize: 13.5 }}>
                      ✏️ Supprimer & Corriger l'erreur de suite
                    </Text>
                    <Text style={{ color: 'rgba(7,7,10,0.8)', fontSize: 12, marginTop: 2 }}>
                      Remet en stock et rouvre la vente avec ces articles pour corriger immédiatement
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 1 : Entrer dans le stock */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#16A34A',
                    borderWidth: 1,
                    borderColor: colors.success,
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderRadius: radius.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isDeletingSale ? 0.6 : 1,
                    cursor: 'pointer' as any
                  }}
                  onPress={() => executeDeleteSale(true, false)}
                  disabled={isDeletingSale}
                >
                  {isDeletingSale ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Check color="#FFFFFF" size={18} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                      1. Entrer dans le stock & Supprimer
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
                      Annule la vente et réintègre les articles dans le stock disponible
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2 : Supprimer définitivement */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.danger,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderRadius: radius.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isDeletingSale ? 0.6 : 1,
                    cursor: 'pointer' as any
                  }}
                  onPress={() => executeDeleteSale(false, false)}
                  disabled={isDeletingSale}
                >
                  {isDeletingSale ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Trash2 color="#FFFFFF" size={18} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                      2. Supprimer définitivement (sans stock)
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
                      Supprime définitivement la vente sans modifier les quantités en stock
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[sharedStyles.modalCancelBtn, { marginTop: 2 }]}
                  onPress={() => {
                    if (!isDeletingSale) {
                      setDeleteSaleModalVisible(false);
                      setSaleToDelete(null);
                    }
                  }}
                  disabled={isDeletingSale}
                >
                  <Text style={sharedStyles.modalCancelBtnText}>Annuler (Conserver la vente)</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
}
