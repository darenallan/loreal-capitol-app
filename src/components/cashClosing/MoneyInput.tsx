import React from 'react';
import { StyleProp, Text, TextInput, View, ViewStyle } from 'react-native';
import { formatMoney } from '../../theme';
import { useCashStyles } from './styles';

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  editable?: boolean;
  /** Affiche « = 12 500 F » sous le champ */
  showFormatted?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Garde uniquement les chiffres (montants FCFA entiers). */
export function digitsOnly(v: string): string {
  return String(v || '').replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
}

export function parseAmount(v: string): number {
  const n = parseInt(digitsOnly(v), 10);
  return isNaN(n) ? 0 : n;
}

/** Champ de saisie d'un montant en FCFA (clavier numérique). */
export default function MoneyInput({ label, value, onChange, placeholder = '0', hint, editable = true, showFormatted, style, testID }: Props) {
  const { s, c } = useCashStyles();
  return (
    <View style={[s.field, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        style={[s.input, !editable && s.inputDisabled]}
        value={value}
        onChangeText={t => onChange(digitsOnly(t))}
        placeholder={placeholder}
        placeholderTextColor={c.inputPlaceholder}
        keyboardType="number-pad"
        inputMode="numeric"
        editable={editable}
        accessibilityLabel={label || placeholder}
        testID={testID}
      />
      {showFormatted && value ? <Text style={s.hint}>= {formatMoney(parseAmount(value))} F</Text> : null}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}
