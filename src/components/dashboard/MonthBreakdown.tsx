import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, Calendar, Eye } from 'lucide-react-native';
import { GlassCard, PressableScale, formatMoney, colors } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';
import { sharedStyles } from './dashboardStyles';

export interface MonthBreakdownProps {
  monthWeeksBreakdown: any[];
  expandedDayKeys: Record<string, boolean>;
  setExpandedDayKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedWeekKeys: Record<string, boolean>;
  setExpandedWeekKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleOpenSaleDetail: (sale: any) => void;
}

/** Détail du mois par semaines. */
export default function MonthBreakdown({
  monthWeeksBreakdown,
  expandedDayKeys,
  setExpandedDayKeys,
  expandedWeekKeys,
  setExpandedWeekKeys,
  handleOpenSaleDetail,
}: MonthBreakdownProps) {
  const { colors } = useAppTheme();
  return (
    <View style={sharedStyles.breakdownSection}>
      <View style={sharedStyles.breakdownHeader}>
        <Calendar color={colors.gold} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.breakdownSectionTitle}>Détail du Mois par Semaines</Text>
          <Text style={sharedStyles.breakdownSectionSubtitle}>Semaines 1 à 5 (Lundi à Samedi)</Text>
        </View>
      </View>

      {monthWeeksBreakdown.map((weekItem) => {
        const isWeekExpanded = !!expandedWeekKeys[weekItem.key];
        return (
          <GlassCard key={weekItem.key} style={styles.weekCard} padded={false}>
            <PressableScale
              style={styles.weekCardHeader}
              onPress={() => setExpandedWeekKeys((prev) => ({ ...prev, [weekItem.key]: !prev[weekItem.key] }))}
              haptic="selection"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.weekCardTitle}>{weekItem.weekLabel} <Text style={styles.weekCardRange}>({weekItem.dateRange})</Text></Text>
                <Text style={styles.weekCardSub}>{weekItem.salesCount} vente(s)</Text>
              </View>
              <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
                <Text style={styles.weekCardTotal}>{formatMoney(weekItem.total)} F</Text>
                {isWeekExpanded ? <ChevronUp color={colors.gold} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
              </View>
            </PressableScale>

            {isWeekExpanded && (
              <View style={styles.weekCardDaysContainer}>
                {weekItem.days.map((dayItem: any) => {
                  const isDayExpanded = !!expandedDayKeys[dayItem.key];
                  return (
                    <View key={dayItem.key} style={styles.nestedDayCard}>
                      <PressableScale
                        style={styles.nestedDayHeader}
                        onPress={() => setExpandedDayKeys((prev) => ({ ...prev, [dayItem.key]: !prev[dayItem.key] }))}
                        haptic="selection"
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.nestedDayName}>{dayItem.dayName} ({dayItem.formattedDate})</Text>
                          <Text style={styles.nestedDaySub}>{dayItem.salesCount} vente(s)</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                          <Text style={styles.nestedDayTotal}>{formatMoney(dayItem.total)} F</Text>
                          {isDayExpanded ? <ChevronUp color={colors.gold} size={16} /> : <ChevronDown color={colors.textMuted} size={16} />}
                        </View>
                      </PressableScale>

                      {isDayExpanded && (
                        <View style={styles.nestedDayContent}>
                          {dayItem.salesCount === 0 ? (
                            <Text style={sharedStyles.emptyDayText}>Aucune vente enregistrée ce jour.</Text>
                          ) : (
                            dayItem.sales.map((sale: any, sIdx: number) => (
                              <TouchableOpacity 
                                key={sale.id || sIdx} 
                                style={[sharedStyles.subSaleRow, { cursor: 'pointer' as any }]}
                                onPress={() => handleOpenSaleDetail(sale)}
                                activeOpacity={0.7}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={sharedStyles.subSaleTime}>
                                    {new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {sale.payment_method}
                                  </Text>
                                  <Text style={sharedStyles.subSaleItems} numberOfLines={1}>
                                    {sale.sale_label || (typeof sale.items === 'string' ? sale.items : (Array.isArray(sale.items) ? sale.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ') : 'Article'))}
                                  </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={sharedStyles.subSaleAmount}>{formatMoney(sale.total)} F</Text>
                                  <Eye color={colors.goldLight} size={14} />
                                </View>
                              </TouchableOpacity>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </GlassCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Week Card (Month view)
  weekCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  weekCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  weekCardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  weekCardRange: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: 'normal',
  },
  weekCardSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  weekCardTotal: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  weekCardDaysContainer: {
    backgroundColor: colors.surfaceSolidHi,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  // Nested Day Card inside Month view
  nestedDayCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  nestedDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  nestedDayName: {
    color: '#eee',
    fontSize: 13,
    fontWeight: '600',
  },
  nestedDaySub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  nestedDayTotal: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: 'bold',
  },
  nestedDayContent: {
    padding: 12,
    backgroundColor: colors.surfaceSolid,
    gap: 8,
  },
});
