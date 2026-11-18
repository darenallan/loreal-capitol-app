import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ClipboardList, PenLine } from 'lucide-react-native';
import { colors } from '../theme';
import { Screen, ScreenHeader, Segmented, useResponsive } from '../ui';
import { isSuperBoss } from '../db/database';
import {
  EntryStore, StoreChoice, floorYMD, parseYMD, todayYMD, yesterdayYMD,
} from '../utils/backdatedHelpers';
import ConsultTab from '../components/backdated/ConsultTab';
import EntryTab from '../components/backdated/EntryTab';

type Tab = 'consult' | 'entry';

/**
 * « Historique & Saisie antérieure » — réservé au Super Boss.
 * Garde : tout autre utilisateur est renvoyé immédiatement (rien n'est rendu).
 */
export default function BackdatedHistoryScreen({ navigation, route }: any) {
  const user = route?.params?.user;
  const allowed = isSuperBoss(user);

  useEffect(() => {
    if (!allowed) {
      if (navigation?.canGoBack?.()) navigation.goBack();
      else navigation?.replace?.('Login');
    }
  }, [allowed]);

  if (!allowed) return null;
  return <BackdatedHistoryContent navigation={navigation} user={user} initialStore={route?.params?.storeId} />;
}

function BackdatedHistoryContent({ navigation, user, initialStore }: { navigation: any; user: any; initialStore?: string }) {
  const r = useResponsive();
  const startStore: EntryStore = initialStore === 'tougou' ? 'tougou' : 'falaise';
  const startDate = yesterdayYMD();
  const startD = parseYMD(startDate);

  const [tab, setTab] = useState<Tab>('consult');
  const [store, setStore] = useState<StoreChoice>(initialStore === 'falaise' || initialStore === 'tougou' ? initialStore : 'falaise');
  const [selectedDate, setSelectedDate] = useState(startDate);
  const [monthCursor, setMonthCursor] = useState({ year: startD.getFullYear(), month: startD.getMonth() + 1 });
  const [refreshKey, setRefreshKey] = useState(0);

  const minDate = floorYMD();
  const entryStore: EntryStore = store === 'all' ? startStore : store;

  const changeDate = (ymd: string) => {
    setSelectedDate(ymd);
    const d = parseYMD(ymd);
    setMonthCursor({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const changeTab = (t: Tab) => {
    if (t === 'entry' && store === 'all') setStore(startStore);
    setTab(t);
  };

  const bump = () => setRefreshKey(k => k + 1);

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Direction · Accès Boss"
        title="Historique & Saisie"
        subtitle="Consulter ou saisir un jour passé"
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login'))}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingHorizontal: r.gutter }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.column, { maxWidth: r.pick({ phone: 640, tablet: 720, laptop: 860 }) }]}>
            <Segmented<Tab>
              options={[
                { id: 'consult', label: 'Consulter', icon: <ClipboardList color={tab === 'consult' ? colors.onGold : colors.textSecondary} size={15} /> },
                { id: 'entry', label: 'Saisir', icon: <PenLine color={tab === 'entry' ? colors.onGold : colors.textSecondary} size={15} /> },
              ]}
              value={tab}
              onChange={changeTab}
              style={styles.tabs}
            />

            {tab === 'consult' ? (
              <ConsultTab
                user={user}
                store={store}
                onStoreChange={setStore}
                date={selectedDate}
                onDateChange={changeDate}
                minDate={minDate}
                maxDate={todayYMD()}
                monthCursor={monthCursor}
                onMonthCursorChange={setMonthCursor}
                refreshKey={refreshKey}
                onChanged={bump}
              />
            ) : (
              <EntryTab
                user={user}
                store={entryStore}
                onStoreChange={setStore}
                date={selectedDate}
                onDateChange={changeDate}
                minDate={minDate}
                maxDate={yesterdayYMD()}
                onSaved={bump}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 4, paddingBottom: 48 },
  column: { width: '100%', alignSelf: 'center', gap: 16 },
  tabs: { marginBottom: 4 },
});
