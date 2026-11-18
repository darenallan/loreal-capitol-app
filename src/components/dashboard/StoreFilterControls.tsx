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

/** Sélecteurs boutique et période (Boss). */
export default function StoreFilterControls({
  filter,
  setFilter,
  selectedStore,
  setSelectedStore,
  setPeriodOffset,
  filterLabels,
}: StoreFilterControlsProps) {
  return (
    <View style={styles.controlsBar}>
      <View style={styles.storeSelectorWrap}>
        {[
          { id: 'falaise', label: 'La Falaise' },
          { id: 'tougou', label: 'Tougou' },
          { id: 'all', label: 'Vue Globale' },
        ].map((s) => {
          const active = selectedStore === s.id;
          return (
            <PressableScale
              key={s.id}
              style={[styles.storePill, active && styles.storePillActive]}
              onPress={() => setSelectedStore(s.id)}
              haptic="selection"
              scaleTo={0.96}
            >
              <Text style={[styles.storePillText, active && styles.storePillTextActive]}>
                {s.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.filterPillsWrap}>
        {['today', 'yesterday', 'week', 'month', 'year'].map((f) => {
          const active = filter === f;
          return (
            <PressableScale
              key={f}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => {
                setFilter(f);
                setPeriodOffset(0);
              }}
              haptic="selection"
              scaleTo={0.96}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {filterLabels[f]}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsBar: { gap: 12, marginVertical: 4 },
  storeSelectorWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  storePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storePillActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  storePillText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textMuted },
  storePillTextActive: { fontFamily: fonts.bold, color: colors.gold },
  filterPillsWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.gold, borderColor: colors.goldLight },
  filterPillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  filterPillTextActive: { fontFamily: fonts.bold, color: colors.onGold },
});
