import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { colors, formatMoney, fonts, radius } from '../../theme';
import { GlassCard, TiltCard, AnimatedNumber } from '../../ui';

export interface LedgerTotalCardProps {
  todaySales: any[];
  totalToday: number;
}

/** Carte « Total Recette du Jour ». */
export default function LedgerTotalCard({ todaySales, totalToday }: LedgerTotalCardProps) {
  return (
    <TiltCard intensity={5} style={styles.heroTilt}>
      <GlassCard style={styles.totalCard} glow="gold">
        <View style={styles.totalCardLeft}>
          <View style={styles.totalCardTag}>
            <Clock color={colors.gold} size={12} style={{ marginRight: 4 }} />
            <Text style={styles.totalCardTagText}>AUJOURD'HUI</Text>
          </View>
          <Text style={styles.totalLabel}>Total Recette du Jour</Text>
          <View style={styles.totalSalesPill}>
            <Text style={styles.totalSalesText}>{todaySales.length} transaction{todaySales.length > 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={styles.totalCardRight}>
          <AnimatedNumber 
            value={totalToday} 
            formatter={formatMoney}
            style={styles.totalValue}
          />
          <Text style={styles.currencyBadge}>FCFA</Text>
        </View>
      </GlassCard>
    </TiltCard>
  );
}

const styles = StyleSheet.create({
  heroTilt: {
    marginBottom: 16,
  },
  totalCard: {
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    flexWrap: 'wrap',
    gap: 15,
  },
  totalCardLeft: {
    flex: 1,
    minWidth: 200,
  },
  totalCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalCardTagText: {
    color: colors.gold,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.sans,
    marginBottom: 8,
  },
  totalSalesPill: {
    backgroundColor: colors.surface,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  totalSalesText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  totalCardRight: {
    alignItems: 'flex-end',
  },
  totalValue: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: '800',
    fontFamily: fonts.serif,
    letterSpacing: 0.5,
  },
  currencyBadge: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
});
