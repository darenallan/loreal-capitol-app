import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, StyleSheet } from 'react-native';
import { User, ArrowRightLeft, Store } from 'lucide-react-native';
import { colors, fonts, radius } from '../../theme';
import { GlassCard, GoldButton } from '../../ui';
import { sharedStyles } from './ledgerStyles';

export interface TransferModalProps {
  storeId: any;
  transferModalVisible: boolean;
  setTransferModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  transferProduct: any;
  setTransferProduct: React.Dispatch<any>;
  transferQty: string;
  setTransferQty: React.Dispatch<React.SetStateAction<string>>;
  transferDest: string;
  setTransferDest: React.Dispatch<React.SetStateAction<string>>;
  availableUsers: any[];
  selectedCarrier: any;
  setSelectedCarrier: React.Dispatch<any>;
  customCarrierName: string;
  setCustomCarrierName: React.Dispatch<React.SetStateAction<string>>;
  estimatedMinutes: number;
  setEstimatedMinutes: React.Dispatch<React.SetStateAction<number>>;
  handleTransferSubmit: () => Promise<void>;
}

/** Modale d'expédition inter-boutique (transfert live). */
export default function TransferModal({
  storeId,
  transferModalVisible,
  setTransferModalVisible,
  transferProduct,
  setTransferProduct,
  transferQty,
  setTransferQty,
  transferDest,
  setTransferDest,
  availableUsers,
  selectedCarrier,
  setSelectedCarrier,
  customCarrierName,
  setCustomCarrierName,
  estimatedMinutes,
  setEstimatedMinutes,
  handleTransferSubmit,
}: TransferModalProps) {
  return (
    <Modal visible={transferModalVisible} animationType="fade" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <GlassCard style={[sharedStyles.modalCard, { maxHeight: '90%', width: 500, maxWidth: '94%' }]} glow="gold">
          <Text style={sharedStyles.modalEyebrow}>EXPÉDITION INTER-BOUTIQUE</Text>
          <Text style={sharedStyles.modalTitle}>Nouveau Transfert Live</Text>

          {transferProduct && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              <View style={styles.transferProductCard}>
                <Text style={styles.transferProductName}>{transferProduct.name}</Text>
                <Text style={styles.transferProductStock}>Stock disponible à {storeId.toUpperCase()} : {transferProduct.stock}</Text>
                <Text style={styles.transferProductMeta}>
                  {transferProduct.category} {transferProduct.size ? `• Taille: ${transferProduct.size}` : ''} {transferProduct.color ? `• Couleur: ${transferProduct.color}` : ''}
                </Text>
              </View>

              <Text style={sharedStyles.fieldLabel}>Quantité à expédier</Text>
              <TextInput style={sharedStyles.input} keyboardType="numeric" value={transferQty} onChangeText={setTransferQty} />

              <Text style={sharedStyles.fieldLabel}>Boutique Destinataire</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity 
                  style={[styles.destPill, transferDest === 'falaise' && styles.destPillActive]}
                  onPress={() => setTransferDest('falaise')}
                >
                  <Store color={transferDest === 'falaise' ? colors.gold : colors.textTertiary} size={16} style={{ marginRight: 6 }} />
                  <Text style={[styles.destPillText, transferDest === 'falaise' && styles.destPillTextActive]}>La Falaise</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.destPill, transferDest === 'tougou' && styles.destPillActive]}
                  onPress={() => setTransferDest('tougou')}
                >
                  <Store color={transferDest === 'tougou' ? colors.gold : colors.textTertiary} size={16} style={{ marginRight: 6 }} />
                  <Text style={[styles.destPillText, transferDest === 'tougou' && styles.destPillTextActive]}>Tougou</Text>
                </TouchableOpacity>
              </View>

              <Text style={sharedStyles.fieldLabel}>Responsable transport ou coursier</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {availableUsers.map((u) => {
                  const isSelected = selectedCarrier?.id === u.id && !customCarrierName;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => {
                        setSelectedCarrier(u);
                        setCustomCarrierName('');
                      }}
                      style={[styles.carrierPill, isSelected && styles.carrierPillActive]}
                    >
                      <User color={isSelected ? colors.gold : colors.textTertiary} size={14} />
                      <View>
                        <Text style={[styles.carrierPillName, isSelected && { color: colors.gold }]}>
                          {u.name}
                        </Text>
                        <Text style={styles.carrierPillRole}>
                          {u.store === 'all' ? 'Direction' : u.store === 'falaise' ? 'La Falaise' : 'Tougou'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[sharedStyles.fieldLabel, { fontSize: 11 }]}>Ou taxi / moto coursier externe :</Text>
              <TextInput
                style={[sharedStyles.input, { marginBottom: 15 }]}
                placeholder="Ex: Roger Moto Douala..."
                placeholderTextColor={colors.textTertiary}
                value={customCarrierName}
                onChangeText={(text) => {
                  setCustomCarrierName(text);
                  if (text) setSelectedCarrier(null);
                }}
              />

              <Text style={sharedStyles.fieldLabel}>Durée estimée du trajet</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {[10, 15, 20, 30].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setEstimatedMinutes(mins)}
                    style={[styles.minsPill, estimatedMinutes === mins && styles.minsPillActive]}
                  >
                    <Text style={[styles.minsPillText, estimatedMinutes === mins && styles.minsPillTextActive]}>
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ gap: 10, marginTop: 5 }}>
                <GoldButton 
                  label="Lancer l'Expédition"
                  onPress={handleTransferSubmit}
                  size="lg"
                  icon={<ArrowRightLeft color="#07070A" size={18} />}
                />
                <TouchableOpacity style={sharedStyles.modalCancelBtn} onPress={() => { setTransferProduct(null); setTransferQty('1'); }}>
                  <Text style={sharedStyles.modalCancelBtnText}>Changer d'article</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {!transferProduct && (
            <TouchableOpacity style={[sharedStyles.modalCancelBtn, { marginTop: 20 }]} onPress={() => setTransferModalVisible(false)}>
              <Text style={sharedStyles.modalCancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  transferProductCard: {
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    padding: 14,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  transferProductName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  transferProductStock: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: fonts.sans,
  },
  transferProductMeta: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  destPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  destPillActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: colors.gold,
  },
  destPillText: {
    color: colors.textTertiary,
    fontWeight: '600',
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  destPillTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  carrierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  carrierPillActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: colors.gold,
  },
  carrierPillName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  carrierPillRole: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: fonts.sans,
  },
  minsPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  minsPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  minsPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  minsPillTextActive: {
    color: '#07070A',
    fontWeight: '800',
  },
});
