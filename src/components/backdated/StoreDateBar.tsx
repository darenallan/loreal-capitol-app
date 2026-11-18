import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, fonts, radius } from '../../theme';
import { GlassCard, IconButton, PressableScale, Segmented } from '../../ui';
import MonthGrid from './MonthGrid';
import { MONTH_NAMES_FR, StoreChoice, addDaysYMD, formatYMDLong, parseYMD } from '../../utils/backdatedHelpers';

type Props = {
  store: StoreChoice;
  onStoreChange: (s: StoreChoice) => void;
  /** Autorise « Toutes » (consultation uniquement) */
  allowAll: boolean;
  date: string;
  onDateChange: (ymd: string) => void;
  minDate: string;
  maxDate: string;
  /** Masque la ligne date (ex. vue Mois) */
  hideDate?: boolean;
};

/** Barre boutique + date : flèches jour -/+ et calendrier déroulant. */
export default function StoreDateBar({ store, onStoreChange, allowAll, date, onDateChange, minDate, maxDate, hideDate }: Props) {
  const [open, setOpen] = useState(false);
  const d = parseYMD(date);
  const [cursor, setCursor] = useState({ year: d.getFullYear(), month: d.getMonth() + 1 });

  useEffect(() => {
    const nd = parseYMD(date);
    setCursor({ year: nd.getFullYear(), month: nd.getMonth() + 1 });
  }, [date]);

  const options = [
    { id: 'falaise' as StoreChoice, label: 'La Falaise' },
    { id: 'tougou' as StoreChoice, label: 'Tougou' },
    ...(allowAll ? [{ id: 'all' as StoreChoice, label: 'Toutes' }] : []),
  ];

  const prev = addDaysYMD(date, -1);
  const next = addDaysYMD(date, 1);
  const canPrev = prev >= minDate;
  const canNext = next <= maxDate;

  const shiftMonth = (delta: number) => {
    setCursor(c => {
      let m = c.month + delta;
      let y = c.year;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      return { year: y, month: m };
    });
  };
  const cursorKey = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`;
  const canPrevMonth = cursorKey > minDate.slice(0, 7);
  const canNextMonth = cursorKey < maxDate.slice(0, 7);

  return (
    <View style={styles.wrap}>
      <Segmented<StoreChoice> options={options} value={store} onChange={onStoreChange} compact />

      {!hideDate && (
        <View style={styles.dateRow}>
          <IconButton
            icon={<ChevronLeft color={canPrev ? colors.textPrimary : colors.textDim} size={20} />}
            onPress={canPrev ? () => onDateChange(prev) : undefined}
            accessibilityLabel="Jour précédent"
            size={42}
          />
          <PressableScale
            style={styles.dateBtn}
            onPress={() => setOpen(o => !o)}
            haptic="selection"
            hoverLift={0}
            accessibilityRole="button"
            accessibilityLabel="Choisir une date"
          >
            <CalendarDays color={colors.gold} size={16} />
            <Text numberOfLines={1} style={styles.dateText}>{formatYMDLong(date)}</Text>
          </PressableScale>
          <IconButton
            icon={<ChevronRight color={canNext ? colors.textPrimary : colors.textDim} size={20} />}
            onPress={canNext ? () => onDateChange(next) : undefined}
            accessibilityLabel="Jour suivant"
            size={42}
          />
        </View>
      )}

      {!hideDate && open && (
        <GlassCard style={styles.picker} padded={false}>
          <View style={styles.pickerHead}>
            <IconButton
              icon={<ChevronLeft color={canPrevMonth ? colors.textPrimary : colors.textDim} size={18} />}
              onPress={canPrevMonth ? () => shiftMonth(-1) : undefined}
              accessibilityLabel="Mois précédent"
              size={36}
            />
            <Text style={styles.pickerTitle}>{MONTH_NAMES_FR[cursor.month - 1]} {cursor.year}</Text>
            <IconButton
              icon={<ChevronRight color={canNextMonth ? colors.textPrimary : colors.textDim} size={18} />}
              onPress={canNextMonth ? () => shiftMonth(1) : undefined}
              accessibilityLabel="Mois suivant"
              size={36}
            />
          </View>
          <MonthGrid
            year={cursor.year}
            month={cursor.month}
            selected={date}
            minDate={minDate}
            maxDate={maxDate}
            compact
            onSelect={(ymd) => { onDateChange(ymd); setOpen(false); }}
          />
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: {
    flex: 1,
    minWidth: 0,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.goldSofter,
  },
  dateText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, textTransform: 'capitalize' },
  picker: { padding: 12 },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  pickerTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textPrimary },
});
