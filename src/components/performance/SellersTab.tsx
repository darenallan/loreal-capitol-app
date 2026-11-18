import React from 'react';
import { Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { formatMoney } from '../../theme';
import { EmptyState, GlassCard } from '../../ui';
import { PerfStoreFilter, SellerRanking } from '../../db/services/analytics';
import { HBar, Notice, Stat, StoreTag } from './PerfPrimitives';
import { usePerfStyles } from './perfStyles';

/** Onglet 2 — classement des vendeuses par recette. */
export default function SellersTab({ data, store, wide }: { data: SellerRanking; store: PerfStoreFilter; wide: boolean }) {
  const { s, c } = usePerfStyles();
  const max = Math.max(1, ...data.rows.map(r => r.revenue));
  const half = Math.ceil(data.rows.length / 2);
  const columns = wide && data.rows.length > 3 ? [data.rows.slice(0, half), data.rows.slice(half)] : [data.rows];

  return (
    <View style={s.gap}>
      {data.excludedGlobalCount > 0 ? (
        <Notice>
          {data.excludedGlobalCount} recette(s) globale(s) saisie(s) a posteriori ({formatMoney(data.excludedGlobalRevenue)} FCFA)
          exclue(s) du classement : elles ne sont rattachées à aucune vendeuse.
        </Notice>
      ) : null}

      {data.rows.length === 0 ? (
        <GlassCard style={s.card}>
          <EmptyState icon={<Users size={24} color={c.gold} />} title="Aucune vente" subtitle="Aucune vente sur cette période pour ce filtre." />
        </GlassCard>
      ) : (
        <View style={wide ? s.grid2 : s.gap}>
          {columns.map((rows, ci) => (
            <GlassCard key={ci} style={[s.card, wide ? { flex: 1, minWidth: 0 } : null]}>
              {ci === 0 ? <Text style={s.cardTitle}>Classement par recette</Text> : <Text style={s.cardTitle}>Suite du classement</Text>}
              {rows.map((r, i) => {
                const rank = ci * half + i + 1;
                return (
                  <View key={r.key} style={[s.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
                    accessible
                    accessibilityLabel={`${rank}e : ${r.name}, ${formatMoney(r.revenue)} FCFA, ${r.salesCount} ventes, panier moyen ${formatMoney(r.avgBasket)} FCFA, ${r.itemsCount} articles`}>
                    <View style={[s.row, { gap: 10 }]}>
                      <View style={s.rank}><Text style={s.rankText}>{rank}</Text></View>
                      <Text style={[s.strong, { flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                      <View style={[s.row, { gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }]}>
                        {r.stores.map(k => <StoreTag key={k} store={k} />)}
                      </View>
                    </View>
                    <HBar value={r.revenue} max={max} color={c.gold} display={`${formatMoney(r.revenue)} FCFA`} />
                    <View style={s.stats}>
                      <Stat label="Ventes" value={String(r.salesCount)} />
                      <Stat label="Panier" value={formatMoney(r.avgBasket)} />
                      <Stat label="Articles" value={String(r.itemsCount)} />
                      {r.backdatedCount > 0 ? <Stat label="Saisies ant." value={String(r.backdatedCount)} /> : null}
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          ))}
        </View>
      )}
      <Text style={s.muted}>
        {store === 'all' ? 'Toutes boutiques' : 'Filtre boutique actif'} · noms regroupés sans tenir compte des majuscules ni des espaces ·
        nb ventes, panier et articles hors tranches d'acompte.
      </Text>
    </View>
  );
}
