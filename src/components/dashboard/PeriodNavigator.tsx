import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
import { PressableScale, colors, fonts, radius } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface PeriodNavigatorProps {
  filter: string;
  periodOffset: number;
  setPeriodOffset: React.Dispatch<React.SetStateAction<number>>;
  periodTitle: string;
  filterLabels: Record<string, string>;
}

/** Navigation temporelle compacte (Boss) : ‹ période ›, retour au présent si décalé. */
export default function PeriodNavigator({
  filter,
  periodOffset,
  setPeriodOffset,
  periodTitle,
  filterLabels,
}: PeriodNavigatorProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <PressableScale
        style={styles.arrow}
        onPress={() => setPeriodOffset((p) => p - 1)}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Période précédente"
      >
        <ChevronLeft color={colors.goldLight} size={18} />
      </PressableScale>

      <Text style={styles.title} numberOfLines={1}>{periodTitle || filterLabels[filter]}</Text>

      <PressableScale
        style={styles.arrow}
        onPress={() => setPeriodOffset((p) => p + 1)}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Période suivante"
      >
        <ChevronRight color={colors.goldLight} size={18} />
      </PressableScale>

      {periodOffset !== 0 && (
        <PressableScale
          style={styles.reset}
          onPress={() => setPeriodOffset(0)}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Revenir à aujourd'hui"
        >
          <RotateCcw color={colors.gold} size={13} />
          <Text style={styles.resetText}>Aujourd'hui</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.text, flexShrink: 1, minWidth: 0 },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto' as any,
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  resetText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.gold },
});
