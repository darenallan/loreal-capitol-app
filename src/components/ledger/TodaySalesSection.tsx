import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trash2, Edit3, Printer, Clock, ShoppingBag } from 'lucide-react-native';
import { colors, formatMoney, fonts, radius } from '../../theme';
import { GlassCard, PressableScale, Pill, FadeIn } from '../../ui';
import { alpha } from '../../theme';

const paymentBadgeColor = (method: string) => {
  switch (method) {
    case 'Carte Bancaire': return { bg: alpha(colors.info, 0.12), border: alpha(colors.info, 0.4), text: colors.info };
    case 'MoMo':
    case 'MoMo Boss': return { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.4)', text: '#EAB308' };
    case 'OM':
    case 'OM Boss': return { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)', text: '#F97316' };
    case 'Avance': return { bg: alpha(colors.warning, 0.15), border: alpha(colors.warning, 0.4), text: colors.warning };
    case 'Ami / Don': return { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.4)', text: '#C084FC' };
    default: return { bg: alpha(colors.success, 0.12), border: alpha(colors.success, 0.4), text: colors.success };
  }
};

export interface TodaySalesSectionProps {
  user: any;
  todaySales: any[];
  totalToday: number;
  setReceiptModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedReceiptSale: React.Dispatch<any>;
  handleDeleteSale: (saleOrId: any) => void;
  openEditOptions: (sale: any) => void;
}

/** Liste des ventes enregistrées aujourd'hui. */
export default function TodaySalesSection({
  user,
  todaySales,
  totalToday,
  setReceiptModalVisible,
  setSelectedReceiptSale,
  handleDeleteSale,
  openEditOptions,
}: TodaySalesSectionProps) {
  return (
    <View style={styles.salesSection}>
      <View style={styles.salesSectionHeader}>
        <View>
          <Text style={styles.salesSectionEyebrow}>JOURNAL EN DIRECT</Text>
          <Text style={styles.salesSectionTitle}>Ventes Enregistrées ({todaySales.length})</Text>
        </View>
        <Pill label={`${formatMoney(totalToday)} FCFA`} tone="gold" size="sm" />
      </View>

      {todaySales.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <ShoppingBag color={colors.textTertiary} size={42} />
          <Text style={styles.emptyTitle}>Aucune vente enregistrée aujourd'hui</Text>
          <Text style={styles.emptySubtitle}>Utilisez "Vente Manuelle" ou le scanner pour démarrer la caisse.</Text>
        </GlassCard>
      ) : (
        <View style={styles.salesList}>
          {todaySales.map((item, index) => {
            const badge = paymentBadgeColor(item.payment_method);
            return (
              <FadeIn key={item.id} delay={index * 30}>
                <GlassCard 
                  style={[styles.saleCard, item.is_advance === 1 && styles.saleCardAdvance]}
                  glow={item.is_advance === 1 ? 'none' : 'none'}
                >
                  <View style={styles.saleHeaderRow}>
                    <View style={styles.saleIndexBadge}>
                      <Text style={styles.saleIndexText}>N°{String(index + 1).padStart(3, '0')}</Text>
                    </View>
                    <View style={styles.saleTimeTag}>
                      <Clock color={colors.textTertiary} size={11} style={{ marginRight: 3 }} />
                      <Text style={styles.saleTimeText}>
                        {new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.saleBody}>
                    <Text style={styles.saleItemNames}>{item.items}</Text>
                    {item.sizes ? (
                      <Text style={styles.saleItemMeta}>Tailles : {item.sizes}</Text>
                    ) : null}
                    <Text style={styles.saleSellerText}>Vendeur : {item.seller_name}</Text>
                  </View>

                  <View style={styles.saleFooterRow}>
                    <View>
                      <Text style={styles.saleAmountText}>{formatMoney(item.total)} FCFA</Text>
                      <View style={[styles.methodBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                        <Text style={[styles.methodBadgeText, { color: badge.text }]}>
                          {item.payment_method}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.saleActionsRow}>
                      <PressableScale accessibilityRole="button" accessibilityLabel="Imprimer le reçu" hitSlop={{ top: 8, bottom: 8 }} 
                        onPress={() => {
                          setSelectedReceiptSale({
                            ...item,
                            items: item.rawItems || item.items,
                            seller_name: item.seller_name || user?.name
                          });
                          setReceiptModalVisible(true);
                        }} 
                        style={styles.saleActionBtn}
                      >
                        <Printer color={colors.gold} size={16} />
                      </PressableScale>

                      <PressableScale accessibilityRole="button" accessibilityLabel="Modifier" hitSlop={{ top: 8, bottom: 8 }} 
                        onPress={() => openEditOptions(item)} 
                        style={styles.saleActionBtn}
                      >
                        <Edit3 color={colors.textSecondary} size={16} />
                      </PressableScale>

                      <PressableScale accessibilityRole="button" accessibilityLabel="Supprimer" hitSlop={{ top: 8, bottom: 8 }} 
                        onPress={() => handleDeleteSale(item)} 
                        style={[styles.saleActionBtn, styles.saleDeleteBtn]}
                      >
                        <Trash2 color={colors.danger} size={16} />
                      </PressableScale>
                    </View>
                  </View>
                </GlassCard>
              </FadeIn>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  salesSection: {
    marginTop: 4,
  },
  salesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  salesSectionEyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
    marginBottom: 2,
  },
  salesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  salesList: {
    gap: 12,
  },
  saleCard: {
    padding: 16,
    borderRadius: radius.md,
  },
  saleCardAdvance: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  saleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleIndexBadge: {
    backgroundColor: alpha(colors.gold, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.25),
  },
  saleIndexText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  saleTimeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saleTimeText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  saleBody: {
    marginBottom: 12,
  },
  saleItemNames: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.sans,
    lineHeight: 20,
  },
  saleItemMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  saleSellerText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  saleFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    paddingTop: 12,
  },
  saleAmountText: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: fonts.serif,
  },
  methodBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  methodBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  saleActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saleActionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  saleDeleteBtn: {
    backgroundColor: alpha(colors.danger, 0.08),
    borderColor: alpha(colors.danger, 0.3),
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    fontFamily: fonts.sans,
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 300,
    fontFamily: fonts.sans,
  },
});
