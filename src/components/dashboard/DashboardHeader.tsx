import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LogOut, User, Users, Bell, RefreshCw } from 'lucide-react-native';
import { isSuperBoss } from '../../db/database';
import { PressableScale, colors, fonts, type, useResponsive } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface DashboardHeaderProps {
  navigation: any;
  user: any;
  r: ReturnType<typeof useResponsive>;
  lowStockCount: number;
  selectedStore: any;
  securityLogs: any[];
  setShowSecurityAssistant: React.Dispatch<React.SetStateAction<boolean>>;
  handleRefresh: () => void;
  loadData: () => Promise<void>;
  openUsersModal: () => void;
  handleLogout: () => void;
}

/** En-tête du tableau de bord : salutation, boutique et actions rapides. */
export default function DashboardHeader({
  navigation,
  user,
  r,
  lowStockCount,
  selectedStore,
  securityLogs,
  setShowSecurityAssistant,
  handleRefresh,
  loadData,
  openUsersModal,
  handleLogout,
}: DashboardHeaderProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.header, { paddingHorizontal: r.gutter }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.headerGreeting}>
          {isSuperBoss(user) ? `Bonjour, ${user?.name || 'Direction'}` : `Session active · ${user?.name || 'Vendeur'}`}
        </Text>
        <Text numberOfLines={1} style={styles.headerStoreSub}>
          {isSuperBoss(user)
            ? (selectedStore === 'all' ? 'Toutes les boutiques (Vue Globale)' : selectedStore === 'tougou' ? 'Boutique Tougou' : 'Boutique La Falaise')
            : (user?.role === 'caissiere' ? 'Caisse principale' : 'Conseiller de vente') + ` — ${selectedStore === 'tougou' ? 'Tougou' : 'La Falaise'}`}
        </Text>
      </View>

      <View style={styles.headerActions}>
        {isSuperBoss(user) && (
          <>
            <PressableScale
              style={[styles.headerIconBtn, (securityLogs.length + lowStockCount > 0) && styles.headerIconBtnActive]}
              onPress={() => { setShowSecurityAssistant(true); loadData(); }}
              haptic="selection"
              accessibilityLabel="Alertes"
            >
              <Bell color={colors.goldLight} size={20} />
              {securityLogs.length + lowStockCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{securityLogs.length + lowStockCount}</Text>
                </View>
              )}
            </PressableScale>
            <PressableScale
              style={styles.headerIconBtn}
              onPress={openUsersModal}
              haptic="selection"
              accessibilityLabel="Utilisateurs"
            >
              <Users color={colors.textSecondary} size={20} />
            </PressableScale>
          </>
        )}

        <PressableScale
          style={styles.headerIconBtn}
          onPress={handleRefresh}
          haptic="selection"
          accessibilityLabel="Actualiser"
        >
          <RefreshCw color={colors.gold} size={19} />
        </PressableScale>

        <PressableScale
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate('Profile', { user })}
          haptic="selection"
          accessibilityLabel="Profil"
        >
          <User color={colors.textSecondary} size={20} />
        </PressableScale>

        {!r.isWide && (
          <PressableScale
            style={[styles.headerIconBtn, { backgroundColor: colors.dangerSoft }]}
            onPress={handleLogout}
            haptic="warning"
            accessibilityLabel="Déconnexion"
          >
            <LogOut color={colors.danger} size={19} />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerGreeting: { fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: -0.3 },
  headerStoreSub: { ...type.caption, fontSize: 13.5, color: colors.goldLight, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: colors.danger, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.bold },
});
