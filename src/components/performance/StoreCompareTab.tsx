import React from 'react';
import { Text, View } from 'react-native';
import { History } from 'lucide-react-native';
import { formatMoney } from '../../theme';
import { AnimatedNumber, GlassCard, Pill } from '../../ui';
import {
  PERF_STORE_LABELS, PERF_STORES, StoreComparison, StoreSummary, formatDayShort, formatRange,
} from '../../db/services/analytics';
import { DeltaBadge, HBar, Notice, Stat, StoreLegend } from './PerfPrimitives';
import { storeColor, usePerfStyles } from './perfStyles';

/** Onglet 1 — La Falaise vs Tougou sur la période. */
export default function StoreCompareTab({ data, wide }: { data: StoreComparison; wide: boolean }) {
  const { s } = usePerfStyles();
  const compareLabel = formatRange(data.previousRange);
  const backdatedTotal = data.stores.reduce((a, x) => a + x.backdatedRevenue, 0);
  const backdatedCount = data.stores.reduce((a, x) => a + x.backdatedCount, 0);

  return (
    <View style={s.gap}>
      <GlassCard variant="gold" style={s.card}>
        <Text style={s.eyebrow}>Recette totale · 2 boutiques</Text>
        <AnimatedNumber value={data.totalRevenue} style={s.value} suffix=" FCFA" />
        <DeltaBadge pct={data.totalDeltaPct} previous={data.totalPrevious} compareLabel={compareLabel} />
      </GlassCard>

      {backdatedCount > 0 ? (
        <Notice>
          Dont {formatMoney(backdatedTotal)} FCFA en {backdatedCount} saisie(s) antérieure(s) du Boss, incluses dans les totaux
          et repérées par l'icône historique dans les barres par jour.
        </Notice>
      ) : null}

      <View style={wide ? s.grid2 : s.gap}>
        {data.stores.map(st => (
          <View key={st.store} style={wide ? s.col : undefined}>
            <StoreCard st={st} compareLabel={compareLabel} />
          </View>
        ))}
      </View>

      <View style={wide ? s.grid2 : s.gap}>
        <View style={wide ? s.col : undefined}><DailyChart data={data} /></View>
        <View style={wide ? s.col : undefined}><PaymentsCard data={data} /></View>
      </View>
    </View>
  );
}

function StoreCard({ st, compareLabel }: { st: StoreSummary; compareLabel: string }) {
  const { s, c } = usePerfStyles();
  return (
    <GlassCard style={s.card} accessibilityLabel={`${PERF_STORE_LABELS[st.store]} : recette ${formatMoney(st.revenue)} FCFA, ${st.salesCount} ventes`}>
      <View style={[s.row, { gap: 8 }]}>
        <View style={[s.swatch, { backgroundColor: storeColor(c, st.store) }]} />
        <Text style={s.cardTitle}>{PERF_STORE_LABELS[st.store]}</Text>
      </View>
      <AnimatedNumber value={st.revenue} style={s.value} suffix=" FCFA" />
      <DeltaBadge pct={st.deltaPct} previous={st.previousRevenue} compareLabel={compareLabel} />
      <View style={s.divider} />
      <View style={s.stats}>
        <Stat label="Ventes" value={String(st.salesCount)} />
        <Stat label="Panier moyen" value={`${formatMoney(st.avgBasket)} FCFA`} />
      </View>
      {st.installmentCount > 0 ? (
        <Text style={s.muted}>
          + {st.installmentCount} tranche(s) d'acompte encaissée(s) : {formatMoney(st.installmentRevenue)} FCFA (hors nb ventes et panier)
        </Text>
      ) : null}
      {st.backdatedCount > 0 ? (
        <Pill tone="warning" label={`${st.backdatedCount} saisie(s) antérieure(s) · ${formatMoney(st.backdatedRevenue)}`} />
      ) : null}
    </GlassCard>
  );
}

function DailyChart({ data }: { data: StoreComparison }) {
  const { s, c } = usePerfStyles();
  const max = Math.max(1, ...data.daily.map(d => Math.max(d.falaise, d.tougou)));
  return (
    <GlassCard style={s.card}>
      <Text style={s.cardTitle}>Recette par jour</Text>
      <Text style={s.cardSub}>Montants encaissés en FCFA, jour local</Text>
      <StoreLegend />
      <View style={{ gap: 10, marginTop: 4 }}>
        {data.daily.map(d => {
          const bd = d.backdatedFalaise + d.backdatedTougou;
          return (
            <View key={d.day} style={[s.row, { gap: 10, alignItems: 'center' }]}>
              <View style={{ width: 62 }}>
                <Text style={s.label}>{formatDayShort(d.day)}</Text>
                {bd > 0 ? (
                  <View style={[s.row, { gap: 3 }]} accessible accessibilityLabel={`Dont ${formatMoney(bd)} FCFA saisis a posteriori`}>
                    <History size={12} color={c.warning} />
                    <Text style={[s.muted, { fontSize: 12 }]}>ant.</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                {PERF_STORES.map(k => (
                  <HBar
                    key={k}
                    value={d[k]}
                    max={max}
                    color={storeColor(c, k)}
                    accessibilityLabel={`${formatDayShort(d.day)}, ${PERF_STORE_LABELS[k]} : ${formatMoney(d[k])} FCFA`}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}

function PaymentsCard({ data }: { data: StoreComparison }) {
  const { s, c } = usePerfStyles();
  return (
    <GlassCard style={s.card}>
      <Text style={s.cardTitle}>Moyens de paiement</Text>
      <Text style={s.cardSub}>Part de la recette de chaque boutique</Text>
      {data.stores.map(st => (
        <View key={st.store} style={{ gap: 8, marginTop: 6 }}>
          <View style={[s.row, { gap: 8 }]}>
            <View style={[s.swatch, { backgroundColor: storeColor(c, st.store) }]} />
            <Text style={s.strong}>{PERF_STORE_LABELS[st.store]}</Text>
          </View>
          {st.payments.length === 0 ? <Text style={s.muted}>Aucune vente sur la période</Text> : null}
          {st.payments.map(p => (
            <View key={p.method} style={{ gap: 3 }}>
              <View style={[s.row, { justifyContent: 'space-between', gap: 8 }]}>
                <Text style={s.label} numberOfLines={1}>{p.method} · {p.count} vente(s)</Text>
                <Text style={[s.valueSm, s.num]}>{Math.round(p.share * 100)} %</Text>
              </View>
              <HBar
                value={p.amount}
                max={st.revenue}
                color={storeColor(c, st.store)}
                accessibilityLabel={`${PERF_STORE_LABELS[st.store]}, ${p.method} : ${formatMoney(p.amount)} FCFA, ${Math.round(p.share * 100)} %`}
              />
            </View>
          ))}
        </View>
      ))}
    </GlassCard>
  );
}
