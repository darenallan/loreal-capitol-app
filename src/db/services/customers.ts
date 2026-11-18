/**
 * Fichier clients — agrégation des clients à partir de `sales` et `advances`.
 *
 * LECTURE SEULE : ce module n'écrit jamais dans la base.
 *  - Les fonctions d'agrégation (buildCustomers, filterCustomers, sortCustomers…)
 *    sont PURES : elles prennent les nœuds bruts et renvoient des objets calculés.
 *  - Le chargement (loadCustomerSources) est séparé : REST puis cache local.
 *
 * Clé client :
 *  - numéro normalisé au format WhatsApp camerounais `237XXXXXXXXX`
 *    (même règle que cleanWhatsAppNumber de src/utils/receiptShare.ts) → `p:237…` ;
 *  - sans numéro valide → nom normalisé (trim, casse, accents, ponctuation) → `n:…`,
 *    marqué « sans téléphone ». Un groupe « nom seul » est rattaché au client avec
 *    téléphone portant exactement ce nom s'il n'y en a qu'UN (sinon il reste à part).
 */
import { RTDB_REST_URL } from './config';
import { getFastCache, getLocalCache } from './cache';
import { isSuperBoss } from './roles';
import { getAdvanceStore } from './advances';
import { getEffectiveTotal, isAnyAdvance, itemsSummary, localDayKey, normStore, todayKey } from '../../utils/saleMath';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CustomerScope = 'all' | 'falaise' | 'tougou';
export type CustomerSortKey = 'lastVisit' | 'totalSpent' | 'remainingDue';

export interface CustomerPurchase {
  id: string;
  /** Date ISO d'origine. */
  date: string;
  /** Jour local 'YYYY-MM-DD'. */
  day: string;
  store: string;
  itemsLabel: string;
  /** Total effectif (getEffectiveTotal). */
  amount: number;
  /** Valeur des articles (article_total ou total). */
  articleTotal: number;
  paymentMethod: string;
  sellerName: string;
  backdated: boolean;
  /** Vente liée à un acompte (initiale, tranche, ou « Avance »). */
  isAdvance: boolean;
  /** Tranche ultérieure d'un acompte (pas un nouvel achat). */
  isInstallment: boolean;
}

export interface CustomerAdvance {
  id: string;
  store: 'falaise' | 'tougou';
  clientName: string;
  /** Numéro normalisé (237…) ou ''. */
  phone: string;
  itemsLabel: string;
  amountPaid: number;
  amountRemaining: number;
  total: number;
  /** Échéance 'YYYY-MM-DD' ou ''. */
  dueDay: string;
  createdAt: string;
  lastPaymentDate: string;
  paymentsCount: number;
  status: string;
  /** Même définition que AdvancesScreen : reste ≤ 0 ou statut 'completed'. */
  isSettled: boolean;
  /** Échéance passée (jour local), reste dû > 0, non soldé. */
  isOverdue: boolean;
  /** Jours avant l'échéance (négatif = jours de retard), null sans échéance. */
  daysUntilDue: number | null;
}

export interface Customer {
  key: string;
  name: string;
  /** Tous les noms normalisés rencontrés (recherche / rattachement). */
  nameKeys: string[];
  /** Numéro normalisé 237XXXXXXXXX, '' si aucun numéro valide. */
  phone: string;
  hasPhone: boolean;
  /** Numéro brut saisi mais invalide (affichage seulement). */
  rawInvalidPhone: string;
  email: string;
  stores: string[];
  purchaseCount: number;
  totalSpent: number;
  avgBasket: number;
  firstVisit: string;
  lastVisit: string;
  /** Historique trié du plus récent au plus ancien. */
  purchases: CustomerPurchase[];
  /** Acomptes non soldés, triés par échéance. */
  openAdvances: CustomerAdvance[];
  settledAdvancesCount: number;
  remainingDue: number;
  hasOpenAdvance: boolean;
  hasOverdue: boolean;
  /** Échéance la plus proche parmi les acomptes en cours ('' si aucune). */
  nextDueDay: string;
}

export interface CustomerReminder {
  customer: Customer;
  advance: CustomerAdvance;
}

