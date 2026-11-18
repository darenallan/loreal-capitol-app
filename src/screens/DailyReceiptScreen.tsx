import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { ArrowLeft, Calendar, FileText, Download, Store, Clock, ShoppingBag } from 'lucide-react-native';
import { exportSalesCSV } from '../utils/exportHelpers';
import { isSuperBoss, getLocalCache } from '../db/database';
import { subscribeResilient } from '../db/resilientSync';
import { getEffectiveTotal, isAnyAdvance, itemsSummary, isOnLocalDay, todayKey } from '../utils/saleMath';
import { colors, fonts, radius, shadow, formatMoney } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, AnimatedNumber, FadeIn } from '../ui';

export default function DailyReceiptScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const initialStore = isSuperBoss(user) 
    ? (route.params?.storeId || (user?.store === 'all' ? 'falaise' : (user?.store || 'falaise')))
    : (user?.store || 'falaise');
  const [currentStore, setCurrentStore] = useState(initialStore);
  const [sales, setSales] = useState<any[]>([]);

  const processSalesData = (data: any) => {
    if (!data) {
      setSales([]);
      return;
    }
    // Jour LOCAL (et non UTC) : une vente faite entre 00h et 01h compte bien pour aujourd'hui.
    const today = todayKey();
    
    const allSales = Object.keys(data).map(k => ({ id: k, ...data[k] }));
    const todaySalesList = allSales
      .filter(s => {
        if (!isOnLocalDay(s.date, today)) return false;
        if (currentStore === 'all') return true;
        const sStore = (s.store || 'falaise').toLowerCase();
        return sStore === currentStore.toLowerCase();
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
    const formattedSales = todaySalesList.map(s => {
      const effectiveTotal = getEffectiveTotal(s);
      const baseItems = Array.isArray(s.items)
        ? itemsSummary(s.items)
        : (s.items || 'Articles');
      const clientTag = (s.client_name || s.advanceData?.clientName) ? ` (${s.client_name || s.advanceData?.clientName})` : '';
      const displayItems = s.sale_label
        ? s.sale_label
        : (isAnyAdvance(s)
            ? (effectiveTotal > 0
                ? `Avance ${formatMoney(effectiveTotal)} FCFA sur ${baseItems}${clientTag}`
                : `Avance (0 FCFA versé) sur ${baseItems}${clientTag}`)
            : baseItems);
      return {
        id: s.id,
        total: effectiveTotal,
        payment_method: s.payment_method,
        date: s.date,
        is_advance: s.is_advance,
        store: s.store || currentStore,
        seller_name: s.seller_name || '',
        items: displayItems
      };
    });

    setSales(formattedSales);
  };

  useEffect(() => {
    // 1. Lecture immédiate du cache local (0ms)
    const cached = getLocalCache('loreal_cache_sales');
    if (cached) {
      processSalesData(cached);
    }

    // 2. Souscription résiliente double transport (HTTPS REST + WebSocket)
    const unsubscribe = subscribeResilient(
      'sales',
      (data) => {
        if (data) processSalesData(data);
      },
      { cacheKey: 'loreal_cache_sales' }
    );

    return () => unsubscribe();
  }, [currentStore]);

  const totalToday = sales.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.screenEyebrow} numberOfLines={1}>RÉCAPITULATIF CAISSE</Text>
            <Text style={styles.title} numberOfLines={1}>Recette du Jour</Text>
          </View>

          <TouchableOpacity 
            style={styles.exportBtn} 
            onPress={() => exportSalesCSV(sales, currentStore)}
            accessibilityLabel="Exporter en CSV"
          >
            <Download color={colors.gold} size={18} />
          </TouchableOpacity>
        </View>

        {/* Store Selector (Boss) */}
        {isSuperBoss(user) && (
          <View style={styles.storeSelector}>
            <TouchableOpacity 
              style={[styles.storeBtn, currentStore === 'falaise' && styles.storeBtnActive]} 
              onPress={() => setCurrentStore('falaise')}
            >
              <Text style={[styles.storeBtnText, currentStore === 'falaise' && styles.storeBtnTextActive]}>
                La Falaise
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.storeBtn, currentStore === 'tougou' && styles.storeBtnActive]} 
              onPress={() => setCurrentStore('tougou')}
            >
              <Text style={[styles.storeBtnText, currentStore === 'tougou' && styles.storeBtnTextActive]}>
                Tougou
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.storeBtn, currentStore === 'all' && styles.storeBtnActive]} 
              onPress={() => setCurrentStore('all')}
            >
              <Text style={[styles.storeBtnText, currentStore === 'all' && styles.storeBtnTextActive]}>
                Global
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={sales}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[styles.contentScroll, r.isWide && styles.contentScrollWide]}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <TiltCard intensity={5}>
              <GlassCard style={styles.summaryCard} glow="gold">
                <View style={styles.summaryLeft}>
                  <View style={styles.dateTag}>
                    <Calendar color={colors.gold} size={12} style={{ marginRight: 4 }} />
                    <Text style={styles.dateTagText}>
                      {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                  <Text style={styles.summaryTitle}>
                    Total Encaissé ({currentStore === 'all' ? 'Toutes boutiques' : currentStore === 'falaise' ? 'La Falaise' : 'Tougou'})
                  </Text>
                  <Text style={styles.salesCountText}>{sales.length} vente{sales.length > 1 ? 's' : ''} validée{sales.length > 1 ? 's' : ''}</Text>
                </View>

                <View style={styles.summaryRight}>
                  <AnimatedNumber 
                    value={totalToday} 
                    formatter={formatMoney}
                    style={styles.summaryValue}
                  />
                  <Text style={styles.currencyBadge}>FCFA</Text>
                </View>
              </GlassCard>
            </TiltCard>

            <View style={styles.listHeaderRow}>
              <Text style={styles.listSectionTitle}>Détails des Ventes</Text>
              <Pill label={`${sales.length} transactions`} tone="gold" size="sm" />
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <FadeIn delay={index * 20}>
            <GlassCard style={styles.saleCard}>
              <View style={styles.saleCardTop}>
                <View style={styles.saleIndexPill}>
                  <Text style={styles.saleIndexText}>N°{String(index + 1).padStart(3, '0')}</Text>
                </View>
                <View style={styles.saleTimeTag}>
                  <Clock color={colors.textTertiary} size={11} style={{ marginRight: 3 }} />
                  <Text style={styles.saleTimeText}>{new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>

              <Text style={styles.saleItems}>{item.items || 'Articles'}</Text>
              
              <View style={styles.saleCardBottom}>
                <View style={styles.methodBadge}>
                  <Text style={styles.methodBadgeText}>{item.payment_method}</Text>
                </View>
                <Text style={styles.saleTotal}>{formatMoney(item.total)} FCFA</Text>
              </View>
            </GlassCard>
          </FadeIn>
        )}
        ListEmptyComponent={
          <GlassCard style={styles.emptyBox}>
            <ShoppingBag color={colors.textTertiary} size={42} />
            <Text style={styles.emptyTitle}>Aucune vente aujourd'hui</Text>
            <Text style={styles.emptySubtitle}>Les encaissements du jour s'afficheront ici en temps réel.</Text>
          </GlassCard>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 48,
    paddingBottom: 14,
    backgroundColor: 'rgba(7, 7, 10, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginRight: 10,
  },
  headerTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  screenEyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.serif,
  },
  exportBtn: {
    padding: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  storeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  storeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  storeBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: colors.gold,
  },
  storeBtnText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  storeBtnTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  contentScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  contentScrollWide: {
    paddingHorizontal: 28,
  },
  summaryCard: {
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryLeft: {
    flex: 1,
    minWidth: 180,
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateTagText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontFamily: fonts.sans,
  },
  summaryTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.sans,
    marginBottom: 4,
  },
  salesCountText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.sans,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryValue: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: '800',
    fontFamily: fonts.serif,
  },
  currencyBadge: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  listSectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  saleCard: {
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  saleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  saleIndexPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  saleIndexText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  saleTimeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saleTimeText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.sans,
  },
  saleItems: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.sans,
    lineHeight: 18,
    marginBottom: 10,
  },
  saleCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    paddingTop: 8,
  },
  methodBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  methodBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  saleTotal: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.serif,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginTop: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    fontFamily: fonts.sans,
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
});
