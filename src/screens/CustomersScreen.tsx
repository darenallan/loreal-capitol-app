import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, FlatList, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BellRing, ChevronLeft, Download, Search, Users, X } from 'lucide-react-native';
import { alpha, colors, fonts, radius, space } from '../theme';
import { EmptyState, GoldButton, LoadingState, Pill, PressableScale, Screen, ScreenHeader, Segmented, useResponsive, HIT_SLOP } from '../ui';
import { IconButton } from '../ui/primitives';
import { isSuperBoss } from '../db/services/roles';
import {
  buildCustomerReminders, buildCustomers, customerScopeForUser, filterCustomers, findCustomerByPhone,
  sortCustomers, summarizeCustomers,
  type Customer, type CustomerScope, type CustomerSortKey,
} from '../db/services/customers';
import { useCustomerSources } from '../components/customers/useCustomerSources';
import CustomerListItem from '../components/customers/CustomerListItem';
import CustomerDetail from '../components/customers/CustomerDetail';
import RemindersView from '../components/customers/RemindersView';
import { exportCustomersCSV, storeName } from '../components/customers/customerActions';

type Tab = 'clients' | 'relances';

/**
 * « Fichier clients » — route 'Customers', params { user, storeId?, focusPhone? }.
 * Garde : sans utilisateur, retour à la connexion (aucune donnée chargée).
 * Boss : toutes boutiques avec filtre. Autres : uniquement leur boutique.
 * Lecture seule : aucune écriture dans `sales` ni `advances`.
 */
export default function CustomersScreen({ navigation, route }: any) {
  const user = route?.params?.user;

  useEffect(() => {
    if (!user) navigation?.replace?.('Login');
  }, [user]);

  if (!user) return null;
  return (
    <CustomersContent
      navigation={navigation}
      user={user}
      initialStore={route?.params?.storeId}
      focusPhone={route?.params?.focusPhone}
    />
  );
}

