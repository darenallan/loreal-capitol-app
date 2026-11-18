import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { GlassCard, PressableScale, colors, fonts, radius, type } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface PeriodNavigatorProps {
  filter: string;
  periodOffset: number;
  setPeriodOffset: React.Dispatch<React.SetStateAction<number>>;
  periodTitle: string;
  filterLabels: Record<string, string>;
}

/** Navigation temporelle Précédent / Suivant (Boss). */
export default function PeriodNavigator({
  filter,
  periodOffset,
  setPeriodOffset,
  periodTitle,
  filterLabels,
}: PeriodNavigatorProps) {
  const { colors } = useAppTheme();
  return (
    <GlassCard style={styles.periodBar} padded={false}>
      <PressableScale
        style={styles.periodBtn}
        onPress={() => setPeriodOffset((p) => p - 1)}
        haptic="selection"
      >
        <ChevronLeft color={colors.goldLight} size={18} />
        <Text style={styles.periodBtnText}>Précédent</Text>
      </PressableScale>

      <View style={styles.periodCenter}>
        <Text style={styles.periodTitle}>{periodTitle || filterLabels[filter]}</Text>
        {periodOffset !== 0 && (
          <PressableScale onPress={() => setPeriodOffset(0)} haptic="light">
            <Text style={styles.periodReset}>Revenir à aujourd'hui ↺</Text>
          </PressableScale>
        )}
      </View>

      <PressableScale
        style={styles.periodBtn}
        onPress={() => setPeriodOffset((p) => p + 1)}
        haptic="selection"
      >
        <Text style={styles.periodBtnText}>Suivant</Text>
        <ChevronRight color={colors.goldLight} size={18} />
      </PressableScale>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  periodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8 },
  periodBtnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.goldLight },
  periodCenter: { alignItems: 'center', flex: 1 },
  periodTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  periodReset: { ...type.caption, fontSize: 10.5, color: colors.gold, marginTop: 2 },
});
