import { Linking, Platform } from 'react-native';
import jsPDF from 'jspdf';
import { LOREAL_LOGO_BASE64 } from '../assets/logoBase64';

export type ReceiptChannel = 'whatsapp' | 'email' | 'none';

const SHOP_CONTACT = '(+237) 699 93 20 24 / 670 37 18 20 / 679 74 70 11';

/** Normalise un numéro WhatsApp (Cameroun par défaut : 9 chiffres -> 237XXXXXXXXX). */
export function cleanWhatsAppNumber(phoneStr?: string | null): string {
  if (!phoneStr) return '';
  let digits = String(phoneStr).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.substring(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.substring(1);
  if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('2'))) {
    return `237${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('237')) {
    return digits;
  }
  if (digits.length > 9 && digits.startsWith('237')) {
    return digits;
  }
  return digits;
}

export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

const money = (val: any): string => {
  const n = Math.round(Number(val) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

function storeLabel(sale: any, storeName?: string): string {
  if (storeName) return String(storeName).replace(/^boutique\s+/i, '').trim() || 'La Falaise';
  if (sale?.store === 'tougou') return 'Tougou';
  if (sale?.store === 'falaise') return 'La Falaise';
  return 'La Falaise';
}

function computeSale(sale: any) {
  const adv = sale?.advanceData || {};
  const isAdvance = sale?.is_advance === 1 || !!sale?.advanceData || !!sale?.advance_id;
  const totalArticles = Number(
    adv.totalArticles || sale?.article_total ||
    (isAdvance ? (Number(adv.amountPaid || 0) + Number(adv.amountRemaining || 0)) : sale?.total) || 0
  );
  const amountPaid = Number(adv.amountPaid !== undefined ? adv.amountPaid : (sale?.amount_paid ?? sale?.total ?? 0));
  const amountRemaining = Number(
    adv.amountRemaining !== undefined ? adv.amountRemaining : (sale?.amount_remaining ?? Math.max(0, totalArticles - amountPaid))
  );
  const dueDate = adv.dueDate || sale?.due_date || sale?.dueDate || '';
  const ticketNum = sale?.id ? String(sale.id).slice(-6).toUpperCase() : '';
  const dateStr = new Date(sale?.date || Date.now()).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const items: any[] = Array.isArray(sale?.items) && sale.items.length > 0 
    ? sale.items 
    : (Array.isArray(sale?.rawItems) && sale.rawItems.length > 0 ? sale.rawItems : []);
  return { isAdvance, totalArticles, amountPaid, amountRemaining, dueDate, ticketNum, dateStr, items };
}

function itemLines(items: any[], fallback: any): string[] {
  if (items.length === 0) return typeof fallback === 'string' && fallback ? [`• ${fallback}`] : [];
  return items.map((i: any) => {
    const qty = Number(i.quantity) || 1;
    const unitPrice = Number(i.price) || 0;
    const lineTotal = unitPrice * qty;
    const specs: string[] = [];
    if (i.size) specs.push(`Taille: ${i.size}`);
    if (i.color) specs.push(`Couleur: ${i.color}`);
    if (i.reference) specs.push(`Réf: ${i.reference}`);
    const specsStr = specs.length > 0 ? ` (${specs.join(', ')})` : '';
    return `• *${i.name || 'Article'}*${specsStr}\n   Qté: ${qty} × ${money(unitPrice)} FCFA = *${money(lineTotal)} FCFA*`;
  });
}

/** Génère l'URL publique officielle du reçu accessible par le client depuis WhatsApp. */
export function buildReceiptWebUrl(sale: any, clientName?: string, storeName?: string): string {
  const c = computeSale(sale);
  const ticketId = c.ticketNum || (sale?.id ? String(sale.id).slice(-6).toUpperCase() : 'OFFICIEL');
  const store = storeName || storeLabel(sale);
  const name = (clientName || sale?.client_name || sale?.clientName || '').trim();
  const phone = (sale?.client_phone || sale?.phone || sale?.advanceData?.clientPhone || '').trim();
  
  const payload = {
    id: ticketId,
    client: name,
    phone,
    store,
    date: c.dateStr,
    total: sale?.total || c.totalArticles,
    paid: c.amountPaid,
    remaining: c.amountRemaining,
    isAdvance: c.isAdvance,
    dueDate: c.dueDate,
    method: sale?.payment_method || 'Espèces',
    items: (c.items || []).map((it: any) => ({
      name: it.name || 'Article',
      qty: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
      size: it.size || '',
      color: it.color || '',
      ref: it.reference || ''
    }))
  };

  try {
    const jsonStr = JSON.stringify(payload);
    const b64 = typeof window !== 'undefined' && typeof window.btoa === 'function'
      ? window.btoa(unescape(encodeURIComponent(jsonStr)))
      : '';
    const safeB64 = encodeURIComponent(b64);
    return `${receiptBaseUrl()}/receipt.html?id=${ticketId}&d=${safeB64}`;
  } catch (e) {
    return `${receiptBaseUrl()}/receipt.html?id=${ticketId}`;
  }
}

/**
 * Domaine où est servi receipt.html : le site lui-même sur le web (Render, Vercel…),
 * sinon EXPO_PUBLIC_SITE_URL (appli mobile), sinon l'ancien domaine Vercel.
 */
function receiptBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol)) {
    return window.location.origin;
  }
  return (process.env.EXPO_PUBLIC_SITE_URL || 'https://loreal-capitol-app.vercel.app').replace(/\/$/, '');
}

/** 
 * Message court et personnalisé d'accompagnement du reçu PDF :
 * « Bonjour M./Mme [Nom], voici la facture de votre achat chez L'ORÉAL CAPITOL. Merci pour l'achat ! »
 * Aucun lien web ni liste détaillée d'articles dans le texte (tout est dans le PDF joint).
 */
export function buildReceiptMessage(
  sale: any, 
  clientName?: string, 
  storeName?: string
): string {
  const c = computeSale(sale);
  const rawName = (clientName || sale?.client_name || sale?.clientName || sale?.advanceData?.clientName || '').trim();
  const salutation = rawName ? `Bonjour M./Mme *${rawName}*,` : 'Bonjour,';
  const boutique = storeLabel(sale, storeName);

  if (c.isAdvance) {
    return `${salutation}\n\nVoici le reçu de votre acompte chez *L'ORÉAL CAPITOL* (${boutique}).\n\nMerci pour l'achat et pour votre fidélité !\n\n🏢 L'ORÉAL CAPITOL — La capitale du prêt-à-porter\n📞 Contacts : ${SHOP_CONTACT}`;
  }

  return `${salutation}\n\nVoici la facture de votre achat chez *L'ORÉAL CAPITOL* (${boutique}).\n\nMerci pour l'achat et pour votre fidélité !\n\n🏢 L'ORÉAL CAPITOL — La capitale du prêt-à-porter\n📞 Contacts : ${SHOP_CONTACT}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const target = cleanWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return target
    ? `https://api.whatsapp.com/send/?phone=${target}&text=${text}`
    : `https://api.whatsapp.com/send/?text=${text}`;
}