export interface CustomerSources {
  sales: Record<string, any>;
  advances: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Numéro normalisé au format WhatsApp : `237` + 9 chiffres (mobiles 6…, fixes 2…),
 * ou numéro international (10 à 15 chiffres, hors 237). '' si invalide / absent.
 * Accepte « 690 00 00 01 », « +237 690000001 », « 00237690000001 », « 0690000001 ».
 */
export function normalizeCustomerPhone(raw: any): string {
  if (raw === null || raw === undefined) return '';
  let d = String(raw).replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.substring(2);
  if (d.length === 10 && d.startsWith('0')) d = d.substring(1);
  if (d.length === 9 && (d.startsWith('6') || d.startsWith('2'))) return `237${d}`;
  if (d.startsWith('237')) {
    const local = d.substring(3);
    return local.length === 9 && (local.startsWith('6') || local.startsWith('2')) ? d : '';
  }
  if (d.length >= 10 && d.length <= 15 && !d.startsWith('0')) return d;
  return '';
}

/** « +237 6 90 00 00 01 » pour un numéro normalisé (sinon le numéro tel quel). */
export function formatCustomerPhone(phone: string): string {
  if (!phone) return '';
  if (phone.startsWith('237') && phone.length === 12) {
    const l = phone.substring(3);
    return `+237 ${l[0]} ${l.substring(1, 3)} ${l.substring(3, 5)} ${l.substring(5, 7)} ${l.substring(7, 9)}`;
  }
  return `+${phone}`;
}

/** Nom normalisé : minuscules, sans accents ni ponctuation, espaces réduits. */
export function normalizeCustomerName(raw: any): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Clé de regroupement d'un client ('' si ni nom ni numéro exploitables). */
export function customerKeyFor(name: any, phone: any): string {
  const p = normalizeCustomerPhone(phone);
  if (p) return `p:${p}`;
  const n = normalizeCustomerName(name);
  return n ? `n:${n}` : '';
}

// ---------------------------------------------------------------------------
// Dates & acomptes
// ---------------------------------------------------------------------------

/** Échéance 'YYYY-MM-DD' : date calendaire gardée telle quelle, sinon jour local. */
export function getAdvanceDueDay(a: any): string {
  const raw = a?.due_date;
  if (!raw || typeof raw !== 'string') return '';
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1];
  return localDayKey(raw);
}

/** Nombre de jours de `fromYmd` à `toYmd` (positif si toYmd est après). */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const p = (s: string) => {
    const [y, mo, d] = s.split('-').map(n => parseInt(n, 10));
    return Date.UTC(y, (mo || 1) - 1, d || 1);
  };
  return Math.round((p(toYmd) - p(fromYmd)) / 86400000);
}

/** Acompte soldé — définition identique à AdvancesScreen. */
export function isAdvanceSettled(a: any): boolean {
  return (Number(a?.amount_remaining) || 0) <= 0 || a?.status === 'completed';
}

function advanceItemsLabel(a: any): string {
  if (Array.isArray(a?.items) && a.items.length > 0) return itemsSummary(a.items);
  return String(a?.product_name || 'Article réservé');
}

/** Vue calculée d'un acompte brut. */
export function toCustomerAdvance(id: string, a: any, today: string = todayKey()): CustomerAdvance {
  const amountPaid = Number(a?.amount_paid) || 0;
  const amountRemaining = Math.max(0, Number(a?.amount_remaining) || 0);
  const dueDay = getAdvanceDueDay(a);
  const isSettled = isAdvanceSettled(a);
  const daysUntilDue = dueDay ? daysBetweenYmd(today, dueDay) : null;
  const payments = Array.isArray(a?.payments) ? a.payments.filter((p: any) => Number(p?.amount) > 0) : [];
  return {
    id,
    store: getAdvanceStore(a),
    clientName: String(a?.client_name || '').trim(),
    phone: normalizeCustomerPhone(a?.client_phone || a?.phone),
    itemsLabel: advanceItemsLabel(a),
    amountPaid,
    amountRemaining,
    total: amountPaid + amountRemaining,
    dueDay,
    createdAt: String(a?.created_at || ''),
    lastPaymentDate: String(a?.last_payment_date || payments[payments.length - 1]?.date || a?.created_at || ''),
    paymentsCount: payments.length,
    status: String(a?.status || ''),
    isSettled,
    isOverdue: !isSettled && amountRemaining > 0 && !!dueDay && dueDay < today,
    daysUntilDue,
  };
}

// ---------------------------------------------------------------------------
// Agrégation
// ---------------------------------------------------------------------------

