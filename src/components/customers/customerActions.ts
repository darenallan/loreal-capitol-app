/**
 * Actions du fichier clients : message de relance, liens wa.me / tel:, export CSV, libellés.
 * Aucun appel réseau : les liens ne s'ouvrent que sur appui explicite de l'utilisateur.
 */
import { Linking, Platform } from 'react-native';
import { formatMoney } from '../../theme';
import { openExternalUrl } from '../../utils/receiptShare';
import { downloadCSV } from '../../utils/exportHelpers';
import { todayKey } from '../../utils/saleMath';
import type { Customer, CustomerAdvance } from '../../db/services/customers';
import { formatCustomerPhone } from '../../db/services/customers';

export function storeName(store: string): string {
  return store === 'tougou' ? 'Tougou' : 'La Falaise';
}

/** 'YYYY-MM-DD' → '18/11/2026'. */
export function dayLabel(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return '—';
  const [y, m, d] = ymd.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Libellé lisible de l'échéance d'un acompte. */
export function dueLabel(a: CustomerAdvance): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (a.daysUntilDue === null) return { label: 'Échéance non définie', tone: 'neutral' };
  if (a.isOverdue) {
    const n = -a.daysUntilDue;
    return { label: `En retard de ${n} jour${n > 1 ? 's' : ''} (échéance ${dayLabel(a.dueDay)})`, tone: 'danger' };
  }
  if (a.daysUntilDue === 0) return { label: "Échéance aujourd'hui", tone: 'warning' };
  if (a.daysUntilDue <= 3) return { label: `Échéance dans ${a.daysUntilDue} jour${a.daysUntilDue > 1 ? 's' : ''} (${dayLabel(a.dueDay)})`, tone: 'warning' };
  return { label: `Échéance le ${dayLabel(a.dueDay)}`, tone: 'neutral' };
}

const CIVILITY = /^(m|mr|mme|mlle|melle|monsieur|madame|mademoiselle|dr|docteur|maitre|me)\b\.?/i;

/** Formule d'appel polie : « Bonjour M./Mme Nom, » sauf si une civilité est déjà saisie. */
function salutation(name: string): string {
  const n = (name || '').trim();
  if (!n) return 'Bonjour,';
  return CIVILITY.test(n) ? `Bonjour ${n},` : `Bonjour M./Mme ${n},`;
}

/** Message de relance WhatsApp pré-rempli (français, poli). */
export function buildReminderMessage(customerName: string, a: CustomerAdvance, today: string = todayKey()): string {
  const boutique = `L'Oréal Capitol — ${storeName(a.store)}`;
  const reste = `${formatMoney(a.amountRemaining)} FCFA`;
  let echeance = '';
  if (a.dueDay) {
    if (a.dueDay < today) echeance = `L'échéance convenue était le ${dayLabel(a.dueDay)}.`;
    else if (a.dueDay === today) echeance = `L'échéance convenue est aujourd'hui (${dayLabel(a.dueDay)}).`;
    else echeance = `L'échéance convenue est le ${dayLabel(a.dueDay)}.`;
  }
  return [
    salutation(customerName || a.clientName),
    '',
    `Nous espérons que vous allez bien. Nous vous rappelons gentiment qu'il reste *${reste}* à régler sur votre réservation : ${a.itemsLabel}.`,
    echeance,
    '',
    'Vous pouvez passer en boutique pour finaliser le règlement et récupérer votre article. N\'hésitez pas à nous répondre ici pour toute question.',
    '',
    'Merci pour votre confiance et votre fidélité !',
    boutique,
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

/** wa.me/<numéro>?text=… (numéro normalisé 237…). */
export function buildWaMeUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppReminder(phone: string, customerName: string, a: CustomerAdvance): boolean {
  if (!phone) return false;
  return openExternalUrl(buildWaMeUrl(phone, buildReminderMessage(customerName, a)));
}

export function callCustomer(phone: string): boolean {
  if (!phone) return false;
  const url = `tel:+${phone}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = url;
    return true;
  }
  Linking.openURL(url).catch(() => {});
  return true;
}

export const NO_PHONE_HINT = 'Aucun numéro de téléphone valide enregistré pour ce client : relance WhatsApp et appel indisponibles.';

/** Export CSV (Boss) — web uniquement (downloadCSV). Renvoie false hors web. */
export function exportCustomersCSV(list: Customer[], scopeLabel: string): boolean {
  if (Platform.OS !== 'web') return false;
  const headers = [
    'Nom', 'Téléphone', 'E-mail', 'Boutiques', "Nb d'achats", 'Total dépensé (FCFA)', 'Panier moyen (FCFA)',
    'Première visite', 'Dernière visite', 'Acomptes en cours', 'Reste dû (FCFA)', 'En retard', 'Prochaine échéance',
  ];
  const rows = list.map(c => [
    c.name,
    c.hasPhone ? formatCustomerPhone(c.phone) : (c.rawInvalidPhone ? `${c.rawInvalidPhone} (invalide)` : 'Sans téléphone'),
    c.email,
    c.stores.map(storeName).join(' / '),
    c.purchaseCount,
    c.totalSpent,
    c.avgBasket,
    dayLabel(c.firstVisit),
    dayLabel(c.lastVisit),
    c.openAdvances.length,
    c.remainingDue,
    c.hasOverdue ? 'Oui' : 'Non',
    c.nextDueDay ? dayLabel(c.nextDueDay) : '',
  ]);
  downloadCSV(`Fichier_Clients_${scopeLabel}_${todayKey()}.csv`, headers, rows);
  return true;
}
