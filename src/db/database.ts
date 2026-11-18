import { db } from './firebaseConfig';
import { ref, get, set, push, update } from 'firebase/database';

export const RTDB_REST_URL = 'https://l-oreal-capitol-default-rtdb.firebaseio.com';

export const DEFAULT_USERS = [
  { id: 'boss', name: 'Boss', role: 'admin', pin: 'B000000.', store: 'all' },
  { id: 'yaya', name: 'Yaya', role: 'caissiere', pin: 'Y000000.', store: 'falaise' },
  { id: 'maya', name: 'Maya', role: 'caissiere', pin: 'M000000.', store: 'falaise' },
  { id: 'angele', name: 'Angèle', role: 'caissiere', pin: 'A000000.', store: 'tougou' },
  { id: 'ivy', name: 'Ivy', role: 'caissiere', pin: 'I000000.', store: 'tougou' },
  { id: 'esther', name: 'Esther', role: 'admin', pin: 'E000000.', store: 'tougou' },
];

export function isUserAdmin(u: any): boolean {
  if (!u) return false;
  const role = (u.role || '').toLowerCase();
  const name = (u.name || '').trim().toLowerCase();
  const id = (u.id || '').toLowerCase();
  return role === 'admin' || role === 'boss' || id === 'boss' || name === 'boss' || u.store === 'all';
}

export function isSuperBoss(u: any): boolean {
  if (!u) return false;
  const role = (u.role || '').toLowerCase();
  const name = (u.name || '').trim().toLowerCase();
  const id = (u.id || '').toLowerCase();
  return id === 'boss' || name === 'boss' || role === 'boss' || u.store === 'all';
}

// Helper pour cache local afin de réduire la consommation de données mobiles
const inMemoryCache: Record<string, any> = {};

export function getFastCache<T = any>(key: string): T | null {
  if (inMemoryCache[key]) {
    return inMemoryCache[key];
  }
  const disk = getLocalCache(key);
  if (disk) {
    inMemoryCache[key] = disk;
    return disk;
  }
  return null;
}

export function saveFastCache(key: string, data: any) {
  inMemoryCache[key] = data;
  setLocalCache(key, data);
}

export function getLocalCache(key: string) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function setLocalCache(key: string, data: any) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }
}

export async function initDB() {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) {
      for (const u of DEFAULT_USERS) {
        await set(ref(db, `users/${u.id}`), {
          name: u.name,
          role: u.role,
          pin: u.pin,
          store: u.store,
        }).catch(() => {});
      }
    } else {
      const data = snapshot.val();
      const hasBoss = Object.keys(data).some(k => k === 'boss' || data[k]?.id === 'boss' || isUserAdmin(data[k]));
      if (!hasBoss) {
        await set(ref(db, `users/boss`), DEFAULT_USERS[0]).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('initDB background handled:', e);
  }
}

export async function addUser(name: string, role: string, pin: string, store: string) {
  const usersRef = ref(db, 'users');
  const newUserRef = push(usersRef);
  const userObj = { name, role, pin, store };
  await set(newUserRef, userObj);
  return { id: newUserRef.key, ...userObj };
}

export async function updateUser(userId: string, data: { name?: string; role?: string; pin?: string; store?: string; photo?: string }) {
  const updates: any = {};
  if (data.name !== undefined) updates[`users/${userId}/name`] = data.name;
  if (data.role !== undefined) updates[`users/${userId}/role`] = data.role;
  if (data.pin !== undefined) updates[`users/${userId}/pin`] = data.pin;
  if (data.store !== undefined) updates[`users/${userId}/store`] = data.store;
  if (data.photo !== undefined) updates[`users/${userId}/photo`] = data.photo;
  await update(ref(db), updates);
}

export async function getUsers() {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) {
      const cached = getLocalCache('loreal_cached_users');
      return cached || DEFAULT_USERS;
    }
    const data = snapshot.val();
    const users = Object.keys(data).map(key => {
      const u = { id: key, ...data[key] };
      if (isUserAdmin(u) && u.role !== 'admin') {
        u.role = 'admin';
      }
      return u;
    });
    setLocalCache('loreal_cached_users', users);
    return users;
  } catch (e) {
    const cached = getLocalCache('loreal_cached_users');
    return cached || DEFAULT_USERS;
  }
}

export async function deleteUser(userId: string) {
  const userRef = ref(db, `users/${userId}`);
  await set(userRef, null);
  // Met à jour le cache
  const cached = getLocalCache('loreal_cached_users');
  if (Array.isArray(cached)) {
    setLocalCache('loreal_cached_users', cached.filter((u: any) => u.id !== userId));
  }
}

export async function logIntrusion(userName: string, locationData: any, type: string = 'login_failed') {
  const logsRef = ref(db, 'security_logs');
  const newLogRef = push(logsRef);
  await set(newLogRef, {
    timestamp: new Date().toISOString(),
    userName,
    location: locationData,
    type,
    resolved: false
  });
}

export async function deleteSecurityLog(logId: string) {
  const logRef = ref(db, `security_logs/${logId}`);
  await set(logRef, null);
}

