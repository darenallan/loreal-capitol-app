import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, formatMoney } from '../../theme';
import PaymentMethodPicker from './PaymentMethodPicker';
import { formStyles } from './formStyles';

type Props = {
  amount: string;
  onAmountChange: (v: string) => void;
  method: string;
  onMethodChange: (m: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
};

/** Formulaire « Recette globale » : un montant total pour la journée, sans impact stock. */
export default function GlobalReceiptForm({ amount, onAmountChange, method, onMethodChange, note, onNoteChange }: Props) {
  const numeric = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  return (
    <View>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Montant encaissé (FCFA)</Text>
        <TextInput
          style={[formStyles.input, styles.amountInput]}
          value={amount}
          onChangeText={(v) => onAmountChange(v.replace(/[^\d ]/g, ''))}
          placeholder="0"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="numeric"
          accessibilityLabel="Montant encaissé"
        />
        {numeric > 0 ? <Text style={formStyles.hint}>{formatMoney(numeric)} FCFA</Text> : null}
      </View>

      <PaymentMethodPicker value={method} onChange={onMethodChange} />

      <View style={formStyles.field}>
        <Text style={formStyles.label}>Note (facultatif)</Text>
        <TextInput
          style={[formStyles.input, formStyles.inputMultiline]}
          value={note}
          onChangeText={onNoteChange}
          placeholder="Ex. : cahier de caisse du samedi, saisie oubliée…"
          placeholderTextColor={colors.inputPlaceholder}
          multiline
        />
      </View>
      <Text style={formStyles.hint}>Une recette globale n'impacte jamais le stock.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amountInput: { fontFamily: fonts.extrabold, fontSize: 22, minHeight: 56 },
});
