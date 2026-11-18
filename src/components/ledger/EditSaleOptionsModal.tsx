import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Wallet, Edit3 } from 'lucide-react-native';
import { GlassCard, GoldButton } from '../../ui';
import { sharedStyles } from './ledgerStyles';
import { colors } from '../../theme';

export interface EditSaleOptionsModalProps {
  editOptionsVisible: boolean;
  setEditOptionsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSaleForEdit: any;
  setPaymentEditModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteSale: (saleOrId: any) => void;
}

/** Modale de choix de correction d'une vente. */
export default function EditSaleOptionsModal({
  editOptionsVisible,
  setEditOptionsVisible,
  selectedSaleForEdit,
  setPaymentEditModal,
  handleDeleteSale,
}: EditSaleOptionsModalProps) {
  return (
    <Modal visible={editOptionsVisible} animationType="fade" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <GlassCard style={[sharedStyles.modalCard, { width: 380, maxWidth: '92%' }]} glow="gold">
          <Text style={sharedStyles.modalTitle}>Modifier / Corriger la Vente</Text>
          <Text style={sharedStyles.modalDate}>Sélectionnez l'action de correction souhaitée</Text>

          <View style={{ gap: 10, marginTop: 15 }}>
            <GoldButton 
              label="Corriger une erreur / Supprimer"
              onPress={() => {
                const target = selectedSaleForEdit;
                setEditOptionsVisible(false);
                if (target) handleDeleteSale(target);
              }}
              size="md"
              icon={<Edit3 color={colors.onGold} size={16} />}
            />

            <GoldButton 
              label="Modifier Mode de Paiement"
              variant="glass"
              onPress={() => {
                setEditOptionsVisible(false);
                setPaymentEditModal(true);
              }}
              size="md"
              icon={<Wallet color={colors.gold} size={16} />}
            />

            <TouchableOpacity style={sharedStyles.modalCancelBtn} onPress={() => setEditOptionsVisible(false)}>
              <Text style={sharedStyles.modalCancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}
