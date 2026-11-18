import { db } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';
import { logAudit } from './audit';
import { DEFAULT_STORE_LOCATIONS, getStoreLocations, calculateDistanceKm, calculateTravelMinutes } from './stores';

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