type Acc = {
  key: string;
  names: { name: string; date: string }[];
  nameKeys: Set<string>;
  phone: string;
  rawInvalidPhone: string;
  emails: { email: string; date: string }[];
  stores: Set<string>;
  purchases: CustomerPurchase[];
  advances: CustomerAdvance[];
  advanceDates: string[];
};

function newAcc(key: string): Acc {
  return { key, names: [], nameKeys: new Set(), phone: '', rawInvalidPhone: '', emails: [], stores: new Set(), purchases: [], advances: [], advanceDates: [] };
}

function saleItems(sale: any): any[] {
  if (Array.isArray(sale?.items)) return sale.items;
  if (sale?.items && typeof sale.items === 'object') return Object.values(sale.items);
  return [];
}

function saleItemsLabel(sale: any): string {
  if (sale?.sale_label) return String(sale.sale_label);
  const items = saleItems(sale);
  if (items.length > 0) return items.map((i: any) => `${i?.name || 'Article'} (x${i?.quantity || 1})`).join(', ');
  return typeof sale?.items === 'string' ? sale.items : 'Vente';
}

function mergeAcc(into: Acc, from: Acc) {
  into.names.push(...from.names);
  from.nameKeys.forEach(k => into.nameKeys.add(k));
  into.emails.push(...from.emails);
  from.stores.forEach(s => into.stores.add(s));
  into.purchases.push(...from.purchases);
  into.advances.push(...from.advances);
  into.advanceDates.push(...from.advanceDates);
  if (!into.rawInvalidPhone && from.rawInvalidPhone) into.rawInvalidPhone = from.rawInvalidPhone;
}

function latestNonEmpty(list: { date: string; [k: string]: any }[], field: string): string {
  let best = '';
  let bestDate = '';
  for (const e of list) {
    const v = String(e[field] || '').trim();
    if (!v) continue;
    if (!best || (e.date || '') >= bestDate) { best = v; bestDate = e.date || ''; }
  }
  return best;
}

function finalize(acc: Acc): Customer {
  const purchases = acc.purchases.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const openAdvances = acc.advances
    .filter(a => !a.isSettled)
    .sort((a, b) => (a.dueDay || '9999').localeCompare(b.dueDay || '9999'));
  const settledAdvancesCount = acc.advances.length - openAdvances.length;
  const purchaseCount = purchases.filter(p => !p.isInstallment).length;
  const totalSpent = purchases.reduce((s, p) => s + p.amount, 0);
  const visitDays = purchases.map(p => p.day).filter(Boolean);
  if (visitDays.length === 0) acc.advanceDates.forEach(d => { const k = localDayKey(d); if (k) visitDays.push(k); });
  visitDays.sort();
  const remainingDue = openAdvances.reduce((s, a) => s + a.amountRemaining, 0);
  const name = latestNonEmpty(acc.names, 'name') || (acc.phone ? formatCustomerPhone(acc.phone) : 'Client');
  return {
    key: acc.key,
    name,
    nameKeys: Array.from(acc.nameKeys),
    phone: acc.phone,
    hasPhone: !!acc.phone,
    rawInvalidPhone: acc.phone ? '' : acc.rawInvalidPhone,
    email: latestNonEmpty(acc.emails, 'email'),
    stores: Array.from(acc.stores).sort(),
    purchaseCount,
    totalSpent,
    avgBasket: purchaseCount > 0 ? Math.round(totalSpent / purchaseCount) : 0,
    firstVisit: visitDays[0] || '',
    lastVisit: visitDays[visitDays.length - 1] || '',
    purchases,
    openAdvances,
    settledAdvancesCount,
    remainingDue,
    hasOpenAdvance: openAdvances.length > 0,
    hasOverdue: openAdvances.some(a => a.isOverdue),
    nextDueDay: openAdvances.find(a => !!a.dueDay)?.dueDay || '',
  };
}

/**
 * Construit le fichier clients (fonction PURE).
 * @param sales    nœud brut `sales` ({ id: vente })
 * @param advances nœud brut `advances` ({ id: acompte })
 * @param opts.store  'all' ou code boutique : seules les ventes / acomptes de cette boutique sont pris en compte
 * @param opts.today  jour local de référence 'YYYY-MM-DD' (défaut : aujourd'hui)
 */
