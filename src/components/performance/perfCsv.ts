/** Construction PURE des tableaux CSV de chaque onglet (l'écriture passe par downloadCSV). */
import {
  ArticleRanking, DayRange, PERF_STORE_LABELS, PERF_STORES, PerfStore, PerfStoreFilter, SellerRanking, StockReport,
  StoreComparison, formatDayFull,
} from '../../db/services/analytics';

export type CsvTable = { filename: string; headers: string[]; rows: (string | number)[][] };

const storeLabel = (k: string) => PERF_STORE_LABELS[k as PerfStore] || k;
const filterLabel = (f: PerfStoreFilter) => (f === 'all' ? 'Toutes boutiques' : storeLabel(f));
const pct = (p: number | null) => (p === null ? '' : p.toFixed(1).replace('.', ','));
const fileRange = (r: DayRange) => (r.start === r.end ? r.start : `${r.start}_${r.end}`);

export function compareCsv(d: StoreComparison): CsvTable {
  const [F, T] = PERF_STORES.map(k => d.stores.find(x => x.store === k)!);
  const rows: (string | number)[][] = [
    ['Synthèse', 'Période', `${formatDayFull(d.range.start)} → ${formatDayFull(d.range.end)}`, '', ''],
    ['Synthèse', 'Période précédente', `${formatDayFull(d.previousRange.start)} → ${formatDayFull(d.previousRange.end)}`, '', ''],
    ['Synthèse', 'Recette (FCFA)', F.revenue, T.revenue, F.revenue + T.revenue],
    ['Synthèse', 'Recette période précédente (FCFA)', F.previousRevenue, T.previousRevenue, d.totalPrevious],
    ['Synthèse', 'Évolution (%)', pct(F.deltaPct), pct(T.deltaPct), pct(d.totalDeltaPct)],
    ['Synthèse', 'Nb ventes (hors tranches d\'acompte)', F.salesCount, T.salesCount, F.salesCount + T.salesCount],
    ['Synthèse', 'Panier moyen (FCFA)', Math.round(F.avgBasket), Math.round(T.avgBasket), ''],
    ['Synthèse', 'Tranches d\'acompte (FCFA)', F.installmentRevenue, T.installmentRevenue, F.installmentRevenue + T.installmentRevenue],
    ['Synthèse', 'Dont saisies antérieures (FCFA)', F.backdatedRevenue, T.backdatedRevenue, F.backdatedRevenue + T.backdatedRevenue],
  ];
  const methods = Array.from(new Set(d.stores.flatMap(x => x.payments.map(p => p.method)))).sort();
  for (const m of methods) {
    const a = F.payments.find(p => p.method === m)?.amount || 0;
    const b = T.payments.find(p => p.method === m)?.amount || 0;
    rows.push(['Paiement', m, a, b, a + b]);
  }
  for (const day of d.daily) {
    const bd = day.backdatedFalaise + day.backdatedTougou;
    rows.push(['Jour', formatDayFull(day.day) + (bd > 0 ? ` (dont ${bd} saisie antérieure)` : ''), day.falaise, day.tougou, day.falaise + day.tougou]);
  }
  return {
    filename: `PERFORMANCE_BOUTIQUES_${fileRange(d.range)}.csv`,
    headers: ['Section', 'Indicateur', 'La Falaise', 'Tougou', 'Total'],
    rows,
  };
}

export function sellersCsv(d: SellerRanking, range: DayRange, store: PerfStoreFilter): CsvTable {
  const rows: (string | number)[][] = d.rows.map((r, i) => [
    i + 1, r.name, r.revenue, r.salesCount, Math.round(r.avgBasket), r.itemsCount, r.stores.map(storeLabel).join(' + '), r.backdatedCount,
  ]);
  if (d.excludedGlobalCount > 0) {
    rows.push(['', `Exclu : ${d.excludedGlobalCount} recette(s) globale(s) saisie(s) a posteriori`, d.excludedGlobalRevenue, '', '', '', '', '']);
  }
  return {
    filename: `PERFORMANCE_VENDEUSES_${store.toUpperCase()}_${fileRange(range)}.csv`,
    headers: ['Rang', `Vendeuse (${filterLabel(store)})`, 'Recette (FCFA)', 'Nb ventes', 'Panier moyen (FCFA)', 'Nb articles', 'Boutique(s)', 'Saisies antérieures'],
    rows,
  };
}

export function articlesCsv(d: ArticleRanking, range: DayRange, store: PerfStoreFilter): CsvTable {
  const line = (kind: string) => (r: ArticleRanking['byQuantity'][number], i: number) => [
    kind, i + 1, r.name, r.reference, r.size, r.color, r.quantity, r.revenue, r.stores.map(storeLabel).join(' + '),
  ];
  const rows: (string | number)[][] = [
    ...d.byQuantity.map(line('Top quantité')),
    ...d.byRevenue.map(line('Top CA')),
  ];
  if (d.excludedGlobalCount > 0) rows.push(['Exclu', '', 'Recette globale (saisie antérieure)', '', '', '', d.excludedGlobalCount, d.excludedGlobalRevenue, '']);
  return {
    filename: `PERFORMANCE_ARTICLES_${store.toUpperCase()}_${fileRange(range)}.csv`,
    headers: ['Classement', 'Rang', 'Article', 'Référence', 'Taille', 'Couleur', 'Quantité', 'CA (FCFA)', 'Boutique(s)'],
    rows,
  };
}

export function stockCsv(d: StockReport, today: string, store: PerfStoreFilter): CsvTable {
  const rows: (string | number)[][] = [];
  for (const k of PERF_STORES) {
    for (const p of d.lowStock[k]) {
      rows.push([`Stock bas (≤ ${d.threshold})`, storeLabel(p.store), p.name, p.reference, p.size, p.color, p.stock, p.price, p.stock * p.price, p.lastSaleDay ? formatDayFull(p.lastSaleDay) : 'Jamais', '', '']);
    }
  }
  for (const p of d.dormant) {
    rows.push([`Dormant (${d.dormantDays} j)`, storeLabel(p.store), p.name, p.reference, p.size, p.color, p.stock, p.price, p.immobilizedValue, p.lastSaleDay ? formatDayFull(p.lastSaleDay) : 'Jamais', p.daysSince ?? '', '']);
  }
  for (const p of d.stockouts) {
    rows.push(['Rupture à réassortir', storeLabel(p.store), p.name, p.reference, p.size, p.color, p.stock, p.price, 0, p.lastSaleDay ? formatDayFull(p.lastSaleDay) : '', '', p.soldLast30]);
  }
  return {
    filename: `PERFORMANCE_STOCK_${store.toUpperCase()}_${today}.csv`,
    headers: ['Catégorie', 'Boutique', 'Article', 'Référence', 'Taille', 'Couleur', 'Stock', 'Prix (FCFA)', 'Valeur (FCFA)', 'Dernière vente', 'Jours sans vente', 'Vendus 30 j'],
    rows,
  };
}
