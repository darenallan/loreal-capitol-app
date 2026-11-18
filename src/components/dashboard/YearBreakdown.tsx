import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { GlassCard, formatMoney, colors, fonts, radius } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';
import { sharedStyles } from './dashboardStyles';

export interface YearBreakdownProps {
  yearMonthsBreakdown: any[];
}

/** Détail de l'année par mois. */
export default function YearBreakdown({ yearMonthsBreakdown }: YearBreakdownProps) {
  const { colors } = useAppTheme();
  return (
    <View style={sharedStyles.breakdownSection}>
      <View style={sharedStyles.breakdownHeader}>
        <Calendar color={colors.gold} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.breakdownSectionTitle}>Détail de l'Année par Mois</Text>
          <Text style={sharedStyles.breakdownSectionSubtitle}>Janvier à Décembre</Text>
        </View>
      </View>

      {yearMonthsBreakdown.map((monthItem) => (
        <GlassCard key={monthItem.key} style={styles.monthCard} padded={false}>
          <View style={styles.monthCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.monthCardTitle}>{monthItem.monthName}</Text>
              <Text style={styles.monthCardSub}>{monthItem.salesCount} vente(s)</Text>
            </View>
            <Text style={styles.monthCardTotal}>{formatMoney(monthItem.total)} F</Text>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  monthCard: {
    marginBottom: 10,
    borderRadius: radius.lg,
  },
  monthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  monthCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  monthCardSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  monthCardTotal: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.gold,
  },
});