export function buildCustomers(
  sales: Record<string, any> | null | undefined,
  advances: Record<string, any> | null | undefined,
  opts: { store?: CustomerScope | string; today?: string } = {}
): Customer[] {
  const scope = (opts.store || 'all').toString().trim().toLowerCase();
  const today = opts.today || todayKey();
  const map = new Map<string, Acc>();
  const get = (key: string) => {
    let acc = map.get(key);
    if (!acc) { acc = newAcc(key); map.set(key, acc); }
    return acc;
  };

  for (const id of Object.keys(sales || {})) {
    const sale = (sales as any)[id];
    if (!sale || typeof sale !== 'object') continue;
    const store = normStore(sale.store);
    if (scope !== 'all' && store !== scope) continue;
    const name = String(sale.client_name || sale.advanceData?.clientName || '').trim();
    const rawPhone = sale.client_phone || sale.advanceData?.clientPhone || sale.phone || '';
    const key = customerKeyFor(name, rawPhone);
    if (!key) continue;
    const acc = get(key);
    const date = typeof sale.date === 'string' ? sale.date : '';
    const phone = normalizeCustomerPhone(rawPhone);
    if (phone) acc.phone = phone;
    else if (rawPhone && !acc.rawInvalidPhone) acc.rawInvalidPhone = String(rawPhone).trim();
    if (name) { acc.names.push({ name, date }); acc.nameKeys.add(normalizeCustomerName(name)); }
    if (sale.client_email) acc.emails.push({ email: String(sale.client_email).trim(), date });
    acc.stores.add(store);
    acc.purchases.push({
      id,
      date,
      day: localDayKey(date),
      store,
      itemsLabel: saleItemsLabel(sale),
      amount: getEffectiveTotal(sale),
      articleTotal: Number(sale.article_total ?? sale.total) || 0,
      paymentMethod: String(sale.payment_method || ''),
      sellerName: String(sale.seller_name || ''),
      backdated: sale.backdated === true,
      isAdvance: isAnyAdvance(sale),
      isInstallment: sale.is_advance_installment === 1,
    });
  }

  for (const id of Object.keys(advances || {})) {
    const raw = (advances as any)[id];
    if (!raw || typeof raw !== 'object') continue;
    const adv = toCustomerAdvance(id, raw, today);
    if (scope !== 'all' && adv.store !== scope) continue;
    const rawPhone = raw.client_phone || raw.phone || '';
    const key = customerKeyFor(adv.clientName, rawPhone);
    if (!key) continue;
    const acc = get(key);
    if (adv.phone) acc.phone = adv.phone;
    else if (rawPhone && !acc.rawInvalidPhone) acc.rawInvalidPhone = String(rawPhone).trim();
    const date = adv.createdAt || adv.lastPaymentDate;
    if (adv.clientName) { acc.names.push({ name: adv.clientName, date }); acc.nameKeys.add(normalizeCustomerName(adv.clientName)); }
    if (raw.client_email) acc.emails.push({ email: String(raw.client_email).trim(), date });
    acc.stores.add(adv.store);
    acc.advances.push(adv);
    if (date) acc.advanceDates.push(date);
  }

  // Rattachement des groupes « nom seul » à un unique client avec téléphone de même nom.
  const byName = new Map<string, Acc[]>();
  map.forEach(acc => {
    if (!acc.key.startsWith('p:')) return;
    acc.nameKeys.forEach(n => {
      const l = byName.get(n) || [];
      l.push(acc);
      byName.set(n, l);
    });
  });
  Array.from(map.values()).forEach(acc => {
    if (!acc.key.startsWith('n:')) return;
    const candidates = byName.get(acc.key.substring(2)) || [];
    if (candidates.length === 1) {
      mergeAcc(candidates[0], acc);
      map.delete(acc.key);
    }
  });

  return Array.from(map.values()).map(finalize);
}

// ---------------------------------------------------------------------------
// Filtre, tri, recherche
// ---------------------------------------------------------------------------

