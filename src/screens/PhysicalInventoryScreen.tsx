import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { ArrowLeft, Search, Check, AlertTriangle, Download, RefreshCw, Barcode, Plus, Minus, Store, CheckCheck } from 'lucide-react-native';
import { applyPhysicalInventory, isUserAdmin, isSuperBoss, getLocalCache } from '../db/database';
import { subscribeResilient } from '../db/resilientSync';
import { downloadCSV } from '../utils/exportHelpers';
import { todayKey } from '../utils/saleMath';
import { colors, fonts, radius, shadow, formatMoney } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, SectionTitle, FadeIn } from '../ui';
import { chrome } from '../ui/screenChrome';
import { alpha } from '../theme';

export default function PhysicalInventoryScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const initialStore = isSuperBoss(user) ? (route.params?.storeId || 'falaise') : (user?.store || 'falaise');
  const [storeId, setStoreId] = useState(initialStore);
  
  const [products, setProducts] = useState<any[]>([]);
  const [countedStocks, setCountedStocks] = useState<Record<string, number>>({});
  const [searchText, setSearchText] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'differences'>('all');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [note, setNote] = useState('');

  const processProductsData = (data: any) => {
    if (!data) {
      setProducts(prev => (prev && prev.length > 0 ? prev : []));
      setLoading(false);
      return;
    }
    const list = Object.keys(data)
      .map(k => ({ id: k, ...data[k] }))
      .filter(p => storeId === 'all' || (p.store || 'falaise').toLowerCase() === storeId.toLowerCase())
      .sort((a, b) => a.name.localeCompare(b.name));

    setProducts(list);

    setCountedStocks(prev => {
      const next = { ...prev };
      list.forEach(p => {
        if (next[p.id] === undefined) {
          next[p.id] = p.stock || 0;
        }
      });
      return next;
    });

    setLoading(false);
  };

  useEffect(() => {
    // 1. Lecture immédiate du cache local (0ms)
    const cached = getLocalCache('loreal_cache_products') || getLocalCache(`loreal_products_${storeId}`);
    if (cached) {
      processProductsData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Souscription résiliente double transport (HTTPS REST + WebSocket)
    const unsubscribe = subscribeResilient(
      'products',
      (data) => {
        if (data) processProductsData(data);
      },
      { cacheKey: 'loreal_cache_products' }
    );

    return () => unsubscribe();
  }, [storeId]);

  const updateCount = (productId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setCountedStocks(prev => ({ ...prev, [productId]: safeVal }));
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchText.trim() || 
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (p.reference && p.reference.toLowerCase().includes(searchText.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchText.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchText.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterMode === 'differences') {
      const counted = countedStocks[p.id] !== undefined ? countedStocks[p.id] : (p.stock || 0);
      return counted !== (p.stock || 0);
    }
    return true;
  });

  const itemsWithDiff = products.filter(p => {
    const counted = countedStocks[p.id] !== undefined ? countedStocks[p.id] : (p.stock || 0);
    return counted !== (p.stock || 0);
  });

  const totalMissingQty = itemsWithDiff.reduce((sum, p) => {
    const counted = countedStocks[p.id] !== undefined ? countedStocks[p.id] : (p.stock || 0);
    const diff = counted - (p.stock || 0);
    return diff < 0 ? sum + Math.abs(diff) : sum;
  }, 0);

  const totalFinancialLoss = itemsWithDiff.reduce((sum, p) => {
    const counted = countedStocks[p.id] !== undefined ? countedStocks[p.id] : (p.stock || 0);
    const diff = counted - (p.stock || 0);
    return diff < 0 ? sum + (Math.abs(diff) * (p.price || 0)) : sum;
  }, 0);

  const handleExportCSV = () => {
    const dateStr = todayKey(); // jour local (nom de fichier)
    const headers = [
      'ID Produit',
      'Code-barres',
      'Nom Article',
      'Catégorie',
      'Taille',
      'Couleur',
      'Référence',
      'Prix Unitaire (FCFA)',
      'Stock Théorique (Système)',
      'Stock Physique (Compté)',
      'Écart Unités',
      'Statut Écart',
      'Impact Financier (FCFA)'
    ];

    const rows = products.map(p => {
      const counted = countedStocks[p.id] !== undefined ? countedStocks[p.id] : (p.stock || 0);
      const diff = counted - (p.stock || 0);
      const financialImpact = diff * (p.price || 0);

      return [
        p.id,
        p.barcode || '',
        p.name || '',
        p.category || '',
        p.size || '',
        p.color || '',
        p.reference || '',
        p.price || 0,
        p.stock || 0,
        counted,
        diff,
        diff === 0 ? 'Conforme' : diff < 0 ? 'Manquant / Perte' : 'Surplus',
        financialImpact
      ];
    });

    downloadCSV(`RAPPORT_INVENTAIRE_${storeId.toUpperCase()}_${dateStr}.csv`, headers, rows);
  };

  const handleApplyInventory = async () => {
    const storeName = storeId === 'falaise' ? 'La Falaise' : 'Tougou';
    const adjustments = products.map(p => {
      const counted = countedStocks[p.id] !== undefined ? countedStocks[p.id] : (p.stock || 0);
      return {
        productId: p.id,
        productName: p.name,
        theoreticalStock: p.stock || 0,
        countedStock: counted,
        difference: counted - (p.stock || 0),
        price: p.price || 0
      };
    });

    const diffCount = adjustments.filter(a => a.difference !== 0).length;

    const proceed = async () => {
      try {
        setIsSaving(true);
        await applyPhysicalInventory(
          storeId,
          adjustments,
          user?.id || 'boss',
          user?.name || 'Boss',
          note || 'Inventaire physique de routine'
        );
        setIsSaving(false);
        const msg = `Inventaire validé pour ${storeName}. ${diffCount} article(s) ajusté(s).`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Succès', msg);
      } catch (e: any) {
        setIsSaving(false);
        Alert.alert('Erreur', e?.message || 'Impossible d\'appliquer l\'inventaire.');
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`Confirmez-vous l'application de cet inventaire pour ${storeName} ?\n\n• ${diffCount} article(s) avec écart.\n• Perte financière enregistrée : ${formatMoney(totalFinancialLoss)} FCFA.`)) {
        proceed();
      }
      return;
    }

    Alert.alert(
      'Validation de l\'inventaire',
      `Confirmez-vous l'application de cet inventaire pour ${storeName} ?\n${diffCount} écart(s) ajusté(s).`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer & Ajuster les stocks', style: 'destructive', onPress: proceed }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retour" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.screenEyebrow} numberOfLines={1}>CONTRÔLE DES RAYONS</Text>
            <Text style={styles.title} numberOfLines={1}>Inventaire Physique</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={styles.exportBtn} 
              onPress={handleExportCSV}
              accessibilityLabel="Exporter le rapport en CSV"
            >
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.goldApplyBtn} 
              onPress={handleApplyInventory}
              disabled={isSaving}
            >
              <CheckCheck color={colors.onGold} size={16} />
              <Text style={styles.goldApplyBtnText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Store Selector */}
        {isSuperBoss(user) && (
          <View style={styles.storeSelector}>
            <TouchableOpacity 
              style={[styles.storeBtn, storeId === 'falaise' && styles.storeBtnActive]} 
              onPress={() => setStoreId('falaise')}
            >
              <Text style={[styles.storeBtnText, storeId === 'falaise' && styles.storeBtnTextActive]}>
                La Falaise
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.storeBtn, storeId === 'tougou' && styles.storeBtnActive]} 
              onPress={() => setStoreId('tougou')}
            >
              <Text style={[styles.storeBtnText, storeId === 'tougou' && styles.storeBtnTextActive]}>
                Tougou
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.storeBtn, storeId === 'all' && styles.storeBtnActive]} 
              onPress={() => setStoreId('all')}
            >
              <Text style={[styles.storeBtnText, storeId === 'all' && styles.storeBtnTextActive]}>
                Tout
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search & Filter Bar */}
        <View style={styles.searchBarRow}>
          <View style={styles.searchBox}>
            <Search color={colors.gold} size={16} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Rechercher nom, code-barres, réf..."
              placeholderTextColor={colors.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <TouchableOpacity 
            style={[styles.filterToggleBtn, filterMode === 'differences' && styles.filterToggleBtnActive]}
            onPress={() => setFilterMode(m => m === 'all' ? 'differences' : 'all')}
          >
            <Text style={[styles.filterToggleText, filterMode === 'differences' && { color: colors.gold, fontWeight: '700' }]}>
              {filterMode === 'differences' ? 'Écarts seuls' : 'Tous'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, r.isWide && styles.listWide]}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <GlassCard style={styles.statsSummary} glow="gold">
              <View style={styles.statCol}>
                <Text style={styles.statVal}>{products.length}</Text>
                <Text style={styles.statLbl}>Articles vérifiés</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, itemsWithDiff.length > 0 && { color: colors.warning }]}>
                  {itemsWithDiff.length}
                </Text>
                <Text style={styles.statLbl}>Écarts constatés</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, totalMissingQty > 0 && { color: colors.danger }]}>
                  {totalMissingQty > 0 ? `-${totalMissingQty}` : 0}
                </Text>
                <Text style={styles.statLbl}>Manquants</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, totalFinancialLoss > 0 && { color: colors.danger }]}>
                  {formatMoney(totalFinancialLoss)} F
                </Text>
                <Text style={styles.statLbl}>Valeur perte</Text>
              </View>
            </GlassCard>
          </View>
        }
        renderItem={({ item, index }) => {
          const counted = countedStocks[item.id] !== undefined ? countedStocks[item.id] : (item.stock || 0);
          const diff = counted - (item.stock || 0);

          return (
            <FadeIn delay={index * 15}>
              <GlassCard 
                style={[
                  styles.itemCard, 
                  diff !== 0 && (diff < 0 ? styles.itemCardDeficit : styles.itemCardSurplus)
                ]}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.category ? `${item.category} ` : ''}
                    {item.size ? `• Taille: ${item.size} ` : ''}
                    {item.color ? `• Couleur: ${item.color} ` : ''}
                  </Text>
                  <Text style={styles.itemPrice}>{formatMoney(item.price || 0)} FCFA</Text>
                </View>

                <View style={styles.counterSection}>
                  <View style={styles.theoryBox}>
                    <Text style={styles.theoryLabel}>Système</Text>
                    <Text style={styles.theoryVal}>{item.stock || 0}</Text>
                  </View>

                  <View style={styles.stepperContainer}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Diminuer la quantité" hitSlop={{ top: 8, bottom: 8 }} 
                      style={styles.stepBtn}
                      onPress={() => updateCount(item.id, counted - 1)}
                    >
                      <Minus color={colors.textPrimary} size={14} />
                    </TouchableOpacity>
                    
                    <TextInput 
                      style={styles.stepInput}
                      keyboardType="numeric"
                      value={counted.toString()}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        updateCount(item.id, isNaN(parsed) ? 0 : parsed);
                      }}
                    />

                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Augmenter la quantité" hitSlop={{ top: 8, bottom: 8 }} 
                      style={styles.stepBtn}
                      onPress={() => updateCount(item.id, counted + 1)}
                    >
                      <Plus color={colors.textPrimary} size={14} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.diffBadge, diff === 0 ? styles.diffBadgeOk : diff < 0 ? styles.diffBadgeDeficit : styles.diffBadgeSurplus]}>
                    <Text style={[styles.diffText, diff === 0 ? { color: colors.success } : diff < 0 ? { color: colors.danger } : { color: colors.info }]}>
                      {diff === 0 ? 'Conforme' : diff > 0 ? `+${diff}` : `${diff}`}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </FadeIn>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Chargement des articles...</Text>
            </View>
          ) : (
            <GlassCard style={styles.emptyBox}>
              <Check color={colors.textTertiary} size={42} />
              <Text style={styles.emptyTitle}>Aucun article dans cette vue</Text>
              <Text style={styles.emptySubtitle}>Tous les articles comptés correspondent au stock théorique.</Text>
            </GlassCard>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  header: { ...chrome.header },
  headerRow: { ...chrome.headerRow },
  backBtn: { ...chrome.backBtn, marginRight: 10 },
  headerTitleBox: { ...chrome.headerTitleBox },
  screenEyebrow: { ...chrome.screenEyebrow },
  title: { ...chrome.title },
  exportBtn: { ...chrome.iconBtn },
  goldApplyBtn: { ...chrome.goldBtn },
  goldApplyBtnText: { ...chrome.goldBtnText },
  storeSelector: { ...chrome.segGroup, marginBottom: 10 },
  storeBtn: { ...chrome.storeBtn },
  storeBtnActive: { ...chrome.storeBtnActive },
  storeBtnText: { ...chrome.storeBtnText },
  storeBtnTextActive: { ...chrome.storeBtnTextActive },
  searchBarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  filterToggleBtn: {
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  filterToggleBtnActive: { ...chrome.storeBtnActive },
  filterToggleText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    gap: 10,
  },
  listWide: {
    paddingHorizontal: 28,
  },
  statsSummary: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: radius.md,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  statLbl: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.glassBorder,
  },
  itemCard: {
    padding: 14,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemCardDeficit: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: alpha(colors.danger, 0.03),
  },
  itemCardSurplus: {
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
    backgroundColor: alpha(colors.info, 0.03),
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  itemMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  itemPrice: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: fonts.bold,
  },
  counterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  theoryBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  theoryLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  theoryVal: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  stepBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    width: 40,
    textAlign: 'center',
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    paddingVertical: 4,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.xs,
    minWidth: 70,
    alignItems: 'center',
  },
  diffBadgeOk: {
    backgroundColor: alpha(colors.success, 0.1),
  },
  diffBadgeDeficit: {
    backgroundColor: alpha(colors.danger, 0.1),
  },
  diffBadgeSurplus: {
    backgroundColor: alpha(colors.info, 0.1),
  },
  diffText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.gold,
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginTop: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    fontFamily: fonts.sans,
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
});
