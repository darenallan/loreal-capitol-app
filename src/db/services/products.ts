import { db } from '../firebaseConfig';
import { ref, get, set, push, update } from 'firebase/database';
import { logAudit } from './audit';
import { getFastCache, saveFastCache, getLocalCache, setLocalCache } from './cache';
import { RTDB_REST_URL } from './config';

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
