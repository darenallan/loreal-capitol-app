import { View, Text, StyleSheet } from 'react-native';
import { GlassCard, fonts, colors, radius, type } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface SalesChartCardProps {
  chartData: { label: string; value: number; }[];
  insightText: string;
}

/** Graphique en barres d'analyse des ventes. */
export default function SalesChartCard({ chartData, insightText }: SalesChartCardProps) {
  const { colors } = useAppTheme();
  return (
    <GlassCard style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Analyse des Ventes</Text>
        {insightText ? <Text style={styles.insightText}>{insightText}</Text> : null}
      </View>
      <View style={styles.chartArea}>
        {(() => {
          const maxVal = Math.max(...chartData.map((d) => d.value), 1);
          return chartData.map((bar, i) => {
            const isTop = bar.value === maxVal && bar.value > 0;
            return (
              <View key={i} style={styles.barWrapper}>
                <Text style={styles.barValue}>
                  {bar.value > 0 ? (bar.value >= 1000 ? `${Math.round(bar.value / 1000)}k` : bar.value) : ''}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max((bar.value / maxVal) * 120, 6),
                      backgroundColor: isTop ? colors.gold : colors.surfaceStrong,
                      borderColor: isTop ? colors.goldLight : colors.border,
                    },
                  ]}
                />
                <Text style={[styles.barLabel, isTop && { color: colors.goldLight, fontFamily: fonts.bold }]}>
                  {bar.label}
                </Text>
              </View>
            );
          });
        })()}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  chartCard: { padding: 20, borderRadius: radius.xxl },
  chartHeader: { marginBottom: 16 },
  chartTitle: { ...type.title, color: colors.gold, marginBottom: 5 },
  insightText: { ...type.caption, color: colors.success, marginBottom: 15, fontStyle: 'italic' },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 160, paddingTop: 20 },
  barWrapper: { alignItems: 'center', flex: 1 },
  barValue: { color: colors.textSecondary, fontSize: 9, marginBottom: 4 },
  bar: { width: 16, borderRadius: 4, minWidth: 12 },
  barLabel: { color: colors.textMuted, fontSize: 10, marginTop: 6, textAlign: 'center' },
});
