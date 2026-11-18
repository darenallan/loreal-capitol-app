import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, Wallet, ArrowRightLeft, ChevronRight } from 'lucide-react-native';
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

/**
 * Raccourcis d'état : stock faible, avances, transferts en transit.
 * Neutres par défaut ; seul le stock faible passe en rouge quand il y a vraiment un problème.
 */
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
  const items = [
    {
      key: 'stock',
      Icon: AlertTriangle,
      value: String(lowStockCount),
      label: 'Stock faible (≤ 3)',
      tone: lowStockCount > 0 ? 'danger' : 'muted',
      onPress: () => navigation.navigate('Inventory', { filter: 'low_stock', user, storeId: selectedStore }),
    },
    {
      key: 'adv',
      Icon: Wallet,
      value: pendingAdvancesTotal > 0 ? `${formatMoney(pendingAdvancesTotal)} F` : '0 F',
      label: pendingAdvancesCount > 0 ? `${pendingAdvancesCount} avance${pendingAdvancesCount > 1 ? 's' : ''} en cours` : 'Avances en cours',
      tone: pendingAdvancesCount > 0 ? 'gold' : 'muted',
      onPress: () => navigation.navigate('Advances', { user, storeId: selectedStore }),
    },
    ...(inTransitTransfersCount > 0
      ? [{
          key: 'transit',
          Icon: ArrowRightLeft,
          value: String(inTransitTransfersCount),
          label: 'Transfert(s) en transit',
          tone: 'gold',
          onPress: () => navigation.navigate('Transfers', { user, storeId: selectedStore }),
        }]
      : []),
  ];

  return (
    <View style={styles.row}>
      {items.map(({ key, Icon, value, label, tone, onPress }) => {
        const accent = tone === 'danger' ? colors.danger : tone === 'gold' ? colors.goldLight : colors.textMuted;
        return (
          <PressableScale
            key={key}
            style={styles.cell}
            onPress={onPress}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={`${label} : ${value}`}
          >
            <GlassCard
              variant={tone === 'danger' ? 'danger' : 'default'}
              style={styles.card}
              padded={false}
            >
              <View style={styles.inner}>
                <Icon color={accent} size={18} />
                <View style={styles.body}>
                  <Text style={[styles.value, tone !== 'muted' && { color: tone === 'danger' ? colors.danger : colors.text }]} numberOfLines={1}>
                    {value}
                  </Text>
                  <Text style={styles.label} numberOfLines={1}>{label}</Text>
                </View>
                <ChevronRight color={colors.textDim} size={16} />
              </View>
            </GlassCard>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexGrow: 1, flexBasis: 220 },
  card: { borderRadius: radius.xl },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  body: { flex: 1, minWidth: 0 },
  value: { fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  label: { ...type.caption, fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