export async function getSecurityLogs() {
  const logsRef = ref(db, 'security_logs');
  const snapshot = await get(logsRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  const logs = Object.keys(data).map(key => ({ id: key, ...data[key] }));
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function changeUserPin(userId: string, newPin: string) {
  const userPinRef = ref(db, `users/${userId}/pin`);
  await set(userPinRef, newPin);
}

export async function updateUserProfile(userId: string, data: { name?: string; photo?: string }) {
  const updates: any = {};
  if (data.name) updates[`users/${userId}/name`] = data.name;
  if (data.photo) updates[`users/${userId}/photo`] = data.photo;
  await update(ref(db), updates);
}

export async function getProducts(storeId: string = 'falaise') {
  const normStore = (storeId || 'falaise').trim().toLowerCase();

  // 1. Retour ULTRA-RAPIDE (0 ms) si le cache est présent en mémoire ou localStorage
  const fastData = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
  if (fastData && typeof fastData === 'object' && Object.keys(fastData).length > 0) {
    const cachedList = Object.keys(fastData)
      .map(key => ({ id: key, ...fastData[key], stock: parseInt(fastData[key]?.stock, 10) || 0 }))
      .filter(p => normStore === 'all' || (p.store || 'falaise').trim().toLowerCase() === normStore);
    
    // Déclenche une mise à jour silencieuse en arrière-plan sans bloquer l'UI
    fetch(`${RTDB_REST_URL}/products.json`)
      .then(r => r.ok ? r.json() : null)
      .then(fresh => {
        if (fresh) {
          saveFastCache('loreal_cache_products', fresh);
          setLocalCache('loreal_cache_products', fresh);
        }
      })
      .catch(() => {});

    return cachedList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  // 2. Si aucun cache n'existe encore, chargement HTTPS REST direct ultra-rapide (pas d'attente de timeout)
  try {
    let data: any = null;
    try {
      const res = await fetch(`${RTDB_REST_URL}/products.json`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      // Ignorer
    }

    if (!data) {
      try {
        const snap = await Promise.race([
          get(ref(db, 'products')),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
        if (snap && snap.exists()) {
          data = snap.val();
        }
      } catch (e) {
        // Ignorer
      }
    }

    if (data) {
      saveFastCache('loreal_cache_products', data);
      setLocalCache('loreal_cache_products', data);
      const products = Object.keys(data)
        .map(key => ({ id: key, ...data[key], stock: parseInt(data[key]?.stock, 10) || 0 }))
        .filter(p => normStore === 'all' || (p.store || 'falaise').trim().toLowerCase() === normStore);
      const sorted = products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setLocalCache(`loreal_products_${storeId}`, sorted);
      return sorted;
    }
  } catch (e) {
    console.warn('Erreur getProducts:', e);
  }

  const fallback = getLocalCache(`loreal_products_${storeId}`) || [];
  return fallback;
}

export async function addProduct(name: string, category: string, price: number, size: string, color: string, reference: string, stock: number, storeId: string = 'falaise') {
  const normStore = (storeId || 'falaise').trim().toLowerCase();
  const cleanName = (name || '').trim();
  const cleanCategory = (category || 'Autre').trim();
  const cleanRef = (reference || '').trim();
  const cleanSize = (size || '').trim();
  const cleanColor = (color || '').trim();
  const exactStock = parseInt(String(stock), 10) || 0;
  const exactPrice = parseFloat(String(price)) || 0;

  const normName = cleanName.toLowerCase();
  const normRef = cleanRef.toLowerCase();
  const normSize = cleanSize.toLowerCase();
  const normColor = cleanColor.toLowerCase();

  // 1. Vérifier si un article identique existe déjà dans cette boutique via le cache local (0ms sans bloquer le réseau)
  const cachedObj = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
  if (normRef) {
    const existingKey = Object.keys(cachedObj).find(k => {
      const p = cachedObj[k];
      if (!p) return false;
      const pStore = (p.store || 'falaise').trim().toLowerCase();
      const pName = (p.name || '').trim().toLowerCase();
      const pRef = (p.reference || '').trim().toLowerCase();
      const pSize = (p.size || '').trim().toLowerCase();
      const pColor = (p.color || '').trim().toLowerCase();
      return pStore === normStore && pRef === normRef && pName === normName && pSize === normSize && pColor === normColor;
    });

    if (existingKey) {
      const existingProduct = cachedObj[existingKey];
      const currentStock = parseInt(existingProduct.stock, 10) || 0;
      const newStock = currentStock + exactStock;
      const patchData: any = { stock: newStock, quantity: newStock, updatedAt: new Date().toISOString() };
      if (exactPrice > 0) patchData.price = exactPrice;
      if (cleanCategory) patchData.category = cleanCategory;

      try {
        await fetch(`${RTDB_REST_URL}/products/${existingKey}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData)
        });
      } catch (e) {
        const updates: any = {};
        updates[`products/${existingKey}/stock`] = newStock;
        if (exactPrice > 0) updates[`products/${existingKey}/price`] = exactPrice;
        if (cleanCategory) updates[`products/${existingKey}/category`] = cleanCategory;
        await update(ref(db), updates).catch(() => {});
      }

      cachedObj[existingKey] = { ...existingProduct, ...patchData };
      saveFastCache('loreal_cache_products', cachedObj);
      return existingKey;
    }
  }

  // 2. Création du nouvel article
  const barcode = `CAPITOL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  const newProductData = {
    name: cleanName,
    category: cleanCategory,
    price: exactPrice,
    size: cleanSize,
    color: cleanColor,
    reference: cleanRef,
    stock: exactStock,
    quantity: exactStock,
    store: normStore,
    barcode,
    createdAt: new Date().toISOString()
  };

  let generatedKey = '';

  // Étape A : Enregistrement direct via HTTPS REST (infaillible sur MTN/Orange et instantané)
  try {
    const res = await fetch(`${RTDB_REST_URL}/products.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProductData)
    });
    if (res.ok) {
      const resJson = await res.json();
      if (resJson && resJson.name) {
        generatedKey = resJson.name;
      }
    }
  } catch (restErr) {
    console.warn('[addProduct] REST fallback vers SDK:', restErr);
  }

  // Étape B : Secours Firebase SDK si le réseau REST n'a pas répondu
  if (!generatedKey) {
    try {
      const productsRef = ref(db, 'products');
      const newProductRef = push(productsRef);
      generatedKey = newProductRef.key || `prod_${Date.now()}`;
      await Promise.race([
        set(newProductRef, newProductData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SDK write timeout')), 4000))
      ]);
    } catch (sdkErr) {
      console.warn('[addProduct] SDK error:', sdkErr);
      if (!generatedKey) generatedKey = `prod_${Date.now()}`;
    }
  }

  // Étape C : Enregistrement instantané dans le cache local (0 ms de latence UI)
  const fullItem = { id: generatedKey, ...newProductData };
  cachedObj[generatedKey] = fullItem;
  saveFastCache('loreal_cache_products', cachedObj);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(`loreal_products_${normStore}`);
      window.localStorage.removeItem('loreal_products_all');
    } catch (e) {}
  }

  return generatedKey;
}

export async function updateProductStock(id: string, additionalStock: number) {
  const cachedObj = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
  let currentStock = cachedObj[id]?.stock !== undefined ? cachedObj[id].stock : 0;

  try {
    const res = await fetch(`${RTDB_REST_URL}/products/${id}/stock.json`);
    if (res.ok) {
      const val = await res.json();
      if (val !== null) currentStock = parseInt(val, 10) || 0;
    }
  } catch (e) {}

  const newStock = Math.max(0, currentStock + additionalStock);

  try {
    await fetch(`${RTDB_REST_URL}/products/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock, quantity: newStock })
    });
  } catch (e) {
    const productStockRef = ref(db, `products/${id}/stock`);
    await set(productStockRef, newStock).catch(() => {});
  }

  if (cachedObj[id]) {
    cachedObj[id].stock = newStock;
    cachedObj[id].quantity = newStock;
    saveFastCache('loreal_cache_products', cachedObj);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('loreal_products_falaise');
      window.localStorage.removeItem('loreal_products_tougou');
      window.localStorage.removeItem('loreal_products_all');
    } catch (e) {}
  }
  return newStock;
}

export async function recordArrivage(productId: string, productName: string, quantity: number, userId: string, storeId: string = 'falaise') {
  const arrivagesRef = ref(db, 'arrivages');
  const newArrivageRef = push(arrivagesRef);
  const dateStr = new Date().toISOString();
  
  await updateProductStock(productId, quantity);
  
  return await set(newArrivageRef, {
    product_id: productId,
    product_name: productName,
    quantity,
    user_id: userId,
    date: dateStr,
    store: storeId
  });
}

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
  const articlesSummary = items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ');
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
    ? advance.items.map((i: any) => `${i.name} (x${i.quantity || 1})`).join(', ')
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
    
    const formattedDate = date.split('T')[0];
    
    const sales = Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(sale => sale.date && typeof sale.date === 'string' && sale.date.startsWith(formattedDate) && (!storeId || sale.store === storeId));

    return sales.map(sale => {
      const isAdvInitial = sale.is_advance === 1 && !sale.is_advance_installment && sale.advanceData && sale.advanceData.amountPaid !== undefined;
      const effectiveTotal = isAdvInitial
        ? (Number(sale.advanceData.amountPaid) || 0)
        : (Number(sale.total) || 0);
      const baseItems = Array.isArray(sale.items) 
        ? sale.items.map((i: any) => `${i.name} (x${i.quantity || 1})`).join(', ')
        : (typeof sale.items === 'string' ? sale.items : '');
      const clientTag = (sale.client_name || sale.advanceData?.clientName) ? ` (${sale.client_name || sale.advanceData?.clientName})` : '';
      const isAnyAdvance = sale.is_advance === 1 || sale.is_advance_installment === 1 || !!sale.advanceData || sale.payment_method === 'Avance';
      const itemsStr = sale.sale_label
        ? sale.sale_label
        : (isAnyAdvance
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

export async function logAudit(action: string, entity: string, details: string, userId: string = '', userName: string = '', storeId: string = 'all', reason: string = '') {
  try {
    const auditRef = ref(db, 'audit_logs');
    const newAuditRef = push(auditRef);
    await set(newAuditRef, {
      action,
      entity,
      details,
      user_id: userId,
      user_name: userName || 'Inconnu',
      store: storeId || 'all',
      reason: reason || '',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Erreur logAudit:', e);
  }
}

export async function getAuditLogs(): Promise<any[]> {
  try {
    const auditRef = ref(db, 'audit_logs');
    const snapshot = await get(auditRef);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.keys(data)
      .map(k => ({ id: k, ...data[k] }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    console.error('Erreur getAuditLogs:', e);
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

export async function updateProduct(id: string, data: { name?: string; category?: string; price?: number; size?: string; color?: string; reference?: string; stock?: number; barcode?: string }, userId: string = '', userName: string = '') {
  const cachedObj = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
  let oldProd = cachedObj[id] || {};

  if (!oldProd.name) {
    try {
      const prodSnap = await Promise.race([
        get(ref(db, `products/${id}`)),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (prodSnap && prodSnap.exists()) oldProd = prodSnap.val();
    } catch (e) {}
  }

  const patchPayload: any = { updatedAt: new Date().toISOString() };
  if (data.name !== undefined) patchPayload.name = (data.name || '').trim();
  if (data.category !== undefined) patchPayload.category = (data.category || '').trim();
  if (data.price !== undefined) patchPayload.price = data.price;
  if (data.size !== undefined) patchPayload.size = (data.size || '').trim();
  if (data.color !== undefined) patchPayload.color = (data.color || '').trim();
  if (data.reference !== undefined) patchPayload.reference = (data.reference || '').trim();
  if (data.stock !== undefined) {
    const s = parseInt(String(data.stock), 10) || 0;
    patchPayload.stock = s;
    patchPayload.quantity = s;
  }
  if (data.barcode !== undefined) patchPayload.barcode = data.barcode;

  // 1. Sauvegarde HTTPS REST direct
  let saved = false;
  try {
    const res = await fetch(`${RTDB_REST_URL}/products/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchPayload)
    });
    if (res.ok) saved = true;
  } catch (err) {
    console.warn('[updateProduct] REST error, using SDK:', err);
  }

  // 2. Fallback SDK si nécessaire
  if (!saved) {
    try {
      const updates: any = {};
      Object.keys(patchPayload).forEach(k => {
        updates[`products/${id}/${k}`] = patchPayload[k];
      });
      await update(ref(db), updates);
    } catch (e) {}
  }

  // 3. Mise à jour instantanée du cache local
  cachedObj[id] = { ...oldProd, ...patchPayload, id };
  saveFastCache('loreal_cache_products', cachedObj);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(`loreal_products_${(oldProd.store || 'falaise').toLowerCase()}`);
      window.localStorage.removeItem('loreal_products_all');
    } catch (e) {}
  }

  if (data.stock !== undefined && data.stock !== oldProd.stock) {
    await logAudit(
      'UPDATE_STOCK_MANUAL',
      'Stock',
      `Modification manuelle stock "${oldProd.name || id}" : ${oldProd.stock || 0} → ${data.stock} unités`,
      userId,
      userName,
      oldProd.store
    ).catch(() => {});
  }
}

export async function getAllProductNames(storeId: string = 'falaise'): Promise<string[]> {
  const cachedObj = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
  if (cachedObj && Object.keys(cachedObj).length > 0) {
    const names = new Set<string>();
    Object.keys(cachedObj).forEach(key => {
      const p = cachedObj[key];
      if (p && (storeId === 'all' || (p.store || 'falaise').toLowerCase() === storeId.toLowerCase()) && p.name) {
        names.add(p.name);
      }
    });
    return Array.from(names).sort();
  }

  try {
    const data = await Promise.race([
      get(ref(db, 'products')),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (data && data.exists()) {
      const val = data.val();
      const names = new Set<string>();
      Object.keys(val).forEach(key => {
        if (val[key].store === storeId && val[key].name) {
          names.add(val[key].name);
        }
      });
      return Array.from(names).sort();
    }
  } catch (e) {}
  return [];
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_STORE_LOCATIONS: Record<string, StoreLocation> = {
  falaise: {
    id: 'falaise',
    name: 'La Falaise',
    address: 'Boutique La Falaise, Douala (3°52\'13.7"N 11°30\'57.9"E)',
    lat: 3.870472,
    lng: 11.516083,
  },
  tougou: {
    id: 'tougou',
    name: 'Tougou',
    address: 'Boutique Tougou, Douala (3°52\'56.9"N 11°31\'24.1"E)',
    lat: 3.882472,
    lng: 11.523361,
  }
};

export async function getStoreLocations(): Promise<Record<string, StoreLocation>> {
  try {
    const locRef = ref(db, 'store_locations');
    const snapshot = await get(locRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        falaise: { ...DEFAULT_STORE_LOCATIONS.falaise, ...(data.falaise || {}) },
        tougou: { ...DEFAULT_STORE_LOCATIONS.tougou, ...(data.tougou || {}) }
      };
    }
  } catch (e) {
    console.error('Erreur getStoreLocations:', e);
  }
  return DEFAULT_STORE_LOCATIONS;
}

export async function updateStoreLocation(
  storeId: string, 
  data: { address?: string; lat: number; lng: number }, 
  userName: string = ''
) {
  const updates: any = {};
  const now = new Date().toISOString();
  if (data.address !== undefined) updates[`store_locations/${storeId}/address`] = data.address;
  updates[`store_locations/${storeId}/lat`] = data.lat;
  updates[`store_locations/${storeId}/lng`] = data.lng;
  updates[`store_locations/${storeId}/updated_at`] = now;
  updates[`store_locations/${storeId}/updated_by`] = userName;
  await update(ref(db), updates);
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 3.5;
  const R = 6371; // Rayon Terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

export function calculateTravelMinutes(distanceKm: number, averageSpeedKmh: number = 20): number {
  if (!distanceKm || distanceKm <= 0) return 15;
  // Trajet moto/taxi en circulation urbaine : distance / vitesse * 60 + 3 min marge feux
  const minutes = Math.round((distanceKm / averageSpeedKmh) * 60) + 3;
  return Math.max(5, Math.min(120, minutes));
}

export async function transferStock(
  productId: string, 
  fromStoreId: string, 
  toStoreId: string, 
  quantity: number, 
  userId: string, 
  userName: string = '',
  carrierId: string = '',
  carrierName: string = '',
  customMinutes: number = 0,
  currentGps?: { lat: number; lng: number }
) {
  // Récupérer le produit source
  const sourceSnapshot = await get(ref(db, `products/${productId}`));
  if (!sourceSnapshot.exists()) throw new Error('Produit source introuvable');
  const sourceProduct = sourceSnapshot.val();

  if (sourceProduct.stock < quantity) throw new Error(`Stock insuffisant. Disponible : ${sourceProduct.stock}`);

  // Récupérer les coordonnées GPS des boutiques
  const storeLocations = await getStoreLocations();
  const fromLoc = storeLocations[fromStoreId] || DEFAULT_STORE_LOCATIONS[fromStoreId] || DEFAULT_STORE_LOCATIONS.falaise;
  const toLoc = storeLocations[toStoreId] || DEFAULT_STORE_LOCATIONS[toStoreId] || DEFAULT_STORE_LOCATIONS.tougou;

  // Origine : position GPS actuelle si disponible, sinon boutique de départ
  const originLat = currentGps?.lat || fromLoc.lat;
  const originLng = currentGps?.lng || fromLoc.lng;
  const destLat = toLoc.lat;
  const destLng = toLoc.lng;

  // Calcul automatique de la distance et de la durée du trajet
  const distanceKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
  const autoMinutes = calculateTravelMinutes(distanceKm);
  const estimatedMinutes = customMinutes > 0 ? customMinutes : autoMinutes;

  const updates: any = {};
  
  // 1. Décrémenter immédiatement le stock de départ (les articles quittent le magasin)
  updates[`products/${productId}/stock`] = sourceProduct.stock - quantity;

  // 2. Créer l'enregistrement de transfert avec le statut 'preparing' et tracking GPS
  const transferRef = push(ref(db, 'transfers'));
  const now = new Date().toISOString();
  const startTime = Date.now();
  const eta = new Date(startTime + estimatedMinutes * 60 * 1000).toISOString();
  
  const assignedCarrierName = carrierName || userName || 'Livreur';
  const assignedCarrierId = carrierId || userId;

  updates[`transfers/${transferRef.key}`] = {
    product_id: productId,
    product_name: sourceProduct.name,
    category: sourceProduct.category || '',
    size: sourceProduct.size || '',
    color: sourceProduct.color || '',
    reference: sourceProduct.reference || '',
    price: sourceProduct.price || 0,
    quantity,
    from_store: fromStoreId,
    to_store: toStoreId,
    from_address: fromLoc.address,
    to_address: toLoc.address,
    origin_coords: { lat: originLat, lng: originLng },
    dest_coords: { lat: destLat, lng: destLng },
    distance_km: distanceKm,
    user_id: userId,
    user_name: userName || 'Utilisateur',
    sender_id: userId,
    sender_name: userName || 'Utilisateur',
    carrier_id: assignedCarrierId,
    carrier_name: assignedCarrierName,
    driver_name: assignedCarrierName,
    start_time: startTime,
    date: now,
    status: 'in_transit',
    estimated_arrival: eta,
    estimated_minutes: estimatedMinutes,
    tracking_steps: {
      preparing: { done: true, time: now, label: 'Colis préparé' },
      picked_up: { done: true, time: now, label: `Récupéré par ${assignedCarrierName}` },
      in_transit: { done: true, time: now, label: 'En route' },
      arriving: { done: false, time: null, label: 'Arrivée imminente' },
      received: { done: false, time: null, label: 'Livré & validé' },
    }
  };

  await update(ref(db), updates);

  await logAudit(
    'TRANSFER_INITIATED',
    'Transfert',
    `Transfert initié : ${quantity}x "${sourceProduct.name}" (taille: ${sourceProduct.size || '-'}) expédié de ${fromStoreId === 'falaise' ? 'La Falaise' : 'Tougou'} (${distanceKm} km, ~${estimatedMinutes} min) vers ${toStoreId === 'falaise' ? 'La Falaise' : 'Tougou'} avec ${assignedCarrierName} (Statut: En transit)`,
    userId,
    userName,
    fromStoreId
  );

  return transferRef.key;
}

export async function updateTransferLocation(
  transferId: string, 
  location: { lat: number; lng: number; speed?: number; heading?: number }
) {
  const updates: any = {};
  updates[`transfers/${transferId}/live_location`] = {
    ...location,
    updated_at: new Date().toISOString()
  };
  await update(ref(db), updates);
}

export async function confirmTransferReceipt(transferId: string, userId: string, userName: string) {
  const transferSnapshot = await get(ref(db, `transfers/${transferId}`));
  if (!transferSnapshot.exists()) throw new Error('Transfert introuvable');
  const transfer = transferSnapshot.val();

  if (transfer.status === 'received') {
    throw new Error('Ce transfert a déjà été réceptionné.');
  }

  // Trouver ou créer l'article correspondant dans la boutique de destination
  const productsSnapshot = await get(ref(db, 'products'));
  let destProductId: string | null = null;

  if (productsSnapshot.exists()) {
    const allProducts = productsSnapshot.val();
    const destStoreNorm = (transfer.to_store || 'falaise').trim().toLowerCase();
    const transNameNorm = (transfer.product_name || '').trim().toLowerCase();
    const transRefNorm = (transfer.reference || '').trim().toLowerCase();
    const transSizeNorm = (transfer.size || '').trim().toLowerCase();
    const transColorNorm = (transfer.color || '').trim().toLowerCase();

    destProductId = Object.keys(allProducts).find(k => {
      const p = allProducts[k];
      const pStoreNorm = (p.store || 'falaise').trim().toLowerCase();
      const pNameNorm = (p.name || '').trim().toLowerCase();
      const pRefNorm = (p.reference || '').trim().toLowerCase();
      const pSizeNorm = (p.size || '').trim().toLowerCase();
      const pColorNorm = (p.color || '').trim().toLowerCase();

      const sameStore = pStoreNorm === destStoreNorm;
      const sameSize = pSizeNorm === transSizeNorm;
      const sameColor = pColorNorm === transColorNorm;
      const sameRef = transRefNorm && pRefNorm ? pRefNorm === transRefNorm : true;
      const sameName = pNameNorm === transNameNorm || (transRefNorm && pRefNorm && pRefNorm === transRefNorm);

      return sameStore && sameSize && sameColor && sameRef && sameName;
    }) || null;
  }

  const updates: any = {};
  if (destProductId) {
    const destSnap = await get(ref(db, `products/${destProductId}`));
    const destProduct = destSnap.val();
    updates[`products/${destProductId}/stock`] = (destProduct.stock || 0) + transfer.quantity;
  } else {
    // Créer le produit dans le magasin destinataire
    const newProductRef = push(ref(db, 'products'));
    updates[`products/${newProductRef.key}`] = {
      name: transfer.product_name,
      category: transfer.category || 'Autre',
      price: transfer.price || 0,
      size: transfer.size || '',
      color: transfer.color || '',
      reference: transfer.reference || '',
      stock: transfer.quantity,
      store: (transfer.to_store || 'falaise').trim().toLowerCase(),
      barcode: `CAPITOL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    };
  }

  // Invalider les caches locaux
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('loreal_products_falaise');
      window.localStorage.removeItem('loreal_products_tougou');
      window.localStorage.removeItem('loreal_products_all');
    } catch (e) {}
  }

  updates[`transfers/${transferId}/status`] = 'received';
  updates[`transfers/${transferId}/received_by_id`] = userId;
  updates[`transfers/${transferId}/received_by_name`] = userName;
  updates[`transfers/${transferId}/received_at`] = new Date().toISOString();

  await update(ref(db), updates);

  await logAudit(
    'TRANSFER_RECEIVED',
    'Transfert',
    `Transfert validé et réceptionné : ${transfer.quantity}x "${transfer.product_name}" bien arrivé à ${transfer.to_store === 'falaise' ? 'La Falaise' : 'Tougou'}`,
    userId,
    userName,
    transfer.to_store
  );
}

// ====== TRACKING EN TEMPS RÉEL (Style Glovo / Yango) ======

export async function updateTransferTrackingStep(
  transferId: string, 
  step: 'preparing' | 'picked_up' | 'in_transit' | 'arriving' | 'received',
  userId: string, 
  userName: string
) {
  const transferSnapshot = await get(ref(db, `transfers/${transferId}`));
  if (!transferSnapshot.exists()) throw new Error('Transfert introuvable');
  const transfer = transferSnapshot.val();

  const now = new Date().toISOString();
  const updates: any = {};

  // Mettre à jour l'étape de tracking
  updates[`transfers/${transferId}/tracking_steps/${step}/done`] = true;
  updates[`transfers/${transferId}/tracking_steps/${step}/time`] = now;

  // Marquer aussi toutes les étapes précédentes comme faites
  const allSteps = ['preparing', 'picked_up', 'in_transit', 'arriving', 'received'];
  const stepIndex = allSteps.indexOf(step);
  for (let i = 0; i < stepIndex; i++) {
    updates[`transfers/${transferId}/tracking_steps/${allSteps[i]}/done`] = true;
    if (!transfer.tracking_steps?.[allSteps[i]]?.time) {
      updates[`transfers/${transferId}/tracking_steps/${allSteps[i]}/time`] = now;
    }
  }

  // Si 'arriving', mettre à jour l'ETA à 2 minutes
  if (step === 'arriving') {
    const eta2min = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    updates[`transfers/${transferId}/estimated_arrival`] = eta2min;
    updates[`transfers/${transferId}/estimated_minutes`] = 2;
  }

  // Si 'received', ne pas modifier les stocks ici - c'est fait par confirmTransferReceipt
  if (step === 'received') {
    updates[`transfers/${transferId}/status`] = 'received';
  } else if (step === 'in_transit') {
    updates[`transfers/${transferId}/status`] = 'in_transit';
  }

  updates[`transfers/${transferId}/last_update`] = now;
  updates[`transfers/${transferId}/last_update_by`] = userName;

  await update(ref(db), updates);

  const fromName = transfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
  const toName = transfer.to_store === 'falaise' ? 'La Falaise' : 'Tougou';
  const stepLabels: Record<string, string> = {
    preparing: 'Colis en préparation',
    picked_up: 'Récupéré par le livreur',
    in_transit: 'En route',
    arriving: 'Arrivée imminente',
    received: 'Livré et validé'
  };

  await logAudit(
    'TRANSFER_TRACKING_UPDATE',
    'Transfert',
    `Suivi livraison : ${stepLabels[step]} — ${transfer.quantity}x "${transfer.product_name}" (${fromName} → ${toName})`,
    userId,
    userName,
    transfer.to_store
  );
}

export async function getTransfers(storeId?: string): Promise<any[]> {
  try {
    const transfersRef = ref(db, 'transfers');
    const snapshot = await get(transfersRef);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));
    if (storeId && storeId !== 'all') {
      return list.filter(t => t.from_store === storeId || t.to_store === storeId)
                 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (e) {
    console.error('Erreur getTransfers:', e);
    return [];
  }
}

// ====== GESTION DES DEMANDES DE TRANSFERTS INTER-MAGASINS AVEC SONNERIE ======

export async function requestTransferStock({
  productId,
  productName,
  reference = '',
  size = '',
  color = '',
  category = '',
  barcode = '',
  availableStock = 0,
  price = 0,
  quantity,
  fromStoreId, // Magasin qui possède le stock (ex: 'tougou')
  toStoreId,   // Magasin demandeur (ex: 'falaise')
  requesterId,
  requesterName,
  note = '',
  items = []
}: {
  productId: string;
  productName: string;
  reference?: string;
  size?: string;
  color?: string;
  category?: string;
  barcode?: string;
  availableStock?: number;
  price?: number;
  quantity: number;
  fromStoreId: string;
  toStoreId: string;
  requesterId: string;
  requesterName: string;
  note?: string;
  items?: any[];
}) {
  if (quantity <= 0) throw new Error('Quantité demandée invalide');

  const transferRef = push(ref(db, 'transfers'));
  const now = new Date().toISOString();
  const fromStoreName = fromStoreId === 'falaise' ? 'La Falaise' : 'Tougou';
  const toStoreName = toStoreId === 'falaise' ? 'La Falaise' : 'Tougou';

  const transferData: any = {
    product_id: productId,
    product_name: productName,
    reference: reference || '',
    size: size || '',
    color: color || '',
    category: category || '',
    barcode: barcode || '',
    available_stock: availableStock || 0,
    price: price || 0,
    quantity,
    items: items && items.length > 0 ? items : [{
      product_id: productId,
      name: productName,
      reference: reference || '',
      size: size || '',
      color: color || '',
      category: category || '',
      barcode: barcode || '',
      stock: availableStock || 0,
      price: price || 0,
      quantity
    }],
    from_store: fromStoreId,
    to_store: toStoreId,
    status: 'requested',
    requested_by_id: requesterId,
    requested_by_name: requesterName,
    sender_name: requesterName,
    requester_name: requesterName,
    note: note || '',
    date: now,
    requested_at: now,
    request_ringing: true,
    last_update: now,
    last_update_by: requesterName
  };

  const updates: any = {};
  updates[`transfers/${transferRef.key}`] = transferData;
  await update(ref(db), updates);

  await logAudit(
    'TRANSFER_REQUESTED',
    'Transfert',
    `Demande de transfert urgente : ${quantity}x "${productName}" (Taille: ${size || '-'}, Réf: ${reference || '-'}) demandée par ${requesterName} de ${fromStoreName} vers ${toStoreName}`,
    requesterId,
    requesterName,
    toStoreId
  );

  return transferRef.key;
}

export async function acceptTransferRequest(
  transferId: string,
  userId: string,
  userName: string,
  carrierName: string = 'Livreur Express',
  carrierId: string = '',
  customMinutes: number = 15
) {
  const transferSnapshot = await get(ref(db, `transfers/${transferId}`));
  if (!transferSnapshot.exists()) throw new Error('Demande de transfert introuvable');
  const transfer = transferSnapshot.val();

  if (transfer.status !== 'requested') {
    throw new Error('Cette demande a déjà été validée ou annulée.');
  }

  const updates: any = {};
  const items = transfer.items && Array.isArray(transfer.items) && transfer.items.length > 0
    ? transfer.items
    : [{ product_id: transfer.product_id, quantity: transfer.quantity, name: transfer.product_name }];

  // 1. Décrémenter le stock dans le magasin d'origine
  for (const it of items) {
    const prodSnap = await get(ref(db, `products/${it.product_id}`));
    if (prodSnap.exists()) {
      const prod = prodSnap.val();
      const currentStock = Number(prod.stock) || 0;
      if (currentStock < it.quantity) {
        throw new Error(`Stock insuffisant pour "${it.name}". Disponible : ${currentStock}`);
      }
      updates[`products/${it.product_id}/stock`] = currentStock - it.quantity;
    }
  }

  const storeLocations = await getStoreLocations();
  const fromLoc = storeLocations[transfer.from_store] || DEFAULT_STORE_LOCATIONS[transfer.from_store] || DEFAULT_STORE_LOCATIONS.tougou;
  const toLoc = storeLocations[transfer.to_store] || DEFAULT_STORE_LOCATIONS[transfer.to_store] || DEFAULT_STORE_LOCATIONS.falaise;

  const distanceKm = calculateDistanceKm(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
  const autoMinutes = calculateTravelMinutes(distanceKm);
  const estimatedMinutes = customMinutes > 0 ? customMinutes : autoMinutes;

  const now = new Date().toISOString();
  const startTime = Date.now();
  const eta = new Date(startTime + estimatedMinutes * 60 * 1000).toISOString();
  const assignedCarrierName = carrierName || 'Livreur Express';

  updates[`transfers/${transferId}/status`] = 'in_transit';
  updates[`transfers/${transferId}/start_time`] = startTime;
  updates[`transfers/${transferId}/date`] = now;
  updates[`transfers/${transferId}/accepted_at`] = now;
  updates[`transfers/${transferId}/accepted_by_id`] = userId;
  updates[`transfers/${transferId}/accepted_by_name`] = userName;
  updates[`transfers/${transferId}/carrier_name`] = assignedCarrierName;
  updates[`transfers/${transferId}/carrier_id`] = carrierId || userId;
  updates[`transfers/${transferId}/driver_name`] = assignedCarrierName;
  updates[`transfers/${transferId}/distance_km`] = distanceKm;
  updates[`transfers/${transferId}/estimated_minutes`] = estimatedMinutes;
  updates[`transfers/${transferId}/estimated_arrival`] = eta;
  updates[`transfers/${transferId}/origin_coords`] = { lat: fromLoc.lat, lng: fromLoc.lng };
  updates[`transfers/${transferId}/dest_coords`] = { lat: toLoc.lat, lng: toLoc.lng };
  updates[`transfers/${transferId}/request_ringing`] = false;
  updates[`transfers/${transferId}/last_update`] = now;
  updates[`transfers/${transferId}/last_update_by`] = userName;
  updates[`transfers/${transferId}/tracking_steps`] = {
    preparing: { done: true, time: now, label: 'Colis préparé' },
    picked_up: { done: true, time: now, label: `Récupéré par ${assignedCarrierName}` },
    in_transit: { done: true, time: now, label: 'En route' },
    arriving: { done: false, time: null, label: 'Arrivée imminente' },
    received: { done: false, time: null, label: 'Livré & validé' },
  };

  await update(ref(db), updates);

  const fromName = transfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
  const toName = transfer.to_store === 'falaise' ? 'La Falaise' : 'Tougou';

  await logAudit(
    'TRANSFER_ACCEPTED',
    'Transfert',
    `Demande de transfert validée et expédiée : ${transfer.quantity}x "${transfer.product_name}" remis à ${assignedCarrierName} de ${fromName} vers ${toName} (~${estimatedMinutes} min)`,
    userId,
    userName,
    transfer.from_store
  );
}

export async function rejectTransferRequest(
  transferId: string,
  userId: string,
  userName: string,
  reason: string = 'Stock indisponible'
) {
  const now = new Date().toISOString();
  const updates: any = {};
  updates[`transfers/${transferId}/status`] = 'rejected';
  updates[`transfers/${transferId}/rejected_at`] = now;
  updates[`transfers/${transferId}/rejected_by_id`] = userId;
  updates[`transfers/${transferId}/rejected_by_name`] = userName;
  updates[`transfers/${transferId}/rejected_reason`] = reason;
  updates[`transfers/${transferId}/request_ringing`] = false;
  updates[`transfers/${transferId}/last_update`] = now;
  updates[`transfers/${transferId}/last_update_by`] = userName;

  await update(ref(db), updates);

  await logAudit(
    'TRANSFER_REJECTED',
    'Transfert',
    `Demande de transfert refusée par ${userName}. Motif : ${reason}`,
    userId,
    userName
  );
}

export async function silenceTransferRinging(transferId: string) {
  await update(ref(db), {
    [`transfers/${transferId}/request_ringing`]: false
  });
}

// ====== ANNULATION DE TRANSFERT & RETOUR DE STOCK ======

export async function cancelTransfer(
  transferId: string,
  userId: string,
  userName: string,
  reason: string = 'Transfert annulé'
) {
  const transferSnapshot = await get(ref(db, `transfers/${transferId}`));
  if (!transferSnapshot.exists()) throw new Error('Transfert introuvable');
  const transfer = transferSnapshot.val();

  if (transfer.status === 'cancelled') {
    throw new Error('Ce transfert est déjà annulé.');
  }

  const updates: any = {};
  const fromStore = transfer.from_store || 'falaise';
  const toStore = transfer.to_store || 'tougou';

  // Si le transfert était en transit (les articles avaient quitté le magasin d'origine)
  // On restitue immédiatement le stock dans le magasin d'origine (from_store)
  if (transfer.status === 'in_transit') {
    const items = transfer.items && Array.isArray(transfer.items) && transfer.items.length > 0
      ? transfer.items
      : [{ product_id: transfer.product_id, quantity: transfer.quantity, name: transfer.product_name, size: transfer.size, color: transfer.color }];

    for (const it of items) {
      if (it.product_id) {
        const prodSnap = await get(ref(db, `products/${it.product_id}`));
        if (prodSnap.exists()) {
          const curStock = Number(prodSnap.val().stock) || 0;
          updates[`products/${it.product_id}/stock`] = curStock + (it.quantity || 1);
        } else {
          // Si le produit n'a pas été trouvé par ID, on le cherche par nom / taille dans fromStore
          const allProdsSnap = await get(ref(db, 'products'));
          if (allProdsSnap.exists()) {
            const allP = allProdsSnap.val();
            const foundKey = Object.keys(allP).find(k => {
              const p = allP[k];
              return (p.store || '').toLowerCase() === fromStore.toLowerCase() && 
                     p.name === it.name && 
                     (p.size || '') === (it.size || '');
            });
            if (foundKey) {
              const curStock = Number(allP[foundKey].stock) || 0;
              updates[`products/${foundKey}/stock`] = curStock + (it.quantity || 1);
            }
          }
        }
      }
    }
  }

  const now = new Date().toISOString();
  updates[`transfers/${transferId}/status`] = 'cancelled';
  updates[`transfers/${transferId}/cancelled_at`] = now;
  updates[`transfers/${transferId}/cancelled_by_id`] = userId;
  updates[`transfers/${transferId}/cancelled_by_name`] = userName;
  updates[`transfers/${transferId}/cancel_reason`] = reason;
  updates[`transfers/${transferId}/request_ringing`] = false;
  updates[`transfers/${transferId}/last_update`] = now;
  updates[`transfers/${transferId}/last_update_by`] = userName;

  await update(ref(db), updates);

  const fromName = fromStore === 'falaise' ? 'La Falaise' : 'Tougou';
  const toName = toStore === 'falaise' ? 'La Falaise' : 'Tougou';

  await logAudit(
    'TRANSFER_CANCELLED',
    'Transfert',
    `Transfert annulé par ${userName} (${fromName} ➔ ${toName}) : ${transfer.quantity}x "${transfer.product_name}" retourné(s) au stock de ${fromName}. Motif : ${reason}`,
    userId,
    userName,
    fromStore
  );
}

// ====== ARTICLE NON VENDU (RETOUR AU MAGASIN QUI A TRANSFÉRÉ) ======

export async function returnUnsoldTransfer(
  transferId: string,
  userId: string,
  userName: string,
  reason: string = 'Client non acheteur / Article non vendu'
) {
  const transferSnapshot = await get(ref(db, `transfers/${transferId}`));
  if (!transferSnapshot.exists()) throw new Error('Transfert introuvable');
  const transfer = transferSnapshot.val();

  if (transfer.status === 'returned_unsold') {
    throw new Error('Cet article a déjà été retourné au magasin d\'origine.');
  }

  const updates: any = {};
  const fromStore = transfer.from_store || 'falaise';
  const toStore = transfer.to_store || 'tougou';
  const items = transfer.items && Array.isArray(transfer.items) && transfer.items.length > 0
    ? transfer.items
    : [{ product_id: transfer.product_id, quantity: transfer.quantity, name: transfer.product_name, size: transfer.size, color: transfer.color }];

  // 1. Si le transfert avait déjà été réceptionné dans la boutique destinataire (to_store),
  // on retire le stock de la boutique destinataire
  if (transfer.status === 'received') {
    const allProdsSnap = await get(ref(db, 'products'));
    if (allProdsSnap.exists()) {
      const allP = allProdsSnap.val();
      for (const it of items) {
        const destKey = Object.keys(allP).find(k => {
          const p = allP[k];
          return (p.store || '').toLowerCase() === toStore.toLowerCase() && 
                 p.name === it.name && 
                 (p.size || '') === (it.size || '') && 
                 (p.color || '') === (it.color || '');
        });
        if (destKey) {
          const curDestStock = Number(allP[destKey].stock) || 0;
          updates[`products/${destKey}/stock`] = Math.max(0, curDestStock - (it.quantity || 1));
        }
      }
    }
  }

  // 2. On réintègre immédiatement le stock dans le magasin d'origine (from_store)
  for (const it of items) {
    if (it.product_id) {
      const prodSnap = await get(ref(db, `products/${it.product_id}`));
      if (prodSnap.exists() && (prodSnap.val().store || '').toLowerCase() === fromStore.toLowerCase()) {
        const curStock = Number(prodSnap.val().stock) || 0;
        updates[`products/${it.product_id}/stock`] = curStock + (it.quantity || 1);
      } else {
        const allProdsSnap = await get(ref(db, 'products'));
        if (allProdsSnap.exists()) {
          const allP = allProdsSnap.val();
          const originKey = Object.keys(allP).find(k => {
            const p = allP[k];
            return (p.store || '').toLowerCase() === fromStore.toLowerCase() && 
                   p.name === it.name && 
                   (p.size || '') === (it.size || '');
          });
          if (originKey) {
            const curStock = Number(allP[originKey].stock) || 0;
            updates[`products/${originKey}/stock`] = curStock + (it.quantity || 1);
          }
        }
      }
    }
  }

  const now = new Date().toISOString();
  updates[`transfers/${transferId}/status`] = 'returned_unsold';
  updates[`transfers/${transferId}/returned_at`] = now;
  updates[`transfers/${transferId}/returned_by_id`] = userId;
  updates[`transfers/${transferId}/returned_by_name`] = userName;
  updates[`transfers/${transferId}/return_reason`] = reason;
  updates[`transfers/${transferId}/request_ringing`] = false;
  updates[`transfers/${transferId}/last_update`] = now;
  updates[`transfers/${transferId}/last_update_by`] = userName;

  await update(ref(db), updates);

  const fromName = fromStore === 'falaise' ? 'La Falaise' : 'Tougou';
  const toName = toStore === 'falaise' ? 'La Falaise' : 'Tougou';

  await logAudit(
    'TRANSFER_RETURNED_UNSOLD',
    'Transfert',
    `Article non vendu à ${toName} : ${transfer.quantity}x "${transfer.product_name}" retourné(s) au stock de ${fromName} (${userName}). Motif : ${reason}`,
    userId,
    userName,
    fromStore
  );
}

export async function searchOtherStoreProducts(targetStoreId: string, query: string = ''): Promise<any[]> {
  try {
    const productsRef = ref(db, 'products');
    const snapshot = await get(productsRef);
    if (!snapshot.exists()) return [];
    const all = snapshot.val();
    const list = Object.keys(all).map(k => ({ id: k, ...all[k] }));

    const target = (targetStoreId || 'falaise').trim().toLowerCase();
    const storeProducts = list.filter(p => (p.store || 'falaise').trim().toLowerCase() === target && (Number(p.stock) > 0));

    // Trier par nom, référence et taille
    storeProducts.sort((a, b) => {
      const nameComp = (a.name || '').localeCompare(b.name || '');
      if (nameComp !== 0) return nameComp;
      const refComp = (a.reference || '').localeCompare(b.reference || '');
      if (refComp !== 0) return refComp;
      const sizeA = parseFloat(a.size) || a.size || '';
      const sizeB = parseFloat(b.size) || b.size || '';
      if (typeof sizeA === 'number' && typeof sizeB === 'number') {
        if (sizeA !== sizeB) return sizeA - sizeB;
      }
      return (a.color || '').localeCompare(b.color || '');
    });

    if (!query.trim()) return storeProducts;

    const terms = query.toLowerCase().trim().split(/\s+/);
    return storeProducts.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pRef = (p.reference || '').toLowerCase();
      const pSize = (p.size || '').toLowerCase();
      const pColor = (p.color || '').toLowerCase();
      const pCat = (p.category || '').toLowerCase();

      return terms.every(t =>
        pName.includes(t) ||
        pRef.includes(t) ||
        pSize.includes(t) ||
        pColor.includes(t) ||
        pCat.includes(t)
      );
    });
  } catch (e) {
    console.error('Erreur searchOtherStoreProducts:', e);
    return [];
  }
}


export async function applyPhysicalInventory(
  storeId: string, 
  adjustments: { productId: string; productName: string; theoreticalStock: number; countedStock: number; difference: number; price: number }[], 
  userId: string, 
  userName: string, 
  note: string = ''
) {
  const updates: any = {};
  const changedItems = adjustments.filter(a => a.difference !== 0);

  for (const adj of changedItems) {
    updates[`products/${adj.productId}/stock`] = adj.countedStock;
  }

  const inventoryRecordRef = push(ref(db, 'inventories'));
  updates[`inventories/${inventoryRecordRef.key}`] = {
    date: new Date().toISOString(),
    store: storeId,
    user_id: userId,
    user_name: userName,
    total_items_checked: adjustments.length,
    adjustments_count: changedItems.length,
    adjustments: changedItems,
    note
  };

  await update(ref(db), updates);

  const totalDiffQty = changedItems.reduce((sum, a) => sum + Math.abs(a.difference), 0);
  const totalFinancialLoss = changedItems.reduce((sum, a) => a.difference < 0 ? sum + Math.abs(a.difference) * a.price : sum, 0);

  await logAudit(
    'INVENTORY_APPLIED',
    'Inventaire',
    `Inventaire physique validé (${storeId === 'falaise' ? 'La Falaise' : 'Tougou'}) : ${adjustments.length} articles vérifiés, ${changedItems.length} écarts (${totalDiffQty} unités). Perte financière : ${totalFinancialLoss.toLocaleString()} FCFA.`,
    userId,
    userName,
    storeId,
    note
  );
}

export async function getProductByBarcode(barcode: string, storeId: string = 'falaise'): Promise<any | null> {
  const productsRef = ref(db, 'products');
  const snapshot = await get(productsRef);
  if (!snapshot.exists()) return null;
  const data = snapshot.val();

  // 1. Chercher par champ barcode dans le magasin spécifié
  let productKey = Object.keys(data).find(key => data[key].barcode === barcode && data[key].store === storeId);
  
  // 2. Si pas trouvé, chercher par ID Firebase (pour les anciens produits dont le QR encode l'id)
  if (!productKey && data[barcode] && data[barcode].store === storeId) {
    productKey = barcode;
  }

  // 3. Si toujours pas trouvé, chercher le barcode dans TOUS les magasins (au cas où)
  if (!productKey) {
    productKey = Object.keys(data).find(key => data[key].barcode === barcode);
  }

  // 4. Dernière tentative: chercher par ID Firebase sans filtre magasin
  if (!productKey && data[barcode]) {
    productKey = barcode;
  }

  if (productKey) {
    return { id: productKey, ...data[productKey] };
  }
  return null;
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
