import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Minus, PackageCheck, Plus } from 'lucide-react-native';
import { formatMoney } from '../../theme';
import { EmptyState, GlassCard, Pill, haptic } from '../../ui';
import {
  PERF_STORE_LABELS, PERF_STORES, PerfStore, PerfStoreFilter, StockReport, formatDayFull,
} from '../../db/services/analytics';
import { ChipGroup, StoreTag } from './PerfPrimitives';
import { articleDetail } from './ArticlesTab';
import { usePerfStyles } from './perfStyles';

export const DORMANT_OPTIONS = [30, 60, 90] as const;
export type DormantDays = typeof DORMANT_OPTIONS[number];

const PAGE = 25;

/** Onglet 4 — stock bas, articles dormants, ruptures à réassortir. */
export default function StockTab({ data, store, wide, threshold, onThreshold, dormantDays, onDormantDays }: {
  data: StockReport; store: PerfStoreFilter; wide: boolean;
  threshold: number; onThreshold: (n: number) => void;
  dormantDays: DormantDays; onDormantDays: (n: DormantDays) => void;
}) {
  const { s, c } = usePerfStyles();
  const stores: PerfStore[] = store === 'all' ? PERF_STORES : [store];
  const step = (d: number) => {
    const n = Math.max(0, Math.min(10, threshold + d));
    if (n !== threshold) { haptic('selection'); onThreshold(n); }
  };

  return (
    <View style={s.gap}>
      {/* (a) Stock bas */}
      <GlassCard style={s.card}>
        <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }]}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.cardTitle}>Stock bas</Text>
            <Text style={s.cardSub}>Articles dont le stock est inférieur ou égal au seuil</Text>
          </View>
          <View style={[s.row, { gap: 8 }]} accessibilityLabel={`Seuil de stock bas : ${threshold}`}>
            <Pressable onPress={() => step(-1)} disabled={threshold <= 0} style={[s.stepBtn, threshold <= 0 && { opacity: 0.4 }]}
              accessibilityRole="button" accessibilityLabel="Diminuer le seuil" accessibilityState={{ disabled: threshold <= 0 }}>
              <Minus size={18} color={c.gold} />
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.stepValue}>{threshold}</Text>
              <Text style={s.muted}>seuil</Text>
            </View>
            <Pressable onPress={() => step(1)} disabled={threshold >= 10} style={[s.stepBtn, threshold >= 10 && { opacity: 0.4 }]}
              accessibilityRole="button" accessibilityLabel="Augmenter le seuil" accessibilityState={{ disabled: threshold >= 10 }}>
              <Plus size={18} color={c.gold} />
            </Pressable>
          </View>
        </View>
        <View style={wide && stores.length > 1 ? s.grid2 : s.gap}>
          {stores.map(k => (
            <View key={k} style={wide && stores.length > 1 ? s.col : { gap: 6 }}>
              <View style={[s.row, { gap: 8, justifyContent: 'space-between' }]}>
                <StoreTag store={k} />
                <Pill tone={data.lowStock[k].length ? 'warning' : 'success'} label={`${data.lowStock[k].length} article(s)`} />
              </View>
              <PagedList
                rows={data.lowStock[k]}
                empty={`Aucun article ≤ ${threshold} à ${PERF_STORE_LABELS[k]}`}
                render={(p, i) => (
                  <ProductLine key={p.id} first={i === 0} name={p.name} detail={articleDetail(p)}
                    right={`${p.stock}`} rightLabel="en stock" danger={p.stock <= 0}
                    foot={p.lastSaleDay ? `Dernière vente ${formatDayFull(p.lastSaleDay)}` : 'Jamais vendu'} />
                )}
              />
            </View>
          ))}
        </View>
      </GlassCard>

      <View style={wide ? s.grid2 : s.gap}>
        {/* (b) Dormants */}
        <GlassCard style={[s.card, wide ? { flex: 1, minWidth: 0 } : null]}>
          <Text style={s.cardTitle}>Articles dormants</Text>
          <Text style={s.cardSub}>En stock, aucune vente depuis {dormantDays} jours</Text>
          <ChipGroup<DormantDays>
            label="Durée sans vente"
            options={DORMANT_OPTIONS.map(n => ({ id: n, label: `${n} jours` }))}
            value={dormantDays}
            onChange={onDormantDays}
          />
          <Text style={s.body}>
            Valeur immobilisée : <Text style={s.strong}>{formatMoney(data.dormantValue)} FCFA</Text> · {data.dormant.length} article(s)
          </Text>
          <PagedList
            rows={data.dormant}
            empty="Aucun article dormant"
            render={(p, i) => (
              <ProductLine key={p.id} first={i === 0} name={p.name} detail={articleDetail(p)} store={p.store as PerfStore}
                right={formatMoney(p.immobilizedValue)} rightLabel={`${p.stock} × ${formatMoney(p.price)}`}
                foot={p.lastSaleDay ? `Dernière vente ${formatDayFull(p.lastSaleDay)} (il y a ${p.daysSince} j)` : 'Aucune vente enregistrée'} />
            )}
          />
        </GlassCard>

        {/* (c) Ruptures */}
        <GlassCard style={[s.card, wide ? { flex: 1, minWidth: 0 } : null]}>
          <Text style={s.cardTitle}>Ruptures à réassortir</Text>
          <Text style={s.cardSub}>Stock à 0 mais vendus ces 30 derniers jours</Text>
          <PagedList
            rows={data.stockouts}
            empty="Aucune rupture sur un article vendu récemment"
            render={(p, i) => (
              <ProductLine key={p.id} first={i === 0} name={p.name} detail={articleDetail(p)} store={p.store as PerfStore}
                right={`${p.soldLast30} u.`} rightLabel="vendus / 30 j" danger
                foot={p.lastSaleDay ? `Dernière vente ${formatDayFull(p.lastSaleDay)}` : ''} />
            )}
          />
        </GlassCard>
      </View>
      <Text style={s.muted}>Stock lu depuis la fiche produit (cache rafraîchi en arrière-plan). Aucune modification n'est faite ici.</Text>
    </View>
  );
}

