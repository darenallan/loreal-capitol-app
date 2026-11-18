/**
 * Performance & Stock (Boss) — LECTURE SEULE, aucune écriture en base.
 *
 * Deux couches :
 *  1. Fonctions de calcul PURES (aucun accès réseau / cache / date implicite sauf `now` passé
 *     en paramètre) : testables en Node avec des objets bruts du nœud `sales` / `products`.
 *  2. Fonctions de chargement : `loadAnalyticsSales`, `loadAnalyticsProducts`.
 *
 * Règles de calcul :
 *  - Jour d'une vente = jour LOCAL (localDayKey), montant = getEffectiveTotal (avance initiale = versé).
 *  - Recette = somme des montants effectifs, tranches d'acompte comprises (argent encaissé ce jour-là).
 *  - Nb ventes / panier moyen / articles : hors tranches d'acompte (`is_advance_installment`),
 *    qui sont des paiements d'une vente déjà comptée (sinon double comptage des articles).
 *  - Ventes `backdated: true` : comptées dans les totaux par jour, mais signalées (montant + nombre).
 *  - « Recette globale (saisie antérieure) » (item sans product_id, sale_type 'daily_total') :
 *    comptée dans la recette des boutiques, EXCLUE des classements vendeuses et articles (montant mentionné).
 *  - Vendeuse : seller_name normalisé (trim, espaces multiples, casse).
 *  - Article : regroupé par product_id, sinon par nom + référence (casse ignorée).
 *    CA article = prix × quantité (valeur vendue).
 */
import { db } from '../firebaseConfig';
import { ref, get } from 'firebase/database';
import { RTDB_REST_URL } from './config';
import { getFastCache, getLocalCache } from './cache';
import { getProducts } from './products';
import { getEffectiveTotal, isAnyAdvance, localDayKey, normStore, ymdLocal } from '../../utils/saleMath';

// ============================================================================
// Types
// ============================================================================

export type PerfStore = 'falaise' | 'tougou';
export type PerfStoreFilter = PerfStore | 'all';
export const PERF_STORES: PerfStore[] = ['falaise', 'tougou'];
export const PERF_STORE_LABELS: Record<PerfStore, string> = { falaise: 'La Falaise', tougou: 'Tougou' };

export type PeriodId = 'today' | '7d' | '30d' | 'month' | 'prevMonth';
export const PERIOD_OPTIONS: { id: PeriodId; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Mois en cours' },
  { id: 'prevMonth', label: 'Mois précédent' },
];

/** Intervalle de jours locaux inclusifs 'YYYY-MM-DD'. */
export type DayRange = { start: string; end: string };

export type AnalyticsItem = {
  key: string;
  productId: string | null;
  name: string;
  reference: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  /** Item « Recette globale (saisie antérieure) » : jamais un article réel. */
  isGlobalReceipt: boolean;
};

export type AnalyticsSale = {
  id: string;
  day: string;
  date: string;
  store: string;
  total: number;
  payment: string;
  sellerKey: string;
  sellerName: string;
  items: AnalyticsItem[];
  backdated: boolean;
  isInstallment: boolean;
  isAdvance: boolean;
  /** Saisie antérieure « recette globale » : exclue des classements. */
  isGlobalReceipt: boolean;
};

export type AnalyticsProduct = {
  id: string;
  name: string;
  reference: string;
  size: string;
  color: string;
  category: string;
  price: number;
  stock: number;
  store: string;
};

// ============================================================================
// Dates (pures)
// ============================================================================

export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function addDaysYMD(ymd: string, n: number): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + n);
  return ymdLocal(d);
}

