import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { LogOut, Package, FileText, Wallet, User, ArrowRightLeft, ArrowLeft, Sparkles, Store } from 'lucide-react-native';
import { isUserAdmin } from '../../db/database';
import { colors, fonts, radius } from '../../theme';

export interface LedgerHeaderProps {
  navigation: any;
  user: any;
  storeId: any;
  setTransferRequestModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAIAssistant: React.Dispatch<React.SetStateAction<boolean>>;
  pendingAdvancesCount: number;
  inTransitCount: number;
  todayFormatted: string;
}

/** En-tête du Cahier de Charge : boutique, vendeur, actions et navigation rapide. */
export default function LedgerHeader({
  navigation,
  user,
  storeId,
  setTransferRequestModalVisible,
  setShowAIAssistant,
  pendingAdvancesCount,
  inTransitCount,
  todayFormatted,
}: LedgerHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopBar}>
        {/* Côté gauche : Bouton retour Dashboard (si admin) + Badge Magasin */}
        <View style={styles.userStorePill}>
          {isUserAdmin(user) && (
            <TouchableOpacity 
              onPress={() => navigation.replace('Dashboard', { user })} 
              style={styles.bossPillBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft color={colors.gold} size={15} style={{ marginRight: 5 }} />
              <Text style={styles.bossPillBtnText}>Dashboard</Text>
            </TouchableOpacity>
          )}

          <View style={styles.storeMiniBadge}>
            <Store color={colors.gold} size={14} style={{ marginRight: 6 }} />
            <Text style={styles.storeMiniBadgeText}>
              {storeId === 'falaise' ? 'La Falaise' : 'Tougou'}
            </Text>
          </View>
        </View>

        {/* Côté droit : Vendeur connecté + Actions */}
        <View style={styles.topIconGroup}>
          <View style={styles.sellerChip}>
            <User color={colors.gold} size={13} style={{ marginRight: 5 }} />
            <Text style={styles.sellerNameHeader} numberOfLines={1}>
              {user?.name || 'Vendeur'}
            </Text>
          </View>

          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Profile', { user })}>
            <User color={colors.textSecondary} size={17} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowAIAssistant(true)}>
            <Sparkles color={colors.gold} size={17} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.headerIconBtn, styles.logoutBtn]} 
            onPress={() => {
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem('savedUserId');
                window.localStorage.removeItem('savedUserPin');
              }
              navigation.replace('Login');
            }}
          >
            <LogOut color={colors.danger} size={17} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Title Box */}
      <View style={styles.headerTitleBox}>
        <Text style={styles.screenEyebrow}>Caisse & Enregistrement</Text>
        <Text style={styles.title}>Cahier de Charge</Text>
        <Text style={styles.subtitle}>{todayFormatted}</Text>
      </View>

      {/* Quick Nav Carousel */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.quickNavScroll}
        style={styles.quickNavWrapper}
      >
        <TouchableOpacity 
          style={[styles.navBtn, inTransitCount > 0 && styles.navBtnActive]} 
          onPress={() => navigation.navigate('Transfers', { user, storeId })}
        >
          <ArrowRightLeft color={inTransitCount > 0 ? colors.gold : colors.textSecondary} size={14} />
          <Text style={[styles.navBtnText, inTransitCount > 0 && { color: colors.gold, fontWeight: '700' }]}>
            Transferts{inTransitCount > 0 ? ` (${inTransitCount})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navBtn, styles.navBtnGoldHighlight]} 
          onPress={() => setTransferRequestModalVisible(true)}
        >
          <Package color={colors.gold} size={14} />
          <Text style={[styles.navBtnText, { color: colors.gold, fontWeight: '700' }]}>
            Demander Article ({storeId === 'falaise' ? 'Tougou' : 'Falaise'})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navBtn, pendingAdvancesCount > 0 && styles.navBtnAmber]} 
          onPress={() => navigation.navigate('Advances', { user, storeId })}
        >
          <Wallet color={pendingAdvancesCount > 0 ? '#F59E0B' : colors.textSecondary} size={14} />
          <Text style={[styles.navBtnText, pendingAdvancesCount > 0 && { color: '#F59E0B', fontWeight: '700' }]}>
            Avances{pendingAdvancesCount > 0 ? ` (${pendingAdvancesCount})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Inventory', { user, storeId })}>
          <Package color={colors.textSecondary} size={14} />
          <Text style={styles.navBtnText}>Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('DailyReceipt', { user, storeId })}>
          <FileText color={colors.textSecondary} size={14} />
          <Text style={styles.navBtnText}>Recette du Jour</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 48,
    paddingBottom: 16,
    backgroundColor: 'rgba(7, 7, 10, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  userStorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  storeMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  storeMiniBadgeText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  sellerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  sellerNameHeader: {
    color: colors.goldLight,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  topIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  bossPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: colors.gold,
    borderWidth: 1.2,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  bossPillBtnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  headerIconBtn: {
    padding: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  headerTitleBox: {
    marginBottom: 8,
  },
  screenEyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
    fontFamily: fonts.sans,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.serif,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
    textTransform: 'capitalize',
  },
  quickNavWrapper: {
    marginTop: 10,
  },
  quickNavScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 10,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 6,
  },
  navBtnActive: {
    borderColor: 'rgba(212, 175, 55, 0.5)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  navBtnGoldHighlight: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  navBtnAmber: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  navBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
});
