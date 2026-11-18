/**
 * Clôture de caisse journalière (par boutique et par jour LOCAL).
 *
 * RTDB :
 *   cash_closings/<store>_<YYYY-MM-DD>            → CashClosing (version courante)
 *   cash_closings_history/<store>_<YYYY-MM-DD>/<push> → versions archivées (à chaque réouverture)
 *
 * « Attendu » : calculé depuis le nœud `sales` avec les MÊMES règles que la carte
 * « Recette du jour » du Dashboard (total effectif getEffectiveTotal, jour local,
 * boutique normalisée, moyen de paiement exact 'Espèces' / 'MoMo' / 'OM' / 'Carte Bancaire').
 * Les tranches d'acompte (addAdvancePayment) sont des ventes `sales` avec leur vrai moyen
 * de paiement : elles sont donc comptées naturellement. Les acomptes initiaux sont
 * enregistrés avec payment_method 'Avance' (ou 'Avance Soldée (…)' une fois soldés) :
 * le Dashboard ne les range dans aucune des 4 cartes ; ici ils sont réattribués à leur
 * moyen réel (advanceData.initialPaymentMethod) et affichés à part pour garder la concordance.
 */
import { db } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';
import { RTDB_REST_URL } from './config';
import { getFastCache, getLocalCache, saveFastCache } from './cache';
import { isSuperBoss } from './roles';
import { logAudit } from './audit';
import { getEffectiveTotal, isOnLocalDay, normStore, todayKey } from '../../utils/saleMath';

// ---------------------------------------------------------------------------
// Constantes & types
// ---------------------------------------------------------------------------

export type CashClosingStore = 'falaise' | 'tougou';
export type CashMethodKey = 'cash' | 'momo' | 'om' | 'card';
export type CashDiffTone = 'success' | 'warning' | 'danger';

/** Écart toléré (FCFA) : |écart| ≤ seuil → avertissement, au-delà → écart important. */
export const CASH_DIFF_THRESHOLD = 1000;

/** Coupures FCFA proposées au comptage (les pièces sont saisies en montant global). */
export const CASH_DENOMINATIONS: number[] = [10000, 5000, 2000, 1000, 500];

export const CASH_METHODS: { key: CashMethodKey; label: string; paymentMethod: string }[] = [
  { key: 'cash', label: 'Espèces', paymentMethod: 'Espèces' },
  { key: 'momo', label: 'MTN MoMo', paymentMethod: 'MoMo' },
  { key: 'om', label: 'Orange Money', paymentMethod: 'OM' },
  { key: 'card', label: 'Carte Bancaire', paymentMethod: 'Carte Bancaire' },
];

export const CASH_STORE_LABELS: Record<CashClosingStore, string> = {
  falaise: 'La Falaise',
  tougou: 'Tougou',
};

export type CashMethodAmounts = { cash: number; momo: number; om: number; card: number };

/** Ventilation de l'attendu calculée depuis `sales` pour une boutique / un jour. */
export type CashSalesBreakdown = {
  /** Mêmes chiffres que les 4 cartes du Dashboard (moyen de paiement exact). */
  dashboard: CashMethodAmounts;
  /** Acomptes initiaux ('Avance' / 'Avance Soldée (…)') réattribués à leur moyen réel. */
  advance_initial: CashMethodAmounts;
  /** Acomptes initiaux dont le moyen réel est inconnu (non attribués). */
  advance_unassigned: number;
  /** Encaissements directs Boss (hors caisse) : 'MoMo Boss', 'OM Boss'. */
  boss: { momo_boss: number; om_boss: number };
  /** Nombre de dons 'Ami / Don' (montant 0). */
  gifts_count: number;
  /** Autres moyens inconnus : libellé → montant. */
  other: Record<string, number>;
  /** = salesTotal du Dashboard (somme des totaux effectifs). */
  sales_total: number;
  sales_count: number;
};

export type CashOutEntry = { label: string; amount: number };

