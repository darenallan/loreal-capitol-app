import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, fonts, radius } from '../../theme';
import { GlassCard } from '../../ui';
import { sharedStyles } from './ledgerStyles';

export interface PaymentEditModalProps {
  paymentEditModal: boolean;
  setPaymentEditModal: React.Dispatch<React.SetStateAction<boolean>>;
  submitPaymentChange: (newMethod: string) => Promise<void>;
}

/** Modale de changement du mode de paiement. */
export default function PaymentEditModal({ paymentEditModal, setPaymentEditModal, submitPaymentChange }: PaymentEditModalProps) {
  return (
    <Modal visible={paymentEditModal} animationType="fade" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <GlassCard style={[sharedStyles.modalCard, { width: 340, maxWidth: '90%' }]}>
          <Text style={sharedStyles.modalTitle}>Nouveau Mode</Text>
          <Text style={sharedStyles.modalDate}>Choisissez le mode de règlement réel</Text>

          <View style={{ gap: 8, marginTop: 12 }}>
            {['Espèces', 'MoMo', 'MoMo Boss', 'OM', 'OM Boss', 'Carte Bancaire'].map(m => (
              <TouchableOpacity 
                key={m} 
                style={styles.paymentSelectRow} 
                onPress={() => submitPaymentChange(m)}
              >
                <Text style={styles.paymentSelectRowText}>{m}</Text>
                <ChevronRight color={colors.gold} size={16} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[sharedStyles.modalCancelBtn, { marginTop: 15 }]} onPress={() => setPaymentEditModal(false)}>
            <Text style={sharedStyles.modalCancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  paymentSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  paymentSelectRowText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
});
