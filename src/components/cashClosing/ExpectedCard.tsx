import React from 'react';
import { Text, View } from 'react-native';
import { Info, Receipt } from 'lucide-react-native';
import { formatMoney } from '../../theme';
import { AnimatedNumber, GlassCard, LoadingState, Pill } from '../../ui';
import { CASH_METHODS, CashSalesBreakdown, cashSalesForMethod } from '../../db/services/cashClosing';
import { useCashStyles } from './styles';

type Props = {
  breakdown: CashSalesBreakdown | null;
  loading?: boolean;
  /** Libellé : « Attendu (en direct) » ou « Attendu au moment de la clôture » */
  live?: boolean;
};

/** Recette du jour ventilée par moyen de paiement (mêmes chiffres que le Dashboard). */
export default function ExpectedCard({ breakdown, loading, live }: Props) {
  const { s, c } = useCashStyles();

  if (!breakdown) {
    return (
      <GlassCard style={s.card}>
        <LoadingState label={loading ? 'Calcul de la recette du jour…' : 'Recette indisponible'} />
      </GlassCard>
    );
  }

  const b = breakdown;
  const advTotal = CASH_METHODS.reduce((sum, m) => sum + b.advance_initial[m.key], 0);
  const bossTotal = b.boss.momo_boss + b.boss.om_boss;
  const otherEntries = Object.entries(b.other).filter(([, v]) => v);

  return (
    <GlassCard variant="gold" style={s.card}>
      <View style={s.rowBetween}>
        <View style={[s.row, { flexShrink: 1 }]}>
          <Receipt color={c.gold} size={16} />
          <Text style={s.eyebrow} numberOfLines={1}>{live ? 'Recette du jour · en direct' : 'Recette à la clôture'}</Text>
        </View>
        <Pill label={`${b.sales_count} vente${b.sales_count > 1 ? 's' : ''}`} tone="gold" />
      </View>

      <AnimatedNumber value={b.sales_total} suffix=" FCFA" style={s.amountLg} />

      <View style={s.divider} />

      {CASH_METHODS.map(m => {
        const adv = b.advance_initial[m.key];
        return (
          <View key={m.key} style={{ gap: 2 }}>
            <View style={s.rowBetween}>
              <Text style={s.body}>{m.label}</Text>
              <Text style={s.amount}>{formatMoney(cashSalesForMethod(b, m.key))} F</Text>
            </View>
            {adv > 0 ? (
              <Text style={s.caption}>
                dont {formatMoney(adv)} F d'acomptes initiaux (rangés sous « Avance » au Dashboard)
              </Text>
            ) : null}
          </View>
        );
      })}

      {bossTotal > 0 || b.advance_unassigned > 0 || otherEntries.length > 0 || b.gifts_count > 0 ? (
        <>
          <View style={s.divider} />
          <Text style={s.label}>Hors caisse / non attribué</Text>
          {b.boss.momo_boss > 0 ? <Line label="MoMo Boss" value={b.boss.momo_boss} /> : null}
          {b.boss.om_boss > 0 ? <Line label="OM Boss" value={b.boss.om_boss} /> : null}
          {b.advance_unassigned > 0 ? <Line label="Acomptes sans moyen précisé" value={b.advance_unassigned} /> : null}
          {otherEntries.map(([k, v]) => <Line key={k} label={k} value={v} />)}
          {b.gifts_count > 0 ? (
            <Text style={s.caption}>{b.gifts_count} don{b.gifts_count > 1 ? 's' : ''} « Ami / Don » (0 F encaissé)</Text>
          ) : null}
        </>
      ) : null}

      {advTotal > 0 ? (
        <View style={s.notice}>
          <Info color={c.info} size={16} />
          <Text style={s.noticeText}>
            Les acomptes initiaux sont ajoutés à l'attendu de leur moyen réel : ils sont bien dans le tiroir.
          </Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  const { s } = useCashStyles();
  return (
    <View style={s.rowBetween}>
      <Text style={[s.body, { flexShrink: 1 }]}>{label}</Text>
      <Text style={s.amount}>{formatMoney(value)} F</Text>
    </View>
  );
}
