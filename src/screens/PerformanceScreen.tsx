import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart3, Boxes, Download, Package, RefreshCw, Users } from 'lucide-react-native';
import { space } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';
import { GlassCard, IconButton, LoadingState, Screen, ScreenHeader, useResponsive } from '../ui';
import { isSuperBoss } from '../db/services/roles';
import {
  PERIOD_OPTIONS, PeriodId, PerfStoreFilter, computeArticleRanking, computeSellerRanking, computeStockReport,
  computeStoreComparison, formatRange, periodRange, previousPeriodRange,
} from '../db/services/analytics';
import { todayKey } from '../utils/saleMath';
import { downloadCSV } from '../utils/exportHelpers';
import { ChipGroup, Notice } from '../components/performance/PerfPrimitives';
import { usePerfStyles } from '../components/performance/perfStyles';
import { usePerformanceData } from '../components/performance/usePerformanceData';
import StoreCompareTab from '../components/performance/StoreCompareTab';
import SellersTab from '../components/performance/SellersTab';
import ArticlesTab from '../components/performance/ArticlesTab';
import StockTab, { DORMANT_OPTIONS, DormantDays } from '../components/performance/StockTab';
import { CsvTable, articlesCsv, compareCsv, sellersCsv, stockCsv } from '../components/performance/perfCsv';

type Tab = 'stores' | 'sellers' | 'articles' | 'stock';

const THRESHOLD_KEY = 'capitol_perf_low_stock_threshold';
const DEFAULT_THRESHOLD = 3;

function readThreshold(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem(THRESHOLD_KEY);
      const n = v === null ? NaN : parseInt(v, 10);
      if (isFinite(n) && n >= 0 && n <= 10) return n;
    }
  } catch (e) {}
  return DEFAULT_THRESHOLD;
}

function writeThreshold(n: number) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(THRESHOLD_KEY, String(n));
  } catch (e) {}
}

/**
 * « Performance & Stock » — réservé au Boss (isSuperBoss). Lecture seule.
 * Garde : tout autre utilisateur est renvoyé ; les hooks de données vivent dans PerformanceContent,
 * rendu uniquement si l'accès est autorisé.
 */
export default function PerformanceScreen({ navigation, route }: any) {
  const user = route?.params?.user;
  const allowed = isSuperBoss(user);

  useEffect(() => {
    if (!allowed) {
      if (navigation?.canGoBack?.()) navigation.goBack();
      else navigation?.replace?.('Login');
    }
  }, [allowed]);

  if (!allowed) return null;
  return <PerformanceContent navigation={navigation} initialStore={route?.params?.storeId} />;
}

