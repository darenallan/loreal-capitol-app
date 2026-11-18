/**
 * Utilitaires de l'écran « Historique & Saisie antérieure » (réservé Super Boss).
 * Toutes les dates « jour » sont au format YYYY-MM-DD.
 */
import type { HistorySale } from '../db/database';
import { localDayKey, ymdLocal } from './saleMath';

export type StoreChoice = 'falaise' | 'tougou' | 'all';
export type EntryStore = 'falaise' | 'tougou';

/** Moyens de paiement comptés par les cartes du Dashboard, puis variantes de la caisse. Jamais « Avance ». */
export const BACKDATED_METHODS: string[] = ['Espèces', 'MoMo', 'OM', 'Carte Bancaire', 'MoMo Boss', 'OM Boss'];

/** Plancher de saisie / consultation : 2 ans. */
export const BACKDATED_FLOOR_YEARS = 2;

export const MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Jour local YYYY-MM-DD d'une date. */
export function toLocalYMD(d: Date): string {
  return ymdLocal(d);
}

/** Date locale (minuit) à partir d'un YYYY-MM-DD. */
export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** ISO du jour choisi à midi heure locale (stable pour localDayKey). */
export function middayLocalISO(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function todayYMD(): string {
  return toLocalYMD(new Date());
}

export function yesterdayYMD(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalYMD(d);
}

export function floorYMD(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - BACKDATED_FLOOR_YEARS);
  return toLocalYMD(d);
}

/** Strictement avant aujourd'hui (local) et pas plus ancien que le plancher. */
export function isStrictlyPast(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return false;
  return ymd < todayYMD() && ymd >= floorYMD();
}

export function addDaysYMD(ymd: string, delta: number): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + delta);
  return toLocalYMD(d);
}

/** Bornes d'un mois (month 1-12). */
export function monthRange(year: number, month: number): { start: string; end: string; daysInMonth: number } {
  const daysInMonth = new Date(year, month, 0).getDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(daysInMonth)}`, daysInMonth };
}

export function isSundayYMD(ymd: string): boolean {
  return parseYMD(ymd).getDay() === 0;
}

export function formatYMDLong(ymd: string): string {
  try {
    return parseYMD(ymd).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return ymd;
  }
}

export function formatYMDShort(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

export function storeLabel(store: string): string {
  const s = (store || '').toLowerCase();
  return s === 'tougou' ? 'Tougou' : s === 'all' ? 'Toutes' : 'La Falaise';
}

export function summarizeSales(list: HistorySale[]): { total: number; count: number; byMethod: Record<string, number> } {
  const byMethod: Record<string, number> = {};
  let total = 0;
  for (const s of list) {
    const t = Number(s.total) || 0;
    total += t;
    const k = s.payment_method || 'Non précisé';
    byMethod[k] = (byMethod[k] || 0) + t;
  }
  return { total, count: list.length, byMethod };
}

export function groupByDay(list: HistorySale[]): Record<string, HistorySale[]> {
  const out: Record<string, HistorySale[]> = {};
  for (const s of list) {
    const k = s.day || localDayKey(s.date);
    (out[k] = out[k] || []).push(s);
  }
  return out;
}
