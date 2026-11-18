import { db } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';
import { logAudit } from './audit';
import { getFastCache, saveFastCache, getLocalCache } from './cache';
import { RTDB_REST_URL } from './config';
import { isSuperBoss } from './roles';
import { localDayKey, normStore, ymdLocal } from '../../utils/saleMath';

// ============================================================================
// HISTORIQUE & SAISIE ANTÉRIEURE (réservé Super Boss) — écriture / suppression
// ============================================================================

export type BackdatedItemInput = {
  productId?: string | null;
  name: string;
  price: number;
  quantity: number;
  size?: string | null;
  color?: string | null;
  reference?: string | null;
};

export type RecordBackdatedSaleInput = {
  actor: any;
  date: string; // YYYY-MM-DD
  store: 'falaise' | 'tougou';
  mode: 'daily_total' | 'detailed';
  paymentMethod: string;
  totalAmount?: number;
  items?: BackdatedItemInput[];
  sellerName?: string;
  sellerId?: string;
  client?: { name?: string; phone?: string; email?: string };
  note?: string;
  impactStock?: boolean;
};

const BACKDATED_FLOOR_YEARS = 2;

function backdatedLocalYMD(d: Date): string {
  return ymdLocal(d);
}

/** Lecture fraîche du stock d'un produit : REST → SDK (2 s) → cache. null = produit introuvable. */
async function readFreshProductStock(productId: string, prodCache: Record<string, any>): Promise<number | null> {
  try {
    const res = await fetch(`${RTDB_REST_URL}/products/${productId}.json`);
    if (res.ok) {
      const prod = await res.json();
      if (prod && typeof prod === 'object') {
        prodCache[productId] = { ...(prodCache[productId] || {}), ...prod };
        return parseInt(prod.stock, 10) || 0;
      }
      if (prod === null) return null;
    }
  } catch (e) {}
  try {
    const snap: any = await Promise.race([
      get(ref(db, `products/${productId}`)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    if (snap && snap.exists()) {
      const prod = snap.val();
      prodCache[productId] = { ...(prodCache[productId] || {}), ...prod };
      return parseInt(prod?.stock, 10) || 0;
    }
  } catch (e) {}
  if (prodCache[productId] && prodCache[productId].stock !== undefined) {
    return parseInt(prodCache[productId].stock, 10) || 0;
  }
  return null;
}

/** Écriture multi-chemin via SDK ; true seulement si confirmée avant 2,5 s. */
async function sdkUpdateConfirmed(updates: Record<string, any>): Promise<boolean> {
  try {
    const r = await Promise.race([
      update(ref(db), updates).then(() => 'ok'),
      new Promise<string>(resolve => setTimeout(() => resolve('timeout'), 2500))
    ]);
    return r === 'ok';
  } catch (e) {
    return false;
  }
}

/**
 * Enregistre une vente à une date passée (Super Boss uniquement).
 * La date est fixée à midi heure locale du jour choisi.
 */
export async function recordBackdatedSale(input: RecordBackdatedSaleInput): Promise<{ saleId: string; total: number; stockApplied: { product_id: string; qty: number }[]; warnings: string[] }> {
  const actor = input?.actor;
  if (!isSuperBoss(actor)) throw new Error('Action réservée au Boss.');

  const ymd = String(input.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error('Date invalide.');
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const localDate = new Date(y, m - 1, d, 12, 0, 0);
  if (isNaN(localDate.getTime()) || backdatedLocalYMD(localDate) !== ymd) throw new Error('Date invalide.');
  const today = backdatedLocalYMD(new Date());
  if (ymd >= today) throw new Error("La date doit être strictement antérieure à aujourd'hui.");
  const floor = new Date();
  floor.setFullYear(floor.getFullYear() - BACKDATED_FLOOR_YEARS);
  if (ymd < backdatedLocalYMD(floor)) throw new Error(`Date trop ancienne (limite : ${BACKDATED_FLOOR_YEARS} ans).`);

  const store = String(input.store || '').trim().toLowerCase();
  if (store !== 'falaise' && store !== 'tougou') throw new Error('Boutique invalide.');

  const paymentMethod = String(input.paymentMethod || '').trim();
  if (!paymentMethod) throw new Error('Mode de paiement requis.');
  if (paymentMethod.toLowerCase() === 'avance') throw new Error("Le mode « Avance » n'est pas autorisé en saisie antérieure.");

  const mode = input.mode === 'detailed' ? 'detailed' : 'daily_total';
  const warnings: string[] = [];
  let total = 0;
  let items: any[] = [];

  if (mode === 'daily_total') {
    total = Math.round(Number(input.totalAmount));
    if (!isFinite(total) || total <= 0) throw new Error('Montant invalide.');
    items = [{ product_id: null, name: 'Recette globale (saisie antérieure)', quantity: 1, price: total, size: null, color: null, reference: null, custom: true }];
  } else {
    const raw = Array.isArray(input.items) ? input.items : [];
    if (raw.length === 0) throw new Error('Ajoutez au moins un article.');
    items = raw.map(it => {
      const name = String(it?.name || '').trim();
      const price = Number(it?.price);
      const quantity = parseInt(String(it?.quantity), 10);
      if (!name) throw new Error("Nom d'article manquant.");
      if (!isFinite(price) || price < 0) throw new Error(`Prix invalide pour « ${name} ».`);
      if (!isFinite(quantity) || quantity <= 0) throw new Error(`Quantité invalide pour « ${name} ».`);
      const productId = it?.productId ? String(it.productId) : null;
      const line: any = {
        product_id: productId,
        name,
        quantity,
        price: Math.round(price),
        size: it?.size || null,
        color: it?.color || null,
        reference: it?.reference || null,
      };
      if (!productId) line.custom = true;
      return line;
    });
    total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    if (!isFinite(total) || total <= 0) throw new Error('Le total doit être supérieur à 0.');
  }

  const impactStock = mode === 'detailed' && input.impactStock === true;
  const nowISO = new Date().toISOString();
  const saleKey = push(ref(db, 'sales')).key || `sale_${Date.now()}`;

  // Décrément de stock : seul ce qui est réellement appliqué est tracé (stock_applied)
  const prodCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
  const stockUpdates: Record<string, number> = {};
  const stockApplied: { product_id: string; qty: number }[] = [];
  if (impactStock) {
    const qtyByProduct: Record<string, { qty: number; name: string }> = {};
    for (const it of items) {
      if (!it.product_id) continue;
      const cur = qtyByProduct[it.product_id] || { qty: 0, name: it.name };
      cur.qty += it.quantity;
      qtyByProduct[it.product_id] = cur;
    }
    for (const pid of Object.keys(qtyByProduct)) {
      const { qty, name } = qtyByProduct[pid];
      const fresh = await readFreshProductStock(pid, prodCache);
      if (fresh === null) {
        warnings.push(`Stock introuvable pour « ${name} » : non décrémenté.`);
        continue;
      }
      const applied = Math.max(0, Math.min(fresh, qty));
      if (applied < qty) warnings.push(`Stock insuffisant pour « ${name} » : ${applied}/${qty} décrémenté(s).`);
      if (applied > 0) {
        stockUpdates[pid] = fresh - applied;
        stockApplied.push({ product_id: pid, qty: applied });
      }
    }
  }

  const client = input.client || {};
  const salePayload: any = {
    total,
    article_total: total,
    date: localDate.toISOString(),
    payment_method: paymentMethod,
    user_id: input.sellerId || 'boss',
    seller_name: (input.sellerName || '').trim() || (actor?.name || 'Boss'),
    beneficiary: '',
    is_advance: 0,
    advanceData: null,
    sale_label: null,
    client_name: (client.name || '').trim(),
    client_phone: (client.phone || '').trim(),
    client_email: (client.email || '').trim(),
    items,
    store,
    backdated: true,
    entered_by: 'boss',
    entered_at: nowISO,
    entered_by_id: actor?.id || 'boss',
    sale_type: mode,
    note: (input.note || '').trim() || null,
    stock_impacted: stockApplied.length > 0,
    stock_applied: stockApplied,
  };

  const updates: Record<string, any> = { [`sales/${saleKey}`]: salePayload };
  for (const pid of Object.keys(stockUpdates)) updates[`products/${pid}/stock`] = stockUpdates[pid];

  // 1. Vente en REST d'abord ; le stock REST n'est écrit que si la vente REST est confirmée
  //    (sinon le SDK porte vente + stock de façon atomique).
  let restOk = false;
  try {
    const res = await fetch(`${RTDB_REST_URL}/sales/${saleKey}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload)
    });
    restOk = res.ok;
  } catch (e) {}

  const restStock: Promise<any>[] = restOk
    ? Object.keys(stockUpdates).map(pid =>
        fetch(`${RTDB_REST_URL}/products/${pid}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: stockUpdates[pid], updatedAt: nowISO })
        }).catch(() => {})
      )
    : [];
  const [sdkOk] = await Promise.all([sdkUpdateConfirmed(updates), Promise.all(restStock)]);

  if (!restOk && !sdkOk) {
    throw new Error("Enregistrement non confirmé (réseau). Vérifiez l'historique avant de ressaisir.");
  }

  try {
    const salesCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};
    salesCache[saleKey] = { id: saleKey, ...salePayload };
    saveFastCache('loreal_cache_sales', salesCache);
    for (const pid of Object.keys(stockUpdates)) {
      if (prodCache[pid]) prodCache[pid].stock = stockUpdates[pid];
    }
    if (Object.keys(prodCache).length > 0) saveFastCache('loreal_cache_products', prodCache);
  } catch (e) {}

  const label = mode === 'daily_total'
    ? `Recette globale ${Math.round(total).toLocaleString('fr-FR')} FCFA`
    : `${items.map(i => `${i.name} (x${i.quantity})`).join(', ')} pour ${Math.round(total).toLocaleString('fr-FR')} FCFA`;
  logAudit(
    'SALE_BACKDATED_CREATED',
    'Vente antérieure',
    `Saisie antérieure #${saleKey.slice(-4)} du ${ymd} (${store}) : ${label} • ${paymentMethod}${stockApplied.length > 0 ? ' • stock décrémenté' : ''}`,
    actor?.id || 'boss',
    actor?.name || 'Boss',
    store,
    salePayload.note || ''
  ).catch(() => {});

  return { saleId: saleKey, total, stockApplied, warnings };
}

