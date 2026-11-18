import React, { useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { Lock, MessageCircle, RotateCcw, Unlock } from 'lucide-react-native';
import { formatMoney } from '../../theme';
import { GlassCard, GoldButton, Pill } from '../../ui';
import {
  CASH_DENOMINATIONS, CashClosing, buildCashClosingSummary, canReopenCashClosing, reopenCashClosing,
} from '../../db/services/cashClosing';
import { buildWhatsAppUrl, openExternalUrl } from '../../utils/receiptShare';
import DiffTable from './DiffTable';
import { useCashStyles } from './styles';

type Props = {
  user: any;
  closing: CashClosing;
  onReopened: (c: CashClosing) => void;
};

const timeFr = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/** Récapitulatif d'une clôture (lecture seule) + partage WhatsApp + réouverture (Boss). */
export default function ClosingRecap({ user, closing, onReopened }: Props) {
  const { s, c } = useCashStyles();
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const isClosed = closing.status === 'closed';
  const canReopen = canReopenCashClosing(user, closing);
  const b = closing.cash_breakdown;

  const share = () => {
    setShareError(null);
    const ok = openExternalUrl(buildWhatsAppUrl('', buildCashClosingSummary(closing)));
    if (!ok) setShareError("Impossible d'ouvrir WhatsApp sur cet appareil.");
  };

  const doReopen = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await reopenCashClosing(closing.store, closing.day, user, reason);
      setReopenOpen(false);
      setReason('');
      onReopened(updated);
    } catch (e: any) {
      setError(e?.message || 'Échec de la réouverture.');
    }
    setBusy(false);
  };

  return (
    <View style={{ gap: 16 }}>
      <GlassCard style={s.card}>
        <View style={s.rowBetween}>
          <View style={[s.row, { flexShrink: 1 }]}>
            {isClosed ? <Lock color={c.gold} size={16} /> : <Unlock color={c.warning} size={16} />}
            <Text style={s.eyebrow} numberOfLines={1}>{isClosed ? 'Caisse clôturée' : 'Clôture rouverte'}</Text>
          </View>
          <Pill label={`v${closing.version}`} tone={isClosed ? 'gold' : 'warning'} />
        </View>
        <Text style={s.body}>
          Par <Text style={s.strong}>{closing.closed_by_name || '—'}</Text> le {timeFr(closing.closed_at)} · {closing.sales_count} vente{closing.sales_count > 1 ? 's' : ''}
        </Text>
        {closing.reopened_at ? (
          <Text style={s.caption}>
            Rouverte par {closing.reopened_by_name || 'Boss'} le {timeFr(closing.reopened_at)}
            {closing.reopen_reason ? ` — « ${closing.reopen_reason} »` : ''}
          </Text>
        ) : null}

        <View style={s.divider} />
        <View style={s.rowBetween}>
          <Text style={s.body}>Fond de caisse</Text>
          <Text style={s.amount}>{formatMoney(closing.opening_float)} F</Text>
        </View>
        <View style={s.rowBetween}>
          <Text style={s.body}>Ventes en espèces</Text>
          <Text style={s.amount}>{formatMoney(closing.expected.cash_sales)} F</Text>
        </View>
        <View style={s.rowBetween}>
          <Text style={s.body}>Sorties de caisse</Text>
          <Text style={s.amount}>− {formatMoney(closing.cash_out_total)} F</Text>
        </View>
        {closing.cash_out.map((e, i) => (
          <Text key={`${e.label}_${i}`} style={s.caption}>• {e.label} : {formatMoney(e.amount)} F</Text>
        ))}

        {b ? (
          <>
            <View style={s.divider} />
            <Text style={s.label}>Comptage par coupures</Text>
            <View style={s.wrapRow}>
              {CASH_DENOMINATIONS.map(d => {
                const n = (b as any)[`b${d}`] || 0;
                return n ? <Pill key={d} tone="neutral" label={`${n} × ${formatMoney(d)}`} /> : null;
              })}
              {b.coins ? <Pill tone="neutral" label={`Pièces ${formatMoney(b.coins)} F`} /> : null}
            </View>
          </>
        ) : null}
      </GlassCard>

      <GlassCard style={s.card}>
        <Text style={s.eyebrow}>Attendu / Compté / Écart</Text>
        <DiffTable expected={closing.expected} counted={closing.counted} diff={closing.diff} diffTotal={closing.diff_total} />
        {closing.note ? (
          <>
            <View style={s.divider} />
            <Text style={s.label}>Note</Text>
            <Text style={s.body}>{closing.note}</Text>
          </>
        ) : null}
      </GlassCard>

      <GoldButton
        label="Partager le récap"
        variant="outline"
        icon={<MessageCircle color={c.gold} size={18} />}
        onPress={share}
        full
        testID="cash-share"
      />
      {shareError ? <Text style={s.error}>{shareError}</Text> : null}

      {canReopen ? (
        <GoldButton
          label="Rouvrir la caisse"
          variant="danger"
          icon={<RotateCcw color={c.danger} size={18} />}
          onPress={() => { setError(null); setReopenOpen(true); }}
          full
          testID="cash-reopen"
        />
      ) : null}

      <Modal visible={reopenOpen} transparent animationType="fade" onRequestClose={busy ? undefined : () => setReopenOpen(false)}>
        <View style={s.backdrop}>
          <GlassCard variant="solid" style={s.modalCard}>
            <Text style={s.title}>Rouvrir cette clôture ?</Text>
            <Text style={s.body}>
              La version actuelle (v{closing.version}) est archivée dans l'historique. La caisse pourra ensuite être re-clôturée.
            </Text>
            <Text style={s.label}>Motif (facultatif)</Text>
            <TextInput
              style={[s.input, s.inputMultiline]}
              value={reason}
              onChangeText={t => setReason(t.slice(0, 300))}
              placeholder="Ex. : vente oubliée, erreur de comptage…"
              placeholderTextColor={c.inputPlaceholder}
              multiline
              editable={!busy}
              accessibilityLabel="Motif de réouverture"
            />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={s.modalActions}>
              <GoldButton label="Annuler" variant="ghost" onPress={() => setReopenOpen(false)} disabled={busy} style={s.modalBtn} />
              <GoldButton label="Rouvrir" variant="danger" onPress={doReopen} loading={busy} style={s.modalBtn} testID="cash-reopen-confirm" />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}
