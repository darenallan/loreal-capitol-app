import { db } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';
import { logAudit } from './audit';

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