function PerformanceContent({ navigation, initialStore }: { navigation: any; initialStore?: string }) {
  const r = useResponsive();
  const { colors } = useAppTheme();
  const { s } = usePerfStyles();
  const wide = r.width >= 900;

  const { sales, products, loading, error, loadedAt, reload } = usePerformanceData();

  const [period, setPeriod] = useState<PeriodId>('7d');
  const [tab, setTab] = useState<Tab>('stores');
  const [store, setStore] = useState<PerfStoreFilter>(initialStore === 'falaise' || initialStore === 'tougou' ? initialStore : 'all');
  const [threshold, setThresholdState] = useState<number>(readThreshold);
  const [dormantDays, setDormantDays] = useState<DormantDays>(DORMANT_OPTIONS[0]);

  const setThreshold = (n: number) => { setThresholdState(n); writeThreshold(n); };

  // `loadedAt` fige « aujourd'hui » au moment du chargement (recalcul après Actualiser)
  const range = useMemo(() => periodRange(period, loadedAt), [period, loadedAt]);
  const prevRange = useMemo(() => previousPeriodRange(period, loadedAt), [period, loadedAt]);
  const today = useMemo(() => todayKey(), [loadedAt]);

  const comparison = useMemo(() => computeStoreComparison(sales, range, prevRange), [sales, range, prevRange]);
  const sellers = useMemo(() => computeSellerRanking(sales, range, store), [sales, range, store]);
  const articles = useMemo(() => computeArticleRanking(sales, range, store, 10), [sales, range, store]);
  const stock = useMemo(
    () => computeStockReport(sales, products, { threshold, dormantDays, today, store }),
    [sales, products, threshold, dormantDays, today, store],
  );

  const exportCurrent = () => {
    let t: CsvTable;
    if (tab === 'stores') t = compareCsv(comparison);
    else if (tab === 'sellers') t = sellersCsv(sellers, range, store);
    else if (tab === 'articles') t = articlesCsv(articles, range, store);
    else t = stockCsv(stock, today, store);
    if (Platform.OS !== 'web') {
      Alert.alert('Export CSV', "L'export CSV est disponible depuis la version web (navigateur).");
      return;
    }
    downloadCSV(t.filename, t.headers, t.rows);
  };

  const iconColor = (active: boolean) => (active ? colors.onGold : colors.textSecondary);
  const showPeriod = tab !== 'stock';
  const showStoreFilter = tab !== 'stores';

  const actions = (
    <View style={styles.headerActions}>
      <IconButton icon={<RefreshCw size={18} color={colors.textPrimary} />} onPress={reload} accessibilityLabel="Actualiser les données" />
      <IconButton tone="gold" icon={<Download size={18} color={colors.gold} />} onPress={exportCurrent} accessibilityLabel="Exporter l'onglet courant en CSV" />
    </View>
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Direction · Accès Boss"
        title="Performance & Stock"
        subtitle={showPeriod ? formatRange(range) : `Stock au ${formatRange({ start: today, end: today })}`}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login'))}
        right={r.isPhone ? undefined : actions}
      />
      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingHorizontal: r.gutter }]}>
        <View style={styles.column}>
          {r.isPhone ? (
            <View style={styles.phoneActions}>
              <Text style={[s.muted, styles.flex]}>Export CSV de l'onglet affiché</Text>
              {actions}
            </View>
          ) : null}
          <ChipGroup<Tab>
            label="Onglet"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'stores', label: 'Boutiques', icon: a => <BarChart3 size={16} color={iconColor(a)} /> },
              { id: 'sellers', label: 'Vendeuses', icon: a => <Users size={16} color={iconColor(a)} /> },
              { id: 'articles', label: 'Articles', icon: a => <Package size={16} color={iconColor(a)} /> },
              { id: 'stock', label: 'Stock', icon: a => <Boxes size={16} color={iconColor(a)} /> },
            ]}
          />

          <GlassCard style={[s.card, styles.filters]}>
            {showPeriod ? (
              <View style={styles.filterBlock}>
                <Text style={s.eyebrow}>Période</Text>
                <ChipGroup<PeriodId> label="Période" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
                <Text style={s.muted}>
                  {formatRange(range)}{tab === 'stores' ? ` · comparé à ${formatRange(prevRange)}` : ''}
                </Text>
              </View>
            ) : null}
            {showStoreFilter ? (
              <View style={styles.filterBlock}>
                <Text style={s.eyebrow}>Boutique</Text>
                <ChipGroup<PerfStoreFilter>
                  label="Boutique"
                  value={store}
                  onChange={setStore}
                  options={[{ id: 'all', label: 'Toutes' }, { id: 'falaise', label: 'La Falaise' }, { id: 'tougou', label: 'Tougou' }]}
                />
              </View>
            ) : null}
          </GlassCard>

          {error ? <Notice>Chargement incomplet : {error}. Les données affichées peuvent provenir du cache.</Notice> : null}

          {loading && sales.length === 0 ? (
            <LoadingState label="Chargement des ventes et du stock…" />
          ) : tab === 'stores' ? (
            <StoreCompareTab data={comparison} wide={wide} />
          ) : tab === 'sellers' ? (
            <SellersTab data={sellers} store={store} wide={wide} />
          ) : tab === 'articles' ? (
            <ArticlesTab data={articles} wide={wide} />
          ) : (
            <StockTab
              data={stock}
              store={store}
              wide={wide}
              threshold={threshold}
              onThreshold={setThreshold}
              dormantDays={dormantDays}
              onDormantDays={setDormantDays}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 4, paddingBottom: 48 },
  column: { width: '100%', alignSelf: 'center', gap: space.md },
  headerActions: { flexDirection: 'row', gap: 8 },
  phoneActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filters: { gap: space.md },
  filterBlock: { gap: space.xs },
});
