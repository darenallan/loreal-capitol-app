import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { alpha, colors, fonts, formatMoney, radius, space } from '../../theme';
import { Pill, PressableScale } from '../../ui';
import type { Customer } from '../../db/services/customers';
import { formatCustomerPhone } from '../../db/services/customers';
import { dayLabel } from './customerActions';

type Props = {
  customer: Customer;
  selected?: boolean;
  onPress: () => void;
};

function initials(name: string): string {
  const parts = name.replace(/^(m|mr|mme|mlle|monsieur|madame)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  const s = parts.slice(0, 2).map(p => p[0]).join('');
  return (s || '?').toUpperCase();
}

/** Ligne de la liste des clients. */
export default function CustomerListItem({ customer: c, selected, onPress }: Props) {
  const phone = c.hasPhone ? formatCustomerPhone(c.phone) : 'Sans téléphone';
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      hoverLift={0}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${c.name}, ${phone}, ${c.purchaseCount} achat${c.purchaseCount > 1 ? 's' : ''}, ${formatMoney(c.totalSpent)} francs dépensés${c.remainingDue > 0 ? `, reste dû ${formatMoney(c.remainingDue)} francs` : ''}${c.hasOverdue ? ', en retard' : ''}`}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={[styles.avatar, c.hasOverdue && styles.avatarLate]}>
        <Text style={[styles.avatarText, c.hasOverdue && styles.avatarTextLate]}>{initials(c.name)}</Text>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.name}>{c.name}</Text>
        <Text numberOfLines={1} style={[styles.phone, !c.hasPhone && styles.noPhone]}>{phone}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {c.purchaseCount} achat{c.purchaseCount > 1 ? 's' : ''} · dernière visite {dayLabel(c.lastVisit)}
        </Text>
        {(c.hasOverdue || c.hasOpenAdvance) ? (
          <View style={styles.pills}>
            {c.hasOverdue ? <Pill label="En retard" tone="danger" /> : null}
            {c.hasOpenAdvance ? <Pill label={`Reste ${formatMoney(c.remainingDue)} F`} tone="warning" /> : null}
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{formatMoney(c.totalSpent)}</Text>
        <Text style={styles.currency}>FCFA</Text>
      </View>
      <ChevronRight color={colors.textTertiary} size={18} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 64,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surface,
  },
  rowSelected: { borderColor: colors.borderGold, backgroundColor: colors.goldSofter },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: alpha(colors.gold, 0.35),
  },
  avatarLate: { backgroundColor: colors.dangerSoft, borderColor: alpha(colors.danger, 0.4) },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.gold },
  avatarTextLate: { color: colors.danger },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  phone: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  noPhone: { color: colors.textTertiary, fontStyle: 'italic' },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  right: { alignItems: 'flex-end' },
  total: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.gold, fontVariant: ['tabular-nums'] },
  currency: { fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary },
});
