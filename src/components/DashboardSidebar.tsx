import React from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import {
  TrendingUp,
  FileText,
  Package,
  Wallet,
  ArrowRightLeft,
  Banknote,
  PackagePlus,
  ClipboardCheck,
  Download,
  ShieldCheck,
  LogOut,
  User,
  CalendarClock,
} from 'lucide-react-native';
import { fonts, radius, shadow, type } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';
import PressableScale from '../ui/PressableScale';
import { isSuperBoss } from '../db/database';
import ThemeToggleButton from '../ui/ThemeToggleButton';

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Props = {
  user: any;
  selectedStore: string;
  navigation: any;
  onOpenBackup?: () => void;
  onOpenAudit?: () => void;
  onLogout?: () => void;
};

export default function DashboardSidebar({
  user,
  selectedStore,
  navigation,
  onOpenBackup,
  onOpenAudit,
  onLogout,
}: Props) {
  const isBoss = isSuperBoss(user);
  const { colors, isDark } = useAppTheme();

  const navItems = [
    {
      id: 'dashboard',
      label: "Vue d'ensemble",
      icon: <TrendingUp color={colors.gold} size={18} />,
      active: true,
      onPress: () => {},
    },
    {
      id: 'ledger',
      label: 'Caisse & Ventes',
      icon: <FileText color={colors.textSecondary} size={18} />,
      onPress: () => navigation.navigate('Ledger', { user, storeId: selectedStore }),
    },
    {
      id: 'inventory',
      label: 'Gestion du Stock',
      icon: <Package color={colors.textSecondary} size={18} />,
      onPress: () => navigation.navigate('Inventory', { user, storeId: selectedStore }),
    },
    {
      id: 'advances',
      label: 'Avances Clients',
      icon: <Wallet color={colors.textSecondary} size={18} />,
      onPress: () => navigation.navigate('Advances', { user, storeId: selectedStore }),
    },
    {
      id: 'transfers',
      label: 'Transferts Inter-Magasin',
      icon: <ArrowRightLeft color={colors.textSecondary} size={18} />,
      onPress: () => navigation.navigate('Transfers', { user, storeId: selectedStore }),
    },
    {
      id: 'daily',
      label: 'Recette du Jour',
      icon: <Banknote color={colors.textSecondary} size={18} />,
      onPress: () => navigation.navigate('DailyReceipt', { user, storeId: selectedStore }),
    },
  ];

  const bossItems = [
    {
      id: 'arrivage',
      label: 'Nouvel Arrivage',
      icon: <PackagePlus color={colors.gold} size={18} />,
      onPress: () => navigation.navigate('ArrivageHistory', { user, storeId: selectedStore }),
    },
    {
      id: 'physical',
      label: 'Inventaire Physique',
      icon: <ClipboardCheck color={colors.gold} size={18} />,
      onPress: () => navigation.navigate('PhysicalInventory', { user, storeId: selectedStore }),
    },
    {
      id: 'backdated',
      label: 'Historique & Saisie antérieure',
      icon: <CalendarClock color={colors.gold} size={18} />,
      onPress: () => navigation.navigate('BackdatedHistory', { user, storeId: selectedStore }),
    },
    {
      id: 'audit',
      label: 'Journal de Sécurité',
      icon: <ShieldCheck color={colors.gold} size={18} />,
      onPress: onOpenAudit,
    },
    {
      id: 'backup',
      label: 'Sauvegarde Données',
      icon: <Download color={colors.gold} size={18} />,
      onPress: onOpenBackup,
    },
  ];

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: isDark ? 'rgba(15,15,24,0.85)' : 'rgba(255,255,255,0.92)',
          borderRightColor: colors.border,
        },
      ]}
    >
      {/* Brand Emblème */}
      <View style={[styles.brand, { borderBottomColor: colors.border }]}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.sidebarLogo}
          resizeMode="contain"
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>L'ORÉAL</Text>
          <Text numberOfLines={2} style={[styles.brandSub, { color: colors.gold }]}>
            LA CAPITALE DU PRÊT À PORTER
          </Text>
        </View>
      </View>

      {/* Nav List */}
      <View style={styles.navSection}>
        <Text style={[styles.sectionHeading, { color: colors.textTertiary }]}>Navigation</Text>
        {navItems.map((item) => (
          <PressableScale
            key={item.id}
            onPress={item.onPress}
            haptic="selection"
            scaleTo={0.98}
            hoverLift={1}
            style={[
              styles.navBtn,
              item.active && {
                backgroundColor: colors.goldSoft,
                borderWidth: 1,
                borderColor: colors.borderGold,
              },
            ]}
          >
            {item.icon}
            <Text
              numberOfLines={1}
              style={[
                styles.navLabel,
                { color: item.active ? colors.gold : colors.textSecondary },
                item.active && { fontFamily: fonts.bold },
              ]}
            >
              {item.label}
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* Boss Section */}
      {isBoss && (
        <View style={styles.navSection}>
          <Text style={[styles.sectionHeading, { color: colors.textTertiary }]}>Direction & Contrôle</Text>
          {bossItems.map((item) => (
            <PressableScale
              key={item.id}
              onPress={item.onPress}
              haptic="selection"
              scaleTo={0.98}
              hoverLift={1}
              style={styles.navBtn}
            >
              {item.icon}
              <Text numberOfLines={1} style={[styles.navLabel, { color: colors.textSecondary }]}>
                {item.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      )}

      {/* Theme Switcher Segment */}
      <View style={{ marginTop: 'auto', paddingTop: 16 }}>
        {/* Intitulé « Thème Visuel » masqué : le sélecteur de thème est désactivé (mode sombre imposé), le titre restait orphelin. */}
        <ThemeToggleButton style={{ marginBottom: 12 }} />
      </View>

      {/* User profile bottom card */}
      <View
        style={[
          styles.userCard,
          {
            backgroundColor: isDark ? '#161625' : '#F4EFE6',
            borderColor: colors.border,
          },
        ]}
      >
        <PressableScale
          onPress={() => navigation.navigate('Profile', { user })}
          haptic="selection"
          style={styles.userInner}
        >
          <View
            style={[
              styles.userAvatar,
              {
                backgroundColor: colors.goldSoft,
                borderColor: colors.borderGold,
              },
            ]}
          >
            <Text style={[styles.userAvatarText, { color: colors.gold }]}>
              {getInitials(user?.name)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.userName, { color: colors.textPrimary }]}>
              {user?.name || 'Collaborateur'}
            </Text>
            <Text numberOfLines={1} style={[styles.userRole, { color: colors.textMuted }]}>
              {isBoss ? 'Superviseur' : 'Caisse'} · {user?.store === 'tougou' ? 'Tougou' : 'La Falaise'}
            </Text>
          </View>
        </PressableScale>

        <PressableScale
          onPress={onLogout}
          haptic="impactMedium"
          style={[styles.logoutIconBtn, { backgroundColor: colors.dangerSoft }]}
          accessibilityLabel="Déconnexion"
        >
          <LogOut color={colors.danger} size={18} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 270,
    borderRightWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          height: '100vh',
          position: 'sticky',
          top: 0,
        } as any)
      : null),
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  sidebarLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  brandTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 2.2,
  },
  brandSub: {
    ...type.eyebrow,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 15,
    marginTop: 2,
  },
  navSection: {
    marginTop: 16,
    gap: 4,
  },
  sectionHeading: {
    ...type.eyebrow,
    fontSize: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  navLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 8,
  },
  userInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  userName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  userRole: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  logoutIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
