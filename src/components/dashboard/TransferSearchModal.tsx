import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { sharedStyles } from './dashboardStyles';
import { colors } from '../../theme';

export interface TransferSearchModalProps {
  transferSearchModalVisible: boolean;
  setTransferSearchModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  transferSearchText: string;
  setTransferSearchText: React.Dispatch<React.SetStateAction<string>>;
  products: any[];
  selectTransferProduct: (product: any) => void;
}

/** Modale de recherche d'article pour un transfert manuel. */
export default function TransferSearchModal({
  transferSearchModalVisible,
  setTransferSearchModalVisible,
  transferSearchText,
  setTransferSearchText,
  products,
  selectTransferProduct,
}: TransferSearchModalProps) {
  return (
    <Modal visible={transferSearchModalVisible} animationType="slide" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, { maxHeight: '80%' }]}>
          <Text style={sharedStyles.modalTitle}>Recherche Article (Transfert)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceStrong, borderRadius: 10, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.borderStrong }}>
            <TextInput
              style={{ flex: 1, height: 50, color: '#fff' }}
              placeholder="Rechercher par nom ou référence..."
              placeholderTextColor={colors.inputPlaceholder}
              value={transferSearchText}
              onChangeText={setTransferSearchText}
              autoFocus
            />
          </View>
          <ScrollView style={{ marginTop: 10 }}>
            {products.filter(p => {
              const searchTerms = transferSearchText.toLowerCase().split(/\s+/).filter(t => t.trim() !== '');
              if (searchTerms.length === 0) return true;
              return searchTerms.every(term => p.name.toLowerCase().includes(term) || (p.reference && p.reference.toLowerCase().includes(term)));
            }).slice(0, 15).map(p => (
              <TouchableOpacity key={p.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => selectTransferProduct(p)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{p.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>
                  {p.category} {p.size ? `| Taille: ${p.size}` : ''} {p.color ? `| Couleur: ${p.color}` : ''} — Stock: {p.stock}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[sharedStyles.cancelBtn, { marginTop: 20, width: '100%', marginHorizontal: 0 }]} onPress={() => setTransferSearchModalVisible(false)}>
            <Text style={sharedStyles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
