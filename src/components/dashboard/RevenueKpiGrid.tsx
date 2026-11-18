import { View, Text, StyleSheet } from 'react-native';
import { Wallet, CreditCard, Banknote, Smartphone } from 'lucide-react-native';
import { isSuperBoss } from '../../db/database';
import { GlassCard, AnimatedNumber, formatMoney, colors, fonts, radius, type, useResponsive } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';
import { alpha } from '../../theme';

export interface RevenueKpiGridProps {
  user: any;
  r: ReturnType<typeof useResponsive>;
  salesTotal: number;
  cardTotal: number;
  cashTotal: number;
  momoTotal: number;
  omTotal: number;
  filter: string;
  salesCount: number;
  selectedStore: any;
  filterLabels: Record<string, string>;
  calcPercent: (val: number) => string;
}

/**
 * Recette totale + répartition par mode de paiement.
 * Direction artistique : une seule carte mise en avant (la recette), les modes de paiement
 * en ton sur ton — l'or porte la hiérarchie, pas une couleur par moyen de paiement.
 */
export default function RevenueKpiGrid({
  user,
  r,
  salesTotal,
  cardTotal,
  cashTotal,
  momoTotal,
  omTotal,
  filter,
  salesCount,
  selectedStore,
  filterLabels,
  calcPercent,
}: RevenueKpiGridProps) {
  const { colors } = useAppTheme();
  const eyebrow = !isSuperBoss(user)
    ? 'Recette du jour'
    : filter === 'week' ? 'Recette de la semaine'
    : filter === 'month' ? 'Recette du mois'
    : filter === 'year' ? "Recette de l'année"
    : `Recette · ${filterLabels[filter]}`;
  const storeName = selectedStore === 'all' ? 'Toutes boutiques' : selectedStore === 'tougou' ? 'Tougou' : 'La Falaise';
  const avg = salesCount > 0 ? Math.round(salesTotal / salesCount) : 0;

  const methods = [
    { key: 'cash', label: 'Espèces', value: cashTotal, Icon: Banknote },
    { key: 'momo', label: 'MTN MoMo', value: momoTotal, Icon: Smartphone },
    { key: 'om', label: 'Orange Money', value: omTotal, Icon: Wallet },
    { key: 'card', label: 'Carte bancaire', value: cardTotal, Icon: CreditCard },
  ];
  const share = (v: number) => (salesTotal > 0 ? Math.min(1, Math.max(0, v / salesTotal)) : 0);

  return (
    <View style={[styles.grid, r.isWide && styles.gridWide]}>
      {/* RECETTE — la seule carte mise en avant de l'écran */}
      <GlassCard variant="gold" style={[styles.hero, r.isWide && styles.heroWide]}>
        <View style={styles.heroRule} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <AnimatedNumber
          value={salesTotal}
          suffix=" FCFA"
          style={r.isWide ? styles.heroAmountWide : styles.heroAmount}
        />
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMeta}>
            <Text style={styles.heroMetaStrong}>{salesCount}</Text> vente{salesCount > 1 ? 's' : ''}
          </Text>
          <View style={styles.dot} />
          <Text style={styles.heroMeta}>
            Panier moyen <Text style={styles.heroMetaStrong}>{formatMoney(avg)} F</Text>
          </Text>
          <View style={styles.dot} />
          <Text style={styles.heroMeta}>{storeName}</Text>
        </View>
      </GlassCard>

      {/* RÉPARTITION — ton sur ton, une jauge dorée par mode */}
      <GlassCard style={[styles.split, r.isWide && styles.splitWide]} padded={false}>
        <Text style={styles.splitTitle}>Répartition des encaissements</Text>
        {methods.map(({ key, label, value, Icon }) => (
          <View key={key} style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <Icon color={value > 0 ? colors.goldLight : colors.textMuted} size={16} />
            </View>
            <View style={styles.methodBody}>
              <View style={styles.methodTop}>
                <Text style={styles.methodLabel}>{label}</Text>
                <AnimatedNumber value={value} suffix=" F" style={styles.methodValue} />
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${share(value) * 100}%` as any }]} />
              </View>
            </View>
            <Text style={styles.methodPct}>{calcPercent(value)}</Text>
          </View>
        ))}
      </GlassCard>
    </View>
  );
}

const heroAmountBase = {
  fontFamily: fonts.extrabold,
  fontSize: 36,
  color: colors.text,
  letterSpacing: -1,
  marginTop: 14,
  marginBottom: 14,
  fontVariant: ['tabular-nums'] as any,
};

const styles = StyleSheet.create({
  grid: { gap: 14 },
  gridWide: { flexDirection: 'row', alignItems: 'stretch' },

  hero: { padding: 24, borderRadius: radius.xxl, justifyContent: 'center', overflow: 'hidden' },
  heroWide: { flex: 1.15, padding: 28 },
  heroRule: { position: 'absolute', top: 0, left: 28, width: 48, height: 2, backgroundColor: colors.gold },
  eyebrow: { ...type.eyebrow, color: colors.goldLight },
  heroAmount: heroAmountBase,
  heroAmountWide: { ...heroAmountBase, fontSize: 46 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  heroMeta: { ...type.caption, fontSize: 13, color: colors.textMuted },
  heroMetaStrong: { fontFamily: fonts.bold, color: colors.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: alpha(colors.gold, 0.6) },

  split: { borderRadius: radius.xxl, paddingHorizontal: 20, paddingVertical: 18, gap: 14 },
  splitWide: { flex: 1 },
  splitTitle: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.textMuted },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBody: { flex: 1, minWidth: 0, gap: 6 },
  methodTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  methodLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  methodValue: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text, fontVariant: ['tabular-nums'] },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: colors.gold },
  methodPct: { width: 38, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
});
