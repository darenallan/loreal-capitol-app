import React from 'react';
import { Text, View } from 'react-native';
import { Package } from 'lucide-react-native';
import { formatMoney } from '../../theme';
import { EmptyState, GlassCard } from '../../ui';
import { ArticleRanking, ArticleRow } from '../../db/services/analytics';
import { HBar, Notice, StoreTag } from './PerfPrimitives';
import { usePerfStyles } from './perfStyles';

export function articleDetail(r: { reference: string; size: string; color: string }): string {
  return [r.reference && `Réf. ${r.reference}`, r.size && `T. ${r.size}`, r.color].filter(Boolean).join(' · ');
}

/** Onglet 3 — top 10 par quantité et par chiffre d'affaires. */
export default function ArticlesTab({ data, wide }: { data: ArticleRanking; wide: boolean }) {
  const { s, c } = usePerfStyles();
  return (
    <View style={s.gap}>
      {data.excludedGlobalCount > 0 ? (
        <Notice>
          {data.excludedGlobalCount} recette(s) globale(s) saisie(s) a posteriori ({formatMoney(data.excludedGlobalRevenue)} FCFA)
          exclue(s) : ce ne sont pas des articles.
        </Notice>
      ) : null}
      {data.distinctCount === 0 ? (
        <GlassCard style={s.card}>
          <EmptyState icon={<Package size={24} color={c.gold} />} title="Aucun article vendu" subtitle="Aucune vente d'article sur cette période pour ce filtre." />
        </GlassCard>
      ) : (
        <View style={wide ? s.grid2 : s.gap}>
          <TopCard title="Top 10 · Quantité" sub="Unités vendues" rows={data.byQuantity} metric="qty" wide={wide} />
          <TopCard title="Top 10 · Chiffre d'affaires" sub="Prix × quantité, en FCFA" rows={data.byRevenue} metric="ca" wide={wide} />
        </View>
      )}
      <Text style={s.muted}>
        {data.distinctCount} article(s) distinct(s) · regroupés par fiche produit, sinon par nom + référence · tranches d'acompte non recomptées.
      </Text>
    </View>
  );
}

function TopCard({ title, sub, rows, metric, wide }: { title: string; sub: string; rows: ArticleRow[]; metric: 'qty' | 'ca'; wide: boolean }) {
  const { s, c } = usePerfStyles();
  const val = (r: ArticleRow) => (metric === 'qty' ? r.quantity : r.revenue);
  const max = Math.max(1, ...rows.map(val));
  return (
    <GlassCard style={[s.card, wide ? { flex: 1, minWidth: 0 } : null]}>
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={s.cardSub}>{sub}</Text>
      {rows.map((r, i) => {
        const detail = articleDetail(r);
        const shown = metric === 'qty' ? `${r.quantity} u.` : formatMoney(r.revenue);
        return (
          <View key={r.key} style={[s.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
            accessible
            accessibilityLabel={`${i + 1}e : ${r.name}${detail ? `, ${detail}` : ''}, ${r.quantity} unités, ${formatMoney(r.revenue)} FCFA`}>
            <View style={[s.row, { gap: 10 }]}>
              <View style={s.rank}><Text style={s.rankText}>{i + 1}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.strong} numberOfLines={2}>{r.name}</Text>
                {detail ? <Text style={s.muted} numberOfLines={1}>{detail}</Text> : null}
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                {r.stores.map(k => <StoreTag key={k} store={k} />)}
              </View>
            </View>
            <HBar value={val(r)} max={max} color={c.gold} display={shown} />
            <Text style={s.muted}>
              {metric === 'qty' ? `CA ${formatMoney(r.revenue)} FCFA` : `${r.quantity} unité(s)`}
            </Text>
          </View>
        );
      })}
    </GlassCard>
  );
}