function PagedList<T>({ rows, empty, render }: { rows: T[]; empty: string; render: (r: T, i: number) => React.ReactNode }) {
  const { s, c } = usePerfStyles();
  const [limit, setLimit] = useState(PAGE);
  if (rows.length === 0) {
    return <EmptyState icon={<PackageCheck size={22} color={c.success} />} title="Rien à signaler" subtitle={empty} />;
  }
  return (
    <View>
      {rows.slice(0, limit).map(render)}
      {rows.length > limit ? (
        <Pressable onPress={() => setLimit(l => l + PAGE)} style={[s.chip, { marginTop: 8, alignSelf: 'center' }]}
          accessibilityRole="button" accessibilityLabel={`Afficher plus (${rows.length - limit} restants)`}>
          <Text style={s.chipText}>Afficher plus ({rows.length - limit})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ProductLine({ name, detail, store, right, rightLabel, foot, danger, first }: {
  name: string; detail: string; store?: PerfStore; right: string; rightLabel: string; foot: string; danger?: boolean; first?: boolean;
}) {
  const { s, c } = usePerfStyles();
  return (
    <View style={[s.listRow, !first && { borderTopWidth: 1, borderTopColor: c.border }]}
      accessible accessibilityLabel={`${name}${detail ? `, ${detail}` : ''}${store ? `, ${PERF_STORE_LABELS[store]}` : ''} : ${right} ${rightLabel}. ${foot}`}>
      <View style={[s.row, { gap: 10, alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.strong} numberOfLines={2}>{name}</Text>
          {detail ? <Text style={s.muted} numberOfLines={1}>{detail}</Text> : null}
          {store ? <StoreTag store={store} /> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.valueSm, { fontSize: 15 }, danger && s.down]}>{right}</Text>
          <Text style={s.muted}>{rightLabel}</Text>
        </View>
      </View>
      {foot ? <Text style={s.muted}>{foot}</Text> : null}
    </View>
  );
}
