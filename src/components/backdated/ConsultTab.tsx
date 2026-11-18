import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { CalendarSearch, ChevronLeft, ChevronRight, Download } from 'lucide-react-native';
import { colors, fonts } from '../../theme';
import { EmptyState, FadeIn, GlassCard, GoldButton, IconButton, Segmented } from '../../ui';
import { deleteBackdatedSale, getSalesByDateRange, HistorySale } from '../../db/database';
import { exportHistoryCSV } from '../../utils/exportHelpers';
import {
  MONTH_NAMES_FR, StoreChoice, formatYMDLong, groupByDay, monthRange, parseYMD, storeLabel, summarizeSales,
} from '../../utils/backdatedHelpers';
import StoreDateBar from './StoreDateBar';
import DaySummary from './DaySummary';
import SaleRow from './SaleRow';
import MonthGrid from './MonthGrid';
import ConfirmDeleteModal from './ConfirmDeleteModal';

type Props = {
  user: any;
  store: StoreChoice;
  onStoreChange: (s: StoreChoice) => void;
  date: string;
  onDateChange: (ymd: string) => void;
  minDate: string;
  maxDate: string;
  monthCursor: { year: number; month: number };
  onMonthCursorChange: (c: { year: number; month: number }) => void;
  refreshKey: number;
  onChanged: () => void;
};

type View_ = 'day' | 'month';

/** Onglet « Consulter » : vue Jour (liste) ou Mois (calendrier des totaux). */
export default function ConsultTab({
  user, store, onStoreChange, date, onDateChange, minDate, maxDate, monthCursor, onMonthCursorChange, refreshKey, onChanged,
}: Props) {
  const [view, setView] = useState<View_>('day');
  const [list, setList] = useState<HistorySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<HistorySale | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const reqId = useRef(0);

  const range = monthRange(monthCursor.year, monthCursor.month);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    getSalesByDateRange(range.start, range.end, store)
      .then(res => { if (id === reqId.current) setList(res); })
      .catch(() => { if (id === reqId.current) setList([]); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [store, range.start, range.end, refreshKey]);

  const byDay = useMemo(() => groupByDay(list), [list]);
  const dayList = byDay[date] || [];
  const totalsByDay = useMemo(() => {
    const out: Record<string, number> = {};
    Object.keys(byDay).forEach(k => { out[k] = summarizeSales(byDay[k]).total; });
    return out;
  }, [byDay]);

  const current = view === 'day' ? dayList : list;
  const summary = useMemo(() => summarizeSales(current), [current]);
  const backdatedCount = current.filter(s => s.backdated).length;

  const monthKey = `${monthCursor.year}-${String(monthCursor.month).padStart(2, '0')}`;
  const canPrevMonth = monthKey > minDate.slice(0, 7);
  const canNextMonth = monthKey < maxDate.slice(0, 7);
  const shiftMonth = (delta: number) => {
    let m = monthCursor.month + delta;
    let y = monthCursor.year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    onMonthCursorChange({ year: y, month: m });
  };

  const changeView = (v: View_) => {
    if (v === 'day') {
      // La liste chargée suit le mois du curseur : on le recale sur le jour sélectionné.
      const d = parseYMD(date);
      if (d.getFullYear() !== monthCursor.year || d.getMonth() + 1 !== monthCursor.month) {
        onMonthCursorChange({ year: d.getFullYear(), month: d.getMonth() + 1 });
      }
    }
    setView(v);
  };

  const handleExport = () => {
    const period = view === 'day' ? date : monthKey;
    if (Platform.OS !== 'web') {
      setInfo("L'export CSV est disponible sur la version web (navigateur).");
      return;
    }
    const n = exportHistoryCSV(current, period, store);
    setInfo(n > 0 ? `${n} ligne${n > 1 ? 's' : ''} exportée${n > 1 ? 's' : ''}.` : null);
  };

  const confirmDelete = async (reason: string) => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteBackdatedSale(toDelete.id, user, reason);
      setToDelete(null);
      setInfo(res.restoredItems.length > 0
        ? `Saisie supprimée. Stock restitué : ${res.restoredItems.join(', ')}.`
        : 'Saisie supprimée.');
      onChanged();
    } catch (e: any) {
      setDeleteError(e?.message || 'Suppression impossible.');
    } finally {
      setDeleting(false);
    }
  };

  const monthLabel = `${MONTH_NAMES_FR[monthCursor.month - 1]} ${monthCursor.year}`;

  return (
    <View style={styles.wrap}>
      <StoreDateBar
        store={store}
        onStoreChange={onStoreChange}
        allowAll
        date={date}
        onDateChange={onDateChange}
        minDate={minDate}
        maxDate={maxDate}
        hideDate={view === 'month'}
      />

      <View style={styles.toolbar}>
        <Segmented<View_>
          options={[{ id: 'day', label: 'Jour' }, { id: 'month', label: 'Mois' }]}
          value={view}
          onChange={changeView}
          compact
        />
        <GoldButton
          label="Export CSV"
          variant="outline"
          size="sm"
          icon={<Download color={colors.gold} size={15} />}
          onPress={handleExport}
          disabled={loading || current.length === 0}
        />
      </View>

      {info ? <Text style={styles.info}>{info}</Text> : null}

      {view === 'month' && (
        <View style={styles.monthHead}>
          <IconButton
            icon={<ChevronLeft color={canPrevMonth ? colors.textPrimary : colors.textDim} size={20} />}
            onPress={canPrevMonth ? () => shiftMonth(-1) : undefined}
            accessibilityLabel="Mois précédent"
            size={40}
          />
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <IconButton
            icon={<ChevronRight color={canNextMonth ? colors.textPrimary : colors.textDim} size={20} />}
            onPress={canNextMonth ? () => shiftMonth(1) : undefined}
            accessibilityLabel="Mois suivant"
            size={40}
          />
        </View>
      )}

      <DaySummary
        eyebrow={`${view === 'day' ? 'Recette du jour' : 'Recette du mois'} · ${storeLabel(store)}`}
        title={view === 'day' ? formatYMDLong(date) : monthLabel}
        total={summary.total}
        count={summary.count}
        byMethod={summary.byMethod}
        backdatedCount={backdatedCount}
        right={loading ? <ActivityIndicator color={colors.gold} /> : undefined}
      />

      {view === 'month' ? (
        <GlassCard style={styles.gridCard}>
          <MonthGrid
            year={monthCursor.year}
            month={monthCursor.month}
            totalsByDay={totalsByDay}
            selected={date}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={(ymd) => { onDateChange(ymd); setView('day'); }}
          />
          <Text style={styles.gridHint}>Touchez un jour pour voir le détail des ventes.</Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {!loading && dayList.length === 0 ? (
            <EmptyState
              icon={<CalendarSearch color={colors.gold} size={24} />}
              title="Aucune vente ce jour"
              subtitle="Utilisez l'onglet « Saisir » pour enregistrer une recette oubliée."
            />
          ) : (
            dayList.map((s, i) => (
              <FadeIn key={s.id} delay={Math.min(i, 8) * 40} distance={8}>
                <SaleRow sale={s} showStore={store === 'all'} onDelete={(sale) => { setDeleteError(null); setToDelete(sale); }} />
              </FadeIn>
            ))
          )}
        </View>
      )}

      <ConfirmDeleteModal
        sale={toDelete}
        loading={deleting}
        error={deleteError}
        onCancel={() => { if (!deleting) setToDelete(null); }}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  info: { fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthTitle: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.textPrimary },
  gridCard: { padding: 12 },
  gridHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  list: { gap: 10 },
});
