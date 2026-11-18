import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, formatMoney } from '../../theme';
import { PressableScale } from '../../ui';

type Props = {
  year: number;
  /** 1-12 */
  month: number;
  totalsByDay?: Record<string, number>;
  selected?: string | null;
  onSelect: (ymd: string) => void;
  /** Dernier jour sélectionnable (inclus), YYYY-MM-DD */
  maxDate?: string;
  /** Premier jour sélectionnable (inclus), YYYY-MM-DD */
  minDate?: string;
  compact?: boolean;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Montant abrégé pour les cases : 1,2M / 45k / 900 */
function shortMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return formatMoney(n);
}

/** Calendrier mensuel maison (lundi en premier), jours hors bornes grisés. */
export default function MonthGrid({ year, month, totalsByDay = {}, selected, onSelect, maxDate, minDate, compact }: Props) {
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // lundi = 0
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(`${year}-${pad(month)}-${pad(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map(w => (
          <Text key={w} style={[styles.weekday, w === 'Dim' && styles.sundayText]}>{w}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((ymd, ci) => {
            if (!ymd) return <View key={`e${ci}`} style={[styles.cell, compact && styles.cellCompact]} />;
            const disabled = (!!maxDate && ymd > maxDate) || (!!minDate && ymd < minDate);
            const isSel = ymd === selected;
            const total = totalsByDay[ymd] || 0;
            const isSunday = ci === 6;
            return (
              <PressableScale
                key={ymd}
                disabled={disabled}
                onPress={() => onSelect(ymd)}
                haptic="selection"
                hoverLift={0}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={`Jour ${parseInt(ymd.slice(8), 10)}${total > 0 ? `, ${formatMoney(total)} FCFA` : ''}`}
                accessibilityState={{ selected: isSel, disabled }}
                style={[
                  styles.cell,
                  compact && styles.cellCompact,
                  styles.dayCell,
                  total > 0 && styles.dayCellFilled,
                  isSel && styles.dayCellSelected,
                ]}
              >
                <Text style={[styles.dayNum, isSunday && styles.sundayText, isSel && styles.dayNumSelected]}>
                  {parseInt(ymd.slice(8), 10)}
                </Text>
                {!compact && total > 0 ? (
                  <Text numberOfLines={1} style={[styles.dayTotal, isSel && styles.dayNumSelected]}>{shortMoney(total)}</Text>
                ) : null}
                {compact && total > 0 ? <View style={[styles.dot, isSel && styles.dotSelected]} /> : null}
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textMuted,
    paddingVertical: 4,
  },
  sundayText: { color: colors.textDim },
  cell: { flex: 1, minHeight: 52, borderRadius: radius.sm },
  cellCompact: { minHeight: 38 },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 2,
  },
  dayCellFilled: { borderColor: colors.borderGold, backgroundColor: colors.goldSofter },
  dayCellSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  dayNum: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  dayNumSelected: { color: colors.onGold },
  dayTotal: { fontFamily: fonts.semibold, fontSize: 10, color: colors.gold, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.gold, marginTop: 3 },
  dotSelected: { backgroundColor: colors.onGold },
});
