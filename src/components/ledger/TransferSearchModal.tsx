import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { Search } from 'lucide-react-native';
import { colors } from '../../theme';
import { GlassCard } from '../../ui';
import { sharedStyles } from './ledgerStyles';

export interface TransferSearchModalProps {
  products: any[];
  transferSearchModalVisible: boolean;
  setTransferSearchModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  transferSearchText: string;
  setTransferSearchText: React.Dispatch<React.SetStateAction<string>>;
  selectTransferProduct: (product: any) => void;
  multiCriteriaSearch: (product: any, text: string) => boolean;
}

/** Modale de recherche d'article pour un transfert manuel. */
export default function TransferSearchModal({
  products,
  transferSearchModalVisible,
  setTransferSearchModalVisible,
  transferSearchText,
  setTransferSearchText,
  selectTransferProduct,
  multiCriteriaSearch,
}: TransferSearchModalProps) {
  return (
    <Modal visible={transferSearchModalVisible} animationType="fade" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <GlassCard style={[sharedStyles.modalCard, { maxHeight: '80%', width: 500, maxWidth: '94%' }]}>
          <Text style={sharedStyles.modalEyebrow}>SÉLECTION PRODUIT</Text>
          <Text style={sharedStyles.modalTitle}>Recherche Article (Transfert)</Text>
          <View style={[sharedStyles.searchBar, { marginTop: 12 }]}>
            <Search color={colors.gold} size={16} />
            <TextInput
              style={sharedStyles.searchInput}
              placeholder="Rechercher par nom ou référence..."
              placeholderTextColor={colors.textTertiary}
              value={transferSearchText}
              onChangeText={setTransferSearchText}
              autoFocus
            />
          </View>
          <ScrollView style={{ marginTop: 10, maxHeight: 300 }}>
            {products.filter(p => multiCriteriaSearch(p, transferSearchText)).slice(0, 15).map(p => (
              <TouchableOpacity key={p.id} style={sharedStyles.searchResultItem} onPress={() => selectTransferProduct(p)}>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.searchResultName}>{p.name}</Text>
                  <Text style={sharedStyles.searchResultInfo}>
                    {p.category} {p.size ? `• Taille: ${p.size}` : ''} {p.color ? `• Couleur: ${p.color}` : ''}
                  </Text>
                </View>
                <Text style={sharedStyles.searchResultStock}>Stock: {p.stock}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[sharedStyles.modalCancelBtn, { marginTop: 15 }]} onPress={() => setTransferSearchModalVisible(false)}>
            <Text style={sharedStyles.modalCancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </Modal>
  );
}