/** Comptage des espèces par coupure (nombre de billets) + montant global des pièces. */
export type CashBreakdownCount = {
  b10000: number; b5000: number; b2000: number; b1000: number; b500: number; coins: number;
};

export type CashExpected = CashMethodAmounts & { cash_sales: number; total: number };
export type CashCounted = CashMethodAmounts & { total: number };

export type CashClosingStatus = 'closed' | 'reopened';

export type CashClosing = {
  id: string;
  store: CashClosingStore;
  day: string;
  expected: CashExpected;
  expected_detail: CashSalesBreakdown;
  counted: CashCounted;
  cash_breakdown: CashBreakdownCount | null;
  opening_float: number;
  cash_out: CashOutEntry[];
  cash_out_total: number;
  diff: CashMethodAmounts;
  diff_total: number;
  note: string | null;
  closed_by_id: string;
  closed_by_name: string;
  closed_at: string;
  status: CashClosingStatus;
  sales_count: number;
  version: number;
  reopened_by_id: string | null;
  reopened_by_name: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
};

export type CashClosingInput = {
  store: CashClosingStore;
  day: string;
  opening_float: number;
  counted: CashMethodAmounts;
  cash_breakdown?: CashBreakdownCount | null;
  cash_out?: CashOutEntry[];
  note?: string;
};

export type CashClosingHistoryEntry = CashClosing & {
  archived_at: string;
  archived_by_id: string;
  archived_by_name: string;
  history_id: string;
};

// ---------------------------------------------------------------------------
// Helpers purs
// ---------------------------------------------------------------------------

const num = (v: any): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};
const zeroAmounts = (): CashMethodAmounts => ({ cash: 0, momo: 0, om: 0, card: 0 });
const methodKeyOf = (pm: any): CashMethodKey | null => {
  const m = CASH_METHODS.find(x => x.paymentMethod === pm);
  return m ? m.key : null;
};

export function cashClosingId(store: string, day: string): string {
  return `${normStore(store)}_${day}`;
}

export function toCashClosingStore(store: any): CashClosingStore {
  return normStore(store) === 'tougou' ? 'tougou' : 'falaise';
}

/** Ton d'un écart : nul → success, ≤ seuil → warning, au-delà → danger. */
export function cashDiffTone(diff: number, threshold: number = CASH_DIFF_THRESHOLD): CashDiffTone {
  const a = Math.abs(Math.round(num(diff)));
  if (a === 0) return 'success';
  return a <= threshold ? 'warning' : 'danger';
}

export function cashBreakdownTotal(b: CashBreakdownCount | null | undefined): number {
  if (!b) return 0;
  return (
    num(b.b10000) * 10000 + num(b.b5000) * 5000 + num(b.b2000) * 2000 +
    num(b.b1000) * 1000 + num(b.b500) * 500 + num(b.coins)
  );
}

/** Acompte initial (création), y compris une fois soldé ('Avance Soldée (…)'). */
function isInitialAdvanceSale(s: any): boolean {
  if (!s || s.is_advance_installment) return false;
  const pm = String(s.payment_method || '');
  return pm === 'Avance' || pm.startsWith('Avance Soldée');
}

/**
 * Calcule la ventilation de l'attendu depuis les données brutes du nœud `sales`
 * (objet { key: sale } ou tableau). Fonction pure.
 */
