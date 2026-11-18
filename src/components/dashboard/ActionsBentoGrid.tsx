import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Package, PackagePlus, Wallet, Banknote, FileText, ClipboardList, ArrowRightLeft, Download, ShieldCheck, ClipboardCheck, ArrowUpRight, CalendarClock } from 'lucide-react-native';
import { isSuperBoss } from '../../db/database';
import { GlassCard, PressableScale, colors, fonts, radius, type, useResponsive } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface ActionsBentoGridProps {
  navigation: any;
  user: any;
  r: ReturnType<typeof useResponsive>;
  setTransferRequestModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedStore: any;
  setScannerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  inTransitTransfersCount: number;
  setBackupModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  openTransferSearchModal: () => Promise<void>;
  openSalesHistoryModal: () => void;
  openAuditModal: () => Promise<void>;
}

/** Grille des modules et accès rapides. */
export default function ActionsBentoGrid({
  navigation,
  user,
  r,
  setTransferRequestModalVisible,
  selectedStore,
  setScannerVisible,
  inTransitTransfersCount,
  setBackupModalVisible,
  openTransferSearchModal,
  openSalesHistoryModal,
  openAuditModal,
}: ActionsBentoGridProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.actionsSection}>
      <Text style={styles.actionsSectionTitle}>Modules & Accès Rapides</Text>

      <View style={[styles.actionsBentoGrid, r.isWide && styles.actionsBentoGridWide]}>
        <PressableScale
          style={[styles.actionTile, styles.actionTilePrimary]}
          onPress={() => navigation.navigate('Ledger', { user, storeId: selectedStore })}
          haptic="medium"
          scaleTo={0.98}
          hoverLift={2}
        >
          <GlassCard variant="gold" glow style={styles.actionTileInner}>
            <View style={styles.actionTileIconWrapGold}>
              <FileText color={colors.onGold} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTileTitleGold}>Caisse & Ventes</Text>
              <Text style={styles.actionTileSubGold}>Enregistrer les encaissements & panier client</Text>
            </View>
            <ArrowUpRight color={colors.goldLight} size={18} />
          </GlassCard>
        </PressableScale>

        <PressableScale
          style={styles.actionTile}
          onPress={() => navigation.navigate('Inventory', { user, storeId: selectedStore })}
          haptic="selection"
        >
          <GlassCard style={styles.actionTileInner}>
            <View style={styles.actionTileIconWrap}>
              <Package color={colors.gold} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTileTitle}>Stock & Catalogue</Text>
              <Text style={styles.actionTileSub}>Articles, prix et niveaux d'inventaire</Text>
            </View>
          </GlassCard>
        </PressableScale>

        <PressableScale
          style={styles.actionTile}
          onPress={() => navigation.navigate('Advances', { user, storeId: selectedStore })}
          haptic="selection"
        >
          <GlassCard style={styles.actionTileInner}>
            <View style={styles.actionTileIconWrap}>
              <Wallet color={colors.warning} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTileTitle}>Avances Clients</Text>
              <Text style={styles.actionTileSub}>Acomptes, retraits et soldes restants</Text>
            </View>
          </GlassCard>
        </PressableScale>

        <PressableScale
          style={styles.actionTile}
          onPress={() => navigation.navigate('DailyReceipt', { user, storeId: selectedStore })}
          haptic="selection"
        >
          <GlassCard style={styles.actionTileInner}>
            <View style={styles.actionTileIconWrap}>
              <Banknote color={colors.success} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTileTitle}>Recette Journalière</Text>
              <Text style={styles.actionTileSub}>Clôture de caisse et récapitulatif</Text>
            </View>
          </GlassCard>
        </PressableScale>

        <PressableScale
          style={styles.actionTile}
          onPress={() => setTransferRequestModalVisible(true)}
          haptic="selection"
        >
          <GlassCard style={styles.actionTileInner}>
            <View style={styles.actionTileIconWrap}>
              <Package color={colors.goldLight} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTileTitle}>Demander un Article</Text>
              <Text style={styles.actionTileSub}>
                Réquisition inter-magasin ({selectedStore === 'falaise' ? 'vers Tougou' : 'vers La Falaise'})
              </Text>
            </View>
          </GlassCard>
        </PressableScale>

        <PressableScale
          style={styles.actionTile}
          onPress={() => navigation.navigate('Transfers', { user, storeId: selectedStore })}
          haptic="selection"
        >
          <GlassCard style={styles.actionTileInner}>
            <View style={styles.actionTileIconWrap}>
              <ArrowRightLeft color={colors.gold} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTileTitle}>Suivi des Transferts</Text>
              <Text style={styles.actionTileSub}>Expéditions, coursiers et réceptions</Text>
            </View>
            {inTransitTransfersCount > 0 && (
              <View style={styles.actionBadgePill}>
                <Text style={styles.actionBadgeText}>{inTransitTransfersCount}</Text>
              </View>
            )}
          </GlassCard>
        </PressableScale>

        {isSuperBoss(user) && (
          <>
            <PressableScale
              style={styles.actionTile}
              onPress={() => navigation.navigate('ArrivageHistory', { user, storeId: selectedStore })}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <PackagePlus color={colors.success} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Enregistrer un Arrivage</Text>
                  <Text style={styles.actionTileSub}>Entrée de nouveaux stocks</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={styles.actionTile}
              onPress={() => navigation.navigate('PhysicalInventory', { user, storeId: selectedStore })}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <ClipboardCheck color={colors.info} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Inventaire Physique</Text>
                  <Text style={styles.actionTileSub}>Comptage réel et calcul des écarts</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={styles.actionTile}
              onPress={() => navigation.navigate('BackdatedHistory', { user, storeId: selectedStore })}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <CalendarClock color={colors.gold} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Historique & Saisie antérieure</Text>
                  <Text style={styles.actionTileSub}>Consulter ou saisir un jour passé</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={styles.actionTile}
              onPress={() => setBackupModalVisible(true)}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <Download color={colors.goldLight} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Sauvegardes & CSV</Text>
                  <Text style={styles.actionTileSub}>Export complet des données Excel</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={styles.actionTile}
              onPress={openAuditModal}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <ShieldCheck color={colors.danger} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Journal d'Audit</Text>
                  <Text style={styles.actionTileSub}>Historique des actions sensibles</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={styles.actionTile}
              onPress={openSalesHistoryModal}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <ClipboardList color={colors.warning} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Historique des Ventes</Text>
                  <Text style={styles.actionTileSub}>Recherche par date et annulation</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={styles.actionTile}
              onPress={openTransferSearchModal}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <ArrowRightLeft color={colors.goldLight} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Transfert Manuel</Text>
                  <Text style={styles.actionTileSub}>Déplacer un article par référence</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={styles.actionTile}
              onPress={() => setScannerVisible(true)}
              haptic="selection"
            >
              <GlassCard style={styles.actionTileInner}>
                <View style={styles.actionTileIconWrap}>
                  <ArrowRightLeft color={colors.goldLight} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTileTitle}>Transfert par Scan</Text>
                  <Text style={styles.actionTileSub}>Scanner le code-barres caméra</Text>
                </View>
              </GlassCard>
            </PressableScale>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Actions Bento Grid
  actionsSection: { marginTop: 6, gap: 14 },
  actionsSectionTitle: { ...type.eyebrow, color: colors.gold, fontSize: 12 },
  actionsBentoGrid: { gap: 12 },
  actionsBentoGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  actionTile: { width: '100%' },
  actionTilePrimary: { width: '100%' },
  actionTileInner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.xl },
  actionTileIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  actionTileIconWrapGold: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  actionTileTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  actionTileSub: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  actionTileTitleGold: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  actionTileSubGold: { ...type.caption, color: colors.goldLight, marginTop: 2 },
  actionBadgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.danger, marginLeft: 8 },
  actionBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff' },
});
