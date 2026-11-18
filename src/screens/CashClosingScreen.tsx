import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ClipboardCheck, History, LockOpen, RefreshCw } from 'lucide-react-native';
import { EmptyState, GlassCard, GoldButton, LoadingState, Screen, ScreenHeader, Segmented, useResponsive } from '../ui';
import { subscribeResilient } from '../db/resilientSync';
import {
  CASH_STORE_LABELS, CashClosing, CashClosingStore, canEditCashClosing, canManageAllCashClosings,
  cashClosingId, cashClosingStoresFor, cashClosingUserStore, computeCashSalesBreakdown, getCashClosing,
} from '../db/services/cashClosing';
import { todayKey } from '../utils/saleMath';
import { formatMoney } from '../theme';
import StoreDayBar from '../components/cashClosing/StoreDayBar';
import ExpectedCard from '../components/cashClosing/ExpectedCard';
import CashCountForm from '../components/cashClosing/CashCountForm';
import ClosingRecap from '../components/cashClosing/ClosingRecap';
import HistoryTab from '../components/cashClosing/HistoryTab';
import { useCashStyles } from '../components/cashClosing/styles';

type Tab = 'closing' | 'history';

/** Jours passés consultables : Boss 1 an, caissière / admin boutique 90 jours (lecture). */
const BOSS_DAYS_BACK = 365;
const STAFF_DAYS_BACK = 90;

/**
 * « Clôture de caisse » — route 'CashClosing', params { user, storeId? }.
 * Caissière / employé / admin non-boss : SA boutique, clôture du jour, jours passés en lecture.
 * Boss : deux boutiques, n'importe quel jour, réouverture, onglet Historique (30 jours).
 */
export default function CashClosingScreen({ navigation, route }: any) {
  const user = route?.params?.user;

  useEffect(() => {
    if (!user) {
      if (navigation?.canGoBack?.()) navigation.goBack();
      else navigation?.replace?.('Login');
    }
  }, [user]);

  if (!user) return null;
  return <CashClosingContent navigation={navigation} user={user} initialStore={route?.params?.storeId} />;
}