export function computeCashSalesBreakdown(salesData: any, store: string, day: string): CashSalesBreakdown {
  const out: CashSalesBreakdown = {
    dashboard: zeroAmounts(),
    advance_initial: zeroAmounts(),
    advance_unassigned: 0,
    boss: { momo_boss: 0, om_boss: 0 },
    gifts_count: 0,
    other: {},
    sales_total: 0,
    sales_count: 0,
  };
  if (!salesData || typeof salesData !== 'object') return out;
  const target = normStore(store);
  const list: any[] = Array.isArray(salesData) ? salesData : Object.values(salesData);

  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const rawDate = s.date || s.created_at || '';
    if (!isOnLocalDay(typeof rawDate === 'string' ? rawDate : '', day)) continue;
    if (normStore(s.store) !== target) continue;

    const amount = getEffectiveTotal(s);
    out.sales_total += amount;
    out.sales_count += 1;

    const pm = s.payment_method;
    const key = methodKeyOf(pm);
    if (key) {
      out.dashboard[key] += amount;
    } else if (isInitialAdvanceSale(s)) {
      const real = s.advanceData?.initialPaymentMethod;
      const realKey = methodKeyOf(real);
      if (realKey) out.advance_initial[realKey] += amount;
      else if (real === 'MoMo Boss') out.boss.momo_boss += amount;
      else if (real === 'OM Boss') out.boss.om_boss += amount;
      else out.advance_unassigned += amount;
    } else if (pm === 'MoMo Boss') {
      out.boss.momo_boss += amount;
    } else if (pm === 'OM Boss') {
      out.boss.om_boss += amount;
    } else if (pm === 'Ami / Don') {
      out.gifts_count += 1;
      if (amount) out.other['Ami / Don'] = (out.other['Ami / Don'] || 0) + amount;
    } else {
      const label = String(pm || 'Non précisé');
      out.other[label] = (out.other[label] || 0) + amount;
    }
  }
  return out;
}

/** Montant attendu en caisse pour un moyen = ventes (Dashboard) + acomptes initiaux réattribués. */
export function cashSalesForMethod(b: CashSalesBreakdown, key: CashMethodKey): number {
  return num(b.dashboard[key]) + num(b.advance_initial[key]);
}

function sanitizeCashOut(list: CashOutEntry[] | undefined | null): CashOutEntry[] {
  if (!Array.isArray(list)) return [];
  return list
    .map(e => ({ label: String(e?.label || '').trim() || 'Sortie', amount: Math.max(0, Math.round(num(e?.amount))) }))
    .filter(e => e.amount > 0);
}

/** Calcule attendu / compté / écarts à partir de la saisie et de la ventilation. Fonction pure. */
export function computeCashClosingTotals(input: Omit<CashClosingInput, 'store' | 'day'>, breakdown: CashSalesBreakdown) {
  const opening = Math.max(0, Math.round(num(input.opening_float)));
  const cashOut = sanitizeCashOut(input.cash_out);
  const cashOutTotal = cashOut.reduce((s, e) => s + e.amount, 0);

  const cashSales = cashSalesForMethod(breakdown, 'cash');
  const expected: CashExpected = {
    cash_sales: cashSales,
    cash: opening + cashSales - cashOutTotal,
    momo: cashSalesForMethod(breakdown, 'momo'),
    om: cashSalesForMethod(breakdown, 'om'),
    card: cashSalesForMethod(breakdown, 'card'),
    total: 0,
  };
  expected.total = expected.cash + expected.momo + expected.om + expected.card;

  const counted: CashCounted = {
    cash: Math.round(num(input.counted?.cash)),
    momo: Math.round(num(input.counted?.momo)),
    om: Math.round(num(input.counted?.om)),
    card: Math.round(num(input.counted?.card)),
    total: 0,
  };
  counted.total = counted.cash + counted.momo + counted.om + counted.card;

  const diff: CashMethodAmounts = {
    cash: counted.cash - expected.cash,
    momo: counted.momo - expected.momo,
    om: counted.om - expected.om,
    card: counted.card - expected.card,
  };
  const diffTotal = diff.cash + diff.momo + diff.om + diff.card;

  return { opening, cashOut, cashOutTotal, expected, counted, diff, diffTotal };
}

// ---------------------------------------------------------------------------
// Droits d'accès
// ---------------------------------------------------------------------------

/** Boutique de l'utilisateur (caissière / employé / admin non-boss). */
export function cashClosingUserStore(user: any): CashClosingStore {
  return toCashClosingStore(user?.store);
}

