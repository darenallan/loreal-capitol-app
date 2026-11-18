import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale, colors, fonts, radius } from '../../ui';

export interface StoreFilterControlsProps {
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  selectedStore: any;
  setSelectedStore: React.Dispatch<any>;
  setPeriodOffset: React.Dispatch<React.SetStateAction<number>>;
  filterLabels: Record<string, string>;
}

const STORES = [
  { id: 'falaise', label: 'La Falaise' },
  { id: 'tougou', label: 'Tougou' },
  { id: 'all', label: 'Vue Globale' },
];
const PERIODS = ['today', 'yesterday', 'week', 'month', 'year'];

/** Sélecteurs boutique et période (Boss) — deux contrôles segmentés sur une même ligne. */
export default function StoreFilterControls({
  filter,
  setFilter,
  selectedStore,
  setSelectedStore,
  setPeriodOffset,
  filterLabels,
}: StoreFilterControlsProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.segment} accessibilityRole="tablist">
        {STORES.map((s) => {
          const active = selectedStore === s.id;
          return (
            <PressableScale
              key={s.id}
              style={[styles.seg, active && styles.segActive]}
              onPress={() => setSelectedStore(s.id)}
              haptic="selection"
              scaleTo={0.97}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{s.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.segment} accessibilityRole="tablist">
        {PERIODS.map((f) => {
          const active = filter === f;
          return (
            <PressableScale
              key={f}
              style={[styles.seg, active && styles.segActive]}
              onPress={() => {
                setFilter(f);
                setPeriodOffset(0);
              }}
              haptic="selection"
              scaleTo={0.97}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{filterLabels[f]}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 3,
    gap: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seg: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent' },
  segActive: { backgroundColor: colors.goldSoft, borderColor: colors.borderGold },
  segText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  segTextActive: { fontFamily: fonts.bold, color: colors.goldLight },
});
