import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, PackageCheck } from 'lucide-react-native';
import { colors, fonts, formatMoney, radius } from '../../theme';
import { GlassCard, GoldButton } from '../../ui';
import type { HistorySale } from '../../db/database';
import { formatYMDLong, storeLabel } from '../../utils/backdatedHelpers';
import { formStyles } from './formStyles';

type Props = {
  sale: HistorySale | null;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

/** Confirmation de suppression d'une saisie antérieure (Modal RN, non bloquante sur le web). */
export default function ConfirmDeleteModal({ sale, loading, error, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (sale) setReason(''); }, [sale?.id]);

  return (
    <Modal visible={!!sale} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
      <View style={styles.backdrop}>
        <GlassCard variant="solid" style={styles.card}>
          <View style={styles.iconWrap}>
            <AlertTriangle color={colors.danger} size={22} />
          </View>
          <Text style={styles.title}>Supprimer cette saisie ?</Text>
          {sale ? (
            <Text style={styles.desc}>
              {formatMoney(sale.total)} FCFA · {sale.payment_method || '—'} · {storeLabel(sale.store)}{'\n'}
              <Text style={styles.descDate}>{formatYMDLong(sale.day)}</Text>
            </Text>
          ) : null}

          {sale?.stock_impacted ? (
            <View style={styles.stockNote}>
              <PackageCheck color={colors.info} size={16} />
              <Text style={styles.stockText}>Le stock décrémenté lors de la saisie sera restitué.</Text>
            </View>
          ) : null}

          <View style={formStyles.field}>
            <Text style={formStyles.label}>Motif (facultatif)</Text>
            <TextInput
              style={[formStyles.input, formStyles.inputMultiline]}
              value={reason}
              onChangeText={setReason}
              placeholder="Ex. : doublon, erreur de montant…"
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              editable={!loading}
            />
          </View>

          {error ? <Text style={[formStyles.error, styles.error]}>{error}</Text> : null}

          <View style={styles.actions}>
            <GoldButton label="Annuler" variant="ghost" onPress={onCancel} disabled={loading} style={styles.actionBtn} />
            <GoldButton label="Supprimer" variant="danger" onPress={() => onConfirm(reason.trim())} loading={loading} style={styles.actionBtn} />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as any) : null),
  },
  card: { width: '100%', maxWidth: 440 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    marginBottom: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrimary, marginBottom: 6 },
  desc: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 14 },
  descDate: { fontFamily: fonts.medium, color: colors.textMuted, textTransform: 'capitalize' },
  stockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
    marginBottom: 14,
  },
  stockText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.info },
  error: { marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 130 },
});
