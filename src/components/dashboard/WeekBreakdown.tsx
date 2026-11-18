import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, Calendar, Eye } from 'lucide-react-native';
import { GlassCard, PressableScale, formatMoney } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';
import { sharedStyles } from './dashboardStyles';
import { colors } from '../../theme';

export interface WeekBreakdownProps {
  weekDaysBreakdown: any[];
  expandedDayKeys: Record<string, boolean>;
  setExpandedDayKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleOpenSaleDetail: (sale: any) => void;
}

/** Détail de la semaine (lundi à samedi). */
export default function WeekBreakdown({ weekDaysBreakdown, expandedDayKeys, setExpandedDayKeys, handleOpenSaleDetail }: WeekBreakdownProps) {
  const { colors } = useAppTheme();
  return (
    <View style={sharedStyles.breakdownSection}>
      <View style={sharedStyles.breakdownHeader}>
        <Calendar color={colors.gold} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.breakdownSectionTitle}>Détail de la Semaine (Lundi à Samedi)</Text>
          <Text style={sharedStyles.breakdownSectionSubtitle}>Dimanche non ouvré</Text>
        </View>
      </View>

      {weekDaysBreakdown.map((dayItem) => {
        const isExpanded = !!expandedDayKeys[dayItem.key];
        return (
          <GlassCard key={dayItem.key} style={styles.dayCard} padded={false}>
            <PressableScale
              style={styles.dayCardHeader}
              onPress={() => setExpandedDayKeys((prev) => ({ ...prev, [dayItem.key]: !prev[dayItem.key] }))}
              haptic="selection"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dayCardName}>
                  {dayItem.dayName} <Text style={styles.dayCardDate}>({dayItem.formattedDate})</Text>
                </Text>
                <Text style={styles.dayCardSub}>{dayItem.salesCount} vente(s)</Text>
              </View>
              <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
                <Text style={styles.dayCardTotal}>{formatMoney(dayItem.total)} F</Text>
                {isExpanded ? <ChevronUp color={colors.gold} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
              </View>
            </PressableScale>

            {isExpanded && (
              <View style={styles.dayCardContent}>
                {dayItem.salesCount === 0 ? (
                  <Text style={sharedStyles.emptyDayText}>Aucune vente enregistrée ce jour.</Text>
                ) : (
                  <>
                    <Text style={styles.articlesSoldTitle}>Articles vendus ce {dayItem.dayName} :</Text>
                    {dayItem.itemsSummary.map((item: any, itemIdx: number) => {
                      const matchingSale = dayItem.sales.find((s: any) =>
                        (Array.isArray(s.items) && s.items.some((it: any) => it.name === item.name)) ||
                        (typeof s.items === 'string' && s.items.includes(item.name))
                      ) || dayItem.sales[0];
                      return (
                        <TouchableOpacity 
                          key={itemIdx} 
                          style={[styles.itemSummaryRow, { cursor: 'pointer' as any }]}
                          onPress={() => matchingSale && handleOpenSaleDetail(matchingSale)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.itemSummaryName}>• {item.name}</Text>
                          <Text style={styles.itemSummaryQty}>x{item.quantity}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.itemSummaryPrice}>{formatMoney(item.amount)} F</Text>
                            <Eye color={colors.goldLight} size={14} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    <Text style={[styles.articlesSoldTitle, { marginTop: 12 }]}>Transactions ({dayItem.sales.length}) :</Text>
                    {dayItem.sales.map((sale: any, sIdx: number) => (
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
                            {typeof sale.items === 'string' ? sale.items : (Array.isArray(sale.items) ? sale.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ') : 'Article')}
                          </Text>
                          <Text style={{ color: colors.goldLight, fontSize: 12, marginTop: 2 }}>
                            👁️ Toucher pour voir le reçu complet
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={sharedStyles.subSaleAmount}>{formatMoney(sale.total)} F</Text>
                          <Eye color={colors.goldLight} size={15} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}
          </GlassCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Day Card (Monday to Saturday)
  dayCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  dayCardName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dayCardDate: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: 'normal',
  },
  dayCardSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  dayCardTotal: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  dayCardContent: {
    backgroundColor: colors.surfaceSolidHi,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  articlesSoldTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemSummaryName: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  itemSummaryQty: {
    color: colors.success,
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  itemSummaryPrice: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: 'bold',
  },
});
