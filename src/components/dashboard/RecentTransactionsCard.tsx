import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Trash2, Eye } from 'lucide-react-native';
import { isSuperBoss } from '../../db/database';
import { GlassCard, fonts, formatMoney, colors, radius, type } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface RecentTransactionsCardProps {
  user: any;
  filter: string;
  recentSales: any[];
  searchSaleText: string;
  setSearchSaleText: React.Dispatch<React.SetStateAction<string>>;
  handleDeleteSale: (saleOrId: any, context?: string) => void;
  handleOpenSaleDetail: (sale: any) => void;
  filterLabels: Record<string, string>;
}

/** Liste des transactions récentes (jour / hier). */
export default function RecentTransactionsCard({
  user,
  filter,
  recentSales,
  searchSaleText,
  setSearchSaleText,
  handleDeleteSale,
  handleOpenSaleDetail,
  filterLabels,
}: RecentTransactionsCardProps) {
  const { colors } = useAppTheme();
  return (
    <GlassCard style={styles.historyCard}>
      <Text style={styles.historyTitle}>
        {!isSuperBoss(user) ? "Ventes enregistrées aujourd'hui" : `Transactions · ${filterLabels[filter]}`}
      </Text>

      <TextInput
        style={styles.historySearchInput}
        placeholder="Rechercher une transaction par article..."
        placeholderTextColor={colors.textDim}
        value={searchSaleText}
        onChangeText={setSearchSaleText}
      />

      {recentSales
        .filter((sale) => {
          if (!searchSaleText) return true;
          const term = searchSaleText.toLowerCase();
          const itemsStr =
            typeof sale.items === 'string'
              ? sale.items
              : Array.isArray(sale.items)
              ? sale.items.map((i: any) => i.name).join(', ')
              : 'Article';
          return itemsStr.toLowerCase().includes(term);
        })
        .map((sale, i) => (
          <TouchableOpacity 
            key={sale.id || i} 
            style={[styles.historyItem, { cursor: 'pointer' as any }]}
            onPress={() => handleOpenSaleDetail(sale)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.historyItemName} numberOfLines={1}>
                {sale.sale_label || (typeof sale.items === 'string'
                  ? sale.items
                  : Array.isArray(sale.items)
                  ? sale.items.map((i: any) => i.name).join(', ')
                  : 'Article')}
              </Text>
              <Text style={styles.historyItemDate}>
                {new Date(sale.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} —{' '}
                {new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                {sale.seller_name ? ` · ${sale.seller_name}` : ''}
              </Text>
              <Text style={{ color: colors.gold, fontSize: 12, marginTop: 2, fontFamily: fonts.semibold }}>
                👁️ Voir l'intégralité de l'achat
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.historyItemTotal}>{formatMoney(sale.total)} F</Text>
                <Text
                  style={[
                    styles.historyItemMethod,
                    sale.payment_method === 'Espèces' && { color: colors.success },
                    sale.payment_method === 'MoMo' && { color: colors.warning },
                    sale.payment_method === 'OM' && { color: '#FF5722' },
                    sale.payment_method === 'Avance' && { color: colors.warning },
                  ]}
                >
                  {sale.payment_method}
                </Text>
              </View>
              <View style={{ padding: 4, justifyContent: 'center' }}>
                <Eye color={colors.goldLight} size={18} />
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Supprimer" hitSlop={{ top: 8, bottom: 8 }} 
                onPress={(e) => {
                  if (e && e.stopPropagation) e.stopPropagation();
                  handleDeleteSale(sale, 'dashboard');
                }} 
                style={{ padding: 6 }}
              >
                <Trash2 color={colors.danger} size={16} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  historyCard: { padding: 20, borderRadius: radius.xxl, gap: 12 },
  historyTitle: { ...type.h2, fontSize: 17, color: colors.text },
  historySearchInput: {
    height: 44,
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyItemName: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  historyItemDate: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  historyItemTotal: { color: colors.gold, fontSize: 15, fontFamily: fonts.bold },
  historyItemMethod: { color: colors.info, fontSize: 12, marginTop: 2 },
});
