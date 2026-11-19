import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PlusCircle, ScanLine, Camera, ArrowRightLeft } from 'lucide-react-native';
import { colors, fonts, radius } from '../../theme';
import { GlassCard, PressableScale, useResponsive } from '../../ui';
import { alpha } from '../../theme';

export interface LedgerActionsGridProps {
  r: ReturnType<typeof useResponsive>;
  setScannerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setScannerMode: React.Dispatch<React.SetStateAction<"sale" | "transfer">>;
  openNewSaleModal: () => void;
  openTransferSearchModal: () => void;
}

/** Grille des actions rapides (vente manuelle, scanner, transferts). */
export default function LedgerActionsGrid({
  r,
  setScannerVisible,
  setScannerMode,
  openNewSaleModal,
  openTransferSearchModal,
}: LedgerActionsGridProps) {
  return (
    <View style={styles.actionsGrid}>
      <PressableScale 
        style={[styles.actionGridItem, { flex: 1, minWidth: r.isMobile ? '47%' : 160 }]}
        onPress={openNewSaleModal}
      >
        <GlassCard style={styles.actionCard} glow="gold">
          <View style={[styles.actionIconCircle, { backgroundColor: alpha(colors.gold, 0.15), borderColor: colors.gold }]}>
            <PlusCircle color={colors.gold} size={22} />
          </View>
          <Text style={styles.actionCardTitle}>Vente Manuelle</Text>
          <Text style={styles.actionCardDesc}>Saisie rapide panier</Text>
        </GlassCard>
      </PressableScale>

      <PressableScale 
        style={[styles.actionGridItem, { flex: 1, minWidth: r.isMobile ? '47%' : 160 }]}
        onPress={() => { setScannerMode('sale'); setScannerVisible(true); }}
      >
        <GlassCard style={styles.actionCard}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
            <Camera color={colors.gold} size={22} />
          </View>
          <Text style={styles.actionCardTitle}>Scanner Article</Text>
          <Text style={styles.actionCardDesc}>Caméra code-barres</Text>
        </GlassCard>
      </PressableScale>

      <PressableScale 
        style={[styles.actionGridItem, { flex: 1, minWidth: r.isMobile ? '47%' : 160 }]}
        onPress={openTransferSearchModal}
      >
        <GlassCard style={styles.actionCard}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
            <ArrowRightLeft color={colors.gold} size={22} />
          </View>
          <Text style={styles.actionCardTitle}>Transfert Manuel</Text>
          <Text style={styles.actionCardDesc}>Expédier article</Text>
        </GlassCard>
      </PressableScale>

      <PressableScale 
        style={[styles.actionGridItem, { flex: 1, minWidth: r.isMobile ? '47%' : 160 }]}
        onPress={() => { setScannerMode('transfer'); setScannerVisible(true); }}
      >
        <GlassCard style={styles.actionCard}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
            <ScanLine color={colors.gold} size={22} />
          </View>
          <Text style={styles.actionCardTitle}>Transfert par Scan</Text>
          <Text style={styles.actionCardDesc}>Scan direct sortie</Text>
        </GlassCard>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionGridItem: {
    minHeight: 110,
  },
  actionCard: {
    padding: 16,
    borderRadius: radius.md,
    height: '100%',
    justifyContent: 'center',
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionCardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  actionCardDesc: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
});
