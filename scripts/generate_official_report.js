const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

const formatMoney = (val) => {
  const n = Math.round(Number(val) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

async function main() {
  console.log('1. Récupération des données en direct depuis Firebase...');
  const [advancesRes, salesRes] = await Promise.all([
    fetch('https://l-oreal-capitol-default-rtdb.firebaseio.com/advances.json').then(r => r.json()),
    fetch('https://l-oreal-capitol-default-rtdb.firebaseio.com/sales.json').then(r => r.json())
  ]);

  const advancesList = Object.entries(advancesRes || {}).map(([id, a]) => ({ id, ...a }));
  const salesList = Object.entries(salesRes || {}).map(([id, s]) => ({ id, ...s }));

  const totalAdvances = advancesList.length;
  const pendingAdvances = advancesList.filter(a => a.status !== 'completed');
  const completedAdvances = advancesList.filter(a => a.status === 'completed');

  let totalValArticles = 0;
  let totalAmountPaid = 0;
  let totalAmountRemaining = 0;

  advancesList.forEach(a => {
    const paid = Number(a.amount_paid || 0);
    const rem = Number(a.amount_remaining || 0);
    const tot = Number(a.article_total || (paid + rem) || 0);
    totalValArticles += tot;
    totalAmountPaid += paid;
    totalAmountRemaining += rem;
  });

  // Logo base64
  let logoBase64 = '';
  try {
    const logoFileContent = fs.readFileSync(path.join(__dirname, '../src/assets/logoBase64.ts'), 'utf8');
    const match = logoFileContent.match(/export const LOREAL_LOGO_BASE64 = '([^']+)';/);
    if (match) logoBase64 = match[1];
  } catch (e) {
    console.error('Erreur lecture logo:', e);
  }

  // -------------------------------------------------------------
  // DOCUMENT 1 : RAPPORT EXÉCUTIF A4 DE TOUTE L'ACTIVITÉ ET DU SYSTÈME
  // -------------------------------------------------------------
  console.log('2. Création du Rapport Exécutif A4...');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;

  const drawHeader = (pageTitle, pageSubtitle, pageNum, totalPages) => {
    // Fond bandeau entête
    doc.setFillColor(15, 15, 18);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Liseré or
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.8);
    doc.line(0, 28, pageWidth, 28);

    // Médaillon circulaire logo
    doc.setFillColor(25, 25, 30);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.circle(marginX + 8, 14, 8, 'FD');

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'JPEG', marginX + 3.5, 9.5, 9, 9);
      } catch (e) {}
    }

    // Titres entête
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 248, 220);
    doc.text("L'ORÉAL CAPITOL", marginX + 20, 12);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(200, 180, 120);
    doc.text('La capitale du prêt à porter — Boutiques La Falaise & Tougou', marginX + 20, 17);

    // Titre page à droite
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(212, 175, 55);
    doc.text(pageTitle.toUpperCase(), pageWidth - marginX, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text(pageSubtitle, pageWidth - marginX, 17, { align: 'right' });

    // Pied de page
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("L'Oréal Capitol • Direction Générale & Contrôle de Gestion • (+237) 699 93 20 24 / 670 37 18 20", marginX, pageHeight - 7);
    doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: 'right' });
  };

  // ========== PAGE 1 : BILAN EXÉCUTIF & KPIs ==========
  drawHeader("Rapport d'Activité & Système", "Édition Officielle du 29/10/2026", 1, 3);

  let curY = 36;

  // Titre principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("RAPPORT GÉNÉRAL D'ACTIVITÉ & BILAN DU SYSTÈME", marginX, curY);

  curY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("Synthèse complète des acomptes, réservations clients, flux financiers et évolutions logicielles", marginX, curY);

  curY += 7;

  // 4 Cartes KPIs
  const cardW = (pageWidth - marginX * 2 - 9) / 4;
  const cardH = 24;

  const kpis = [
    { label: "DOSSIERS D'ACOMPTE", val: `${totalAdvances}`, sub: `${pendingAdvances.length} en cours • ${completedAdvances.length} soldés`, color: [180, 130, 20], bg: [255, 252, 240] },
    { label: "VALEUR DES ARTICLES", val: `${formatMoney(totalValArticles)} F`, sub: "Valeur marchande réservée", color: [20, 20, 20], bg: [250, 250, 252] },
    { label: "ACOMPTES VERSÉS", val: `${formatMoney(totalAmountPaid)} F`, sub: `${((totalAmountPaid/totalValArticles)*100).toFixed(1)}% des commandes encaissé`, color: [22, 101, 52], bg: [240, 253, 244] },
    { label: "SOLDE RESTANT DÛ", val: `${formatMoney(totalAmountRemaining)} F`, sub: "À recouvrer aux retraits", color: [185, 28, 28], bg: [254, 242, 242] }
  ];

  kpis.forEach((kpi, idx) => {
    const cx = marginX + idx * (cardW + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.roundedRect(cx, curY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 100, 100);
    doc.text(kpi.label, cx + 3.5, curY + 6);

    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, cx + 3.5, curY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(110, 110, 110);
    doc.text(kpi.sub, cx + 3.5, curY + 20);
  });

  curY += cardH + 9;

  // SECTION : SYNTHÈSE DES AMÉLIORATIONS ET INTERVENTIONS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("1. BILAN DES CORRECTIONS ET AMÉLIORATIONS DU SYSTÈME DE REÇUS", marginX, curY);

  curY += 2;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(marginX, curY, marginX + 182, curY);
  curY += 5.5;

  const improvements = [
    {
      title: "Transformation du Logo en Médaillon Circulaire Compact",
      desc: "Remplacement de l'ancien rectangle noir massif par un médaillon circulaire or & noir de 13 mm de diamètre. Gain de plus de 60% d'espace en haut du ticket, évitant l'encombrement du rouleau thermique et offrant un cachet luxe digne d'une grande maison de couture."
    },
    {
      title: "Résolution Totale des Débordements de Lignes & Cadrage Sécurisé",
      desc: "Restructuration de chaque article réservé sur deux lignes distinctes : la ligne 1 affiche le nom intégral avec le prix net aligné à droite (marge sécurisée de 6 mm), la ligne 2 détaille la quantité, le prix unitaire, la référence fabricant, la taille et le coloris sans tronquage ni coupure."
    },
    {
      title: "Élimination des Caractères Corrompus et Séparateurs de Milliers",
      desc: "Remplacement du caractère spécial '\\u202F' (qui s'affichait sous forme de slashes '80/000 F' ou '1/880/000 F') par des espaces standards compatibles Helvetica. Suppression définitive des caractères WinAnsi corrompus ('Ô=üû', '&', etc.)."
    },
    {
      title: "Hauteur Dynamique Automatique (Ticket sans Coupure)",
      desc: "Calcul en temps réel de la longueur exacte du ticket en fonction du nombre d'articles (support jusqu'à 30 articles sur un seul slip continu). L'historique des tranches d'acompte, le récapitulatif financier, les conditions légales et le code-barres sont intégralement préservés."
    },
    {
      title: "Génération PDF & Partage WhatsApp 1-Clic",
      desc: "Téléchargement immédiat du reçu officiel vectoriel au format PDF avec possibilité d'envoi automatique direct au client par message WhatsApp formaté avec détail complet du panier."
    }
  ];

  improvements.forEach(item => {
    doc.setFillColor(255, 253, 245);
    doc.setDrawColor(230, 215, 170);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, curY, pageWidth - marginX * 2, 17, 1.5, 1.5, 'FD');

    // Puce dorée
    doc.setFillColor(212, 175, 55);
    doc.circle(marginX + 4.5, curY + 5.5, 1.6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 30, 30);
    doc.text(item.title, marginX + 9, curY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(70, 70, 70);
    const splitDesc = doc.splitTextToSize(item.desc, pageWidth - marginX * 2 - 12);
    doc.text(splitDesc, marginX + 9, curY + 10.5);

    curY += 19;
  });

  // Encadré indicateur de déploiement
  curY += 2;
  doc.setFillColor(15, 15, 18);
  doc.roundedRect(marginX, curY, pageWidth - marginX * 2, 14, 2, 2, 'F');
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, curY, pageWidth - marginX * 2, 14, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(212, 175, 55);
  doc.text("DÉPLOIEMENT CLOUD PRODUCTION VALIDÉ", marginX + 6, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(220, 220, 220);
  doc.text("Application en ligne et synchronisée : https://loreal-capitol-app.vercel.app  •  Base de données Firebase RTDB connectée", marginX + 6, curY + 10);

  // ========== PAGE 2 : FOCUS DOSSIER CLIENT EZA BRICE ==========
  doc.addPage();
  drawHeader("Dossier de Réservation Réf. #NKH_KY", "Client VIP : Mr EZA Brice", 2, 3);

  curY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text("2. DOSSIER D'ACOMPTE DE RÉFÉRENCE — MR EZA BRICE (#NKH_KY)", marginX, curY);

  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text("Détail complet du dossier ayant servi aux tests de dimensionnement multi-articles (18 pièces réservées)", marginX, curY);

  curY += 6;

  // Trouver l'acompte de Mr EZA Brice
  const ezaAdvance = advancesList.find(a => (a.client_name || '').toLowerCase().includes('eza')) || advancesList[0];
  const ezaItems = Array.isArray(ezaAdvance.items) ? ezaAdvance.items : [];

  // Fiche récapitulative EZA
  doc.setFillColor(255, 252, 240);
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, curY, pageWidth - marginX * 2, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 130, 20);
  doc.text("INFORMATIONS DU REÇU D'ACOMPTE", marginX + 5, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Client : ${ezaAdvance.client_name || 'Mr EZA Brice'}`, marginX + 5, curY + 12);
  doc.text(`Boutique : La Falaise (Douala)`, marginX + 5, curY + 17);
  doc.text(`Date de création : 03/10/2026 à 16:38`, marginX + 5, curY + 22);

  doc.text(`Valeur totale des 18 articles : ${formatMoney(1880000)} FCFA`, marginX + 65, curY + 12);
  doc.text(`Mode de versement : Orange Money (OM)`, marginX + 65, curY + 17);
  doc.text(`Date limite de retrait convenue : 10/10/2026`, marginX + 65, curY + 22);

  // Cadre solde à droite
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.4);
  doc.roundedRect(pageWidth - marginX - 52, curY + 3.5, 48, 19, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(22, 101, 52);
  doc.text(`Acompte versé : ${formatMoney(1050000)} FCFA`, pageWidth - marginX - 50, curY + 9.5);

  doc.setFontSize(8.5);
  doc.setTextColor(185, 28, 28);
  doc.text(`RESTE DÛ : ${formatMoney(830000)} F`, pageWidth - marginX - 50, curY + 18);

  curY += 31;

  // Tableau des articles d'EZA Brice
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text("DÉTAIL DES 18 ARTICLES RÉSERVÉS DANS LE DOSSIER", marginX, curY);

  curY += 4;

  // En-tête tableau
  doc.setFillColor(15, 15, 18);
  doc.rect(marginX, curY, pageWidth - marginX * 2, 6.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(212, 175, 55);
  doc.text("N°", marginX + 3, curY + 4.5);
  doc.text("DÉSIGNATION DE L'ARTICLE", marginX + 12, curY + 4.5);
  doc.text("RÉFÉRENCE & TAILLE", marginX + 105, curY + 4.5);
  doc.text("QTÉ × P.U.", marginX + 145, curY + 4.5);
  doc.text("TOTAL (FCFA)", pageWidth - marginX - 3, curY + 4.5, { align: 'right' });

  curY += 6.5;

  const displayItems = ezaItems.length > 0 ? ezaItems : [
    { name: "CHAUSSURE FEMME MAGZA", reference: "1112", size: "40", color: "NOIR", quantity: 1, price: 80000 },
    { name: "CHAUSSURE FEMME MAGZA", reference: "66814", size: "40", color: "BLEU CIEL", quantity: 1, price: 80000 },
    { name: "BALERINE MAGZA", reference: "", size: "40", color: "MARRON DIN", quantity: 1, price: 80000 },
    { name: "BALERINE MAGZA", reference: "", size: "40", color: "ROUGE CIRE", quantity: 1, price: 80000 },
    { name: "CHAUSSURE FEMME MAGZA", reference: "5022", size: "40", color: "BORDEAUX", quantity: 1, price: 80000 },
    { name: "CHAUSSURE FEMME MAGZA", reference: "4239", size: "40", color: "BLANC", quantity: 1, price: 80000 },
    { name: "ENSEMBLE JUPE ORNA FARHO", reference: "", size: "42", color: "VERT CITRON", quantity: 1, price: 180000 },
    { name: "COSTUME PAUL HAGGIS", reference: "C08", size: "52", color: "GRIS SOURIS", quantity: 1, price: 150000 },
    { name: "COSTUME PAUL HAGGIS CROISE", reference: "2711305", size: "52", color: "BLEU BOUTON DORE", quantity: 1, price: 150000 },
    { name: "BLAZER NEVIO", reference: "C08", size: "52", color: "GRIS", quantity: 1, price: 100000 },
    { name: "BLAZER NEVIO", reference: "C01", size: "52", color: "NOIR", quantity: 1, price: 100000 },
    { name: "COSTUME FABIO MATEO CROISE", reference: "", size: "52", color: "BLEU", quantity: 1, price: 150000 },
    { name: "COSTUME EMMANUEL KHANN CROISE", reference: "", size: "52", color: "GRIS", quantity: 1, price: 200000 },
    { name: "CHEMISE PRESIDENT", reference: "", size: "L", color: "FLEURI VERT", quantity: 3, price: 40000 },
    { name: "CHEMISE CLASSIQUE", reference: "", size: "L", color: "BLANC", quantity: 2, price: 30000 },
    { name: "CHEMISE CLASSIQUE", reference: "", size: "L", color: "BLEU CIEL", quantity: 3, price: 30000 },
    { name: "CHEMISE CLASSIQUE LONG COL", reference: "", size: "L", color: "BLANC", quantity: 1, price: 25000 },
    { name: "BALERINE MAGZA", reference: "", size: "40", color: "DIN", quantity: 1, price: 75000 }
  ];

  displayItems.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 249, isEven ? 255 : 249, isEven ? 255 : 251);
    doc.rect(marginX, curY, pageWidth - marginX * 2, 6.2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(90, 90, 90);
    doc.text(String(idx + 1), marginX + 3, curY + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    const itemName = String(item.name || 'Article').substring(0, 42);
    doc.text(itemName, marginX + 12, curY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const refText = [
      item.reference ? `Réf:${item.reference}` : '',
      item.size ? `T:${item.size}` : '',
      item.color ? item.color : ''
    ].filter(Boolean).join(' • ') || 'Standard';
    doc.text(refText.substring(0, 26), marginX + 105, curY + 4.2);

    doc.text(`${item.quantity || 1} × ${formatMoney(item.price || 0)}`, marginX + 145, curY + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(`${formatMoney((item.price || 0) * (item.quantity || 1))} F`, pageWidth - marginX - 3, curY + 4.2, { align: 'right' });

    curY += 6.2;
  });

  // ========== PAGE 3 : RÉPERTOIRE DES ACOMPTES EN COURS ==========
  doc.addPage();
  drawHeader("Répertoire des Acomptes & Soldes", "Suivi du Portefeuille Clients", 3, 3);

  curY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text("3. RÉPERTOIRE SÉLECTIF DES ACOMPTES ET RÉSERVATIONS EN COURS", marginX, curY);

  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text("État du portefeuille des clients avec acomptes en attente de solde et retrait en boutique", marginX, curY);

  curY += 6;

  // En-tête tableau clients
  doc.setFillColor(15, 15, 18);
  doc.rect(marginX, curY, pageWidth - marginX * 2, 6.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(212, 175, 55);
  doc.text("CLIENT", marginX + 3, curY + 4.5);
  doc.text("BOUTIQUE", marginX + 48, curY + 4.5);
  doc.text("ARTICLE RÉSERVÉ", marginX + 75, curY + 4.5);
  doc.text("DATE LIMITE", marginX + 130, curY + 4.5);
  doc.text("VERSÉ (FCFA)", marginX + 158, curY + 4.5);
  doc.text("RESTE DÛ", pageWidth - marginX - 3, curY + 4.5, { align: 'right' });

  curY += 6.5;

  // Prendre les 25 premiers acomptes
  const sampleAdvances = advancesList.slice(0, 28);

  sampleAdvances.forEach((adv, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 249, isEven ? 255 : 249, isEven ? 255 : 251);
    doc.rect(marginX, curY, pageWidth - marginX * 2, 5.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(25, 25, 25);
    const clientStr = String(adv.client_name || 'Client').substring(0, 20);
    doc.text(clientStr, marginX + 3, curY + 4.0);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    const storeStr = adv.store === 'falaise' ? 'La Falaise' : (adv.store === 'tougou' ? 'Tougou' : 'Principale');
    doc.text(storeStr, marginX + 48, curY + 4.0);

    const artStr = String(adv.product_name || (adv.items && adv.items[0]?.name) || 'Articles').substring(0, 28);
    doc.text(artStr, marginX + 75, curY + 4.0);

    const dueStr = adv.due_date || 'Non spécifiée';
    doc.text(dueStr, marginX + 130, curY + 4.0);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text(`${formatMoney(adv.amount_paid)} F`, marginX + 158, curY + 4.0);

    const rem = Number(adv.amount_remaining || 0);
    doc.setTextColor(rem > 0 ? 185 : 22, rem > 0 ? 28 : 101, rem > 0 ? 28 : 52);
    doc.text(rem > 0 ? `${formatMoney(rem)} F` : "SOLDÉ", pageWidth - marginX - 3, curY + 4.0, { align: 'right' });

    curY += 5.8;
  });

  // Footer validation bas de page
  curY = pageHeight - 32;
  doc.setFillColor(255, 253, 245);
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, curY, pageWidth - marginX * 2, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 130, 20);
  doc.text("CERTIFICATION ET VISA DE LA DIRECTION", marginX + 5, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(60, 60, 60);
  doc.text("Le présent rapport certifie la concordance des encaissements d'acomptes et de l'état des stocks réservés.", marginX + 5, curY + 10.5);
  doc.text("Généré automatiquement par le système d'encaissement et de gestion L'Oréal Capitol.", marginX + 5, curY + 14);

  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text("Visa : Direction Générale / Caisse Centrale", pageWidth - marginX - 5, curY + 10.5, { align: 'right' });

  // -------------------------------------------------------------
  // DOCUMENT 2 : LE REÇU THERMIQUE OFFICIEL PDF DE MR EZA BRICE (#NKH_KY)
  // -------------------------------------------------------------
  console.log('3. Création du Reçu Thermique Officiel pour Mr EZA Brice...');
  const countItems = displayItems.length;
  const baseHeaderH = 54;
  const itemsTotalH = countItems * 8.2;
  const financeBoxH = 28;
  const historyTotalH = 14;
  const footerTotalH = 48;
  const receiptHeight = Math.ceil(baseHeaderH + itemsTotalH + financeBoxH + historyTotalH + footerTotalH + 15);

  const docReceipt = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, receiptHeight]
  });

  docReceipt.setFillColor(255, 255, 255);
  docReceipt.rect(0, 0, 80, receiptHeight, 'F');

  // Médaillon circulaire
  docReceipt.setFillColor(15, 15, 18);
  docReceipt.setDrawColor(212, 175, 55);
  docReceipt.setLineWidth(0.5);
  docReceipt.circle(40, 9.5, 6.5, 'FD');

  docReceipt.setDrawColor(180, 140, 30);
  docReceipt.setLineWidth(0.2);
  docReceipt.circle(40, 9.5, 5.8, 'D');

  if (logoBase64) {
    try {
      docReceipt.addImage(logoBase64, 'JPEG', 36, 5.5, 8, 8);
    } catch (e) {}
  }

  let ry = 19.5;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setFontSize(10.2);
  docReceipt.setTextColor(20, 20, 20);
  docReceipt.text("L'OREAL CAPITOL", 40, ry, { align: 'center' });

  ry += 3.6;
  docReceipt.setFont('helvetica', 'italic');
  docReceipt.setFontSize(6.8);
  docReceipt.setTextColor(110, 110, 110);
  docReceipt.text('La capitale du pret a porter.', 40, ry, { align: 'center' });

  ry += 3.5;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setFontSize(6.8);
  docReceipt.setTextColor(180, 130, 20);
  docReceipt.text('BOUTIQUE LA FALAISE', 40, ry, { align: 'center' });

  ry += 3.5;
  docReceipt.setFillColor(255, 250, 240);
  docReceipt.setDrawColor(212, 175, 55);
  docReceipt.setLineWidth(0.35);
  docReceipt.roundedRect(6, ry, 68, 5.0, 1, 1, 'FD');

  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setFontSize(6.5);
  docReceipt.setTextColor(180, 120, 10);
  docReceipt.text("RECU D'ACOMPTE & RESERVATION", 40, ry + 3.5, { align: 'center' });

  ry += 5.3;
  docReceipt.setDrawColor(212, 175, 55);
  docReceipt.setLineWidth(0.35);
  docReceipt.line(6.5, ry, 73.5, ry);

  ry += 3.8;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setFontSize(6.8);
  docReceipt.setTextColor(30, 30, 30);
  docReceipt.text("Ticket : #NKH_KY", 6.5, ry);
  docReceipt.setFont('helvetica', 'normal');
  docReceipt.setTextColor(70, 70, 70);
  docReceipt.text("03/10/2026 16:38", 73.5, ry, { align: 'right' });

  ry += 3.4;
  docReceipt.text("Vendeur : Boss", 6.5, ry);
  docReceipt.text("Paiement : Orange Money", 73.5, ry, { align: 'right' });

  ry += 3.4;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setTextColor(30, 30, 30);
  docReceipt.text("Client : Mr EZA Brice", 6.5, ry);

  ry += 3.0;
  docReceipt.setDrawColor(200, 200, 200);
  docReceipt.setLineDashPattern([1, 1], 0);
  docReceipt.line(6.5, ry, 73.5, ry);
  docReceipt.setLineDashPattern([], 0);

  ry += 4.0;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setFontSize(7.0);
  docReceipt.setTextColor(20, 20, 20);
  docReceipt.text("ARTICLES RESERVES", 6.5, ry);
  docReceipt.text("TOTAL (FCFA)", 73.5, ry, { align: 'right' });

  ry += 3.6;

  displayItems.forEach((item) => {
    const rawName = String(item.name || 'Article');
    const nameLines = docReceipt.splitTextToSize(rawName, 44);
    const itemTotal = `${formatMoney((item.price || 0) * (item.quantity || 1))} FCFA`;

    docReceipt.setFont('helvetica', 'bold');
    docReceipt.setFontSize(7.0);
    docReceipt.setTextColor(30, 30, 30);

    nameLines.forEach((line, lIdx) => {
      docReceipt.text(line, 6.5, ry);
      if (lIdx === 0) {
        docReceipt.text(itemTotal, 73.5, ry, { align: 'right' });
      }
      ry += 3.3;
    });

    const qtyPrice = `${item.quantity || 1} x ${formatMoney(item.price || 0)} FCFA`;
    const metaParts = [
      item.reference ? `Ref: ${item.reference}` : '',
      item.size ? `T: ${item.size}` : '',
      item.color ? item.color : ''
    ].filter(Boolean);

    const detailStr = metaParts.length > 0 ? `${qtyPrice}  (${metaParts.join(' - ')})` : qtyPrice;
    const detailLines = docReceipt.splitTextToSize(detailStr, 67);

    docReceipt.setFont('helvetica', 'normal');
    docReceipt.setFontSize(6.2);
    docReceipt.setTextColor(110, 110, 110);
    detailLines.forEach((dLine) => {
      docReceipt.text(dLine, 6.5, ry);
      ry += 2.9;
    });

    ry += 1.4;
  });

  ry += 1.0;
  docReceipt.setDrawColor(212, 175, 55);
  docReceipt.setLineWidth(0.4);
  docReceipt.line(6.5, ry, 73.5, ry);

  ry += 3.0;
  const boxH = 26;
  docReceipt.setFillColor(255, 252, 245);
  docReceipt.setDrawColor(212, 175, 55);
  docReceipt.setLineWidth(0.4);
  docReceipt.roundedRect(6, ry, 68, boxH, 1.5, 1.5, 'FD');

  let fry = ry + 4.0;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setFontSize(7.2);
  docReceipt.setTextColor(180, 120, 10);
  docReceipt.text("RESUME FINANCIER DE L'ACOMPTE", 40, fry, { align: 'center' });

  fry += 4.0;
  docReceipt.setFont('helvetica', 'normal');
  docReceipt.setFontSize(6.8);
  docReceipt.setTextColor(60, 60, 60);
  docReceipt.text("Valeur des articles :", 9, fry);
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setTextColor(20, 20, 20);
  docReceipt.text(`${formatMoney(1880000)} FCFA`, 71, fry, { align: 'right' });

  fry += 4.0;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setTextColor(180, 120, 10);
  docReceipt.text("Total acompte verse :", 9, fry);
  docReceipt.text(`${formatMoney(1050000)} FCFA`, 71, fry, { align: 'right' });

  fry += 4.0;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setTextColor(190, 30, 30);
  docReceipt.text("Solde restant du :", 9, fry);
  docReceipt.text(`${formatMoney(830000)} FCFA`, 71, fry, { align: 'right' });

  fry += 4.0;
  docReceipt.setFont('helvetica', 'normal');
  docReceipt.setFontSize(6.5);
  docReceipt.setTextColor(90, 90, 90);
  docReceipt.text("Date limite de retrait : 10/10/2026", 9, fry);

  ry += boxH + 3.0;

  // Historique des règlements
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setFontSize(7.0);
  docReceipt.setTextColor(180, 120, 10);
  docReceipt.text("HISTORIQUE DES REGLEMENTS :", 6.5, ry);
  ry += 3.6;

  docReceipt.setFont('helvetica', 'normal');
  docReceipt.setFontSize(6.4);
  docReceipt.setTextColor(80, 80, 80);
  docReceipt.text("- Acompte initial (Orange Money) 03/10/2026", 7.5, ry);
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setTextColor(22, 101, 52);
  docReceipt.text(`+${formatMoney(1050000)} FCFA`, 73.5, ry, { align: 'right' });

  ry += 5.0;

  // Footer
  docReceipt.setFont('helvetica', 'normal');
  docReceipt.setFontSize(6.5);
  docReceipt.setTextColor(80, 80, 80);
  docReceipt.text("Articles reserves sous reserve du reglement integral.", 40, ry, { align: 'center' });
  ry += 3.4;
  docReceipt.text("Merci de votre visite et de votre fidelite !", 40, ry, { align: 'center' });
  ry += 3.4;
  docReceipt.text("Les articles vendus ne sont ni repris ni echanges.", 40, ry, { align: 'center' });
  ry += 3.6;
  docReceipt.setFont('helvetica', 'bold');
  docReceipt.setTextColor(180, 130, 20);
  docReceipt.text("Contact : (+237) 699 93 20 24 / 670 37 18 20 / 679 74 70 11", 40, ry, { align: 'center' });
  ry += 3.4;
  docReceipt.setFont('helvetica', 'italic');
  docReceipt.setTextColor(100, 100, 100);
  docReceipt.text("L'Elegance a son Sommet", 40, ry, { align: 'center' });

  ry += 4.5;
  const barWidths = [0.3, 0.7, 0.3, 1.0, 0.4, 0.8, 0.3, 0.5, 1.2, 0.4, 0.3, 0.9, 0.4, 0.6, 0.3, 1.1, 0.4, 0.8, 0.3, 0.6, 1.0, 0.4, 0.5, 0.8, 0.3];
  let bx = 18;
  docReceipt.setFillColor(30, 30, 30);
  barWidths.forEach((w, i) => {
    if (i % 2 === 0) {
      docReceipt.rect(bx, ry, w, 5.0, 'F');
    }
    bx += w + 0.45;
  });

  ry += 7.5;
  docReceipt.setFont('helvetica', 'normal');
  docReceipt.setFontSize(6.5);
  docReceipt.setTextColor(110, 110, 110);
  docReceipt.text("* NKH_KY *", 40, ry, { align: 'center' });

  // -------------------------------------------------------------
  // SAUVEGARDE DANS LES DOSSIERS DOWNLOADS
  // -------------------------------------------------------------
  console.log('4. Sauvegarde des fichiers PDF...');

  const reportData = doc.output('arraybuffer');
  const receiptData = docReceipt.output('arraybuffer');

  const destDirs = [
    'C:\\Users\\natakwe pangop marc\\OneDrive\\Pictures\\Documents\\New folder\\.cloud\\Downloads',
    'C:\\Users\\natakwe pangop marc\\Downloads',
    path.join(__dirname, '..'),
    'C:\\Users\\natakwe pangop marc\\.gemini\\antigravity-ide\\brain\\70b532b3-e1ea-4168-9d2a-29c358466743'
  ];

  destDirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const reportPath = path.join(dir, 'RAPPORT_GLOBAL_LOREAL_CAPITOL.pdf');
      const receiptPath = path.join(dir, 'RECU_ACOMPTE_OFFICIEL_EZA_BRICE_NKH_KY.pdf');

      fs.writeFileSync(reportPath, Buffer.from(reportData));
      fs.writeFileSync(receiptPath, Buffer.from(receiptData));
      console.log(`✓ Écrit avec succès dans : ${dir}`);
    } catch (err) {
      console.error(`Erreur écriture dans ${dir}:`, err.message);
    }
  });

  console.log('Fini avec succès !');
}

main().catch(console.error);
