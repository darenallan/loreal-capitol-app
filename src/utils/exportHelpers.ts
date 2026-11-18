// Helper pour exporter des données au format CSV compatible Excel (avec BOM UTF-8 et séparateur point-virgule)
import { db } from '../db/firebaseConfig';
import { ref, get } from 'firebase/database';
import { getAuditLogs, getAdvanceStore } from '../db/database';
import { localDayKey, normStore, todayKey } from './saleMath';

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (cell: any) => {
    if (cell === null || cell === undefined) return '""';
    let str = String(cell).replace(/"/g, '""');
    // Anti-injection de formule Excel : un texte saisi commençant par = + - @ est neutralisé.
    if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return `"${str}"`;
  };

  // Séparateur point-virgule et BOM UTF-8 (\uFEFF) pour compatibilité native Excel français
  const csvContent = '\uFEFF' + [
    headers.map(escapeCell).join(';'),
    ...rows.map(row => row.map(escapeCell).join(';'))
  ].join('\r\n');

  if (typeof window !== 'undefined' && window.document) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
}

// Export Ventes séparées par boutique (Falaise ou Tougou ou Global)
export async function exportSalesCSV(salesList?: any[], storeId: string = 'all') {
  const targetStore = (storeId || 'all').trim().toLowerCase();
  let sales = salesList;
  if (!sales || !Array.isArray(sales) || sales.length === 0) {
    try {
      const snapshot = await get(ref(db, 'sales'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        let allSales = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        if (targetStore !== 'all') {
          allSales = allSales.filter(s => (s.store || 'falaise').trim().toLowerCase() === targetStore);
        }
        sales = allSales;
      } else {
        sales = [];
      }
    } catch (e) {
      console.error('Erreur chargement ventes pour export:', e);
      sales = [];
    }
  } else if (targetStore !== 'all') {
    sales = sales.filter(s => (s.store || 'falaise').trim().toLowerCase() === targetStore);
  }

  // Trier par date décroissante
  sales.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const dateStr = todayKey(); // jour local (nom de fichier)
  const storeLabel = targetStore === 'falaise' ? 'LA_FALAISE' : targetStore === 'tougou' ? 'TOUGOU' : 'GLOBAL';
  const headers = [
    'ID Vente',
    'Date & Heure',
    'Magasin',
    'Vendeur',
    'Bénéficiaire',
    'Articles',
    'Référence(s)',
    'Taille(s)',
    'Couleur(s)',
    'Total (FCFA)',
    'Mode de Paiement',
    'Est une Avance'
  ];

  const rows = sales.map(s => {
    const items = Array.isArray(s.items) ? s.items : [];
    const itemsDesc = items.length > 0 
      ? items.map((i: any) => `${i.name || 'Article'}${i.reference ? ' [Réf:' + i.reference + ']' : ''}${i.size ? ' (T:' + i.size + ')' : ''}${i.color ? ' (' + i.color + ')' : ''} x${i.quantity || 1}`).join(' | ') 
      : (s.items || '');
    const refs = items.map((i: any) => i.reference).filter(Boolean).join(', ');
    const sizes = items.map((i: any) => i.size).filter(Boolean).join(', ');
    const colors = items.map((i: any) => i.color).filter(Boolean).join(', ');
    const sStore = (s.store || 'falaise').trim().toLowerCase();

    return [
      s.id,
      s.date ? new Date(s.date).toLocaleString('fr-FR') : '',
      sStore === 'tougou' ? 'Tougou' : 'La Falaise',
      s.seller_name || '',
      s.beneficiary || '',
      itemsDesc,
      refs,
      sizes,
      colors,
      s.total || 0,
      s.payment_method || '',
      s.is_advance ? 'Oui' : 'Non'
    ];
  });

  downloadCSV(`LOREAL_VENTES_${storeLabel}_${dateStr}.csv`, headers, rows);
  return rows.length;
}

// Export Stocks séparés par boutique
export async function exportProductsCSV(productsList?: any[], storeId: string = 'all') {
  const targetStore = (storeId || 'all').trim().toLowerCase();
  let products = productsList;
  if (!products || !Array.isArray(products) || products.length === 0) {
    try {
      const snapshot = await get(ref(db, 'products'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        let allProducts = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        if (targetStore !== 'all') {
          allProducts = allProducts.filter(p => (p.store || 'falaise').trim().toLowerCase() === targetStore);
        }
        products = allProducts;
      } else {
        products = [];
      }
    } catch (e) {
      console.error('Erreur chargement stock pour export:', e);
      products = [];
    }
  } else if (targetStore !== 'all') {
    products = products.filter(p => (p.store || 'falaise').trim().toLowerCase() === targetStore);
  }

  // Trier méthodiquement par Nom, puis Référence, puis Taille, puis Couleur
  products.sort((a, b) => {
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

  const dateStr = todayKey(); // jour local (nom de fichier)
  const storeLabel = targetStore === 'falaise' ? 'LA_FALAISE' : targetStore === 'tougou' ? 'TOUGOU' : 'TOUS_MAGASINS';
  const headers = [
    'ID Produit',
    'Code-barres',
    'Nom Article',
    'Catégorie',
    'Taille',
    'Couleur',
    'Référence',
    'Prix Unitaire (FCFA)',
    'Stock Actuel',
    'Magasin'
  ];

  const rows = products.map(p => {
    const pStore = (p.store || 'falaise').trim().toLowerCase();
    const cleanStock = Math.max(0, parseInt(p.stock, 10) || 0);

    return [
      p.id,
      p.barcode || '',
      p.name || '',
      p.category || '',
      p.size || '',
      p.color || '',
      p.reference || '',
      Number(p.price) || 0,
      cleanStock,
      pStore === 'tougou' ? 'Tougou' : 'La Falaise'
    ];
  });

  downloadCSV(`LOREAL_STOCK_${storeLabel}_${dateStr}.csv`, headers, rows);
  return rows.length;
}

export async function exportAdvancesCSV(advancesList?: any[], storeId: string = 'all') {
  let advances = advancesList;
  if (!advances || !Array.isArray(advances) || advances.length === 0) {
    try {
      const snapshot = await get(ref(db, 'advances'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        let allAdvances = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        if (storeId && storeId !== 'all') {
          allAdvances = allAdvances.filter(a => getAdvanceStore(a) === storeId.toLowerCase());
        }
        advances = allAdvances;
      } else {
        advances = [];
      }
    } catch (e) {
      console.error('Erreur chargement avances pour export:', e);
      advances = [];
    }
  } else if (storeId && storeId !== 'all') {
    advances = advances.filter(a => getAdvanceStore(a) === storeId.toLowerCase());
  }

  const dateStr = todayKey(); // jour local (nom de fichier)
  const storeLabel = storeId === 'falaise' ? 'LA_FALAISE' : storeId === 'tougou' ? 'TOUGOU' : 'TOUS';
  const headers = [
    'ID Avance',
    'Nom Client',
    'Téléphone Client',
    'Magasin',
    'Article(s)',
    'Référence',
    'Taille',
    'Couleur',
    'Montant Déjà Payé (FCFA)',
    'Reste à Payer (FCFA)',
    'Total Achat (FCFA)',
    'Date Limite / Échéance',
    'Statut',
    'Détail des Versements'
  ];

  const rows = advances.map(a => {
    const totalAchat = (a.amount_paid || 0) + (a.amount_remaining || 0);
    const paymentsStr = Array.isArray(a.payments)
      ? a.payments.map((p: any) => `${new Date(p.date).toLocaleDateString('fr-FR')}: ${p.amount}F (${p.method})`).join(' | ')
      : '';

    const refVal = a.reference || (Array.isArray(a.items) ? a.items.map((i: any) => i.reference).filter(Boolean).join(', ') : '');
    const sizeVal = a.size || (Array.isArray(a.items) ? a.items.map((i: any) => i.size).filter(Boolean).join(', ') : '');
    const colorVal = a.color || (Array.isArray(a.items) ? a.items.map((i: any) => i.color).filter(Boolean).join(', ') : '');

    const advStore = getAdvanceStore(a);
    return [
      a.id,
      a.client_name || a.clientName || '',
      a.client_phone || a.clientPhone || a.phone || '',
      advStore === 'tougou' ? 'Tougou' : 'La Falaise',
      a.product_name || a.productName || '',
      refVal,
      sizeVal,
      colorVal,
      a.amount_paid || a.amountPaid || 0,
      a.amount_remaining || a.amountRemaining || 0,
      totalAchat,
      a.due_date || a.dueDate || '',
      a.status === 'completed' ? 'Soldée' : 'En cours',
      paymentsStr
    ];
  });

  downloadCSV(`LOREAL_AVANCES_${storeLabel}_${dateStr}.csv`, headers, rows);
  return rows.length;
}

export async function exportTransfersCSV(transfersList?: any[]) {
  let transfers = transfersList;
  if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
    try {
      const snapshot = await get(ref(db, 'transfers'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        transfers = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      } else {
        transfers = [];
      }
    } catch (e) {
      console.error('Erreur chargement transferts pour export:', e);
      transfers = [];
    }
  }

  const dateStr = todayKey(); // jour local (nom de fichier)
  const headers = [
    'ID Transfert',
    'Date Initié',
    'Article',
    'Taille',
    'Couleur',
    'Quantité',
    'Magasin Source',
    'Magasin Destination',
    'Initié Par',
    'Statut',
    'Réceptionné Par',
    'Date Réception'
  ];

  const rows = transfers.map(t => [
    t.id,
    t.date ? new Date(t.date).toLocaleString('fr-FR') : '',
    t.product_name || '',
    t.size || '',
    t.color || '',
    t.quantity || 0,
    t.from_store === 'falaise' ? 'La Falaise' : 'Tougou',
    t.to_store === 'falaise' ? 'La Falaise' : 'Tougou',
    t.user_name || '',
    t.status === 'received' ? 'Réceptionné' : 'En transit (En cours)',
    t.received_by_name || '-',
    t.received_at ? new Date(t.received_at).toLocaleString('fr-FR') : '-'
  ]);

  downloadCSV(`LOREAL_TRANSFERTS_${dateStr}.csv`, headers, rows);
  return rows.length;
}

export async function exportAuditLogsCSV(logsList?: any[]) {
  let logs = logsList;
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    try {
      logs = await getAuditLogs();
    } catch (e) {
      console.error('Erreur chargement logs audit pour export:', e);
      logs = [];
    }
  }

  const dateStr = todayKey(); // jour local (nom de fichier)
  const headers = [
    'Date & Heure',
    'Utilisateur',
    'Action',
    'Entité',
    'Magasin',
    'Détails',
    'Motif / Justification'
  ];

  const rows = logs.map(l => [
    l.timestamp ? new Date(l.timestamp).toLocaleString('fr-FR') : '',
    l.userName || l.user_name || 'Inconnu',
    l.action || '',
    l.entity || '',
    l.store === 'falaise' ? 'La Falaise' : l.store === 'tougou' ? 'Tougou' : l.store || 'Tous',
    typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || ''),
    l.reason || ''
  ]);

  downloadCSV(`LOREAL_AUDIT_LOGS_${dateStr}.csv`, headers, rows);
  return rows.length;
}

// Export Historique (écran « Historique & Saisie antérieure ») : uniquement la liste fournie
export function exportHistoryCSV(sales: any[], periodLabel: string, storeId: string = 'all') {
  const list = Array.isArray(sales) ? [...sales] : [];
  if (list.length === 0) return 0;
  list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const target = (storeId || 'all').trim().toLowerCase();
  const storeLabel = target === 'falaise' ? 'LA_FALAISE' : target === 'tougou' ? 'TOUGOU' : 'GLOBAL';
  const safePeriod = String(periodLabel || '').replace(/[^0-9A-Za-z_-]+/g, '_') || todayKey();
  const fmtDate = (iso: any) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('fr-FR');
  };

  const headers = ['ID', 'Date', 'Magasin', 'Vendeur', 'Client', 'Articles', 'Total effectif (FCFA)', 'Paiement', 'Saisie antérieure', 'Note', 'Saisi le'];
  const rows = list.map(s => {
    const items = Array.isArray(s.items) ? s.items : [];
    const articles = s.itemsLabel
      || items.map((i: any) => `${i?.name || 'Article'} x${i?.quantity || 1}`).join(' | ');
    const store = normStore(s.store);
    return [
      s.id,
      s.backdated ? String(s.day || localDayKey(s.date)) : fmtDate(s.date),
      store === 'tougou' ? 'Tougou' : 'La Falaise',
      s.seller_name || '',
      s.client_name || '',
      articles,
      Math.round(Number(s.total) || 0),
      s.payment_method || '',
      s.backdated ? 'Oui' : 'Non',
      s.note || '',
      s.entered_at ? fmtDate(s.entered_at) : '',
    ];
  });

  downloadCSV(`LOREAL_HISTORIQUE_${storeLabel}_${safePeriod}.csv`, headers, rows);
  return rows.length;
}
