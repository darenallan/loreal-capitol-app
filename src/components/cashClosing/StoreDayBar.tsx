import React from 'react';
import { Text, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { IconButton, PressableScale, Segmented } from '../../ui';
import { CASH_STORE_LABELS, CashClosingStore } from '../../db/services/cashClosing';
import { todayKey, ymdLocal } from '../../utils/saleMath';
import { useCashStyles } from './styles';

/** Décale un 'YYYY-MM-DD' (jour local) de `delta` jours. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + delta);
  return ymdLocal(dt);
}

export function formatDayLong(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (isNaN(dt.getTime())) return day;
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

type Props = {
  stores: CashClosingStore[];
  store: CashClosingStore;
  onStoreChange: (s: CashClosingStore) => void;
  day: string;
  onDayChange: (d: string) => void;
  minDay: string;
};

/** Sélecteur boutique (si plusieurs) + navigation jour précédent / suivant / aujourd'hui. */
export default function StoreDayBar({ stores, store, onStoreChange, day, onDayChange, minDay }: Props) {
  const { s, c } = useCashStyles();
  const today = todayKey();
  const prev = shiftDay(day, -1);
  const next = shiftDay(day, 1);
  const canPrev = prev >= minDay;
  const canNext = next <= today;
  const isToday = day === today;

  return (
    <View style={{ gap: 12 }}>
      {stores.length > 1 ? (
        <Segmented<CashClosingStore>
          options={stores.map(id => ({ id, label: CASH_STORE_LABELS[id] }))}
          value={store}
          onChange={onStoreChange}
        />
      ) : null}

      <View style={s.row}>
        <IconButton
          icon={<ChevronLeft color={canPrev ? c.textPrimary : c.textDim} size={20} />}
          onPress={canPrev ? () => onDayChange(prev) : undefined}
          accessibilityLabel="Jour précédent"
        />
        <View style={s.dayPill} accessibilityRole="text">
          <CalendarDays color={c.gold} size={16} />
          <Text numberOfLines={1} style={s.dayText}>
            {isToday ? "Aujourd'hui" : formatDayLong(day)}
          </Text>
        </View>
        <IconButton
          icon={<ChevronRight color={canNext ? c.textPrimary : c.textDim} size={20} />}
          onPress={canNext ? () => onDayChange(next) : undefined}
          accessibilityLabel="Jour suivant"
        />
      </View>

      {!isToday ? (
        <PressableScale
          onPress={() => onDayChange(today)}
          style={[s.chip, { alignSelf: 'center' }]}
          hoverLift={0}
          accessibilityRole="button"
          accessibilityLabel="Revenir à aujourd'hui"
        >
          <Text style={s.chipText}>Revenir à aujourd'hui</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
