/**
 * Source unique de vérité pour :
 *  - le « total effectif » d'une vente (avance initiale = montant versé, sinon total),
 *  - le jour calendaire d'une vente (en heure LOCALE de l'appareil, pas en UTC).
 *
 * Pourquoi le jour local : les ventes sont stockées en ISO UTC (toISOString). Comparer
 * `date.startsWith('YYYY-MM-DD')` utilise le jour UTC — au Cameroun (UTC+1) une vente faite
 * entre 00h00 et 01h00 était comptée la veille. localDayKey() corrige ce décalage.
 */

/** Une vente est une « avance initiale » si elle crée l'acompte (pas une tranche ultérieure). */
export function isAdvanceInitial(sale: any): boolean {
  return (
    !!sale &&
    sale.is_advance === 1 &&
    !sale.is_advance_installment &&
    !!sale.advanceData &&
    sale.advanceData.amountPaid !== undefined
  );
}

/** Toute vente liée à un acompte (initiale, tranche, ou marquée « Avance »). */
export function isAnyAdvance(sale: any): boolean {
  return (
    !!sale &&
    (sale.is_advance === 1 ||
      sale.is_advance_installment === 1 ||
      !!sale.advanceData ||
      sale.payment_method === 'Avance')
  );
}

/** Montant réellement encaissé pour cette vente. */
export function getEffectiveTotal(sale: any): number {
  if (!sale) return 0;
  return isAdvanceInitial(sale)
    ? Number(sale.advanceData.amountPaid) || 0
    : Number(sale.total) || 0;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' du jour LOCAL d'une Date. */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM-DD' du jour local d'une date ISO (ou Date). '' si invalide. */
export function localDayKey(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return ymdLocal(d);
}

/** Jour local d'aujourd'hui, décalé de `offsetDays`. */
export function todayKey(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return ymdLocal(d);
}

/** La vente tombe-t-elle sur ce jour local ('YYYY-MM-DD') ? */
export function isOnLocalDay(saleDate: string | null | undefined, ymd: string): boolean {
  return !!saleDate && typeof saleDate === 'string' && localDayKey(saleDate) === ymd;
}

/** Normalise le code boutique ('falaise' par défaut, comme le code historique). */
export function normStore(store: any): string {
  return String(store || 'falaise').trim().toLowerCase();
}

/** "Nom (xN), Nom (xN)" à partir d'items tableau ou chaîne. */
export function itemsSummary(items: any, fallback: string = ''): string {
  if (Array.isArray(items)) return items.map((i: any) => `${i.name} (x${i.quantity || 1})`).join(', ');
  return typeof items === 'string' && items ? items : fallback;
}
