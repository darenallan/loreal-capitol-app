import React from 'react';
import { Text, View } from 'react-native';
import { PressableScale } from '../../ui';
import { BACKDATED_METHODS } from '../../utils/backdatedHelpers';
import { formStyles } from './formStyles';

/** Puces de sélection du moyen de paiement (libellés identiques au Dashboard, jamais « Avance »). */
export default function PaymentMethodPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>Moyen de paiement</Text>
      <View style={formStyles.chipsRow}>
        {BACKDATED_METHODS.map(m => {
          const active = m === value;
          return (
            <PressableScale
              key={m}
              onPress={() => onChange(m)}
              haptic="selection"
              hoverLift={0}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[formStyles.chip, active && formStyles.chipActive]}
            >
              <Text style={[formStyles.chipText, active && formStyles.chipTextActive]}>{m}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
