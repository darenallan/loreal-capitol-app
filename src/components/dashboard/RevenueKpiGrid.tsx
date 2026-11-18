import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, Wallet, CreditCard, Banknote } from 'lucide-react-native';
import { isSuperBoss } from '../../db/database';
import { GlassCard, TiltCard, AnimatedNumber, colors, fonts, radius, type, useResponsive } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

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

/** Carte recette totale + 4 cartes de répartition par mode de paiement. */
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
  return (
    <View style={[styles.kpiBentoGrid, r.isWide && styles.kpiBentoGridWide]}>
      {/* HERO CARD RECETTE TOTALE */}
      <View style={[styles.heroCardCol, r.isWide && styles.heroCardColWide]}>
        <TiltCard maxTilt={5}>
          <GlassCard variant="gold" glow style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroEyebrowWrap}>
                <TrendingUp color={colors.gold} size={16} />
                <Text style={styles.heroEyebrow}>
                  {!isSuperBoss(user)
                    ? "RECETTE DU JOUR"
                    : filter === 'week' ? 'RECETTE DE LA SEMAINE' : filter === 'month' ? 'RECETTE DU MOIS' : filter === 'year' ? "RECETTE DE L'ANNÉE" : `RECETTE · ${filterLabels[filter].toUpperCase()}`}
                </Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{salesCount} vente{salesCount > 1 ? 's' : ''}</Text>
              </View>
            </View>

            <View style={styles.heroAmountWrap}>
              <AnimatedNumber
                value={salesTotal}
                suffix=" FCFA"
                style={styles.heroAmount}
              />
            </View>

            <Text style={styles.heroSubText}>
              Enregistrements certifiés · {selectedStore === 'all' ? 'Toutes boutiques' : selectedStore === 'tougou' ? 'Tougou' : 'La Falaise'}
            </Text>
          </GlassCard>
        </TiltCard>
      </View>

      {/* 4 CARTES MODES DE PAIEMENT */}
      <View style={[styles.paymentsGrid, r.isWide && styles.paymentsGridWide]}>
        <GlassCard style={styles.paymentCard} padded={false}>
          <View style={styles.paymentCardInner}>
            <View style={styles.paymentCardTop}>
              <View style={[styles.paymentIconWrap, { backgroundColor: colors.successSoft }]}>
                <Banknote color={colors.success} size={18} />
              </View>
              <Text style={[styles.paymentPercent, { color: colors.success }]}>{calcPercent(cashTotal)}</Text>
            </View>
            <AnimatedNumber value={cashTotal} suffix=" F" style={styles.paymentValue} />
            <Text style={styles.paymentLabel}>Espèces</Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.paymentCard} padded={false}>
          <View style={styles.paymentCardInner}>
            <View style={styles.paymentCardTop}>
              <View style={[styles.paymentIconWrap, { backgroundColor: colors.infoSoft }]}>
                <CreditCard color={colors.info} size={18} />
              </View>
              <Text style={[styles.paymentPercent, { color: colors.info }]}>{calcPercent(cardTotal)}</Text>
            </View>
            <AnimatedNumber value={cardTotal} suffix=" F" style={styles.paymentValue} />
            <Text style={styles.paymentLabel}>Carte Bancaire</Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.paymentCard} padded={false}>
          <View style={styles.paymentCardInner}>
            <View style={styles.paymentCardTop}>
              <View style={[styles.paymentIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Wallet color={colors.warning} size={18} />
              </View>
              <Text style={[styles.paymentPercent, { color: colors.warning }]}>{calcPercent(momoTotal)}</Text>
            </View>
            <AnimatedNumber value={momoTotal} suffix=" F" style={styles.paymentValue} />
            <Text style={styles.paymentLabel}>MTN MoMo</Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.paymentCard} padded={false}>
          <View style={styles.paymentCardInner}>
            <View style={styles.paymentCardTop}>
              <View style={[styles.paymentIconWrap, { backgroundColor: 'rgba(255,87,34,0.14)' }]}>
                <Wallet color="#FF5722" size={18} />
              </View>
              <Text style={[styles.paymentPercent, { color: '#FF5722' }]}>{calcPercent(omTotal)}</Text>
            </View>
            <AnimatedNumber value={omTotal} suffix=" F" style={styles.paymentValue} />
            <Text style={styles.paymentLabel}>Orange Money</Text>
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // KPI Bento Grid
  kpiBentoGrid: { gap: 14 },
  kpiBentoGridWide: { flexDirection: 'row', alignItems: 'stretch' },
  heroCardCol: { width: '100%' },
  heroCardColWide: { flex: 1.2 },
  heroCard: { padding: 24, borderRadius: radius.xxl, minHeight: 180, justifyContent: 'space-between' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroEyebrowWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroEyebrow: { ...type.eyebrow, color: colors.goldLight },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  heroBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.goldLight },
  heroAmountWrap: { marginVertical: 12 },
  heroAmount: { fontFamily: fonts.extrabold, fontSize: 34, color: colors.text, letterSpacing: -0.8 },
  heroSubText: { ...type.caption, color: colors.textMuted },
  paymentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentsGridWide: { flex: 1.3 },
  paymentCard: { flex: 1, minWidth: '45%' as any, borderRadius: radius.xl },
  paymentCardInner: { padding: 14, gap: 6 },
  paymentCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  paymentPercent: { fontFamily: fonts.bold, fontSize: 11.5 },
  paymentValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  paymentLabel: { ...type.caption, fontSize: 11.5, color: colors.textMuted },
});