/** Nombre de jours entre deux jours locaux (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseYMD(b).getTime() - parseYMD(a).getTime()) / 86400000);
}

export function enumerateDays(range: DayRange): string[] {
  const out: string[] = [];
  if (!range.start || !range.end || range.start > range.end) return out;
  let cur = range.start;
  let guard = 0;
  while (cur <= range.end && guard < 1000) {
    out.push(cur);
    cur = addDaysYMD(cur, 1);
    guard++;
  }
  return out;
}

function lastDayOfMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Intervalle de la période, relatif au jour local de `now`. */
export function periodRange(id: PeriodId, now: Date = new Date()): DayRange {
  const today = ymdLocal(now);
  switch (id) {
    case 'today':
      return { start: today, end: today };
    case '7d':
      return { start: addDaysYMD(today, -6), end: today };
    case '30d':
      return { start: addDaysYMD(today, -29), end: today };
    case 'month':
      return { start: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1, 12)), end: today };
    case 'prevMonth': {
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      return {
        start: ymdLocal(new Date(y, m, 1, 12)),
        end: ymdLocal(new Date(y, m, lastDayOfMonth(y, m), 12)),
      };
    }
  }
}

/**
 * Période précédente ÉQUIVALENTE :
 *  - today → hier ; 7d / 30d → les 7 / 30 jours juste avant ;
 *  - month (1er → aujourd'hui) → mois précédent du 1er au même quantième (borné à sa fin) ;
 *  - prevMonth → le mois d'avant, complet.
 */