export function buildEmailUrl(email: string, sale: any, clientName?: string, storeName?: string): string {
  const c = computeSale(sale);
  const name = (clientName || sale?.client_name || sale?.clientName || 'Client').trim();
  const subject = `Votre reçu L'Oréal Capitol #${c.ticketNum || 'OFFICIEL'} - ${name}`;
  const body = buildReceiptMessage(sale, clientName, storeName).replace(/\*/g, '').replace(/_/g, '');
  return `mailto:${(email || '').trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Ouvre un lien externe (WhatsApp / mail) de façon synchrone dans le geste utilisateur
 * avec gestion anti-blocage popup pour navigateurs mobiles et desktop.
 */
export function openExternalUrl(url: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (url.startsWith('mailto:')) {
      window.location.href = url;
      return true;
    }

    try {
      // 1. Ouverture synchrone nouvel onglet
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (w) {
        w.focus();
        return true;
      }
    } catch (e) {
      console.warn('window.open warning:', e);
    }

    try {
      // 2. Déclenchement par élément <a> programmatique
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (e2) {
      // 3. Fallback direct si nouvel onglet impossible
      window.location.href = url;
      return true;
    }
  }
  Linking.openURL(url).catch(() => {});
  return true;
}

/** Envoie le reçu sur le canal choisi. Renvoie false si rien n'a pu être ouvert. */
export function sendReceipt(
  channel: ReceiptChannel,
  sale: any,
  contact: { name?: string; phone?: string; email?: string },
  storeName?: string
): boolean {
  if (channel === 'whatsapp' && cleanWhatsAppNumber(contact.phone)) {
    return openExternalUrl(buildWhatsAppUrl(contact.phone || '', buildReceiptMessage(sale, contact.name, storeName)));
  }
  if (channel === 'email' && isValidEmail(contact.email)) {
    return openExternalUrl(buildEmailUrl(contact.email || '', sale, contact.name, storeName));
  }
  return false;
}

/** Génère le document PDF de reçu officiel avec jsPDF */
export function buildReceiptPDF(sale: any, clientName?: string, storeName?: string): jsPDF {
  const c = computeSale(sale);
  const adv = sale?.advanceData || {};
  const isAdvance = c.isAdvance;
  const isCompleted = isAdvance && (c.amountRemaining <= 0 || sale?.status === 'completed' || adv.isCompleted);
  const isInstallment = sale?.ticketType === 'installment' || !!adv.specificPayment || !!sale?.is_advance_installment;
  const specificPayment = adv.specificPayment || null;
  const paymentsList = Array.isArray(adv.payments) ? adv.payments : (Array.isArray(sale?.payments) ? sale.payments : []);
  const storeDisplay = String(storeName || storeLabel(sale)).replace(/^boutique\s+/i, '').trim() || 'La Falaise';
  const ticketNum = c.ticketNum || 'OFFICIEL';
  const dateStr = c.dateStr;
  const items = c.items;
  const totalArticles = c.totalArticles;
  const amountPaid = c.amountPaid;
  const amountRemaining = c.amountRemaining;
  const dueDate = c.dueDate;
  const totalFormatted = `${money(sale?.total || 0)} FCFA`;
  const pdfHeaderBadge = isInstallment 
    ? "RECU DE VERSEMENT D'ACOMPTE"
    : (isCompleted ? "RECU DE SOLDE D'ACOMPTE" : "RECU D'ACOMPTE & RESERVATION");

  let itemsTotalH = 0;
  if (items.length > 0) {
    items.forEach((item: any) => {
      const nameLen = String(item.name || '').length;
      const nameLines = Math.max(1, Math.ceil(nameLen / 26));
      itemsTotalH += nameLines * 3.4 + 4.8;
    });
  } else {
    itemsTotalH = 10;
  }

  const baseHeaderH = isAdvance ? 54 : 46;
  const financeBoxH = isAdvance ? (isInstallment && specificPayment ? 32 : 27) : 15;
  const historyTotalH = (isAdvance && paymentsList.length > 0) ? (paymentsList.length * 3.6 + 10) : 0;
  const footerTotalH = isAdvance ? 48 : 44;
  const calculatedHeight = Math.ceil(baseHeaderH + itemsTotalH + financeBoxH + historyTotalH + footerTotalH + 14);
  const pdfHeight = Math.max(160, calculatedHeight);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, pdfHeight]
  });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 80, pdfHeight, 'F');

  doc.setFillColor(15, 15, 18);
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.circle(40, 9.5, 6.5, 'FD');

  doc.setDrawColor(180, 140, 30);
  doc.setLineWidth(0.2);
  doc.circle(40, 9.5, 5.8, 'D');

  try {
    doc.addImage(LOREAL_LOGO_BASE64, 'JPEG', 36, 5.5, 8, 8);
  } catch (e) {
    console.error('Erreur chargement logo PDF:', e);
  }

  let y = 19.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(20, 20, 20);
  doc.text("L'OREAL CAPITOL", 40, y, { align: 'center' });

  y += 3.6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(110, 110, 110);
  doc.text('La capitale du pret a porter.', 40, y, { align: 'center' });

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(180, 130, 20);
  doc.text(`BOUTIQUE ${storeDisplay.toUpperCase()}`, 40, y, { align: 'center' });

  if (isAdvance) {
    y += 3.5;
    doc.setFillColor(isCompleted ? 240 : 255, isCompleted ? 253 : 250, isCompleted ? 244 : 240);
    doc.setDrawColor(isCompleted ? 74 : 212, isCompleted ? 222 : 175, isCompleted ? 128 : 55);
    doc.setLineWidth(0.35);
    doc.roundedRect(6, y, 68, 5.0, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(isCompleted ? 22 : 180, isCompleted ? 101 : 120, isCompleted ? 52 : 10);
    doc.text(pdfHeaderBadge, 40, y + 3.5, { align: 'center' });
    y += 1.8;
  }

  y += 3.4;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.35);
  doc.line(6.5, y, 73.5, y);

  y += 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 30, 30);
  doc.text(`Ticket : #${ticketNum}`, 6.5, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`${dateStr}`, 73.5, y, { align: 'right' });

  y += 3.4;
  doc.text(`Vendeur : ${sale.seller_name || 'Caisse'}`, 6.5, y);
  const activeClientName = (clientName || sale.clientName || sale.client_name || adv.clientName || '').trim();
  const activeClientPhone = (sale.client_phone || sale.phone || adv.clientPhone || '').trim();

  if (activeClientName || activeClientPhone) {
    y += 3.4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Client : ${activeClientName || 'Client'}`, 6.5, y);
    if (activeClientPhone) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Tel : ${activeClientPhone}`, 73.5, y, { align: 'right' });
    }
  }

  y += 3.0;
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(6.5, y, 73.5, y);
  doc.setLineDashPattern([], 0);

  y += 4.0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(20, 20, 20);
  doc.text(isAdvance ? 'ARTICLES RESERVES' : 'ARTICLES', 6.5, y);
  doc.text('TOTAL (FCFA)', 73.5, y, { align: 'right' });
  y += 3.6;

  if (items.length > 0) {
    items.forEach((item: any) => {
      const rawName = String(item.name || 'Article');
      const nameLines = doc.splitTextToSize(rawName, 44);
      const itemTotal = `${money((item.price || 0) * (item.quantity || 1))} FCFA`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.0);
      doc.setTextColor(30, 30, 30);

      nameLines.forEach((line: string, lIdx: number) => {
        doc.text(line, 6.5, y);
        if (lIdx === 0) {
          doc.text(itemTotal, 73.5, y, { align: 'right' });
        }
        y += 3.3;
      });

      const qtyPrice = `${item.quantity || 1} x ${money(item.price || 0)} FCFA`;
      const metaParts = [
        item.reference ? `Ref: ${item.reference}` : '',
        item.size ? `T: ${item.size}` : '',
        item.color ? item.color : ''
      ].filter(Boolean);

      const detailStr = metaParts.length > 0 ? `${qtyPrice}  (${metaParts.join(' - ')})` : qtyPrice;
      const detailLines = doc.splitTextToSize(detailStr, 67);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(110, 110, 110);
      detailLines.forEach((dLine: string) => {
        doc.text(dLine, 6.5, y);
        y += 2.9;
      });

      y += 1.4;
    });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    const singleItem = String(sale.items || 'Articles');
    const itemTitle = singleItem.length > 32 ? singleItem.substring(0, 30) + '..' : singleItem;
    doc.text(itemTitle, 6.5, y);
    doc.text(`${money(totalArticles || sale.total || 0)} FCFA`, 73.5, y, { align: 'right' });
    y += 5.0;
  }

  y += 1.0;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.4);
  doc.line(6.5, y, 73.5, y);

  if (!isAdvance) {
    y += 3.2;
    doc.setFillColor(250, 248, 240);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.roundedRect(6, y, 68, 9.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(15, 15, 15);
    doc.text('TOTAL NET :', 9.5, y + 6.2);

    doc.setFontSize(9.8);
    doc.setTextColor(180, 120, 10);
    doc.text(totalFormatted, 71, y + 6.2, { align: 'right' });
    y += 13.0;
  } else {
    y += 3.0;
    const boxH = isInstallment && specificPayment ? 30 : 25;
    doc.setFillColor(255, 252, 245);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.roundedRect(6, y, 68, boxH, 1.5, 1.5, 'FD');

    let fy = y + 4.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(180, 120, 10);
    doc.text("RESUME FINANCIER DE L'ACOMPTE", 40, fy, { align: 'center' });

    fy += 4.0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(60, 60, 60);
    doc.text('Valeur des articles :', 9, fy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(`${money(totalArticles)} FCFA`, 71, fy, { align: 'right' });

    fy += 4.0;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 120, 10);
    doc.text('Total acompte verse :', 9, fy);
    doc.text(`${money(amountPaid)} FCFA`, 71, fy, { align: 'right' });

    fy += 4.0;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isCompleted ? 22 : 190, isCompleted ? 101 : 30, isCompleted ? 52 : 30);
    doc.text('Solde restant du :', 9, fy);
    doc.text(isCompleted ? '0 FCFA (SOLDE)' : `${money(amountRemaining)} FCFA`, 71, fy, { align: 'right' });

    if (isInstallment && specificPayment) {
      fy += 4.0;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`Versement ce jour : ${money(specificPayment.amount)} FCFA (${specificPayment.method || 'Especes'})`, 9, fy);
    }

    if (dueDate) {
      fy += 4.0;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(90, 90, 90);
      doc.text(`Date limite de retrait : ${dueDate}`, 9, fy);
    }

    y += boxH + 3.0;

    if (paymentsList.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.0);
      doc.setTextColor(180, 120, 10);
      doc.text('HISTORIQUE DES REGLEMENTS :', 6.5, y);
      y += 3.6;

      paymentsList.forEach((p: any, idx: number) => {
        const pDate = p.date ? new Date(p.date).toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        }) : '';
        const label = idx === 0 ? 'Acompte initial' : `Tranche N.${idx + 1}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.4);
        doc.setTextColor(80, 80, 80);
        doc.text(`- ${label} (${p.method || 'Especes'}) ${pDate}`, 7.5, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text(`+${money(p.amount)} FCFA`, 73.5, y, { align: 'right' });
        y += 3.3;
      });
      y += 1.5;
    }
  }

  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(80, 80, 80);
  if (isAdvance) {
    doc.text('Articles reserves sous reserve du reglement integral.', 40, y, { align: 'center' });
    y += 3.4;
  }
  doc.text('Merci de votre visite et de votre fidelite !', 40, y, { align: 'center' });
  y += 3.4;
  doc.text('Les articles vendus ne sont ni repris ni echanges.', 40, y, { align: 'center' });
  y += 3.6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 130, 20);
  doc.text('Contact : (+237) 699 93 20 24 / 670 37 18 20 / 679 74 70 11', 40, y, { align: 'center' });
  y += 3.4;
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text("L'Elegance a son Sommet", 40, y, { align: 'center' });

  y += 4.5;
  const barWidths = [0.3, 0.7, 0.3, 1.0, 0.4, 0.8, 0.3, 0.5, 1.2, 0.4, 0.3, 0.9, 0.4, 0.6, 0.3, 1.1, 0.4, 0.8, 0.3, 0.6, 1.0, 0.4, 0.5, 0.8, 0.3];
  let bx = 18;
  doc.setFillColor(30, 30, 30);
  barWidths.forEach((w, i) => {
    if (i % 2 === 0) {
      doc.rect(bx, y, w, 5.0, 'F');
    }
    bx += w + 0.45;
  });

  y += 7.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(110, 110, 110);
  doc.text(`* ${ticketNum} *`, 40, y, { align: 'center' });

  return doc;
}

/**
 * Partage du reçu officiel :
 * - Ouvre la boîte de partage native du téléphone (navigator.share) avec le fichier PDF joint
 * - L'utilisateur sélectionne WhatsApp et le contact de son choix pour envoyer le PDF directement
 * - En fallback sur PC : Télécharge le PDF et ouvre WhatsApp
 */
export async function shareReceiptWhatsApp(
  sale: any,
  clientName?: string,
  storeName?: string,
  phoneOverride?: string
): Promise<boolean> {
  const c = computeSale(sale);
  const targetPhone = cleanWhatsAppNumber(phoneOverride || sale?.client_phone || sale?.phone || sale?.advanceData?.clientPhone);

  const isAdvance = c.isAdvance;
  const isCompletedAdvance = isAdvance && (
    c.amountRemaining <= 0 ||
    sale?.status === 'completed' ||
    sale?.advanceData?.isCompleted
  );
  const prefix = isAdvance ? (isCompletedAdvance ? 'Recu_Solde_LOREAL_' : 'Recu_Acompte_LOREAL_') : 'Recu_LOREAL_';
  const fileName = `${prefix}${c.ticketNum || 'OFFICIEL'}.pdf`;

  const message = buildReceiptMessage(sale, clientName, storeName);
  const waUrl = buildWhatsAppUrl(targetPhone, message);

  // 1. Partage natif avec le fichier PDF joint si l'appareil le supporte (Mobile / Tablette)
  if (typeof navigator !== 'undefined' && typeof (navigator as any).canShare === 'function') {
    try {
      const doc = buildReceiptPDF(sale, clientName, storeName);
      const blob = doc.output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if ((navigator as any).canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Reçu L'Oréal Capitol #${c.ticketNum || 'OFFICIEL'}`,
          text: message
        });
        return true;
      }
    } catch (e: any) {
      if (e && e.name === 'AbortError') {
        // L'utilisateur a fermé la boîte de partage
        return false;
      }
      console.log('Partage direct fichier annulé ou non géré:', e);
    }
  }

  // 2. Si non supporté sur l'appareil (ex: PC sans partage de fichier) : Téléchargement PDF + ouverture WhatsApp
  try {
    const doc = buildReceiptPDF(sale, clientName, storeName);
    doc.save(fileName);
  } catch (e) {
    console.error('Erreur téléchargement PDF reçu:', e);
  }

  openExternalUrl(waUrl);
  return true;
}



