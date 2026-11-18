import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, Wallet, ArrowRightLeft } from 'lucide-react-native';
import { GlassCard, PressableScale, formatMoney, colors, fonts, radius, type } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface QuickAlertsRowProps {
  navigation: any;
  user: any;
  lowStockCount: number;
  pendingAdvancesCount: number;
  pendingAdvancesTotal: number;
  selectedStore: any;
  inTransitTransfersCount: number;
}

/** Alertes rapides : stock faible, avances, transferts en transit. */
export default function QuickAlertsRow({
  navigation,
  user,
  lowStockCount,
  pendingAdvancesCount,
  pendingAdvancesTotal,
  selectedStore,
  inTransitTransfersCount,
}: QuickAlertsRowProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.alertsRow}>
      <PressableScale
        style={{ flex: 1 }}
        onPress={() => navigation.navigate('Inventory', { filter: 'low_stock', user, storeId: selectedStore })}
        haptic="selection"
      >
        <GlassCard
          variant={lowStockCount > 0 ? 'danger' : 'default'}
          style={styles.alertCard}
          padded={false}
        >
          <View style={styles.alertCardInner}>
            <View style={[styles.alertIconWrap, lowStockCount > 0 && { backgroundColor: colors.dangerSoft }]}>
              <AlertTriangle color={lowStockCount > 0 ? colors.danger : colors.textMuted} size={18} />
            </View>
            <Text style={[styles.alertCount, lowStockCount > 0 && { color: colors.danger }]}>{lowStockCount}</Text>
            <Text numberOfLines={1} style={styles.alertTitle}>Stock faible (≤ 3)</Text>
          </View>
        </GlassCard>
      </PressableScale>

      <PressableScale
        style={{ flex: 1 }}
        onPress={() => navigation.navigate('Advances', { user, storeId: selectedStore })}
        haptic="selection"
      >
        <GlassCard style={styles.alertCard} padded={false}>
          <View style={styles.alertCardInner}>
            <View style={[styles.alertIconWrap, pendingAdvancesCount > 0 && { backgroundColor: colors.warningSoft }]}>
              <Wallet color={pendingAdvancesCount > 0 ? colors.warning : colors.textMuted} size={18} />
            </View>
            <Text style={[styles.alertCount, pendingAdvancesCount > 0 && { color: colors.warning }]}>
              {pendingAdvancesTotal > 0 ? `${formatMoney(pendingAdvancesTotal)} F` : '0 F'}
            </Text>
            <Text numberOfLines={1} style={styles.alertTitle}>
              {pendingAdvancesCount > 0 ? `${pendingAdvancesCount} avance(s)` : 'Avances en cours'}
            </Text>
          </View>
        </GlassCard>
      </PressableScale>

      {inTransitTransfersCount > 0 && (
        <PressableScale
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('Transfers', { user, storeId: selectedStore })}
          haptic="selection"
        >
          <GlassCard style={styles.alertCard} padded={false}>
            <View style={styles.alertCardInner}>
              <View style={[styles.alertIconWrap, { backgroundColor: colors.goldSoft }]}>
                <ArrowRightLeft color={colors.gold} size={18} />
              </View>
              <Text style={[styles.alertCount, { color: colors.gold }]}>{inTransitTransfersCount}</Text>
              <Text numberOfLines={1} style={styles.alertTitle}>En transit</Text>
            </View>
          </GlassCard>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  alertsRow: { flexDirection: 'row', gap: 10 },
  alertCard: { borderRadius: radius.xl },
  alertCardInner: { padding: 14, alignItems: 'center', gap: 4 },
  alertIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  alertCount: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  alertTitle: { ...type.caption, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
