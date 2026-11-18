import { db } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';
import { logAudit } from './audit';
import { getFastCache, saveFastCache, getLocalCache } from './cache';
import { RTDB_REST_URL } from './config';
import { itemsSummary } from '../../utils/saleMath';

export function getAdvanceStore(a: any): 'tougou' | 'falaise' {
  if (!a) return 'falaise';
  if (a.store) {
    const s = String(a.store).trim().toLowerCase();
    if (s === 'tougou' || s === 'falaise') return s;
  }
  const seller = (a.seller_name || a.user_id || '').toLowerCase();
  if (['angele', 'ivy', 'esther'].some(name => seller.includes(name))) {
    return 'tougou';
  }
  return 'falaise';
}


export async function addAdvancePayment(advanceId: string, amount: number, method: string, userId: string = '', userName: string = '') {
  const advCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_advances') || getLocalCache('loreal_cache_advances') || {};
  let advance: any = advCache[advanceId] || null;

  if (!advance) {
    try {
      const res = await fetch(`${RTDB_REST_URL}/advances/${advanceId}.json`);
      if (res.ok) advance = await res.json();
    } catch (e) {}
  }

  if (!advance) {
    try {
      const snapshot: any = await Promise.race([
        get(ref(db, `advances/${advanceId}`)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (snapshot && snapshot.exists()) advance = snapshot.val();
    } catch (e) {}
  }

  if (!advance) throw new Error("Avance introuvable");
  
  const advStore = getAdvanceStore(advance);
  const nowISO = new Date().toISOString();
  const existingPayments = Array.isArray(advance.payments)
    ? advance.payments.filter((p: any) => Number(p?.amount) > 0)
    : [];
  const newPayments = [
    ...existingPayments,
    {
      date: nowISO,
      amount,
      method,
      received_by: userName || 'Caisse',
      user_id: userId || ''
    }
  ];
  
  const newRemaining = Math.max(0, (Number(advance.amount_remaining) || 0) - amount);
  const newPaid = (Number(advance.amount_paid) || 0) + amount;
  const totalArticlesVal = newPaid + newRemaining;
  const isCompleted = newRemaining === 0;
  const status = isCompleted ? 'completed' : 'pending';
  
  // 1. Enregistrement automatique de ce versement dans la Caisse du jour
  const salesRef = ref(db, 'sales');
  const newSaleRef = push(salesRef);
  const newSaleKey = newSaleRef.key || `sale_${Date.now()}`;

  const articlesLabel = Array.isArray(advance.items) && advance.items.length > 0
    ? itemsSummary(advance.items)
    : (advance.product_name || 'Article');

  const saleLabel = `Avance ${Math.round(amount).toLocaleString('fr-FR')} FCFA sur ${articlesLabel}${advance.client_name ? ` (${advance.client_name})` : ''}`;
  
  const saleObj = {
    total: amount,
    article_total: totalArticlesVal,
    date: nowISO,
    payment_method: method || 'Espèces',
    user_id: userId || '',
    seller_name: userName || advance.seller_name || 'Caisse',
    is_advance: isCompleted ? 0 : 1,
    is_advance_installment: 1,
    advance_id: advanceId,
    client_name: advance.client_name || '',
    client_phone: advance.client_phone || advance.phone || '',
    store: advStore,
    sale_label: saleLabel,
    items: advance.items && advance.items.length > 0 ? advance.items : [
      {
        product_id: advance.sale_id || advanceId,
        name: `${saleLabel}`,
        quantity: 1,
        price: totalArticlesVal,
        reference: advance.reference || null,
        size: advance.size || null,
        color: advance.color || null,
      }
    ],
    advanceData: {
      clientName: advance.client_name,
      clientPhone: advance.client_phone || advance.phone || '',
      amountPaid: newPaid,
      amountRemaining: newRemaining,
      totalArticles: totalArticlesVal,
      dueDate: advance.due_date,
      isFullyPaid: isCompleted,
      isCompleted: isCompleted,
      paidInstallment: amount,
      installmentDate: nowISO,
      payments: newPayments
    }
  };

  const updates: any = {};
  const restPromises: Promise<any>[] = [];

  updates[`sales/${newSaleKey}`] = saleObj;
  updates[`advances/${advanceId}/payments`] = newPayments;
  updates[`advances/${advanceId}/amount_remaining`] = newRemaining;
  updates[`advances/${advanceId}/amount_paid`] = newPaid;
  updates[`advances/${advanceId}/status`] = status;
  updates[`advances/${advanceId}/store`] = advStore;
  updates[`advances/${advanceId}/last_payment_date`] = nowISO;

  const advancePatch: any = {
    payments: newPayments,
    amount_remaining: newRemaining,
    amount_paid: newPaid,
    status,
    store: advStore,
    last_payment_date: nowISO
  };
  
  if (isCompleted) {
    updates[`advances/${advanceId}/completed_at`] = nowISO;
    advancePatch.completed_at = nowISO;
    if (advance.sale_id) {
      updates[`sales/${advance.sale_id}/is_advance`] = 0;
      updates[`sales/${advance.sale_id}/status`] = 'completed';
      updates[`sales/${advance.sale_id}/payment_method`] = `Avance Soldée (${method})`;
      restPromises.push(
        fetch(`${RTDB_REST_URL}/sales/${advance.sale_id}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_advance: 0, status: 'completed', payment_method: `Avance Soldée (${method})` })
        }).catch(() => {})
      );
    }
  }

  restPromises.push(
    fetch(`${RTDB_REST_URL}/sales/${newSaleKey}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleObj)
    }).catch(() => {}),
    fetch(`${RTDB_REST_URL}/advances/${advanceId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(advancePatch)
    }).catch(() => {})
  );
  
  await Promise.all([
    Promise.all(restPromises),
    Promise.race([
      update(ref(db), updates),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]).catch(() => {})
  ]);

  try {
    const salesCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};
    salesCache[newSaleKey] = { id: newSaleKey, ...saleObj };
    saveFastCache('loreal_cache_sales', salesCache);

    advCache[advanceId] = { ...advance, id: advanceId, ...advancePatch };
    saveFastCache('loreal_cache_advances', advCache);
  } catch (e) {}

  return {
    saleId: newSaleKey,
    saleObj,
    isCompleted,
    newRemaining,
    newPaid
  };
}


export async function completeAdvance(advanceId: string, saleId: string, paymentMethod: string) {
  await update(ref(db), {
    [`advances/${advanceId}/status`]: 'completed',
    [`advances/${advanceId}/amount_remaining`]: 0,
    [`sales/${saleId}/is_advance`]: 0,
    [`sales/${saleId}/payment_method`]: paymentMethod
  });
}

export async function deleteAdvanceAndRestoreStock(advanceId: string, userWhoDeleted?: any, restoreStock: boolean = true) {
  if (!advanceId) throw new Error("ID d'avance manquant.");

  // 1. Récupération résiliente de l'avance (Cache mémoire/local -> REST HTTPS -> SDK avec timeout)
  const advCache = getFastCache<Record<string, any>>('loreal_cache_advances') || getLocalCache('loreal_cache_advances') || {};
  let advance: any = advCache[advanceId] || null;

  if (!advance) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
      const res = await fetch(`${RTDB_REST_URL}/advances/${advanceId}.json`, {
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data) advance = data;
      }
    } catch (e) {}
  }

  if (!advance) {
    try {
      const snap: any = await Promise.race([
        get(ref(db, `advances/${advanceId}`)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (snap && snap.exists()) {
        advance = snap.val();
      }
    } catch (e) {}
  }

  // Fallback minimal si l'avance était déjà partiellement supprimée
  if (!advance) {
    advance = { id: advanceId, client_name: 'Client', store: 'falaise', items: [] };
  }

  const advStore = getAdvanceStore(advance);
  const restoredItems: string[] = [];
  const updates: Record<string, any> = {};
  const restPromises: Promise<any>[] = [];

  const prodCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};

  // 2. Réintégration en stock uniquement si restoreStock === true
  if (restoreStock) {
    const ensureAllProductsLoaded = async () => {
      if (Object.keys(prodCache).length > 0) return prodCache;
      try {
        const res = await fetch(`${RTDB_REST_URL}/products.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            Object.assign(prodCache, data);
          }
        }
      } catch (e) {}
      return prodCache;
    };

    if (Array.isArray(advance.items) && advance.items.length > 0) {
      for (const item of advance.items) {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const pId = item.product_id || item.id;
        let targetKey: string | null = null;
        let currentStock = 0;

        if (pId && prodCache[pId]) {
          targetKey = pId;
          currentStock = parseInt(prodCache[pId].stock, 10) || 0;
        } else if (pId) {
          try {
            const pRes = await fetch(`${RTDB_REST_URL}/products/${pId}.json`);
            if (pRes.ok) {
              const pVal = await pRes.json();
              if (pVal) {
                targetKey = pId;
                currentStock = parseInt(pVal.stock, 10) || 0;
                prodCache[pId] = pVal;
              }
            }
          } catch (e) {}
        }

        // Recherche de secours par référence ou nom + boutique
        if (!targetKey) {
          const prods = await ensureAllProductsLoaded();
          const matchedKey = Object.keys(prods).find(k => {
            const p = prods[k];
            if (!p) return false;
            const pStore = (p.store || 'falaise').trim().toLowerCase();
            if (pStore !== advStore) return false;
            if (item.reference && p.reference && String(p.reference).trim().toLowerCase() === String(item.reference).trim().toLowerCase()) {
              return true;
            }
            if (item.name && p.name && String(p.name).trim().toLowerCase() === String(item.name).trim().toLowerCase()) {
              if (item.size && p.size && String(p.size).trim() !== String(item.size).trim()) return false;
              return true;
            }
            return false;
          });

          if (matchedKey) {
            targetKey = matchedKey;
            currentStock = parseInt(prods[matchedKey].stock, 10) || 0;
          }
        }

        if (targetKey) {
          const newStock = currentStock + qty;
          updates[`products/${targetKey}/stock`] = newStock;
          if (prodCache[targetKey]) {
            prodCache[targetKey].stock = newStock;
          }
          restPromises.push(
            fetch(`${RTDB_REST_URL}/products/${targetKey}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock: newStock, updatedAt: new Date().toISOString() })
            }).catch(() => {})
          );
          restoredItems.push(`${item.name || prodCache[targetKey]?.name || 'Article'} (+${qty})`);
        } else {
          restoredItems.push(`${item.name || 'Article'} (+${qty})`);
        }
      }
    } else if (advance.product_name) {
      const prods = await ensureAllProductsLoaded();
      const matchedKey = Object.keys(prods).find(k => {
        const p = prods[k];
        if (!p) return false;
        const pStore = (p.store || 'falaise').trim().toLowerCase();
        if (pStore !== advStore) return false;
        if (advance.reference && p.reference && String(p.reference).trim().toLowerCase() === String(advance.reference).trim().toLowerCase()) return true;
        return p.name && advance.product_name && String(advance.product_name).toLowerCase().includes(String(p.name).toLowerCase());
      });
      if (matchedKey) {
        const curStock = parseInt(prods[matchedKey].stock, 10) || 0;
        const newStock = curStock + 1;
        updates[`products/${matchedKey}/stock`] = newStock;
        if (prodCache[matchedKey]) {
          prodCache[matchedKey].stock = newStock;
        }
        restPromises.push(
          fetch(`${RTDB_REST_URL}/products/${matchedKey}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock: newStock, updatedAt: new Date().toISOString() })
          }).catch(() => {})
        );
        restoredItems.push(`${prods[matchedKey].name} (+1)`);
      }
    }
  }

  // 3. Suppression de l'avance et des ventes d'acompte associées
  updates[`advances/${advanceId}`] = null;
  restPromises.push(
    fetch(`${RTDB_REST_URL}/advances/${advanceId}.json`, { method: 'DELETE' }).catch(() => {})
  );

  const salesCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};

  if (advance.sale_id) {
    updates[`sales/${advance.sale_id}`] = null;
    if (salesCache[advance.sale_id]) {
      delete salesCache[advance.sale_id];
    }
    restPromises.push(
      fetch(`${RTDB_REST_URL}/sales/${advance.sale_id}.json`, { method: 'DELETE' }).catch(() => {})
    );
  }

  // Supprimer également les éventuels versements liés à cette avance dans le cache des ventes
  Object.keys(salesCache).forEach(sKey => {
    if (salesCache[sKey] && (salesCache[sKey].advance_id === advanceId || salesCache[sKey].sale_id === advanceId)) {
      updates[`sales/${sKey}`] = null;
      delete salesCache[sKey];
      restPromises.push(
        fetch(`${RTDB_REST_URL}/sales/${sKey}.json`, { method: 'DELETE' }).catch(() => {})
      );
    }
  });

  // Exécution REST directe (ne bloque jamais sur les réseaux mobiles) + SDK avec timeout court
  await Promise.all([
    Promise.all(restPromises),
    Promise.race([
      update(ref(db), updates),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]).catch(() => {})
  ]);

  // 4. Mise à jour immédiate des caches en mémoire et localStorage
  try {
    if (advCache && advCache[advanceId]) {
      delete advCache[advanceId];
    }
    saveFastCache('loreal_cache_advances', advCache);
    if (Object.keys(prodCache).length > 0) {
      saveFastCache('loreal_cache_products', prodCache);
    }
    saveFastCache('loreal_cache_sales', salesCache);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`loreal_products_${advStore}`);
      window.localStorage.removeItem('loreal_products_falaise');
      window.localStorage.removeItem('loreal_products_tougou');
    }
  } catch (e) {}

  // 5. Journalisation d'audit non bloquante
  const auditAction = restoreStock ? 'SUPPRESSION_AVANCE_STOCK_REINTEGRE' : 'SUPPRESSION_AVANCE_DEFINITIVE';
  const auditDetails = restoreStock
    ? `Avance #${advanceId} de ${advance.client_name || 'Client'} (${advance.product_name || 'Articles'}) supprimée avec remise en stock (${advStore}) : ${restoredItems.join(', ')}.`
    : `Avance #${advanceId} de ${advance.client_name || 'Client'} (${advance.product_name || 'Articles'}) supprimée définitivement SANS remise en stock (${advStore}).`;

  logAudit(
    auditAction,
    'advances',
    auditDetails,
    userWhoDeleted?.id || userWhoDeleted?.name || 'Inconnu',
    userWhoDeleted?.name || 'Utilisateur',
    advStore,
    restoreStock ? 'Suppression avance + retour en stock' : 'Suppression définitive sans retour en stock'
  ).catch(() => {});

  return {
    success: true,
    restoreStock,
    clientName: advance.client_name,
    restoredItems,
    count: restoredItems.length,
    store: advStore
  };
}
