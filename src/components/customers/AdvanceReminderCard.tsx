import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MessageCircle, Phone, ChevronRight } from 'lucide-react-native';
import { alpha, colors, fonts, formatMoney, radius, space } from '../../theme';
import { GoldButton, Pill, PressableScale } from '../../ui';
import { localDayKey } from '../../utils/saleMath';
import type { CustomerAdvance } from '../../db/services/customers';
import { callCustomer, dayLabel, dueLabel, NO_PHONE_HINT, openWhatsAppReminder, storeName } from './customerActions';

type Props = {
  advance: CustomerAdvance;
  customerName: string;
  /** Numéro normalisé du client ('' si aucun). */
  phone: string;
  showStore?: boolean;
  /** Affiche le nom du client et un lien vers sa fiche (vue Relances). */
  onOpenCustomer?: () => void;
};

/** Carte d'acompte en cours : reste dû, échéance, relance WhatsApp et appel. */
export default function AdvanceReminderCard({ advance, customerName, phone, showStore, onOpenCustomer }: Props) {
  const due = dueLabel(advance);
  const target = phone || advance.phone;
  const canContact = !!target;
  const who = customerName || advance.clientName || 'ce client';

  return (
    <View style={[styles.card, advance.isOverdue && styles.cardLate]}>
      {onOpenCustomer ? (
        <PressableScale
          onPress={onOpenCustomer}
          haptic="selection"
          hoverLift={0}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir la fiche de ${who}`}
          style={styles.clientRow}
        >
          <Text numberOfLines={1} style={styles.clientName}>{who}</Text>
          <ChevronRight color={colors.textTertiary} size={18} />
        </PressableScale>
      ) : null}

      <View style={styles.topRow}>
        <View style={styles.flex}>
          <Text numberOfLines={2} style={styles.items}>{advance.itemsLabel}</Text>
          <Text style={styles.meta}>
            Versé {formatMoney(advance.amountPaid)} F sur {formatMoney(advance.total)} F
            {advance.createdAt ? ` · réservé le ${dayLabel(localDayKey(advance.createdAt))}` : ''}
            {showStore ? ` · ${storeName(advance.store)}` : ''}
          </Text>
        </View>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Reste dû</Text>
          <Text style={[styles.amount, advance.isOverdue && styles.amountLate]}>{formatMoney(advance.amountRemaining)}</Text>
          <Text style={styles.currency}>FCFA</Text>
        </View>
      </View>

      <View style={styles.pills}>
        {advance.isOverdue ? <Pill label="En retard" tone="danger" /> : null}
        <Pill label={due.label} tone={due.tone} />
      </View>

      <View style={styles.actions}>
        <GoldButton
          label="Relancer sur WhatsApp"
          size="md"
          disabled={!canContact}
          icon={<MessageCircle color={canContact ? colors.onGold : colors.textTertiary} size={18} />}
          onPress={() => openWhatsAppReminder(target, who, advance)}
          style={styles.actionMain}
        />
        <GoldButton
          label="Appeler"
          size="md"
          variant="outline"
          disabled={!canContact}
          icon={<Phone color={canContact ? colors.gold : colors.textTertiary} size={18} />}
          onPress={() => callCustomer(target)}
          style={styles.actionSecondary}
        />
      </View>
      {!canContact ? <Text style={styles.hint}>{NO_PHONE_HINT}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  cardLate: { borderColor: alpha(colors.danger, 0.45), backgroundColor: alpha(colors.danger, 0.06) },
  clientRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 8 },
  clientName: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary },
  topRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  items: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, marginTop: 4, lineHeight: 17 },
  amountBox: { alignItems: 'flex-end' },
  amountLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textTertiary },
  amount: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.gold, fontVariant: ['tabular-nums'] },
  amountLate: { color: colors.danger },
  currency: { fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  actionMain: { flexGrow: 1, flexBasis: 200 },
  actionSecondary: { flexGrow: 1, flexBasis: 120 },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.warning, lineHeight: 17 },
});
