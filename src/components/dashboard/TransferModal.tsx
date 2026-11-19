import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { sharedStyles } from './dashboardStyles';
import { colors } from '../../theme';

export interface TransferModalProps {
  selectedStore: any;
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

/** Modale de transfert de stock (suivi en direct). */
export default function TransferModal({
  selectedStore,
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
    <Modal visible={transferModalVisible} animationType="slide" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, { padding: 22, maxHeight: '90%' }]}>
          <Text style={sharedStyles.modalTitle}>🚚 Nouveau Transfert (Suivi en Direct)</Text>

          {transferProduct && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: colors.surfaceStrong, padding: 14, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: colors.borderGold }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>{transferProduct.name}</Text>
                <Text style={{ color: colors.gold, marginTop: 4, fontWeight: 'bold' }}>Stock disponible à {selectedStore.toUpperCase()} : {transferProduct.stock}</Text>
                <Text style={{ color: colors.textTertiary, marginTop: 2, fontSize: 12 }}>
                  {transferProduct.category} {transferProduct.size ? `• Taille: ${transferProduct.size}` : ''} {transferProduct.color ? `• Couleur: ${transferProduct.color}` : ''}
                </Text>
              </View>

              <Text style={sharedStyles.fieldLabel}>Quantité à expédier</Text>
              <TextInput style={sharedStyles.input} keyboardType="numeric" value={transferQty} onChangeText={setTransferQty} />

              <Text style={sharedStyles.fieldLabel}>Boutique Destinataire</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity 
                  style={[sharedStyles.input, { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: transferDest === 'falaise' ? colors.borderGold : colors.border, backgroundColor: transferDest === 'falaise' ? colors.goldSoft : colors.surface }]}
                  onPress={() => setTransferDest('falaise')}
                >
                  <Text style={{ color: transferDest === 'falaise' ? '#fff' : '#888', fontWeight: 'bold' }}>📍 La Falaise</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[sharedStyles.input, { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: transferDest === 'tougou' ? colors.borderGold : colors.border, backgroundColor: transferDest === 'tougou' ? colors.goldSoft : colors.surface }]}
                  onPress={() => setTransferDest('tougou')}
                >
                  <Text style={{ color: transferDest === 'tougou' ? '#fff' : '#888', fontWeight: 'bold' }}>📍 Tougou</Text>
                </TouchableOpacity>
              </View>

              {/* Sélecteur du Transporteur / Livreur (Style Glovo / Yango) */}
              <Text style={sharedStyles.fieldLabel}>🏍️ Qui transporte ou reçoit le colis ?</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                Ce transfert sera notifié et affiché sur le tableau de bord de cette personne, du magasin et du Boss !
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                {availableUsers.map((u) => {
                  const isSelected = selectedCarrier?.id === u.id && !customCarrierName;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => {
                        setSelectedCarrier(u);
                        setCustomCarrierName('');
                      }}
                      style={{
                        backgroundColor: isSelected ? '#d4af3722' : '#222',
                        borderColor: isSelected ? colors.gold : '#444',
                        borderWidth: 1.5,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{u.role === 'admin' ? '👑' : '🛍️'}</Text>
                      <View>
                        <Text style={{ color: isSelected ? colors.gold : '#fff', fontWeight: 'bold', fontSize: 12 }}>
                          {u.name}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          {u.store === 'all' ? 'Direction' : u.store === 'falaise' ? 'La Falaise' : 'Tougou'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Saisie libre optionnelle coursier moto / taxi */}
              <Text style={[sharedStyles.fieldLabel, { fontSize: 12 }]}>Ou nom d'un taxi / moto externe :</Text>
              <TextInput
                style={[sharedStyles.input, { marginBottom: 15 }]}
                placeholder="Ex: Taxi Moto Douala / Roger Moto..."
                placeholderTextColor={colors.inputPlaceholder}
                value={customCarrierName}
                onChangeText={(text) => {
                  setCustomCarrierName(text);
                  if (text) setSelectedCarrier(null);
                }}
              />

              {/* Durée estimée du trajet */}
              <Text style={sharedStyles.fieldLabel}>⏱️ Durée estimée du trajet</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {[10, 15, 20, 30].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setEstimatedMinutes(mins)}
                    style={{
                      flex: 1,
                      backgroundColor: estimatedMinutes === mins ? colors.gold : '#252525',
                      paddingVertical: 9,
                      borderRadius: 8,
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: estimatedMinutes === mins ? colors.gold : '#444'
                    }}
                  >
                    <Text style={{ color: estimatedMinutes === mins ? '#121212' : '#ccc', fontWeight: 'bold', fontSize: 12 }}>
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                <TouchableOpacity style={[sharedStyles.cancelBtn, { flex: 1, margin: 0 }]} onPress={() => { setTransferProduct(null); setTransferQty('1'); }}>
                  <Text style={sharedStyles.cancelBtnText}>Changer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sharedStyles.saveBtn, { flex: 2, backgroundColor: colors.gold, margin: 0 }]} onPress={handleTransferSubmit}>
                  <Text style={[sharedStyles.saveBtnText, { color: colors.onGold, fontWeight: 'bold' }]}>Lancer le suivi live</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {!transferProduct && (
            <TouchableOpacity style={[sharedStyles.cancelBtn, { marginTop: 20 }]} onPress={() => setTransferModalVisible(false)}>
              <Text style={sharedStyles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
