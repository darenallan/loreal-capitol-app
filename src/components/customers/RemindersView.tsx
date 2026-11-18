import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BellRing } from 'lucide-react-native';
import { colors, fonts, formatMoney, space } from '../../theme';
import { EmptyState } from '../../ui';
import type { CustomerReminder } from '../../db/services/customers';
import AdvanceReminderCard from './AdvanceReminderCard';

type Props = {
  reminders: CustomerReminder[];
  showStore: boolean;
  onOpenCustomer: (key: string) => void;
};

/** Acomptes en retard ou échéant sous 3 jours, triés par échéance, avec relance directe. */
export default function RemindersView({ reminders, showStore, onOpenCustomer }: Props) {
  if (reminders.length === 0) {
    return (
      <EmptyState
        icon={<BellRing color={colors.gold} size={24} />}
        title="Aucune relance à faire"
        subtitle="Aucun acompte en retard ni échéant dans les 3 prochains jours."
      />
    );
  }
  const late = reminders.filter(r => r.advance.isOverdue);
  const total = reminders.reduce((s, r) => s + r.advance.amountRemaining, 0);
  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>
        {reminders.length} acompte{reminders.length > 1 ? 's' : ''} à relancer
        {late.length ? ` · ${late.length} en retard` : ''} · {formatMoney(total)} FCFA restant dû
      </Text>
      {reminders.map(r => (
        <AdvanceReminderCard
          key={r.advance.id}
          advance={r.advance}
          customerName={r.customer.name}
          phone={r.customer.phone}
          showStore={showStore}
          onOpenCustomer={() => onOpenCustomer(r.customer.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  summary: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