/** Recherche (nom sans accents / téléphone) et filtres acompte en cours / en retard. */
export function filterCustomers(
  list: Customer[],
  opts: { query?: string; onlyOpenAdvance?: boolean; onlyOverdue?: boolean } = {}
): Customer[] {
  const q = normalizeCustomerName(opts.query || '');
  const digits = String(opts.query || '').replace(/[^0-9]/g, '');
  return list.filter(c => {
    if (opts.onlyOpenAdvance && !c.hasOpenAdvance) return false;
    if (opts.onlyOverdue && !c.hasOverdue) return false;
    if (!q && !digits) return true;
    if (q && (normalizeCustomerName(c.name).includes(q) || c.nameKeys.some(n => n.includes(q)))) return true;
    if (digits.length >= 3) {
      const local = c.phone.startsWith('237') ? c.phone.substring(3) : c.phone;
      // « 00237… » → « 237… » ; « 0690… » (10 chiffres) → « 690… » ; sinon saisie partielle telle quelle.
      let d = digits.startsWith('00') ? digits.substring(2) : digits;
      if (d.length === 10 && d.startsWith('0')) d = d.substring(1);
      if (d && (c.phone.includes(d) || local.includes(d))) return true;
    }
    return false;
  });
}

/** Tri : dernière visite (récent d'abord), total dépensé, reste dû (puis échéance). */
export function sortCustomers(list: Customer[], by: CustomerSortKey = 'lastVisit'): Customer[] {
  const out = [...list];
  out.sort((a, b) => {
    if (by === 'totalSpent') return b.totalSpent - a.totalSpent || b.lastVisit.localeCompare(a.lastVisit);
    if (by === 'remainingDue') {
      return b.remainingDue - a.remainingDue
        || (a.nextDueDay || '9999').localeCompare(b.nextDueDay || '9999')
        || b.lastVisit.localeCompare(a.lastVisit);
    }
    return b.lastVisit.localeCompare(a.lastVisit) || b.totalSpent - a.totalSpent;
  });
  return out;
}

/** Client correspondant à un numéro (toute écriture acceptée). */
export function findCustomerByPhone(list: Customer[], phone: any): Customer | undefined {
  const p = normalizeCustomerPhone(phone);
  if (!p) return undefined;
  return list.find(c => c.phone === p);
}

/**
 * Relances : acomptes en cours en retard ou échéant dans `withinDays` jours
 * (aujourd'hui inclus), triés par échéance croissante.
 */
export function buildCustomerReminders(list: Customer[], withinDays: number = 3): CustomerReminder[] {
  const out: CustomerReminder[] = [];
  for (const customer of list) {
    for (const advance of customer.openAdvances) {
      if (advance.daysUntilDue === null || advance.amountRemaining <= 0) continue;
      if (advance.isOverdue || advance.daysUntilDue <= withinDays) out.push({ customer, advance });
    }
  }
  return out.sort((a, b) => a.advance.dueDay.localeCompare(b.advance.dueDay) || b.advance.amountRemaining - a.advance.amountRemaining);
}

/** Totaux d'en-tête. */
export function summarizeCustomers(list: Customer[]) {
  let withPhone = 0, openAdvances = 0, overdue = 0, remainingDue = 0;
  for (const c of list) {
    if (c.hasPhone) withPhone++;
    openAdvances += c.openAdvances.length;
    overdue += c.openAdvances.filter(a => a.isOverdue).length;
    remainingDue += c.remainingDue;
  }
  return { count: list.length, withPhone, openAdvances, overdue, remainingDue };
}

// ---------------------------------------------------------------------------
// Accès & chargement
// ---------------------------------------------------------------------------

/** Boss → périmètre demandé (défaut toutes boutiques) ; autres → leur boutique uniquement. */
export function customerScopeForUser(user: any, requested?: string | null): CustomerScope {
  if (isSuperBoss(user)) {
    const r = String(requested || 'all').trim().toLowerCase();
    return r === 'falaise' || r === 'tougou' ? r : 'all';
  }
  return normStore(user?.store) === 'tougou' ? 'tougou' : 'falaise';
}

async function fetchNode(path: string, cacheKey: string, timeoutMs = 8000): Promise<Record<string, any>> {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const res = await fetch(`${RTDB_REST_URL}/${path}.json`, { signal: controller ? controller.signal : undefined });
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') return data;
      if (data === null) return {};
    }
  } catch (e) {}
  return getFastCache<Record<string, any>>(cacheKey) || getLocalCache(cacheKey) || {};
}

/** Charge `sales` et `advances` (REST, repli cache local). Lecture seule. */
export async function loadCustomerSources(): Promise<CustomerSources> {
  const [sales, advances] = await Promise.all([
    fetchNode('sales', 'loreal_cache_sales'),
    fetchNode('advances', 'loreal_cache_advances'),
  ]);
  return { sales, advances };
}
