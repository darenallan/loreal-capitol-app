import { db } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';
import { logAudit } from './audit';
import { getFastCache, saveFastCache, getLocalCache, setLocalCache } from './cache';
import { RTDB_REST_URL } from './config';
import { getEffectiveTotal, isAnyAdvance, itemsSummary, isOnLocalDay, localDayKey, normStore } from '../../utils/saleMath';

export async function recordSale(
  total: number, 
  paymentMethod: string, 
  userId: string, 
  cart: any[], 
  advanceData?: any, 
  storeId: string = 'falaise', 
  sellerName: string = '', 
  beneficiary: string = '',
  clientInfo?: { name?: string; phone?: string; email?: string }
) {
  const salesRef = ref(db, 'sales');
  const newSaleRef = push(salesRef);
  
  const items = cart.map(item => ({
    product_id: item.id,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    size: item.size || null,
    color: item.color || null,
    reference: item.reference || null
  }));

  const isAdvance = advanceData ? 1 : 0;
  const initialPaid = isAdvance
    ? (advanceData.amountPaid !== undefined && advanceData.amountPaid !== null ? Math.max(0, Number(advanceData.amountPaid) || 0) : 0)
    : total;
  const recordedAmount = isAdvance ? initialPaid : total;
  
  const resolvedClientName = clientInfo?.name || advanceData?.clientName || '';
  const resolvedClientPhone = clientInfo?.phone || advanceData?.clientPhone || '';
  const resolvedClientEmail = clientInfo?.email || advanceData?.clientEmail || '';
  const nowISO = new Date().toISOString();
  const articlesSummary = itemsSummary(items);
  const saleLabel = isAdvance
    ? (initialPaid > 0
        ? `Avance ${Math.round(initialPaid).toLocaleString('fr-FR')} FCFA sur ${articlesSummary}`
        : `Avance (0 FCFA versé) sur ${articlesSummary}`)
    : undefined;

  const saleKey = newSaleRef.key || `sale_${Date.now()}`;
  const salePayload: any = {
    total: recordedAmount,
    article_total: total,
    date: nowISO,
    payment_method: paymentMethod,
    user_id: userId,
    seller_name: sellerName,
    beneficiary: beneficiary,
    is_advance: isAdvance,
    client_name: resolvedClientName,
    client_phone: resolvedClientPhone,
    client_email: resolvedClientEmail,
    advanceData: advanceData ? { ...advanceData, amountPaid: initialPaid } : null,
    sale_label: saleLabel || null,
    items,
    store: storeId
  };

  const updates: Record<string, any> = {};
  const restPromises: Promise<any>[] = [];

  updates[`sales/${saleKey}`] = salePayload;
  restPromises.push(
    fetch(`${RTDB_REST_URL}/sales/${saleKey}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload)
    }).catch(() => {})
  );

  // Update stock
  const prodCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
  for (const item of cart) {
    let currentStock = 0;
    if (prodCache[item.id] && prodCache[item.id].stock !== undefined) {
      currentStock = parseInt(prodCache[item.id].stock, 10) || 0;
    } else {
      try {
        const snapshot: any = await Promise.race([
          get(ref(db, `products/${item.id}/stock`)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        if (snapshot && snapshot.exists()) currentStock = parseInt(snapshot.val(), 10) || 0;
      } catch (e) {}
    }
    const newStock = Math.max(0, currentStock - (item.quantity || 1));
    updates[`products/${item.id}/stock`] = newStock;
    if (prodCache[item.id]) {
      prodCache[item.id].stock = newStock;
    }
    restPromises.push(
      fetch(`${RTDB_REST_URL}/products/${item.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock, updatedAt: nowISO })
      }).catch(() => {})
    );
  }

  // Record advance if needed
  const advCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_advances') || getLocalCache('loreal_cache_advances') || {};
  if (advanceData) {
    const advancesRef = ref(db, 'advances');
    const newAdvanceRef = push(advancesRef);
    const advKey = newAdvanceRef.key || `adv_${Date.now()}`;
    const refStr = items.map(i => i.reference).filter(Boolean).join(', ');
    const sizeStr = items.map(i => i.size).filter(Boolean).join(', ');
    const colorStr = items.map(i => i.color).filter(Boolean).join(', ');

    const initialPayments = initialPaid > 0
      ? [
          {
            date: nowISO,
            amount: initialPaid,
            method: advanceData.initialPaymentMethod || paymentMethod
          }
        ]
      : [];

    const advancePayload = {
      sale_id: saleKey,
      client_name: resolvedClientName,
      client_phone: resolvedClientPhone,
      client_email: resolvedClientEmail,
      amount_paid: initialPaid,
      amount_remaining: Math.max(0, total - initialPaid),
      due_date: advanceData.dueDate,
      status: 'pending',
      created_at: nowISO,
      product_name: articlesSummary,
      items: items,
      reference: refStr || '',
      size: sizeStr || '',
      color: colorStr || '',
      store: storeId || 'falaise',
      seller_name: sellerName || '',
      user_id: userId || '',
      payments: initialPayments
    };

    updates[`advances/${advKey}`] = advancePayload;
    advCache[advKey] = { id: advKey, ...advancePayload };
    restPromises.push(
      fetch(`${RTDB_REST_URL}/advances/${advKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advancePayload)
      }).catch(() => {})
    );
  }

  await Promise.all([
    Promise.all(restPromises),
    Promise.race([
      update(ref(db), updates),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]).catch(() => {})
  ]);

  try {
    const salesCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};
    salesCache[saleKey] = { id: saleKey, ...salePayload };
    saveFastCache('loreal_cache_sales', salesCache);
    if (Object.keys(prodCache).length > 0) saveFastCache('loreal_cache_products', prodCache);
    if (advanceData) saveFastCache('loreal_cache_advances', advCache);
  } catch (e) {}
}


export async function getDailySales(date: string, storeId?: string) {
  try {
    let data: any = null;
    try {
      const snap = await Promise.race([
        get(ref(db, 'sales')),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (snap && snap.exists()) {
        data = snap.val();
      }
    } catch (e) {
      // Fallback
    }

    if (!data) {
      try {
        const res = await fetch(`${RTDB_REST_URL}/sales.json`);
        if (res.ok) data = await res.json();
      } catch (err) {}
    }

    if (!data) {
      const cached = getLocalCache('loreal_cache_sales');
      data = cached || {};
    } else {
      setLocalCache('loreal_cache_sales', data);
    }
    
    // Jour LOCAL demandé : 'YYYY-MM-DD' gardé tel quel, sinon (ISO) converti en jour local.
    const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : (localDayKey(date) || date.split('T')[0]);
    
    const sales = Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(sale => isOnLocalDay(sale.date, formattedDate) && (!storeId || sale.store === storeId));

    return sales.map(sale => {
      const effectiveTotal = getEffectiveTotal(sale);
      const baseItems = itemsSummary(sale.items);
      const clientTag = (sale.client_name || sale.advanceData?.clientName) ? ` (${sale.client_name || sale.advanceData?.clientName})` : '';
      const itemsStr = sale.sale_label
        ? sale.sale_label
        : (isAnyAdvance(sale)
            ? (effectiveTotal > 0
                ? `Avance ${Math.round(effectiveTotal).toLocaleString('fr-FR')} FCFA sur ${baseItems}${clientTag}`
                : `Avance (0 FCFA versé) sur ${baseItems}${clientTag}`)
            : baseItems);
      return {
        id: sale.id,
        total: effectiveTotal,
        payment_method: sale.payment_method,
        date: sale.date,
        is_advance: sale.is_advance,
        items: itemsStr,
        store: sale.store,
        seller_name: sale.seller_name,
        beneficiary: sale.beneficiary
      };
    });
  } catch (e) {
    return [];
  }
}

// ============================================================================
// HISTORIQUE & SAISIE ANTÉRIEURE (réservé Super Boss) — lecture par période
// ============================================================================

export type HistorySale = {
  id: string;
  day: string;
  date: string;
  total: number;
  article_total: number;
  payment_method: string;
  store: string;
  seller_name: string;
  client_name: string;
  items: any[];
  itemsLabel: string;
  is_advance: number;
  backdated: boolean;
  entered_by?: string | null;
  entered_at?: string | null;
  note?: string | null;
  sale_type?: string | null;
  stock_impacted?: boolean;
};

/** Charge le nœud `sales` complet : SDK (2,5 s) → REST → cache local. */
async function loadAllSalesRaw(): Promise<Record<string, any>> {
  let data: any = null;
  try {
    const snap: any = await Promise.race([
      get(ref(db, 'sales')),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
    ]);
    if (snap && snap.exists()) data = snap.val();
  } catch (e) {}

  if (!data) {
    try {
      const res = await fetch(`${RTDB_REST_URL}/sales.json`);
      if (res.ok) data = await res.json();
    } catch (e) {}
  }

  if (!data) {
    return getLocalCache('loreal_cache_sales') || {};
  }
  setLocalCache('loreal_cache_sales', data);
  return data;
}

/**
 * Ventes dont le jour LOCAL (localDayKey(date)) est compris entre startYMD et endYMD inclus.
 * Total effectif calculé comme getDailySales. Tri par date décroissante.
 */
export async function getSalesByDateRange(startYMD: string, endYMD: string, storeId: 'falaise' | 'tougou' | 'all' = 'all'): Promise<HistorySale[]> {
  try {
    const data = await loadAllSalesRaw();
    const wanted = (storeId || 'all').trim().toLowerCase();
    const list: HistorySale[] = [];
    for (const key of Object.keys(data || {})) {
      const sale = data[key];
      if (!sale || typeof sale.date !== 'string') continue;
      const day = localDayKey(sale.date);
      if (!day || day < startYMD || day > endYMD) continue;
      const store = normStore(sale.store);
      if (wanted !== 'all' && store !== wanted) continue;

      const effectiveTotal = getEffectiveTotal(sale);
      const items: any[] = Array.isArray(sale.items)
        ? sale.items
        : (sale.items && typeof sale.items === 'object' ? Object.values(sale.items) : []);
      const itemsLabel = sale.sale_label
        ? String(sale.sale_label)
        : (items.length > 0
            ? items.map((i: any) => `${i?.name || 'Article'} (x${i?.quantity || 1})`).join(', ')
            : (typeof sale.items === 'string' ? sale.items : ''));

      list.push({
        id: key,
        day,
        date: sale.date,
        total: effectiveTotal,
        article_total: Number(sale.article_total ?? sale.total) || 0,
        payment_method: sale.payment_method || '',
        store,
        seller_name: sale.seller_name || '',
        client_name: sale.client_name || sale.advanceData?.clientName || '',
        items,
        itemsLabel,
        is_advance: Number(sale.is_advance) || 0,
        backdated: sale.backdated === true,
        entered_by: sale.entered_by ?? null,
        entered_at: sale.entered_at ?? null,
        note: sale.note ?? null,
        sale_type: sale.sale_type ?? null,
        stock_impacted: sale.stock_impacted === true,
      });
    }
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch (e) {
    console.warn('Erreur getSalesByDateRange:', e);
    return [];
  }
}


export async function deleteSale(saleId: string, userId: string = '', userName: string = '', reason: string = '', restoreStock: boolean = true) {
  if (!saleId) throw new Error("ID de vente manquant.");

  const salesCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_sales') || getLocalCache('loreal_cache_sales') || {};
  let sale: any = salesCache[saleId] || null;

  if (!sale) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
      const res = await fetch(`${RTDB_REST_URL}/sales/${saleId}.json`, {
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data) sale = data;
      }
    } catch (e) {}
  }

  if (!sale) {
    try {
      const saleSnapshot: any = await Promise.race([
        get(ref(db, `sales/${saleId}`)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (saleSnapshot && saleSnapshot.exists()) {
        sale = saleSnapshot.val();
      }
    } catch (e) {}
  }

  if (!sale) {
    sale = { id: saleId, store: 'falaise', total: 0, items: [] };
  }

  const saleStore = (sale.store || 'falaise').trim().toLowerCase();
  const updates: Record<string, any> = {};
  const restPromises: Promise<any>[] = [];

  updates[`sales/${saleId}`] = null;
  restPromises.push(
    fetch(`${RTDB_REST_URL}/sales/${saleId}.json`, { method: 'DELETE' }).catch(() => {})
  );

  // Supprimer l'avance associée si existante
  const advCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_advances') || getLocalCache('loreal_cache_advances') || {};
  if (sale.is_advance === 1 || sale.advance_id) {
    const targetAdvId = sale.advance_id || Object.keys(advCache).find(k => advCache[k]?.sale_id === saleId);
    if (targetAdvId) {
      updates[`advances/${targetAdvId}`] = null;
      delete advCache[targetAdvId];
      restPromises.push(
        fetch(`${RTDB_REST_URL}/advances/${targetAdvId}.json`, { method: 'DELETE' }).catch(() => {})
      );
    } else {
      try {
        const advRes = await fetch(`${RTDB_REST_URL}/advances.json`);
        if (advRes.ok) {
          const advances = await advRes.json();
          if (advances && typeof advances === 'object') {
            const advanceId = Object.keys(advances).find(k => advances[k]?.sale_id === saleId);
            if (advanceId) {
              updates[`advances/${advanceId}`] = null;
              delete advCache[advanceId];
              restPromises.push(
                fetch(`${RTDB_REST_URL}/advances/${advanceId}.json`, { method: 'DELETE' }).catch(() => {})
              );
            }
          }
        }
      } catch (e) {}
    }
  }

  const prodCache: Record<string, any> = getFastCache<Record<string, any>>('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
  const itemNames: string[] = [];
  const rawSaleItems = Array.isArray(sale.rawItems) && sale.rawItems.length > 0
    ? sale.rawItems
    : (Array.isArray(sale.items) ? sale.items : []);

  // Réintégration en stock uniquement si restoreStock === true
  if (rawSaleItems.length > 0) {
    for (const item of rawSaleItems) {
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      itemNames.push(`${item.name || 'Article'} (x${qty})`);

      if (restoreStock) {
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
              const prod = await pRes.json();
              if (prod) {
                targetKey = pId;
                currentStock = parseInt(prod.stock, 10) || 0;
                prodCache[pId] = prod;
              }
            }
          } catch (e) {}
        }

        // Recherche de secours par référence ou nom + taille + magasin
        if (!targetKey && Object.keys(prodCache).length > 0) {
          const matchedKey = Object.keys(prodCache).find(k => {
            const p = prodCache[k];
            if (!p) return false;
            const pStore = (p.store || 'falaise').trim().toLowerCase();
            if (pStore !== saleStore) return false;
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
            currentStock = parseInt(prodCache[matchedKey].stock, 10) || 0;
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
        }
      }
    }
  }

  await Promise.all([
    Promise.all(restPromises),
    Promise.race([
      update(ref(db), updates),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]).catch(() => {})
  ]);

  // Mise à jour immédiate des caches locaux
  try {
    if (salesCache && salesCache[saleId]) {
      delete salesCache[saleId];
    }
    saveFastCache('loreal_cache_sales', salesCache);
    if (Object.keys(prodCache).length > 0) {
      saveFastCache('loreal_cache_products', prodCache);
    }
    saveFastCache('loreal_cache_advances', advCache);
  } catch (e) {}

  logAudit(
    restoreStock ? 'SALE_DELETED' : 'SALE_DELETED_NO_STOCK',
    'Vente',
    `${restoreStock ? 'Suppression vente + remise en stock' : 'Suppression définitive vente (sans remise en stock)'} #${saleId.slice(-4)} (${itemNames.join(', ')}) pour ${(sale.total || 0).toLocaleString()} FCFA (Magasin: ${saleStore})`,
    userId,
    userName,
    sale.store,
    reason || (restoreStock ? 'Annulation vente + remise en stock' : 'Suppression définitive vente sans toucher au stock')
  ).catch(() => {});

  return {
    success: true,
    restoreStock,
    restoredItems: itemNames,
    sale
  };
}


export async function updateSalePaymentMethod(saleId: string, newPaymentMethod: string, nfcAuthId: string) {
  await update(ref(db), {
    [`sales/${saleId}/payment_method`]: newPaymentMethod,
    [`sales/${saleId}/nfc_auth_modifier`]: nfcAuthId,
    [`sales/${saleId}/modified_at`]: new Date().toISOString()
  });
}

export async function exchangeProduct(saleId: string, oldProductId: string, newProductId: string, newPrice: number, storeId: string, nfcAuthId: string) {
  const saleSnapshot = await get(ref(db, `sales/${saleId}`));
  if (!saleSnapshot.exists()) throw new Error('Vente non trouvée');
  const sale = saleSnapshot.val();

  const updates: any = {};
  
  const oldProdSnapshot = await get(ref(db, `products/${oldProductId}/stock`));
  if (oldProdSnapshot.exists()) {
    updates[`products/${oldProductId}/stock`] = oldProdSnapshot.val() + 1;
  }
  
  const newProdSnapshot = await get(ref(db, `products/${newProductId}/stock`));
  if (newProdSnapshot.exists()) {
    updates[`products/${newProductId}/stock`] = newProdSnapshot.val() - 1;
  }

  const newProdDetails = await get(ref(db, `products/${newProductId}`));
  if (!newProdDetails.exists()) throw new Error('Nouveau produit non trouvé');
  
  const updatedItems = sale.items.map((item: any) => {
    if (item.product_id === oldProductId) {
      return {
        product_id: newProductId,
        name: newProdDetails.val().name,
        quantity: 1,
        price: newPrice,
        size: newProdDetails.val().size || null,
        reference: newProdDetails.val().reference || null,
        is_exchanged: true,
        exchanged_from: oldProductId
      };
    }
    return item;
  });

  const newTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  updates[`sales/${saleId}/items`] = updatedItems;
  updates[`sales/${saleId}/total`] = newTotal;
  updates[`sales/${saleId}/nfc_auth_exchange`] = nfcAuthId;
  updates[`sales/${saleId}/exchange_date`] = new Date().toISOString();

  await update(ref(db), updates);
}