/** Le Boss voit les deux boutiques, n'importe quel jour, l'historique, et peut rouvrir. */
export function canManageAllCashClosings(user: any): boolean {
  return isSuperBoss(user);
}

/** Boutiques consultables par l'utilisateur. */
export function cashClosingStoresFor(user: any): CashClosingStore[] {
  return isSuperBoss(user) ? ['falaise', 'tougou'] : [cashClosingUserStore(user)];
}

/** Peut-il consulter ce jour / cette boutique ? (jamais un jour futur) */
export function canViewCashClosing(user: any, store: string, day: string): boolean {
  if (!user || day > todayKey()) return false;
  if (isSuperBoss(user)) return true;
  return toCashClosingStore(store) === cashClosingUserStore(user);
}

/** Peut-il saisir / enregistrer la clôture ? (caissière : sa boutique, aujourd'hui uniquement) */
export function canEditCashClosing(user: any, store: string, day: string, existing: CashClosing | null): boolean {
  if (!canViewCashClosing(user, store, day)) return false;
  if (existing && existing.status === 'closed') return false;
  if (isSuperBoss(user)) return true;
  return day === todayKey();
}

export function canReopenCashClosing(user: any, existing: CashClosing | null): boolean {
  return isSuperBoss(user) && !!existing && existing.status === 'closed';
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

async function sdkGet(path: string, timeoutMs: number = 2500): Promise<{ ok: boolean; val: any }> {
  try {
    const snap: any = await Promise.race([
      get(ref(db, path)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return { ok: true, val: snap && snap.exists() ? snap.val() : null };
  } catch (e) {
    return { ok: false, val: null };
  }
}

/** Lecture REST d'abord, repli SDK. `ok:false` si aucune source n'a répondu. */
async function readPath(path: string): Promise<{ ok: boolean; val: any }> {
  try {
    const res = await fetch(`${RTDB_REST_URL}/${path}.json`);
    if (res.ok) return { ok: true, val: await res.json() };
  } catch (e) {}
  return sdkGet(path);
}

/** Charge les ventes (REST → SDK → cache local) et renvoie la ventilation du jour. */
export async function fetchCashSalesBreakdown(store: string, day: string): Promise<CashSalesBreakdown> {
  const r = await readPath('sales');
  let data = r.ok ? r.val : null;
  if (r.ok && data) saveFastCache('loreal_cache_sales', data);
  if (!r.ok) data = getFastCache('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};
  return computeCashSalesBreakdown(data || {}, store, day);
}

function normalizeClosing(id: string, raw: any): CashClosing | null {
  if (!raw || typeof raw !== 'object') return null;
  const cashOutRaw = Array.isArray(raw.cash_out)
    ? raw.cash_out
    : (raw.cash_out && typeof raw.cash_out === 'object' ? Object.values(raw.cash_out) : []);
  const detail = raw.expected_detail || {};
  const amounts = (o: any): CashMethodAmounts => ({ cash: num(o?.cash), momo: num(o?.momo), om: num(o?.om), card: num(o?.card) });
  return {
    id,
    store: toCashClosingStore(raw.store),
    day: String(raw.day || id.split('_').slice(1).join('_')),
    expected: { ...amounts(raw.expected), cash_sales: num(raw.expected?.cash_sales), total: num(raw.expected?.total) },
    expected_detail: {
      dashboard: amounts(detail.dashboard),
      advance_initial: amounts(detail.advance_initial),
      advance_unassigned: num(detail.advance_unassigned),
      boss: { momo_boss: num(detail.boss?.momo_boss), om_boss: num(detail.boss?.om_boss) },
      gifts_count: num(detail.gifts_count),
      other: detail.other && typeof detail.other === 'object' ? detail.other : {},
      sales_total: num(detail.sales_total),
      sales_count: num(detail.sales_count),
    },
    counted: { ...amounts(raw.counted), total: num(raw.counted?.total) },
    cash_breakdown: raw.cash_breakdown && typeof raw.cash_breakdown === 'object'
      ? {
          b10000: num(raw.cash_breakdown.b10000), b5000: num(raw.cash_breakdown.b5000),
          b2000: num(raw.cash_breakdown.b2000), b1000: num(raw.cash_breakdown.b1000),
          b500: num(raw.cash_breakdown.b500), coins: num(raw.cash_breakdown.coins),
        }
      : null,
    opening_float: num(raw.opening_float),
    cash_out: sanitizeCashOut(cashOutRaw),
    cash_out_total: num(raw.cash_out_total),
    diff: amounts(raw.diff),
    diff_total: num(raw.diff_total),
    note: raw.note || null,
    closed_by_id: String(raw.closed_by_id || ''),
    closed_by_name: String(raw.closed_by_name || ''),
    closed_at: String(raw.closed_at || ''),
    status: raw.status === 'reopened' ? 'reopened' : 'closed',
    sales_count: num(raw.sales_count),
    version: Math.max(1, num(raw.version) || 1),
    reopened_by_id: raw.reopened_by_id || null,
    reopened_by_name: raw.reopened_by_name || null,
    reopened_at: raw.reopened_at || null,
    reopen_reason: raw.reopen_reason || null,
  };
}

/** Clôture d'une boutique / d'un jour, ou null si aucune. Lève une erreur si la base est injoignable. */
export async function getCashClosing(store: string, day: string): Promise<CashClosing | null> {
  const id = cashClosingId(store, day);
  const r = await readPath(`cash_closings/${id}`);
  if (!r.ok) throw new Error('Impossible de lire la clôture (réseau).');
  return normalizeClosing(id, r.val);
}

/** Clôtures des `days` derniers jours (aujourd'hui inclus), plus récentes d'abord. */
export async function listCashClosings(days: number = 30, store?: string): Promise<CashClosing[]> {
  const r = await readPath('cash_closings');
  if (!r.ok) throw new Error("Impossible de lire l'historique des clôtures (réseau).");
  const data = r.val || {};
  const from = todayKey(-(Math.max(1, days) - 1));
  const target = store ? normStore(store) : null;
  return Object.keys(data)
    .map(id => normalizeClosing(id, data[id]))
    .filter((c): c is CashClosing => !!c && c.day >= from && (!target || c.store === target))
    .sort((a, b) => (a.day === b.day ? a.store.localeCompare(b.store) : b.day.localeCompare(a.day)));
}

/** Versions archivées d'une clôture (plus récentes d'abord). */
export async function getCashClosingHistory(store: string, day: string): Promise<CashClosingHistoryEntry[]> {
  const id = cashClosingId(store, day);
  const r = await readPath(`cash_closings_history/${id}`);
  if (!r.ok || !r.val) return [];
  return Object.keys(r.val)
    .map(k => {
      const raw = r.val[k];
      const c = normalizeClosing(id, raw);
      return c
        ? {
            ...c,
            history_id: k,
            archived_at: String(raw.archived_at || ''),
            archived_by_id: String(raw.archived_by_id || ''),
            archived_by_name: String(raw.archived_by_name || ''),
          }
        : null;
    })
    .filter((x): x is CashClosingHistoryEntry => !!x)
    .sort((a, b) => b.archived_at.localeCompare(a.archived_at));
}

// ---------------------------------------------------------------------------
// Écriture (REST PUT/PATCH vérifié + repli SDK update)
// ---------------------------------------------------------------------------

async function sdkUpdateConfirmed(updates: Record<string, any>): Promise<boolean> {
  try {
    const r = await Promise.race([
      update(ref(db), updates).then(() => 'ok'),
      new Promise<string>(resolve => setTimeout(() => resolve('timeout'), 2500)),
    ]);
    return r === 'ok';
  } catch (e) {
    return false;
  }
}

async function restWrite(path: string, method: 'PUT' | 'PATCH', body: any): Promise<boolean> {
  try {
    const res = await fetch(`${RTDB_REST_URL}/${path}.json`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/** Remplace récursivement `undefined` par null (RTDB refuse undefined). */
function noUndefined<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => (val === undefined ? null : val)));
}

const fmt = (n: number) => Math.round(num(n)).toLocaleString('fr-FR');

/**
 * Enregistre (ou ré-enregistre après réouverture) la clôture.
 * Recalcule l'attendu depuis `sales` au moment de l'enregistrement.
 */
export async function saveCashClosing(input: CashClosingInput, actor: any): Promise<CashClosing> {
  const store = toCashClosingStore(input.store);
  const day = input.day;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Jour invalide.');

  const existing = await getCashClosing(store, day);
  if (!canEditCashClosing(actor, store, day, existing)) {
    throw new Error(existing?.status === 'closed'
      ? 'Cette caisse est déjà clôturée.'
      : "Vous n'avez pas le droit de clôturer cette caisse.");
  }

  const breakdown = await fetchCashSalesBreakdown(store, day);
  const t = computeCashClosingTotals(input, breakdown);
  const id = cashClosingId(store, day);
  const nowISO = new Date().toISOString();

  const closing: CashClosing = {
    id,
    store,
    day,
    expected: t.expected,
    expected_detail: breakdown,
    counted: t.counted,
    cash_breakdown: input.cash_breakdown ? { ...input.cash_breakdown } : null,
    opening_float: t.opening,
    cash_out: t.cashOut,
    cash_out_total: t.cashOutTotal,
    diff: t.diff,
    diff_total: t.diffTotal,
    note: (input.note || '').trim() || null,
    closed_by_id: String(actor?.id || ''),
    closed_by_name: String(actor?.name || 'Inconnu'),
    closed_at: nowISO,
    status: 'closed',
    sales_count: breakdown.sales_count,
    version: existing ? existing.version + 1 : 1,
    reopened_by_id: existing?.reopened_by_id || null,
    reopened_by_name: existing?.reopened_by_name || null,
    reopened_at: existing?.reopened_at || null,
    reopen_reason: existing?.reopen_reason || null,
  };

  const { id: _omit, ...payloadRaw } = closing;
  const payload = noUndefined(payloadRaw);

  const restOk = await restWrite(`cash_closings/${id}`, 'PUT', payload);
  const sdkOk = restOk ? true : await sdkUpdateConfirmed({ [`cash_closings/${id}`]: payload });
  if (!restOk && !sdkOk) {
    throw new Error("Clôture non enregistrée (réseau). Réessayez avant de quitter l'écran.");
  }

  logAudit(
    'CASH_CLOSING',
    'Caisse',
    `Clôture ${CASH_STORE_LABELS[store]} du ${day} (v${closing.version}) : attendu ${fmt(t.expected.total)} F, compté ${fmt(t.counted.total)} F, écart ${t.diffTotal > 0 ? '+' : ''}${fmt(t.diffTotal)} F • ${breakdown.sales_count} vente(s)`,
    closing.closed_by_id,
    closing.closed_by_name,
    store,
    closing.note || ''
  ).catch(() => {});

  return closing;
}

/** Rouvre une clôture (Boss) : archive la version actuelle puis passe le statut à 'reopened'. */
export async function reopenCashClosing(store: string, day: string, actor: any, reason: string = ''): Promise<CashClosing> {
  const s = toCashClosingStore(store);
  const existing = await getCashClosing(s, day);
  if (!canReopenCashClosing(actor, existing) || !existing) {
    throw new Error(existing ? 'Seul le Boss peut rouvrir une caisse clôturée.' : 'Aucune clôture à rouvrir.');
  }
  const id = cashClosingId(s, day);
  const nowISO = new Date().toISOString();
  const historyKey = push(ref(db, `cash_closings_history/${id}`)).key || `h_${Date.now()}`;
  const { id: _omit, ...snapshot } = existing;
  const archived = noUndefined({
    ...snapshot,
    archived_at: nowISO,
    archived_by_id: String(actor?.id || ''),
    archived_by_name: String(actor?.name || 'Boss'),
  });
  const patch = {
    status: 'reopened',
    reopened_by_id: String(actor?.id || ''),
    reopened_by_name: String(actor?.name || 'Boss'),
    reopened_at: nowISO,
    reopen_reason: reason.trim() || null,
  };

  // L'archive doit être confirmée AVANT de modifier le statut (on ne perd jamais une version).
  let archivedOk = await restWrite(`cash_closings_history/${id}/${historyKey}`, 'PUT', archived);
  let patchedOk = archivedOk ? await restWrite(`cash_closings/${id}`, 'PATCH', patch) : false;
  if (!archivedOk || !patchedOk) {
    const updates: Record<string, any> = {};
    if (!archivedOk) updates[`cash_closings_history/${id}/${historyKey}`] = archived;
    for (const k of Object.keys(patch)) updates[`cash_closings/${id}/${k}`] = (patch as any)[k];
    const sdkOk = await sdkUpdateConfirmed(updates);
    if (sdkOk) { archivedOk = true; patchedOk = true; }
  }
  if (!patchedOk) throw new Error('Réouverture non enregistrée (réseau). Réessayez.');

  logAudit(
    'CASH_CLOSING_REOPENED',
    'Caisse',
    `Réouverture de la clôture ${CASH_STORE_LABELS[s]} du ${day} (v${existing.version} archivée)`,
    patch.reopened_by_id,
    patch.reopened_by_name,
    s,
    patch.reopen_reason || ''
  ).catch(() => {});

  return { ...existing, ...patch, status: 'reopened' } as CashClosing;
}

// ---------------------------------------------------------------------------
// Récapitulatif texte (WhatsApp)
// ---------------------------------------------------------------------------

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))} F`;

function formatDayFr(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? day : dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Texte récapitulatif de clôture (format WhatsApp : *gras*). */
export function buildCashClosingSummary(c: CashClosing): string {
  const lines: string[] = [];
  lines.push(`*CLÔTURE DE CAISSE — ${CASH_STORE_LABELS[c.store].toUpperCase()}*`);
  lines.push(formatDayFr(c.day));
  lines.push(`${c.sales_count} vente(s) · Recette ${fmt(c.expected_detail.sales_total)} F`);
  lines.push('');
  lines.push(`Fond de caisse : ${fmt(c.opening_float)} F`);
  if (c.cash_out.length > 0) {
    lines.push(`Sorties de caisse : ${fmt(c.cash_out_total)} F`);
    c.cash_out.forEach(e => lines.push(`  • ${e.label} : ${fmt(e.amount)} F`));
  }
  lines.push('');
  lines.push('*Attendu / Compté / Écart*');
  CASH_METHODS.forEach(m => {
    lines.push(`${m.label} : ${fmt(c.expected[m.key])} / ${fmt(c.counted[m.key])} / ${signed(c.diff[m.key])}`);
  });
  lines.push(`*TOTAL : ${fmt(c.expected.total)} / ${fmt(c.counted.total)} / ${signed(c.diff_total)}*`);
  const boss = c.expected_detail.boss.momo_boss + c.expected_detail.boss.om_boss;
  if (boss > 0) lines.push(`Hors caisse (MoMo/OM Boss) : ${fmt(boss)} F`);
  if (c.expected_detail.advance_unassigned > 0) lines.push(`Acomptes sans moyen précisé : ${fmt(c.expected_detail.advance_unassigned)} F`);
  if (c.note) { lines.push(''); lines.push(`Note : ${c.note}`); }
  lines.push('');
  const when = c.closed_at ? new Date(c.closed_at) : null;
  lines.push(`Clôturée par ${c.closed_by_name}${when && !isNaN(when.getTime()) ? ` à ${when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}${c.version > 1 ? ` (version ${c.version})` : ''}`);
  if (c.status === 'reopened') lines.push('⚠ Clôture rouverte — en attente de re-clôture');
  return lines.join('\n');
}
