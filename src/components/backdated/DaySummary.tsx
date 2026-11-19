import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, formatMoney, radius, type } from '../../theme';
import { AnimatedNumber, GlassCard } from '../../ui';

type Props = {
  eyebrow: string;
  title: string;
  total: number;
  count: number;
  byMethod: Record<string, number>;
  backdatedCount?: number;
  right?: React.ReactNode;
};

/** Carte de synthèse : total, nombre de ventes, répartition par moyen de paiement. */
export default function DaySummary({ eyebrow, title, total, count, byMethod, backdatedCount = 0, right }: Props) {
  const methods = Object.keys(byMethod).sort((a, b) => byMethod[b] - byMethod[a]);
  return (
    <GlassCard variant="gold" glow style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={type.eyebrow}>{eyebrow}</Text>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
        </View>
        {right}
      </View>

      <View style={styles.totalRow}>
        <AnimatedNumber value={total} style={styles.total} />
        <Text style={styles.currency}>FCFA</Text>
      </View>
      <Text style={styles.count}>
        {count} vente{count > 1 ? 's' : ''}
        {backdatedCount > 0 ? ` · dont ${backdatedCount} saisie${backdatedCount > 1 ? 's' : ''} antérieure${backdatedCount > 1 ? 's' : ''}` : ''}
      </Text>

      {methods.length > 0 && (
        <View style={styles.methods}>
          {methods.map(m => (
            <View key={m} style={styles.methodChip}>
              <Text style={styles.methodLabel}>{m}</Text>
              <Text style={styles.methodValue}>{formatMoney(byMethod[m])}</Text>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  headText: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: fonts.displaySemi, fontSize: 19, color: colors.textPrimary, textTransform: 'capitalize' },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' },
  total: { fontFamily: fonts.mono, fontSize: 34, color: colors.goldLight, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  currency: { fontFamily: fonts.bold, fontSize: 14, color: colors.gold, marginBottom: 7 },
  count: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 96,
  },
  methodLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  methodValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, fontVariant: ['tabular-nums'], marginTop: 2 },
});