/**
 * Supprime une vente saisie a posteriori (backdated === true uniquement).
 * Restitue exactement le stock tracé dans stock_applied (par product_id).
 */
export async function deleteBackdatedSale(saleId: string, actor: any, reason: string = ''): Promise<{ success: true; restoredItems: string[] }> {
  if (!isSuperBoss(actor)) throw new Error('Action réservée au Boss.');
  if (!saleId) throw new Error('ID de vente manquant.');

  let sale: any = null;
  try {
    const res = await fetch(`${RTDB_REST_URL}/sales/${saleId}.json`);
    if (res.ok) sale = await res.json();
  } catch (e) {}
  if (!sale) {
    try {
      const snap: any = await Promise.race([
        get(ref(db, `sales/${saleId}`)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (snap && snap.exists()) sale = snap.val();
    } catch (e) {}
  }
  const salesCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};
  if (!sale && salesCache[saleId]) sale = salesCache[saleId];
  if (!sale) throw new Error('Vente introuvable.');
  if (sale.backdated !== true) throw new Error('Seules les saisies antérieures peuvent être supprimées ici.');

  const store = normStore(sale.store);
  const prodCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
  const applied: any[] = Array.isArray(sale.stock_applied)
    ? sale.stock_applied
    : (sale.stock_applied && typeof sale.stock_applied === 'object' ? Object.values(sale.stock_applied) : []);

  const qtyByProduct: Record<string, number> = {};
  for (const a of applied) {
    const pid = a?.product_id ? String(a.product_id) : '';
    const qty = parseInt(a?.qty, 10) || 0;
    if (!pid || qty <= 0) continue;
    qtyByProduct[pid] = (qtyByProduct[pid] || 0) + qty;
  }

  const saleItems: any[] = Array.isArray(sale.items) ? sale.items : [];
  const nameOf = (pid: string) => saleItems.find(i => i?.product_id === pid)?.name || prodCache[pid]?.name || 'Article';

  const stockUpdates: Record<string, number> = {};
  const restoredItems: string[] = [];
  for (const pid of Object.keys(qtyByProduct)) {
    const fresh = await readFreshProductStock(pid, prodCache);
    if (fresh === null) continue; // produit supprimé entre-temps : rien à restituer
    stockUpdates[pid] = fresh + qtyByProduct[pid];
    restoredItems.push(`${nameOf(pid)} (x${qtyByProduct[pid]})`);
  }

  const updates: Record<string, any> = { [`sales/${saleId}`]: null };
  for (const pid of Object.keys(stockUpdates)) updates[`products/${pid}/stock`] = stockUpdates[pid];

  let restOk = false;
  try {
    const res = await fetch(`${RTDB_REST_URL}/sales/${saleId}.json`, { method: 'DELETE' });
    restOk = res.ok;
  } catch (e) {}
  const nowISO = new Date().toISOString();
  const restStock: Promise<any>[] = restOk
    ? Object.keys(stockUpdates).map(pid =>
        fetch(`${RTDB_REST_URL}/products/${pid}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: stockUpdates[pid], updatedAt: nowISO })
        }).catch(() => {})
      )
    : [];
  const [sdkOk] = await Promise.all([sdkUpdateConfirmed(updates), Promise.all(restStock)]);

  if (!restOk && !sdkOk) {
    throw new Error('Suppression non confirmée (réseau). Réessayez.');
  }

  try {
    delete salesCache[saleId];
    saveFastCache('loreal_cache_sales', salesCache);
    for (const pid of Object.keys(stockUpdates)) {
      if (prodCache[pid]) prodCache[pid].stock = stockUpdates[pid];
    }
    if (Object.keys(prodCache).length > 0) saveFastCache('loreal_cache_products', prodCache);
  } catch (e) {}

  const day = (typeof sale.date === 'string' && localDayKey(sale.date)) || '?';
  logAudit(
    'SALE_BACKDATED_DELETED',
    'Vente antérieure',
    `Suppression saisie antérieure #${saleId.slice(-4)} du ${day} (${store}) pour ${(Number(sale.total) || 0).toLocaleString('fr-FR')} FCFA${restoredItems.length > 0 ? ` • stock restitué : ${restoredItems.join(', ')}` : ''}`,
    actor?.id || 'boss',
    actor?.name || 'Boss',
    store,
    reason || ''
  ).catch(() => {});

  return { success: true, restoredItems };
}