export function previousPeriodRange(id: PeriodId, now: Date = new Date()): DayRange {
  const cur = periodRange(id, now);
  if (id === 'month' || id === 'prevMonth') {
    const s = parseYMD(cur.start);
    const y = s.getMonth() === 0 ? s.getFullYear() - 1 : s.getFullYear();
    const m = s.getMonth() === 0 ? 11 : s.getMonth() - 1;
    const last = lastDayOfMonth(y, m);
    const endDay = id === 'month' ? Math.min(parseYMD(cur.end).getDate(), last) : last;
    return { start: ymdLocal(new Date(y, m, 1, 12)), end: ymdLocal(new Date(y, m, endDay, 12)) };
  }
  const len = enumerateDays(cur).length;
  return { start: addDaysYMD(cur.start, -len), end: addDaysYMD(cur.start, -1) };
}

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** '18 nov.' */
export function formatDayShort(ymd: string): string {
  if (!ymd) return '—';
  const d = parseYMD(ymd);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

/** '18/11/2026' */
export function formatDayFull(ymd: string): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

export function formatRange(range: DayRange): string {
  if (range.start === range.end) return formatDayFull(range.start);
  return `${formatDayShort(range.start)} → ${formatDayFull(range.end)}`;
}

// ============================================================================
// Normalisation (pure)
// ============================================================================

export const GLOBAL_RECEIPT_LABEL = 'Recette globale (saisie antérieure)';

const clean = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function normalizeSellerKey(name: any): string {
  return clean(name).toLowerCase();
}

/** Libellé de paiement regroupé : « Avance Soldée (OM) » → « OM », casse/espaces unifiés. */
export function normalizePaymentLabel(method: any): string {
  let m = clean(method);
  const solded = m.match(/^avance sold[ée]e\s*\((.+)\)$/i);
  if (solded) m = clean(solded[1]);
  if (!m) return 'Non précisé';
  const lower = m.toLowerCase();
  if (lower === 'especes' || lower === 'espèces' || lower === 'cash') return 'Espèces';
  if (lower === 'om' || lower === 'orange money') return 'OM';
  if (lower === 'momo' || lower === 'mtn momo' || lower === 'mobile money') return 'MoMo';
  if (lower === 'carte' || lower === 'carte bancaire' || lower === 'cb') return 'Carte Bancaire';
  if (lower === 'avance') return 'Avance';
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export function isGlobalReceiptItem(it: any): boolean {
  if (!it || it.product_id) return false;
  return /^recette globale/i.test(clean(it.name));
}

export function itemGroupKey(it: { product_id?: any; productId?: any; name?: any; reference?: any }): string {
  const pid = it.productId ?? it.product_id;
  if (pid) return `id:${pid}`;
  return `nr:${clean(it.name).toLowerCase()}|${clean(it.reference).toLowerCase()}`;
}

function toItems(raw: any): AnalyticsItem[] {
  const arr: any[] = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return arr
    .filter(it => it && typeof it === 'object')
    .map(it => ({
      key: itemGroupKey(it),
      productId: it.product_id ? String(it.product_id) : null,
      name: clean(it.name) || 'Article',
      reference: clean(it.reference),
      size: clean(it.size),
      color: clean(it.color),
      quantity: Math.max(0, parseInt(String(it.quantity ?? 1), 10) || 0),
      price: Number(it.price) || 0,
      isGlobalReceipt: isGlobalReceiptItem(it),
    }));
}

/** Nœud `sales` brut (objet ou tableau) → ventes normalisées (date invalide ignorée). */
export function normalizeSales(raw: Record<string, any> | any[] | null | undefined): AnalyticsSale[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries: [string, any][] = Array.isArray(raw)
    ? raw.map((s, i) => [String(s?.id ?? i), s])
    : Object.keys(raw).map(k => [k, (raw as any)[k]]);
  const out: AnalyticsSale[] = [];
  for (const [id, s] of entries) {
    if (!s || typeof s !== 'object' || typeof s.date !== 'string') continue;
    const day = localDayKey(s.date);
    if (!day) continue;
    const items = toItems(s.items);
    const sellerName = clean(s.seller_name);
    const isGlobalReceipt =
      s.sale_type === 'daily_total' || (items.length > 0 && items.every(i => i.isGlobalReceipt));
    out.push({
      id,
      day,
      date: s.date,
      store: normStore(s.store),
      total: getEffectiveTotal(s),
      payment: normalizePaymentLabel(s.payment_method),
      sellerKey: normalizeSellerKey(sellerName),
      sellerName,
      items,
      backdated: s.backdated === true,
      isInstallment: Number(s.is_advance_installment) === 1,
      isAdvance: isAnyAdvance(s),
      isGlobalReceipt,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Nœud `products` brut (ou liste getProducts) → produits normalisés. */
export function normalizeProducts(raw: Record<string, any> | any[] | null | undefined): AnalyticsProduct[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries: [string, any][] = Array.isArray(raw)
    ? raw.map((p, i) => [String(p?.id ?? i), p])
    : Object.keys(raw).map(k => [k, (raw as any)[k]]);
  return entries
    .filter(([, p]) => p && typeof p === 'object')
    .map(([id, p]) => ({
      id,
      name: clean(p.name) || 'Article',
      reference: clean(p.reference),
      size: clean(p.size),
      color: clean(p.color),
      category: clean(p.category),
      price: Number(p.price) || 0,
      stock: parseInt(String(p.stock ?? 0), 10) || 0,
      store: normStore(p.store),
    }));
}

export function filterSales(sales: AnalyticsSale[], range: DayRange, store: PerfStoreFilter = 'all'): AnalyticsSale[] {
  return sales.filter(s => s.day >= range.start && s.day <= range.end && (store === 'all' || s.store === store));
}

// ============================================================================
// 1. Comparatif boutiques (pur)
// ============================================================================

export type PaymentShare = { method: string; amount: number; count: number; share: number };

export type StoreSummary = {
  store: PerfStore;
  revenue: number;
  /** Ventes hors tranches d'acompte. */
  salesCount: number;
  /** Recette hors tranches / nb ventes. */
  avgBasket: number;
  installmentRevenue: number;
  installmentCount: number;
  backdatedRevenue: number;
  backdatedCount: number;
  previousRevenue: number;
  /** Évolution en % vs période précédente ; null si la précédente vaut 0. */
  deltaPct: number | null;
  payments: PaymentShare[];
};

export type DailyPoint = {
  day: string;
  falaise: number;
  tougou: number;
  /** Part saisie a posteriori (Boss) dans ce jour. */
  backdatedFalaise: number;
  backdatedTougou: number;
};

export type StoreComparison = {
  range: DayRange;
  previousRange: DayRange;
  stores: StoreSummary[];
  daily: DailyPoint[];
  totalRevenue: number;
  totalPrevious: number;
  totalDeltaPct: number | null;
};

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export function computeStoreComparison(sales: AnalyticsSale[], range: DayRange, prevRange: DayRange): StoreComparison {
  const cur = filterSales(sales, range);
  const prev = filterSales(sales, prevRange);
  const stores: StoreSummary[] = PERF_STORES.map(store => {
    const mine = cur.filter(s => s.store === store);
    const revenue = mine.reduce((a, s) => a + s.total, 0);
    const inst = mine.filter(s => s.isInstallment);
    const real = mine.filter(s => !s.isInstallment);
    const installmentRevenue = inst.reduce((a, s) => a + s.total, 0);
    const bd = mine.filter(s => s.backdated);
    const payMap = new Map<string, { amount: number; count: number }>();
    for (const s of mine) {
      const p = payMap.get(s.payment) || { amount: 0, count: 0 };
      p.amount += s.total;
      p.count += 1;
      payMap.set(s.payment, p);
    }
    const payments = Array.from(payMap.entries())
      .map(([method, v]) => ({ method, amount: v.amount, count: v.count, share: revenue > 0 ? v.amount / revenue : 0 }))
      .sort((a, b) => b.amount - a.amount || a.method.localeCompare(b.method));
    const previousRevenue = prev.filter(s => s.store === store).reduce((a, s) => a + s.total, 0);
    return {
      store,
      revenue,
      salesCount: real.length,
      avgBasket: real.length > 0 ? (revenue - installmentRevenue) / real.length : 0,
      installmentRevenue,
      installmentCount: inst.length,
      backdatedRevenue: bd.reduce((a, s) => a + s.total, 0),
      backdatedCount: bd.length,
      previousRevenue,
      deltaPct: pctChange(revenue, previousRevenue),
      payments,
    };
  });

  const byDay = new Map<string, DailyPoint>();
  for (const day of enumerateDays(range)) byDay.set(day, { day, falaise: 0, tougou: 0, backdatedFalaise: 0, backdatedTougou: 0 });
  for (const s of cur) {
    const p = byDay.get(s.day);
    if (!p) continue;
    if (s.store === 'falaise') {
      p.falaise += s.total;
      if (s.backdated) p.backdatedFalaise += s.total;
    } else if (s.store === 'tougou') {
      p.tougou += s.total;
      if (s.backdated) p.backdatedTougou += s.total;
    }
  }
  const totalRevenue = stores.reduce((a, s) => a + s.revenue, 0);
  const totalPrevious = stores.reduce((a, s) => a + s.previousRevenue, 0);
  return {
    range,
    previousRange: prevRange,
    stores,
    daily: Array.from(byDay.values()),
    totalRevenue,
    totalPrevious,
    totalDeltaPct: pctChange(totalRevenue, totalPrevious),
  };
}

// ============================================================================
// 2. Vendeuses (pur)
// ============================================================================

export type SellerRow = {
  key: string;
  name: string;
  revenue: number;
  salesCount: number;
  avgBasket: number;
  itemsCount: number;
  stores: PerfStore[];
  backdatedCount: number;
};

export type SellerRanking = {
  rows: SellerRow[];
  /** Recettes globales (saisies antérieures) exclues du classement. */
  excludedGlobalRevenue: number;
  excludedGlobalCount: number;
};

export function computeSellerRanking(sales: AnalyticsSale[], range: DayRange, store: PerfStoreFilter = 'all'): SellerRanking {
  const list = filterSales(sales, range, store);
  const map = new Map<string, SellerRow & { installmentRevenue: number; names: Map<string, number> }>();
  let excludedGlobalRevenue = 0;
  let excludedGlobalCount = 0;
  for (const s of list) {
    if (s.isGlobalReceipt) {
      excludedGlobalRevenue += s.total;
      excludedGlobalCount += 1;
      continue;
    }
    const key = s.sellerKey || '__none__';
    const row = map.get(key) || {
      key, name: '', revenue: 0, salesCount: 0, avgBasket: 0, itemsCount: 0, stores: [], backdatedCount: 0,
      installmentRevenue: 0, names: new Map<string, number>(),
    };
    row.revenue += s.total;
    if (s.isInstallment) row.installmentRevenue += s.total;
    else {
      row.salesCount += 1;
      row.itemsCount += s.items.filter(i => !i.isGlobalReceipt).reduce((a, i) => a + i.quantity, 0);
    }
    if (s.backdated) row.backdatedCount += 1;
    if ((s.store === 'falaise' || s.store === 'tougou') && !row.stores.includes(s.store)) row.stores.push(s.store);
    const label = s.sellerName || 'Non renseignée';
    row.names.set(label, (row.names.get(label) || 0) + 1);
    map.set(key, row);
  }
  const rows: SellerRow[] = Array.from(map.values()).map(r => {
    // Nom affiché : la graphie la plus fréquente
    const name = Array.from(r.names.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'Non renseignée';
    return {
      key: r.key,
      name,
      revenue: r.revenue,
      salesCount: r.salesCount,
      avgBasket: r.salesCount > 0 ? (r.revenue - r.installmentRevenue) / r.salesCount : 0,
      itemsCount: r.itemsCount,
      stores: r.stores.sort(),
      backdatedCount: r.backdatedCount,
    };
  });
  rows.sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount || a.name.localeCompare(b.name));
  return { rows, excludedGlobalRevenue, excludedGlobalCount };
}

// ============================================================================
// 3. Articles (pur)
// ============================================================================

export type ArticleRow = {
  key: string;
  productId: string | null;
  name: string;
  reference: string;
  size: string;
  color: string;
  quantity: number;
  revenue: number;
  stores: PerfStore[];
};

export type ArticleRanking = {
  byQuantity: ArticleRow[];
  byRevenue: ArticleRow[];
  distinctCount: number;
  excludedGlobalRevenue: number;
  excludedGlobalCount: number;
};

export function computeArticleRanking(sales: AnalyticsSale[], range: DayRange, store: PerfStoreFilter = 'all', top: number = 10): ArticleRanking {
  const list = filterSales(sales, range, store);
  const map = new Map<string, ArticleRow>();
  let excludedGlobalRevenue = 0;
  let excludedGlobalCount = 0;
  for (const s of list) {
    if (s.isInstallment) continue; // articles déjà comptés à la vente initiale
    for (const it of s.items) {
      if (it.isGlobalReceipt) {
        excludedGlobalRevenue += it.price * it.quantity;
        excludedGlobalCount += 1;
        continue;
      }
      const row = map.get(it.key) || {
        key: it.key, productId: it.productId, name: it.name, reference: it.reference, size: it.size, color: it.color,
        quantity: 0, revenue: 0, stores: [],
      };
      row.quantity += it.quantity;
      row.revenue += it.price * it.quantity;
      if ((s.store === 'falaise' || s.store === 'tougou') && !row.stores.includes(s.store)) row.stores.push(s.store);
      map.set(it.key, row);
    }
  }
  const all = Array.from(map.values());
  const byQuantity = [...all].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name)).slice(0, top);
  const byRevenue = [...all].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, top);
  return { byQuantity, byRevenue, distinctCount: all.length, excludedGlobalRevenue, excludedGlobalCount };
}

// ============================================================================
// 4. Stock (pur)
// ============================================================================

export type ProductSalesInfo = { lastDay: string; qty30: number };

/**
 * Dernier jour de vente et quantité vendue sur les 30 derniers jours, par produit.
 * Correspondance par product_id, sinon (item sans id) par nom + référence dans la même boutique.
 * Les tranches d'acompte et recettes globales sont ignorées.
 */
export function computeProductSalesIndex(sales: AnalyticsSale[], products: AnalyticsProduct[], today: string): Map<string, ProductSalesInfo> {
  const since30 = addDaysYMD(today, -29);
  const byNameRef = new Map<string, string>();
  for (const p of products) byNameRef.set(`${p.store}|${itemGroupKey({ name: p.name, reference: p.reference })}`, p.id);
  const idx = new Map<string, ProductSalesInfo>();
  for (const s of sales) {
    if (s.isInstallment) continue;
    for (const it of s.items) {
      if (it.isGlobalReceipt) continue;
      const pid = it.productId || byNameRef.get(`${s.store}|${it.key}`);
      if (!pid) continue;
      const info = idx.get(pid) || { lastDay: '', qty30: 0 };
      if (s.day > info.lastDay) info.lastDay = s.day;
      if (s.day >= since30 && s.day <= today) info.qty30 += it.quantity;
      idx.set(pid, info);
    }
  }
  return idx;
}

export type LowStockRow = AnalyticsProduct & { lastSaleDay: string };
export type DormantRow = AnalyticsProduct & { lastSaleDay: string; daysSince: number | null; immobilizedValue: number };
export type StockoutRow = AnalyticsProduct & { lastSaleDay: string; soldLast30: number };

export type StockReport = {
  threshold: number;
  dormantDays: number;
  lowStock: Record<PerfStore, LowStockRow[]>;
  dormant: DormantRow[];
  dormantValue: number;
  stockouts: StockoutRow[];
};

export function computeStockReport(
  sales: AnalyticsSale[],
  products: AnalyticsProduct[],
  opts: { threshold: number; dormantDays: number; today: string; store?: PerfStoreFilter },
): StockReport {
  const threshold = Math.max(0, Math.min(10, Math.round(opts.threshold)));
  const store = opts.store || 'all';
  const prods = products.filter(p => store === 'all' || p.store === store);
  const idx = computeProductSalesIndex(sales, products, opts.today);
  const byName = (a: AnalyticsProduct, b: AnalyticsProduct) => a.name.localeCompare(b.name) || a.reference.localeCompare(b.reference);

  const lowStock: Record<PerfStore, LowStockRow[]> = { falaise: [], tougou: [] };
  for (const p of prods) {
    if (p.stock > threshold) continue;
    if (p.store !== 'falaise' && p.store !== 'tougou') continue;
    lowStock[p.store].push({ ...p, lastSaleDay: idx.get(p.id)?.lastDay || '' });
  }
  for (const k of PERF_STORES) lowStock[k].sort((a, b) => a.stock - b.stock || byName(a, b));

  const cutoff = addDaysYMD(opts.today, -opts.dormantDays);
  const dormant: DormantRow[] = prods
    .filter(p => p.stock > 0)
    .map(p => {
      const last = idx.get(p.id)?.lastDay || '';
      return { ...p, lastSaleDay: last, daysSince: last ? daysBetween(last, opts.today) : null, immobilizedValue: p.stock * p.price };
    })
    // aucune vente depuis N jours : dernière vente strictement avant (aujourd'hui − N), ou jamais vendu
    .filter(p => !p.lastSaleDay || p.lastSaleDay < cutoff)
    .sort((a, b) => b.immobilizedValue - a.immobilizedValue || byName(a, b));

  const stockouts: StockoutRow[] = prods
    .filter(p => p.stock <= 0)
    .map(p => ({ ...p, lastSaleDay: idx.get(p.id)?.lastDay || '', soldLast30: idx.get(p.id)?.qty30 || 0 }))
    .filter(p => p.soldLast30 > 0)
    .sort((a, b) => b.soldLast30 - a.soldLast30 || b.lastSaleDay.localeCompare(a.lastSaleDay) || byName(a, b));

  return {
    threshold,
    dormantDays: opts.dormantDays,
    lowStock,
    dormant,
    dormantValue: dormant.reduce((a, p) => a + p.immobilizedValue, 0),
    stockouts,
  };
}

// ============================================================================
// Chargement (lecture seule)
// ============================================================================

/** Nœud `sales` brut : REST → SDK (2,5 s) → cache local. Aucune écriture distante. */
async function loadRawSales(): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${RTDB_REST_URL}/sales.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') return data;
      if (data === null) return {};
    }
  } catch (e) {}
  try {
    const snap: any = await Promise.race([
      get(ref(db, 'sales')),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);
    if (snap && snap.exists()) return snap.val() || {};
  } catch (e) {}
  return getFastCache('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};
}

export async function loadAnalyticsSales(): Promise<AnalyticsSale[]> {
  return normalizeSales(await loadRawSales());
}

/** Toutes boutiques. Stock FRAIS d'abord (REST), cache getProducts seulement si le réseau échoue. */
export async function loadAnalyticsProducts(): Promise<AnalyticsProduct[]> {
  try {
    const res = await fetch(`${RTDB_REST_URL}/products.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') return normalizeProducts(data);
      if (data === null) return [];
    }
  } catch (e) {}
  const list = await getProducts('all');
  return normalizeProducts(Array.isArray(list) ? list : []);
}