function CustomersContent({ navigation, user, initialStore, focusPhone }: {
  navigation: any; user: any; initialStore?: string; focusPhone?: string;
}) {
  const r = useResponsive();
  const boss = isSuperBoss(user);
  const twoCol = r.width >= 900;

  const [storeFilter, setStoreFilter] = useState<CustomerScope>(() => customerScopeForUser(user, initialStore));
  const scope = customerScopeForUser(user, storeFilter);
  const showStore = scope === 'all';

  const { sales, advances, ready } = useCustomerSources();
  const customers = useMemo(() => buildCustomers(sales, advances, { store: scope }), [sales, advances, scope]);
  const summary = useMemo(() => summarizeCustomers(customers), [customers]);
  const reminders = useMemo(() => buildCustomerReminders(customers, 3), [customers]);

  const [tab, setTab] = useState<Tab>('clients');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<CustomerSortKey>('lastVisit');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyLate, setOnlyLate] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focusMissing, setFocusMissing] = useState(false);
  const focusDone = useRef(false);

  const visible = useMemo(
    () => sortCustomers(filterCustomers(customers, { query, onlyOpenAdvance: onlyOpen, onlyOverdue: onlyLate }), sortBy),
    [customers, query, onlyOpen, onlyLate, sortBy]
  );
  const selected: Customer | undefined = selectedKey ? customers.find(c => c.key === selectedKey) : undefined;

  // focusPhone : ouvre directement la fiche correspondante (une seule fois, dès que les données sont là).
  useEffect(() => {
    if (!ready || focusDone.current || !focusPhone) return;
    focusDone.current = true;
    const found = findCustomerByPhone(customers, focusPhone);
    if (found) { setSelectedKey(found.key); setTab('clients'); }
    else setFocusMissing(true);
  }, [ready, customers, focusPhone]);

  // Téléphone : le bouton retour Android ferme d'abord la fiche.
  useEffect(() => {
    if (Platform.OS !== 'android' || twoCol || !selected) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSelectedKey(null); return true; });
    return () => sub.remove();
  }, [twoCol, !!selected]);

  const goBack = () => {
    if (!twoCol && selected) { setSelectedKey(null); return; }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Login');
  };

  const openCustomer = (key: string) => { setSelectedKey(key); setTab('clients'); };

  const onExport = () => {
    const label = scope === 'all' ? 'Toutes' : storeName(scope).replace(/\s+/g, '');
    const ok = exportCustomersCSV(visible, label);
    if (!ok) Alert.alert('Export CSV', "L'export du fichier clients est disponible sur la version web (PC).");
  };

  const scopeLabel = scope === 'all' ? 'Toutes boutiques' : storeName(scope);
  const subtitle = `${summary.count} client${summary.count > 1 ? 's' : ''} · ${summary.openAdvances} acompte${summary.openAdvances > 1 ? 's' : ''} en cours${summary.overdue ? ` · ${summary.overdue} en retard` : ''}`;

  const controls = (
    <View style={styles.controls}>
      {boss ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          <Segmented<CustomerScope>
            compact
            options={[
              { id: 'all', label: 'Toutes' },
              { id: 'falaise', label: 'La Falaise' },
              { id: 'tougou', label: 'Tougou' },
            ]}
            value={storeFilter}
            onChange={v => { setStoreFilter(v); setSelectedKey(null); }}
          />
        </ScrollView>
      ) : (
        <Pill label={`Boutique ${storeName(scope)}`} tone="gold" />
      )}

      <Segmented<Tab>
        options={[
          { id: 'clients', label: `Clients (${summary.count})`, icon: <Users color={tab === 'clients' ? colors.onGold : colors.textSecondary} size={15} /> },
          { id: 'relances', label: `Relances (${reminders.length})`, icon: <BellRing color={tab === 'relances' ? colors.onGold : colors.textSecondary} size={15} /> },
        ]}
        value={tab}
        onChange={setTab}
      />

      {focusMissing ? (
        <Text style={styles.notice}>Aucun client trouvé pour le numéro demandé dans {scopeLabel}.</Text>
      ) : null}

      {tab === 'clients' ? (
        <>
          <View style={styles.searchBox}>
            <Search color={colors.textTertiary} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un nom ou un numéro"
              placeholderTextColor={colors.inputPlaceholder}
              style={styles.searchInput}
              accessibilityLabel="Rechercher un client par nom ou numéro de téléphone"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query ? (
              <PressableScale
                onPress={() => setQuery('')}
                haptic="selection"
                hoverLift={0}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
                style={styles.clearBtn}
              >
                <X color={colors.textSecondary} size={18} />
              </PressableScale>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            <Segmented<CustomerSortKey>
              compact
              options={[
                { id: 'lastVisit', label: 'Dernière visite' },
                { id: 'totalSpent', label: 'Total dépensé' },
                { id: 'remainingDue', label: 'Reste dû' },
              ]}
              value={sortBy}
              onChange={setSortBy}
            />
          </ScrollView>

          <View style={styles.toggles}>
            <Toggle label="Avec acompte en cours" active={onlyOpen} onPress={() => setOnlyOpen(v => !v)} />
            <Toggle label="En retard" tone="danger" active={onlyLate} onPress={() => setOnlyLate(v => !v)} />
          </View>
          <Text style={styles.count}>
            {visible.length} résultat{visible.length > 1 ? 's' : ''}
          </Text>
        </>
      ) : null}
    </View>
  );

  const emptyList = (
    <EmptyState
      icon={<Users color={colors.gold} size={24} />}
      title={customers.length ? 'Aucun client ne correspond' : 'Aucun client enregistré'}
      subtitle={customers.length
        ? 'Modifiez la recherche ou les filtres.'
        : 'Les clients apparaissent dès qu’un nom ou un numéro est saisi lors d’une vente ou d’un acompte.'}
    />
  );

  const detail = selected ? <CustomerDetail key={selected.key} customer={selected} showStore={showStore} /> : null;

  const header = (
    <ScreenHeader
      eyebrow={`Fichier clients · ${scopeLabel}`}
      title={!twoCol && selected ? selected.name : 'Clients'}
      subtitle={subtitle}
      onBack={goBack}
      right={boss ? (
        <IconButton
          icon={<Download color={colors.gold} size={18} />}
          tone="gold"
          onPress={onExport}
          accessibilityLabel="Exporter le fichier clients en CSV"
        />
      ) : null}
    />
  );

  if (!ready) {
    return (
      <Screen>
        {header}
        <LoadingState label="Chargement du fichier clients…" />
      </Screen>
    );
  }

  // ---------- Téléphone / petite tablette : une colonne ----------
  if (!twoCol) {
    if (selected) {
      return (
        <Screen>
          {header}
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: r.gutter }]}>
            <GoldButton
              label="Liste des clients"
              variant="ghost"
              icon={<ChevronLeft color={colors.textSecondary} size={18} />}
              onPress={() => setSelectedKey(null)}
              style={styles.backToList}
            />
            {detail}
          </ScrollView>
        </Screen>
      );
    }
    if (tab === 'relances') {
      return (
        <Screen>
          {header}
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: r.gutter }]} keyboardShouldPersistTaps="handled">
            {controls}
            <RemindersView reminders={reminders} showStore={showStore} onOpenCustomer={openCustomer} />
          </ScrollView>
        </Screen>
      );
    }
    return (
      <Screen>
        {header}
        <FlatList
          data={visible}
          keyExtractor={c => c.key}
          renderItem={({ item }) => <CustomerListItem customer={item} onPress={() => setSelectedKey(item.key)} />}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={controls}
          ListEmptyComponent={emptyList}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.listContent, { paddingHorizontal: r.gutter }]}
          initialNumToRender={20}
          windowSize={9}
        />
      </Screen>
    );
  }

  // ---------- PC / grande tablette : liste + fiche ----------
  return (
    <Screen>
      {header}
      <View style={[styles.columns, { paddingHorizontal: r.gutter }]}>
        <View style={styles.leftCol}>
          {tab === 'clients' ? (
            <FlatList
              data={visible}
              keyExtractor={c => c.key}
              renderItem={({ item }) => (
                <CustomerListItem customer={item} selected={item.key === selectedKey} onPress={() => setSelectedKey(item.key)} />
              )}
              ItemSeparatorComponent={Separator}
              ListHeaderComponent={controls}
              ListEmptyComponent={emptyList}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              initialNumToRender={20}
              windowSize={9}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.colContent} keyboardShouldPersistTaps="handled">
              {controls}
              <RemindersView reminders={reminders} showStore={showStore} onOpenCustomer={openCustomer} />
            </ScrollView>
          )}
        </View>
        <ScrollView style={styles.rightCol} contentContainerStyle={styles.colContent}>
          {detail || (
            <EmptyState
              icon={<Users color={colors.gold} size={24} />}
              title="Sélectionnez un client"
              subtitle="Sa fiche s’affiche ici : achats, acomptes en cours et relance WhatsApp."
            />
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function Toggle({ label, active, onPress, tone = 'gold' }: { label: string; active: boolean; onPress: () => void; tone?: 'gold' | 'danger' }) {
  const accent = tone === 'danger' ? colors.danger : colors.gold;
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      hoverLift={0}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`Filtrer : ${label}`}
      style={[styles.toggle, active && { borderColor: accent, backgroundColor: alpha(accent, 0.14) }]}
    >
      <View style={[styles.toggleDot, active && { backgroundColor: accent, borderColor: accent }]} />
      <Text style={[styles.toggleText, active && { color: accent }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 4, paddingBottom: 48, gap: space.md },
  listContent: { paddingTop: 4, paddingBottom: 48 },
  controls: { gap: space.sm, marginBottom: space.sm },
  hScroll: { paddingRight: space.xs },
  notice: {
    fontFamily: fonts.semibold, fontSize: 13, color: colors.warning, lineHeight: 18,
    backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: space.sm,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    minHeight: 48, paddingHorizontal: space.sm,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md,
  },
  searchInput: {
    flex: 1, minWidth: 0, minHeight: 44, fontFamily: fonts.medium, fontSize: 15, color: colors.inputText,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  toggleDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.textTertiary },
  toggleText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textTertiary },
  separator: { height: space.xs },
  backToList: { alignSelf: 'flex-start' },
  columns: { flex: 1, flexDirection: 'row', gap: space.lg },
  leftCol: { width: 420, maxWidth: '42%' },
  rightCol: { flex: 1 },
  colContent: { paddingTop: 4, paddingBottom: 48, gap: space.md },
});