function CashClosingContent({ navigation, user, initialStore }: { navigation: any; user: any; initialStore?: string }) {
  const r = useResponsive();
  const { s, c } = useCashStyles();
  const isBoss = canManageAllCashClosings(user);
  const stores = cashClosingStoresFor(user);

  const startStore: CashClosingStore = isBoss
    ? (initialStore === 'tougou' ? 'tougou' : 'falaise')
    : cashClosingUserStore(user);

  const [tab, setTab] = useState<Tab>('closing');
  const [store, setStore] = useState<CashClosingStore>(startStore);
  const [day, setDay] = useState<string>(todayKey());
  const [salesRaw, setSalesRaw] = useState<any>(undefined);
  const [closingState, setClosingState] = useState<{ id: string; closing: CashClosing | null } | null>(null);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);

  const minDay = todayKey(-(isBoss ? BOSS_DAYS_BACK : STAFF_DAYS_BACK));
  const currentId = cashClosingId(store, day);

  // Ventes en temps réel (cache → REST → WebSocket), comme le Dashboard.
  useEffect(() => {
    const unsub = subscribeResilient('sales', data => setSalesRaw(data || {}), { cacheKey: 'loreal_cache_sales' });
    return unsub;
  }, []);

  const breakdown = useMemo(
    () => (salesRaw === undefined ? null : computeCashSalesBreakdown(salesRaw, store, day)),
    [salesRaw, store, day]
  );

  // Clôture existante pour la boutique / le jour sélectionnés.
  useEffect(() => {
    let alive = true;
    setClosingError(null);
    getCashClosing(store, day)
      .then(cl => { if (alive) setClosingState({ id: currentId, closing: cl }); })
      .catch(e => { if (alive) setClosingError(e?.message || 'Erreur de chargement.'); });
    return () => { alive = false; };
  }, [store, day, reload]);

  const ready = closingState && closingState.id === currentId;
  const closing = ready ? closingState!.closing : null;
  const editable = !!ready && canEditCashClosing(user, store, day, closing);

  const onSaved = (cl: CashClosing) => {
    setClosingState({ id: cl.id, closing: cl });
    setHistoryKey(k => k + 1);
  };

  const openFromHistory = (st: CashClosingStore, d: string) => {
    setStore(st);
    setDay(d);
    setTab('closing');
  };

  const subtitle = `${CASH_STORE_LABELS[store]} · ${isBoss ? 'Accès Boss' : 'Ma boutique'}`;

  const renderClosing = () => {
    if (closingError && !ready) {
      return (
        <GlassCard style={s.card}>
          <View style={s.row}>
            <AlertTriangle color={c.danger} size={18} />
            <Text style={[s.error, styles.flexShrink]}>{closingError}</Text>
          </View>
          <GoldButton label="Réessayer" variant="outline" size="sm" icon={<RefreshCw color={c.gold} size={16} />} onPress={() => setReload(x => x + 1)} />
        </GlassCard>
      );
    }
    if (!ready) return <LoadingState label="Chargement de la clôture…" />;

    // Clôturée (ou rouverte mais non modifiable par cet utilisateur) → récapitulatif
    if (closing && (closing.status === 'closed' || !editable)) {
      const liveTotal = breakdown?.sales_total;
      const drift = liveTotal !== undefined && Math.round(liveTotal) !== Math.round(closing.expected_detail.sales_total);
      return (
        <View style={styles.gap}>
          {drift ? (
            <View style={[s.notice, { backgroundColor: c.warningSoft }]}>
              <AlertTriangle color={c.warning} size={16} />
              <Text style={[s.noticeText, { color: c.warning }]}>
                Les ventes du jour ont changé depuis la clôture : recette actuelle {formatMoney(liveTotal)} F
                (contre {formatMoney(closing.expected_detail.sales_total)} F à la clôture).
                {isBoss ? ' Rouvrez puis re-clôturez pour mettre à jour.' : ''}
              </Text>
            </View>
          ) : null}
          <ExpectedCard breakdown={closing.expected_detail} />
          <ClosingRecap user={user} closing={closing} onReopened={cl => { setClosingState({ id: cl.id, closing: cl }); setHistoryKey(k => k + 1); }} />
        </View>
      );
    }

    if (editable && breakdown) {
      return (
        <View style={styles.gap}>
          {closing?.status === 'reopened' ? (
            <View style={[s.notice, { backgroundColor: c.warningSoft }]}>
              <LockOpen color={c.warning} size={16} />
              <Text style={[s.noticeText, { color: c.warning }]}>
                Clôture rouverte par {closing.reopened_by_name || 'le Boss'}
                {closing.reopen_reason ? ` (« ${closing.reopen_reason} »)` : ''}. Corrigez puis re-clôturez.
              </Text>
            </View>
          ) : null}
          <ExpectedCard breakdown={breakdown} live />
          <CashCountForm key={currentId} user={user} store={store} day={day} breakdown={breakdown} previous={closing} onSaved={onSaved} />
        </View>
      );
    }

    if (editable) return <ExpectedCard breakdown={null} loading />;

    // Jour passé non clôturé, en lecture seule pour la caissière
    return (
      <View style={styles.gap}>
        <ExpectedCard breakdown={breakdown} loading={!breakdown} live />
        <GlassCard style={s.card}>
          <EmptyState
            icon={<ClipboardCheck color={c.gold} size={22} />}
            title="Caisse non clôturée"
            subtitle={day < todayKey() ? "Ce jour n'a pas été clôturé. Seul le Boss peut clôturer un jour passé." : 'Clôture indisponible pour ce jour.'}
          />
        </GlassCard>
      </View>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Caisse"
        title="Clôture de caisse"
        subtitle={subtitle}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login'))}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingHorizontal: r.gutter }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.column, { maxWidth: r.pick({ phone: 640, tablet: 720, laptop: 820 }) }]}>
            {isBoss ? (
              <Segmented<Tab>
                options={[
                  { id: 'closing', label: 'Clôture', icon: <ClipboardCheck color={tab === 'closing' ? c.onGold : c.textSecondary} size={15} /> },
                  { id: 'history', label: 'Historique', icon: <History color={tab === 'history' ? c.onGold : c.textSecondary} size={15} /> },
                ]}
                value={tab}
                onChange={setTab}
              />
            ) : null}

            {tab === 'history' && isBoss ? (
              <HistoryTab refreshKey={historyKey} onOpen={openFromHistory} />
            ) : (
              <>
                <StoreDayBar stores={stores} store={store} onStoreChange={setStore} day={day} onDayChange={setDay} minDay={minDay} />
                {renderClosing()}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  content: { paddingTop: 4, paddingBottom: 48 },
  column: { width: '100%', alignSelf: 'center', gap: 16 },
  gap: { gap: 16 },
});
