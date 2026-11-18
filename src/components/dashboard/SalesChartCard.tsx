import { View, Text, StyleSheet } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { GlassCard, fonts, colors, radius, type } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';
import { alpha } from '../../theme';

export interface SalesChartCardProps {
  chartData: { label: string; value: number; }[];
  insightText: string;
}

const CHART_H = 150;
const fmtShort = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.0', '')}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

/** Graphique en barres : toutes les barres en or (la meilleure en plein), lignes de repère discrètes. */
export default function SalesChartCard({ chartData, insightText }: SalesChartCardProps) {
  const { colors } = useAppTheme();
  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const isBest = insightText.startsWith('Meilleure');
  // Beaucoup de barres (heures, jours du mois) : on n'affiche le montant que sur la meilleure.
  const dense = chartData.length > 8;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Analyse des ventes</Text>
        {insightText ? (
          <View style={styles.insight}>
            {isBest && <Trophy color={colors.gold} size={14} />}
            <Text style={styles.insightText}>{insightText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.plot}>
        {/* Lignes de repère : 100 %, 50 %, 0 */}
        {[0, 0.5, 1].map((p) => (
          <View key={p} style={[styles.gridLine, { bottom: 22 + p * CHART_H }]}>
            {p > 0 && <Text style={styles.gridLabel}>{fmtShort(Math.round(maxVal * p))}</Text>}
          </View>
        ))}

        <View style={styles.bars}>
          {chartData.map((bar, i) => {
            const isTop = bar.value === maxVal && bar.value > 0;
            const h = bar.value > 0 ? Math.max((bar.value / maxVal) * CHART_H, 4) : 2;
            return (
              <View key={i} style={styles.col}>
                <Text style={[styles.barValue, isTop && styles.barValueTop]}>
                  {bar.value > 0 && (!dense || isTop) ? fmtShort(bar.value) : ''}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: bar.value <= 0 ? colors.surfaceStrong : isTop ? colors.gold : alpha(colors.gold, 0.38),
                    },
                  ]}
                />
                {/* Graphique dense : une étiquette sur deux (+ la meilleure), jamais tronquée */}
                <Text style={[styles.barLabel, isTop && styles.barLabelTop]}>
                  {!dense || i % 2 === 0 || isTop ? bar.label : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 22, borderRadius: radius.xxl },
  header: { marginBottom: 18, gap: 6 },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.text },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightText: { ...type.caption, fontSize: 13, color: colors.textMuted },
  plot: { height: CHART_H + 44, position: 'relative' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  gridLabel: { position: 'absolute', right: 0, top: -16, fontFamily: fonts.medium, fontSize: 11, color: colors.textDim },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingRight: 36 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 },
  barValue: { width: 52, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  barValueTop: { color: colors.goldLight, fontFamily: fonts.bold },
  bar: { width: '62%', maxWidth: 28, minWidth: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { width: 40, height: 16, marginTop: 6, fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  barLabelTop: { color: colors.goldLight, fontFamily: fonts.bold },
});
