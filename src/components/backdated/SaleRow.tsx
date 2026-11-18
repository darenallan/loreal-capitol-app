import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { colors, fonts, formatMoney, radius } from '../../theme';
import { IconButton, Pill } from '../../ui';
import type { HistorySale } from '../../db/database';
import { storeLabel } from '../../utils/backdatedHelpers';

type Props = {
  sale: HistorySale;
  showStore?: boolean;
  onDelete?: (sale: HistorySale) => void;
};

function timeLabel(sale: HistorySale): string {
  if (sale.backdated) return 'Jour entier';
  const d = new Date(sale.date);
  if (isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Ligne de vente : heure, vendeur, articles, montant ; suppression si saisie antérieure. */
export default function SaleRow({ sale, showStore, onDelete }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{timeLabel(sale)}</Text>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.items}>{sale.itemsLabel || 'Vente'}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {sale.seller_name || 'Vendeur inconnu'}
          {sale.client_name ? ` · ${sale.client_name}` : ''}
          {showStore ? ` · ${storeLabel(sale.store)}` : ''}
        </Text>
        <View style={styles.pills}>
          {sale.payment_method ? <Pill label={sale.payment_method} tone="neutral" /> : null}
          {sale.backdated ? <Pill label="Saisie antérieure" tone="violet" /> : null}
          {sale.backdated && sale.stock_impacted ? <Pill label="Stock impacté" tone="info" /> : null}
          {sale.is_advance === 1 ? <Pill label="Avance" tone="warning" /> : null}
        </View>
        {sale.note ? <Text numberOfLines={2} style={styles.note}>« {sale.note} »</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatMoney(sale.total)}</Text>
        <Text style={styles.currency}>FCFA</Text>
        {sale.backdated && onDelete ? (
          <IconButton
            icon={<Trash2 color={colors.danger} size={16} />}
            tone="danger"
            size={36}
            onPress={() => onDelete(sale)}
            accessibilityLabel="Supprimer cette saisie antérieure"
            style={styles.deleteBtn}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  timeCol: { width: 52, paddingTop: 2 },
  time: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  body: { flex: 1, minWidth: 0, gap: 4 },
  items: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.textPrimary },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  note: { fontFamily: fonts.displayItalic, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  amount: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  currency: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textMuted },
  deleteBtn: { marginTop: 8 },
});
