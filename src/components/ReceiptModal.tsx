import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Linking, Platform, Image, TextInput } from 'react-native';
import { Printer, MessageCircle, X, Download, Sparkles, CheckCircle2, ShieldCheck, Clock, Mail, Phone, User as UserIcon, ChevronDown, ChevronUp, Check, Send } from 'lucide-react-native';
import jsPDF from 'jspdf';
import { LOREAL_LOGO_BASE64 } from '../assets/logoBase64';
import { cleanWhatsAppNumber, buildReceiptMessage, buildWhatsAppUrl, buildEmailUrl, openExternalUrl, shareReceiptWhatsApp } from '../utils/receiptShare';

interface ReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  sale: any;
  storeName?: string;
}

export default function ReceiptModal({ visible, onClose, sale, storeName }: ReceiptModalProps) {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [showCustomerEdit, setShowCustomerEdit] = useState(false);

  useEffect(() => {
    if (sale) {
      setClientName(sale.client_name || sale.clientName || sale.advanceData?.clientName || '');
      setClientPhone(sale.client_phone || sale.phone || sale.advanceData?.clientPhone || '');
      setClientEmail(sale.client_email || sale.email || sale.advanceData?.clientEmail || '');
    }
  }, [sale]);


  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'receipt-print-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-receipt, #printable-receipt * {
              visibility: visible !important;
            }
            #printable-receipt {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 78mm !important;
              margin: 0 !important;
              padding: 10px 8px !important;
              background: #fff !important;
              color: #000 !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  if (!sale) return null;

  const dateStr = sale.date ? new Date(sale.date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : new Date().toLocaleString('fr-FR');

  const rawStoreDisplay = storeName || (sale.store === 'falaise' ? 'La Falaise' : sale.store === 'tougou' ? 'Tougou' : 'La Falaise');
  const storeDisplay = String(rawStoreDisplay).replace(/^boutique\s+/i, '').trim() || 'La Falaise';
  const items = Array.isArray(sale.items) && sale.items.length > 0 
    ? sale.items 
    : (Array.isArray(sale.rawItems) && sale.rawItems.length > 0 ? sale.rawItems : (Array.isArray(sale.advanceData?.items) ? sale.advanceData.items : []));
  const ticketNum = sale.id ? String(sale.id).slice(-6).toUpperCase() : Math.floor(100000 + Math.random() * 900000).toString();

  // Analyse complète de l'avance / acompte
  const isAdvance = sale.is_advance === 1 || !!sale.advanceData || sale.ticketType === 'advance' || sale.ticketType === 'installment' || !!sale.advance_id;
  const isInstallment = sale.ticketType === 'installment' || !!sale.advanceData?.specificPayment || !!sale.is_advance_installment;
  const advanceInfo = sale.advanceData || {};

  const totalArticles = Number(
    advanceInfo.totalArticles || 
    sale.article_total || 
    (isAdvance ? ((advanceInfo.amountPaid || 0) + (advanceInfo.amountRemaining || 0)) : sale.total) || 
    sale.total || 
    0
  );
  const amountPaid = Number(advanceInfo.amountPaid !== undefined ? advanceInfo.amountPaid : (sale.amount_paid !== undefined ? sale.amount_paid : sale.total || 0));
  const amountRemaining = Number(
    advanceInfo.amountRemaining !== undefined 
      ? advanceInfo.amountRemaining 
      : (sale.amount_remaining !== undefined ? sale.amount_remaining : Math.max(0, totalArticles - amountPaid))
  );
  const isCompleted = isAdvance && (amountRemaining <= 0 || advanceInfo.isCompleted || advanceInfo.isFullyPaid || sale.status === 'completed');
  const dueDate = advanceInfo.dueDate || sale.due_date || sale.dueDate;
  const paymentsList: any[] = Array.isArray(advanceInfo.payments) ? advanceInfo.payments : (Array.isArray(sale.payments) ? sale.payments : []);
  const specificPayment = advanceInfo.specificPayment;

  const currentPaidAmount = isInstallment && specificPayment 
    ? Number(specificPayment.amount) 
    : (isAdvance ? amountPaid : Number(sale.total || 0));

  const formatPDFMoney = (val: number | string | undefined | null): string => {
    const n = Math.round(Number(val) || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const totalFormatted = `${formatPDFMoney(sale.total || 0)} FCFA`;

  // Libellé de l'entête
  const ticketHeaderBadge = isInstallment
    ? '✦ REÇU DE VERSEMENT D\'ACOMPTE ✦'
    : (isCompleted
        ? '✦ REÇU DE SOLDE D\'ACOMPTE ✦'
        : (isAdvance
            ? '✦ REÇU D\'ACOMPTE & RÉSERVATION ✦'
            : `✦ BOUTIQUE ${storeDisplay.toUpperCase()} ✦`));

  // Libellé PDF sans caractères spéciaux incompatibles avec Helvetica (WinAnsi)
  const pdfHeaderBadge = isInstallment
    ? "RECU DE VERSEMENT D'ACOMPTE"
    : (isCompleted
        ? "RECU DE SOLDE D'ACOMPTE"
        : (isAdvance
            ? "RECU D'ACOMPTE & RESERVATION"
            : `BOUTIQUE ${storeDisplay.toUpperCase()}`));

  // Génération du Document PDF officiel L'Oréal Capitol
  const buildReceiptPDF = () => {
    // 1. Calcul précis et dynamique de la hauteur du ticket pour garantir zéro coupure
    let itemsTotalH = 0;
    if (items.length > 0) {
      items.forEach((item: any) => {
        const nameLen = String(item.name || '').length;
        const nameLines = Math.max(1, Math.ceil(nameLen / 26));
        const itemH = nameLines * 3.4 + 4.8;
        itemsTotalH += itemH;
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

    // Fond blanc immaculé
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 80, pdfHeight, 'F');

    // 1. Médaillon circulaire compact luxueux (cercle or & noir)
    doc.setFillColor(15, 15, 18);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.circle(40, 9.5, 6.5, 'FD'); // Diamètre 13mm

    // Anneau doré interne prestige
    doc.setDrawColor(180, 140, 30);
    doc.setLineWidth(0.2);
    doc.circle(40, 9.5, 5.8, 'D');

    try {
      // 8x8mm image au centre (rayon max des coins = 5.65mm < 5.8mm)
      // L'image est ainsi 100% à l'intérieur du cercle
      doc.addImage(LOREAL_LOGO_BASE64, 'JPEG', 36, 5.5, 8, 8);
    } catch (e) {
      console.error('Erreur chargement logo PDF:', e);
    }

    let y = 19.5;

    // Entête Marque Prestige
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

    // Si reçu d'acompte, badge distinctif sécurisé sans débordement
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

    // Ligne dorée de séparation
    y += 3.4;
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.35);
    doc.line(6.5, y, 73.5, y);

    // Métadonnées ticket (Marges sûres : gauche 6.5mm, droite 73.5mm)
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
    const activeClientName = (clientName.trim() || sale.clientName || sale.client_name || '').trim();
    const activeClientPhone = (clientPhone.trim() || sale.client_phone || sale.phone || '').trim();

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

    // Titres colonnes
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
        const itemTotal = `${formatPDFMoney((item.price || 0) * (item.quantity || 1))} FCFA`;

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

        // Sous-ligne details (Quantite x Prix unitaire + Ref / Taille / Couleur)
        const qtyPrice = `${item.quantity || 1} x ${formatPDFMoney(item.price || 0)} FCFA`;
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
      doc.text(`${formatPDFMoney(totalArticles || sale.total || 0)} FCFA`, 73.5, y, { align: 'right' });
      y += 5.0;
    }

    // Ligne de séparation avant Total Net ou Carte Financière
    y += 1.0;
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.line(6.5, y, 73.5, y);

    if (!isAdvance) {
      // Vente standard : Boîte Total Net Haute Visibilité
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
      // ACOMPTE : Encart Financier Détaillé et Élégant
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
      doc.text(`${formatPDFMoney(totalArticles)} FCFA`, 71, fy, { align: 'right' });

      fy += 4.0;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 120, 10);
      doc.text('Total acompte verse :', 9, fy);
      doc.text(`${formatPDFMoney(amountPaid)} FCFA`, 71, fy, { align: 'right' });

      fy += 4.0;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isCompleted ? 22 : 190, isCompleted ? 101 : 30, isCompleted ? 52 : 30);
      doc.text('Solde restant du :', 9, fy);
      doc.text(isCompleted ? '0 FCFA (SOLDE)' : `${formatPDFMoney(amountRemaining)} FCFA`, 71, fy, { align: 'right' });

      if (isInstallment && specificPayment) {
        fy += 4.0;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`Versement ce jour : ${formatPDFMoney(specificPayment.amount)} FCFA (${specificPayment.method || 'Especes'})`, 9, fy);
      }

      if (dueDate) {
        fy += 4.0;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(90, 90, 90);
        doc.text(`Date limite de retrait : ${dueDate}`, 9, fy);
      }

      y += boxH + 3.0;

      // Historique des versements imprimé si disponible
      if (paymentsList.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.0);
        doc.setTextColor(180, 120, 10);
        doc.text('HISTORIQUE DES REGLEMENTS :', 6.5, y);
        y += 3.6;

        paymentsList.forEach((p: any, idx: number) => {
          const pDate = p.date ? new Date(p.date).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) : '';
          const label = idx === 0 ? 'Acompte initial' : `Tranche N.${idx + 1}`;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.4);
          doc.setTextColor(80, 80, 80);
          doc.text(`- ${label} (${p.method || 'Especes'}) ${pDate}`, 7.5, y);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(22, 101, 52);
          doc.text(`+${formatPDFMoney(p.amount)} FCFA`, 73.5, y, { align: 'right' });
          y += 3.3;
        });
        y += 1.5;
      }
    }

    // Bas de page
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

    // Code-barres décoratif officiel au pied du ticket
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
  };

  // Télécharger le PDF
  const handleDownloadPDF = () => {
    try {
      const doc = buildReceiptPDF();
      const prefix = isAdvance ? (isCompleted ? 'Recu_Solde_LOREAL_' : 'Recu_Acompte_LOREAL_') : 'Recu_LOREAL_';
      doc.save(`${prefix}${ticketNum}.pdf`);
    } catch (e) {
      console.error('Erreur téléchargement PDF:', e);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Erreur lors de la création du PDF.');
      }
    }
  };

  // Partage WhatsApp intelligent : Reçu PDF si vente complétée ou avance soldée, message texte seul si avance non complétée
  const handleShareWhatsApp = async () => {
    const targetPhone = cleanWhatsAppNumber(clientPhone);
    await shareReceiptWhatsApp(sale, clientName, storeDisplay, targetPhone);
  };

  // Envoi de la facture / reçu par Email
  const handleSendEmail = () => {
    const url = buildEmailUrl(clientEmail, sale, clientName, storeDisplay);
    openExternalUrl(url);
  };

  // Impression thermique
  const handlePrint = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        
        {/* Dynamic Island Flottant Apple Style en Haut de l'Écran */}
        <View style={styles.dynamicIslandWrapper}>
          <View style={styles.dynamicIsland}>
            
            {/* Ligne Principale Dynamic Island */}
            <View style={styles.islandMainRow}>
              {/* Gauche : Indicateur pulsant + Boutique */}
              <View style={styles.islandLeftSection}>
                <View style={[
                  styles.beaconGlow,
                  isAdvance && !isCompleted && styles.beaconGlowAmber
                ]}>
                  <View style={[
                    styles.beaconDot,
                    isAdvance && !isCompleted && styles.beaconDotAmber
                  ]} />
                </View>
                <View style={{ marginLeft: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Sparkles color="#d4af37" size={13} />
                    <Text style={styles.islandBrandName}>L'ORÉAL CAPITOL</Text>
                  </View>
                  <Text style={styles.islandTicketMeta}>
                    #{ticketNum} • {storeDisplay} {isAdvance ? (isCompleted ? '• Soldé ✓' : '• Acompte') : ''}
                  </Text>
                </View>
              </View>

              {/* Droite : Montant et État de Règlement */}
              <View style={styles.islandRightSection}>
                <Text style={styles.islandTotalNetLabel}>
                  {isInstallment ? 'VERSEMENT REÇU' : (isCompleted ? 'TOTAL RÉGLÉ (SOLDÉ)' : (isAdvance ? 'ACOMPTE VERSÉ' : 'TOTAL NET'))}
                </Text>
                <Text style={styles.islandTotalNetAmount}>
                  {formatPDFMoney(currentPaidAmount)} FCFA
                </Text>
                {isAdvance && (
                  <View style={[
                    styles.islandBadge,
                    isCompleted ? styles.islandBadgeGreen : styles.islandBadgeAmber
                  ]}>
                    <Text style={[
                      styles.islandBadgeText,
                      isCompleted ? styles.islandBadgeTextGreen : styles.islandBadgeTextAmber
                    ]}>
                      {isCompleted ? '✓ 100% Soldé' : `Reste : ${formatPDFMoney(amountRemaining)} FCFA`}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Raccourcis Rapides Intégrés dans la Dynamic Island */}
            <View style={styles.islandActionsBar}>
              <TouchableOpacity style={styles.islandQuickBtnPrint} onPress={handlePrint} activeOpacity={0.7}>
                <Printer color="#111" size={13} />
                <Text style={styles.islandQuickBtnPrintText}>Imprimer</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.islandQuickBtnPdf} onPress={handleDownloadPDF} activeOpacity={0.7}>
                <Download color="#121212" size={13} />
                <Text style={styles.islandQuickBtnPdfText}>PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.islandQuickBtnWa} onPress={handleShareWhatsApp} activeOpacity={0.7}>
                <MessageCircle color="#fff" size={13} />
                <Text style={styles.islandQuickBtnWaText}>Partager</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.islandQuickBtnMail} onPress={handleSendEmail} activeOpacity={0.7}>
                <Mail color="#fff" size={13} />
                <Text style={styles.islandQuickBtnMailText}>Mail</Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.islandQuickBtnClose} onPress={onClose} activeOpacity={0.7}>
                <X color="#999" size={15} />
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* Conteneur de Carte Reçu Thermique Haute Couture */}
        <View style={styles.cardContainer}>

          {/* Panneau Destinataire Client (WhatsApp & Email Direct) */}
          <View style={styles.clientRecipientBox}>
            <View style={styles.clientRecipientHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <UserIcon color="#d4af37" size={14} />
                <Text style={styles.clientRecipientTitle}>Destinataire WhatsApp & Mail</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCustomerEdit(!showCustomerEdit)}
                style={styles.clientEditToggle}
                activeOpacity={0.7}
              >
                <Text style={styles.clientEditToggleText}>
                  {showCustomerEdit ? 'Masquer' : (clientPhone || clientName || clientEmail ? 'Modifier' : '+ Ajouter Coordonnées')}
                </Text>
                {showCustomerEdit ? <ChevronUp color="#d4af37" size={13} /> : <ChevronDown color="#d4af37" size={13} />}
              </TouchableOpacity>
            </View>

            {/* Synthèse compacte avec indicateur direct WhatsApp */}
            {!showCustomerEdit && (
              <View style={styles.clientSummaryRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.clientSummaryText} numberOfLines={1}>
                    👤 <Text style={{ color: '#fff', fontWeight: 'bold' }}>{clientName.trim() || 'Client sans nom'}</Text>
                    {cleanWhatsAppNumber(clientPhone) ? `  •  💬 +${cleanWhatsAppNumber(clientPhone)}` : ''}
                    {clientEmail.trim() ? `  •  ✉️ ${clientEmail.trim()}` : ''}
                  </Text>
                </View>
                {cleanWhatsAppNumber(clientPhone) ? (
                  <View style={styles.waDirectBadge}>
                    <Check color="#25D366" size={11} />
                    <Text style={styles.waDirectBadgeText}>WhatsApp direct</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Formulaire de saisie dynamique */}
            {showCustomerEdit && (
              <View style={styles.clientInputForm}>
                <View style={styles.clientFieldGroup}>
                  <Text style={styles.clientFieldLabel}>Nom du client</Text>
                  <TextInput
                    style={styles.clientInputField}
                    placeholder="Ex: M. Jean Dupont"
                    placeholderTextColor="#666"
                    value={clientName}
                    onChangeText={setClientName}
                  />
                </View>

                <View style={styles.clientFieldGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.clientFieldLabel}>N° WhatsApp</Text>
                    {cleanWhatsAppNumber(clientPhone) ? (
                      <Text style={styles.waDirectHint}>✓ Envoi direct vers +{cleanWhatsAppNumber(clientPhone)}</Text>
                    ) : (
                      <Text style={styles.waDirectHintGray}>Ex: 699932024 (9 chiffres Cameroun)</Text>
                    )}
                  </View>
                  <TextInput
                    style={[styles.clientInputField, cleanWhatsAppNumber(clientPhone) && styles.clientInputFieldActive]}
                    placeholder="Ex: 699932024 ou +237 6..."
                    placeholderTextColor="#666"
                    keyboardType="phone-pad"
                    value={clientPhone}
                    onChangeText={setClientPhone}
                  />
                </View>

                <View style={styles.clientFieldGroup}>
                  <Text style={styles.clientFieldLabel}>Adresse Email</Text>
                  <TextInput
                    style={styles.clientInputField}
                    placeholder="Ex: client@gmail.com"
                    placeholderTextColor="#666"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={clientEmail}
                    onChangeText={setClientEmail}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Ticket de Caisse Imprimable */}
          <ScrollView contentContainerStyle={styles.receiptPaperScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.receiptPaper} id="printable-receipt">
              
              {/* Entête Marque avec Médaillon Doré Intégré */}
              <View style={styles.brandHeader}>
                <View style={styles.brandMedallion}>
                  <Image 
                    source={{ uri: LOREAL_LOGO_BASE64 }} 
                    style={styles.brandLogo} 
                    resizeMode="contain" 
                  />
                </View>
                <Text style={styles.brandTitle}>L'ORÉAL CAPITOL</Text>
                <Text style={styles.brandSubtitle}>La capitale du prêt à porter.</Text>
                
                <View style={[styles.brandStoreBadge, isAdvance && styles.brandAdvanceBadge]}>
                  <Text style={[styles.brandStoreBadgeText, isAdvance && styles.brandAdvanceBadgeText]}>
                    {ticketHeaderBadge}
                  </Text>
                </View>

                {isAdvance && (
                  <View style={[styles.advanceStatusPill, isCompleted ? styles.advanceStatusPillGreen : styles.advanceStatusPillAmber]}>
                    <Text style={[styles.advanceStatusPillText, isCompleted ? styles.advanceStatusPillTextGreen : styles.advanceStatusPillTextAmber]}>
                      {isCompleted ? 'ACOMPTE INTÉGRALEMENT SOLDÉ ✓' : 'RÉSERVATION VALIDÉE • EN COURS'}
                    </Text>
                  </View>
                )}

                <View style={styles.goldDivider} />
              </View>

              {/* Méta-données vente */}
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Ticket: <Text style={styles.metaBold}>#{ticketNum}</Text></Text>
                <Text style={styles.metaText}>{dateStr}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Vendeur: <Text style={styles.metaBold}>{sale.seller_name || 'Caisse'}</Text></Text>
                <Text style={styles.metaText}>Paiement: <Text style={styles.metaBold}>{specificPayment?.method || sale.payment_method || 'Espèces'}</Text></Text>
              </View>
              {(clientName.trim() || clientPhone.trim() || clientEmail.trim() || sale.clientName || sale.client_name) && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Client: <Text style={styles.metaBold}>{clientName.trim() || sale.clientName || sale.client_name || 'Client'}</Text></Text>
                  {(clientPhone.trim() || sale.client_phone || sale.phone) && (
                    <Text style={styles.metaText}>Tél: <Text style={styles.metaBold}>{clientPhone.trim() || sale.client_phone || sale.phone}</Text></Text>
                  )}
                </View>
              )}

              <View style={styles.dashedDivider} />

              {/* En-tête Colonnes Articles */}
              <View style={styles.itemsHeaderRow}>
                <Text style={styles.sectionHeaderLeft}>
                  {isAdvance ? 'ARTICLES RÉSERVÉS' : 'DÉSIGNATION DES ARTICLES'}
                </Text>
                <Text style={styles.sectionHeaderRight}>TOTAL (FCFA)</Text>
              </View>

              {/* Lignes d'articles avec FCFA toujours affiché */}
              {items.length > 0 ? (
                items.map((item: any, idx: number) => {
                  const metaParts = [
                    item.reference ? `Réf: ${item.reference}` : '',
                    item.size ? `T: ${item.size}` : '',
                    item.color ? item.color : ''
                  ].filter(Boolean);

                  return (
                    <View key={idx} style={styles.itemRow}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.itemName}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemUnitPrice}>
                          {item.quantity || 1} × {formatPDFMoney(item.price || 0)} FCFA
                          {metaParts.length > 0 ? `  •  (${metaParts.join(' • ')})` : ''}
                        </Text>
                      </View>
                      <Text style={styles.itemTotalPrice}>
                        {formatPDFMoney((item.price || 0) * (item.quantity || 1))} FCFA
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.itemRow}>
                  <Text style={[styles.itemName, { flex: 1 }]}>{sale.items || 'Articles'}</Text>
                  <Text style={styles.itemTotalPrice}>{formatPDFMoney(totalArticles || sale.total || 0)} FCFA</Text>
                </View>
              )}

              <View style={styles.goldDivider} />

              {/* Section Financière */}
              {!isAdvance ? (
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>TOTAL NET :</Text>
                  <Text style={styles.totalValue}>{totalFormatted}</Text>
                </View>
              ) : (
                <View style={styles.advanceFinancialCard}>
                  <View style={styles.advanceFinRow}>
                    <Text style={styles.advanceFinLabel}>VALEUR TOTALE ARTICLES :</Text>
                    <Text style={styles.advanceFinValNormal}>{formatPDFMoney(totalArticles)} FCFA</Text>
                  </View>
                  <View style={styles.advanceFinRow}>
                    <Text style={styles.advanceFinLabelGold}>TOTAL ACOMPTE VERSÉ :</Text>
                    <Text style={styles.advanceFinValGold}>{formatPDFMoney(amountPaid)} FCFA</Text>
                  </View>
                  <View style={[styles.advanceFinRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <Text style={[styles.advanceFinLabel, { color: isCompleted ? '#166534' : '#b71c1c', fontWeight: '800' }]}>
                      SOLDE RESTANT À PAYER :
                    </Text>
                    <Text style={[styles.advanceFinVal, { color: isCompleted ? '#166534' : '#b71c1c', fontWeight: '900' }]}>
                      {isCompleted ? '0 FCFA (SOLDÉ ✓)' : `${formatPDFMoney(amountRemaining)} FCFA`}
                    </Text>
                  </View>
                  {isInstallment && specificPayment && (
                    <View style={styles.advanceInstallmentNotice}>
                      <Text style={styles.advanceInstallmentNoticeText}>
                        ✦ Versement du jour : <Text style={{ fontWeight: 'bold' }}>{formatPDFMoney(specificPayment.amount)} FCFA</Text> ({specificPayment.method || 'Espèces'})
                      </Text>
                    </View>
                  )}
                  {dueDate && (
                    <View style={styles.advanceDueDateRow}>
                      <Clock size={11} color="#854d0e" style={{ marginRight: 4 }} />
                      <Text style={styles.advanceDueDateText}>Date limite de retrait : <Text style={{ fontWeight: '700' }}>{dueDate}</Text></Text>
                    </View>
                  )}
                </View>
              )}

              {/* Historique des tranches si disponible */}
              {isAdvance && paymentsList.length > 0 && (
                <View style={styles.ticketHistoryBox}>
                  <Text style={styles.ticketHistoryTitle}>📜 HISTORIQUE DES VERSEMENTS :</Text>
                  {paymentsList.map((p: any, idx: number) => {
                    const pDate = p.date ? new Date(p.date).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }) : '';
                    return (
                      <View key={idx} style={styles.ticketHistoryRow}>
                        <Text style={styles.ticketHistoryLabel}>
                          {idx === 0 ? 'Acompte initial' : `Tranche N°${idx + 1}`} ({p.method || 'Espèces'})
                          {pDate ? ` • ${pDate}` : ''}
                        </Text>
                        <Text style={styles.ticketHistoryVal}>+{formatPDFMoney(p.amount)} FCFA</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Message de bas de page avec contacts */}
              <View style={styles.footerNote}>
                {isAdvance && (
                  <Text style={[styles.footerText, { color: '#854d0e', marginBottom: 3, fontWeight: '700' }]}>
                    Articles réservés sous réserve du règlement intégral.
                  </Text>
                )}
                <Text style={styles.footerText}>Merci de votre visite et de votre fidélité !</Text>
                <Text style={styles.footerSubText}>Les articles vendus ne sont ni repris ni échangés.</Text>
                <Text style={styles.footerContact}>📞 Contact : (+237) 699 93 20 24 / 670 37 18 20 / 679 74 70 11</Text>
                <Text style={styles.footerSubText}>★ L'Élégance à son Sommet ★</Text>

                {/* Code barre officiel simulé */}
                <View style={styles.barcodeVisual}>
                  {[3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2].map((w, i) => (
                    <View 
                      key={i} 
                      style={{ 
                        width: w, 
                        height: 22, 
                        backgroundColor: i % 2 === 0 ? '#1a1a1a' : '#ffffff',
                        marginRight: 2
                      }} 
                    />
                  ))}
                </View>
                <Text style={styles.barcodeTicketNum}>* {ticketNum} *</Text>
              </View>

            </View>
          </ScrollView>

          {/* Action Buttons au Bas */}
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.whatsAppBtn} onPress={handleShareWhatsApp} activeOpacity={0.8}>
              <MessageCircle color="#fff" size={17} />
              <View style={{ alignItems: 'flex-start' }}>
                <Text style={styles.whatsAppBtnText}>Partager WhatsApp</Text>
                <Text style={styles.whatsAppBtnSub}>Reçu PDF inclus</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.emailBtn} onPress={handleSendEmail} activeOpacity={0.8}>
              <Mail color="#fff" size={16} />
              <Text style={styles.emailBtnText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pdfBtn} onPress={handleDownloadPDF} activeOpacity={0.8}>
              <Download color="#121212" size={16} />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.printBtn} onPress={handlePrint} activeOpacity={0.8}>
              <Printer color="#121212" size={16} />
              <Text style={styles.printBtnText}>Imprimer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },

  // Dynamic Island Apple Style
  dynamicIslandWrapper: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    marginBottom: 10,
    zIndex: 100,
  },
  dynamicIsland: {
    width: '100%',
    backgroundColor: '#0c0d10',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.55)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  islandMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  islandLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  beaconGlow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  beaconGlowAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  beaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  beaconDotAmber: {
    backgroundColor: '#f59e0b',
  },
  islandBrandName: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  islandTicketMeta: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  islandRightSection: {
    alignItems: 'flex-end',
  },
  islandTotalNetLabel: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  islandTotalNetAmount: {
    color: '#d4af37',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  islandBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  islandBadgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 0.8,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  islandBadgeAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  islandBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  islandBadgeTextGreen: {
    color: '#4ade80',
  },
  islandBadgeTextAmber: {
    color: '#fbbf24',
  },

  islandActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  islandQuickBtnPrint: {
    flex: 1,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  islandQuickBtnPrintText: {
    color: '#111',
    fontSize: 11,
    fontWeight: 'bold',
  },
  islandQuickBtnPdf: {
    flex: 1,
    backgroundColor: '#d4af37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  islandQuickBtnPdfText: {
    color: '#121212',
    fontSize: 11,
    fontWeight: 'bold',
  },
  islandQuickBtnWa: {
    flex: 1.3,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  islandQuickBtnWaText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  islandQuickBtnClose: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Conteneur de Reçu
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#161618',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2e2e34',
    display: 'flex',
    flexDirection: 'column',
  },
  receiptPaperScroll: {
    padding: 16,
    alignItems: 'center',
  },
  receiptPaper: {
    width: '100%',
    maxWidth: 370,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },

  // Entête
  brandHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  brandMedallion: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f0f12',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  brandLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  brandTitle: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  brandSubtitle: {
    color: '#666',
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
  },
  brandStoreBadge: {
    marginTop: 5,
    backgroundColor: '#121214',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: '#d4af37',
  },
  brandStoreBadgeText: {
    color: '#d4af37',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brandAdvanceBadge: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  brandAdvanceBadgeText: {
    color: '#b45309',
  },
  advanceStatusPill: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 0.8,
  },
  advanceStatusPillAmber: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  advanceStatusPillGreen: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  advanceStatusPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  advanceStatusPillTextAmber: {
    color: '#b45309',
  },
  advanceStatusPillTextGreen: {
    color: '#15803d',
  },

  goldDivider: {
    height: 1.5,
    backgroundColor: '#d4af37',
    width: '100%',
    marginVertical: 10,
    opacity: 0.7,
  },
  dashedDivider: {
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: '#bbb',
    marginVertical: 8,
  },

  // Méta
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  metaText: {
    color: '#444',
    fontSize: 10.5,
  },
  metaBold: {
    fontWeight: 'bold',
    color: '#121212',
  },

  // Table articles
  itemsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionHeaderLeft: {
    color: '#333',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeaderRight: {
    color: '#333',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  itemName: {
    color: '#121212',
    fontSize: 12,
    fontWeight: '700',
  },
  itemUnitPrice: {
    color: '#777',
    fontSize: 10.5,
    marginTop: 1,
  },
  itemTotalPrice: {
    color: '#121212',
    fontSize: 12,
    fontWeight: 'bold',
    flexShrink: 0,
    minWidth: 90,
    textAlign: 'right',
  },

  // Total standard
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fbf9f2',
    borderWidth: 1.2,
    borderColor: '#d4af37',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
  },
  totalLabel: {
    color: '#121212',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  totalValue: {
    color: '#b38e1e',
    fontSize: 17,
    fontWeight: '900',
    flexShrink: 0,
    minWidth: 120,
    textAlign: 'right',
  },

  // Encart Financier Spécifique Acompte
  advanceFinancialCard: {
    backgroundColor: '#fffcf5',
    borderWidth: 1.2,
    borderColor: '#d4af37',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
  },
  advanceFinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3.5,
    borderBottomWidth: 0.6,
    borderBottomColor: '#f1e8d0',
  },
  advanceFinLabel: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
  },
  advanceFinValNormal: {
    color: '#222',
    fontSize: 11.5,
    fontWeight: '700',
  },
  advanceFinLabelGold: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '800',
  },
  advanceFinValGold: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '900',
  },
  advanceFinVal: {
    fontSize: 13,
  },
  advanceInstallmentNotice: {
    marginTop: 6,
    padding: 5,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
  },
  advanceInstallmentNoticeText: {
    color: '#92400e',
    fontSize: 10.5,
  },
  advanceDueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 4,
  },
  advanceDueDateText: {
    color: '#854d0e',
    fontSize: 10.5,
  },

  // Historique des versements
  ticketHistoryBox: {
    backgroundColor: '#f9f9fa',
    borderWidth: 0.8,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  ticketHistoryTitle: {
    color: '#b45309',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ticketHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2.5,
  },
  ticketHistoryLabel: {
    color: '#555',
    fontSize: 9.5,
  },
  ticketHistoryVal: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },

  // Bas de page
  footerNote: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    color: '#444',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerSubText: {
    color: '#888',
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  footerContact: {
    color: '#b38e1e',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 2,
    textAlign: 'center',
  },
  barcodeVisual: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  barcodeTicketNum: {
    color: '#888',
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 3,
  },

  islandQuickBtnMail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  islandQuickBtnMailText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Panneau Destinataire Client WhatsApp & Email
  clientRecipientBox: {
    backgroundColor: '#16171b',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#272830',
  },
  clientRecipientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientRecipientTitle: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  clientEditToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  clientEditToggleText: {
    color: '#d4af37',
    fontSize: 10.5,
    fontWeight: '600',
  },
  clientSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  clientSummaryText: {
    color: '#aaa',
    fontSize: 11,
  },
  waDirectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(37, 211, 102, 0.4)',
  },
  waDirectBadgeText: {
    color: '#25D366',
    fontSize: 10,
    fontWeight: '700',
  },
  clientInputForm: {
    marginTop: 10,
    gap: 8,
    backgroundColor: '#0f1013',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22232a',
  },
  clientFieldGroup: {
    gap: 3,
  },
  clientFieldLabel: {
    color: '#999',
    fontSize: 10.5,
    fontWeight: '600',
  },
  clientInputField: {
    backgroundColor: '#1b1c22',
    color: '#fff',
    fontSize: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#30323d',
  },
  clientInputFieldActive: {
    borderColor: '#25D366',
    backgroundColor: 'rgba(37, 211, 102, 0.05)',
  },
  waDirectHint: {
    color: '#25D366',
    fontSize: 10,
    fontWeight: '600',
  },
  waDirectHintGray: {
    color: '#777',
    fontSize: 9.5,
  },

  // Action Buttons au Bas
  bottomActions: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#121214',
    borderTopWidth: 1,
    borderTopColor: '#252528',
    gap: 6,
  },
  whatsAppBtn: {
    flex: 2.2,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  whatsAppBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  whatsAppBtnSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9.5,
    fontWeight: '500',
  },
  emailBtn: {
    flex: 1.4,
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  emailBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pdfBtn: {
    flex: 1.2,
    backgroundColor: '#d4af37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  pdfBtnText: {
    color: '#121212',
    fontSize: 12,
    fontWeight: 'bold',
  },
  printBtn: {
    flex: 1.2,
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  printBtnText: {
    color: '#121212',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  closeBtn: {
    backgroundColor: '#28282c',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
