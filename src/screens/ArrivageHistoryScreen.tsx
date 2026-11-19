import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { ArrowLeft, PackagePlus, Plus, Search, X, Calendar, User, Store, Check, Layers } from 'lucide-react-native';
import { recordArrivage, getLocalCache } from '../db/database';
import { subscribeResilient } from '../db/resilientSync';
import { colors, fonts, radius, shadow, formatMoney } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, SectionTitle, FadeIn } from '../ui';
import { chrome } from '../ui/screenChrome';
import { alpha } from '../theme';

export default function ArrivageHistoryScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const initialStore = route.params?.storeId || (user?.store === 'all' ? 'falaise' : (user?.store || 'falaise'));
  const [storeId, setStoreId] = useState(initialStore);
  const [arrivages, setArrivages] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [arrivageQty, setArrivageQty] = useState('');
  const [modalSearchText, setModalSearchText] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  const [loading, setLoading] = useState(true);

  const applyArrivages = (data: any) => {
    if (!data) {
      setArrivages([]);
      setLoading(false);
      return;
    }
    const allArrivages = Object.keys(data).map(k => ({ id: k, ...data[k] }));
    const sortedArrivages = allArrivages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setArrivages(sortedArrivages);
    setLoading(false);
  };

  useEffect(() => {
    // 1. Lecture immédiate du cache local (0ms)
    const cached = getLocalCache('loreal_cache_arrivages');
    if (cached) {
      applyArrivages(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Souscription résiliente double transport (HTTPS REST + WebSocket)
    const unsubscribe = subscribeResilient(
      'arrivages',
      (data) => {
        if (data) applyArrivages(data);
      },
      { cacheKey: 'loreal_cache_arrivages' }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Charger immédiatement les produits du cache pour le modal de nouvel arrivage
    const cachedProds = getLocalCache('loreal_cache_products');
    if (cachedProds) {
      const pList = Object.keys(cachedProds)
        .map(k => ({ id: k, ...cachedProds[k] }))
        .filter(p => storeId === 'all' || (p.store || 'falaise').toLowerCase() === (storeId || 'falaise').toLowerCase());
      setProducts(pList.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }

    const unsubscribe = subscribeResilient(
      'products',
      (data) => {
        if (!data) return;
        const productsList = Object.keys(data)
          .map(k => ({ id: k, ...data[k] }))
          .filter(p => storeId === 'all' || (p.store || 'falaise').toLowerCase() === (storeId || 'falaise').toLowerCase());
        setProducts(productsList.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      },
      { cacheKey: 'loreal_cache_products' }
    );

    return () => unsubscribe();
  }, [storeId]);

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute:'2-digit' });
  };

  const handleRecordArrivage = () => {
    if (!selectedProduct) {
      Alert.alert('Erreur', 'Veuillez sélectionner un produit.');
      return;
    }
    if (!arrivageQty) {
      Alert.alert('Erreur', 'Veuillez entrer la quantité reçue.');
      return;
    }
    const qty = parseInt(arrivageQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'La quantité doit être un nombre positif.');
      return;
    }

    const prodName = selectedProduct.name;
    setModalVisible(false);
    setSelectedProduct(null);
    setArrivageQty('');
    setModalSearchText('');

    recordArrivage(selectedProduct.id, selectedProduct.name, qty, user?.name || 'Inconnu', storeId)
      .then(() => {
        Alert.alert('Arrivage enregistré', `+${qty} unités de "${prodName}" ajoutées au stock.`);
      })
      .catch(e => {
        console.error('Erreur arrivage:', e);
        Alert.alert('Erreur', 'Impossible d\'enregistrer l\'arrivage.');
      });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(modalSearchText.toLowerCase())
  );

  const filteredArrivages = arrivages.filter(a => {
    if (user?.store === 'all' && storeId !== 'all') {
      if (a.store && a.store !== storeId) return false;
    }
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase().trim();
    const matchProduct = (a.product_name || '').toLowerCase().includes(q);
    const matchUser = (a.user_id || '').toLowerCase().includes(q);
    return matchProduct || matchUser;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retour" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.screenEyebrow}>RÉCEPTION MARCHANDISES</Text>
            <Text style={styles.title}>Historique des Arrivages</Text>
          </View>

          <TouchableOpacity style={styles.goldAddBtn} onPress={() => setModalVisible(true)}>
            <Plus color={colors.onGold} size={16} />
            <Text style={styles.goldAddBtnText}>Arrivage</Text>
          </TouchableOpacity>
        </View>

        {/* Store Selector */}
        {user?.store === 'all' && (
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
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search color={colors.gold} size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par article ou réceptionnaire..."
            placeholderTextColor={colors.textTertiary}
            value={historySearchQuery}
            onChangeText={setHistorySearchQuery}
            autoCorrect={false}
          />
          {historySearchQuery.length > 0 && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setHistorySearchQuery('')} style={{ padding: 4 }}>
              <X color={colors.textTertiary} size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredArrivages}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, r.isWide && styles.listWide]}
        ListHeaderComponent={
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              {filteredArrivages.length} arrivage{filteredArrivages.length > 1 ? 's' : ''} ({filteredArrivages.reduce((sum, a) => sum + (a.quantity || 0), 0)} articles réceptionnés)
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <FadeIn delay={index * 20}>
            <GlassCard style={styles.arrivageCard}>
              <View style={styles.arrivageTop}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.productName}>{item.product_name}</Text>
                  <Text style={styles.userText}>Enregistré par : {item.user_id}</Text>
                </View>

                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>+{item.quantity}</Text>
                </View>
              </View>

              <View style={styles.arrivageBottom}>
                <View style={styles.dateRow}>
                  <Calendar color={colors.gold} size={12} style={{ marginRight: 5 }} />
                  <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                </View>

                {item.store ? (
                  <View style={styles.storeBadge}>
                    <Text style={styles.storeBadgeText}>
                      {item.store === 'falaise' ? 'La Falaise' : 'Tougou'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GlassCard>
          </FadeIn>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Chargement des arrivages...</Text>
            </View>
          ) : (
            <GlassCard style={styles.emptyBox}>
              <PackagePlus color={colors.textTertiary} size={42} />
              <Text style={styles.emptyTitle}>
                {historySearchQuery.trim() ? `Aucun arrivage pour "${historySearchQuery}"` : 'Aucun arrivage enregistré'}
              </Text>
              <Text style={styles.emptySubtitle}>Appuyez sur "Arrivage" pour enregistrer une réception de stock.</Text>
            </GlassCard>
          )
        }
      />

      {/* Modal Nouvel Arrivage */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
            <GlassCard style={[styles.modalCard, { width: 440, maxWidth: '94%' }]} glow="gold">
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalEyebrow}>RÉCEPTION EN MAGASIN</Text>
                  <Text style={styles.modalTitle}>Nouvel Arrivage</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <X color={colors.textSecondary} size={18} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Produit reçu *</Text>
              {selectedProduct ? (
                <View style={styles.selectedProductBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                    <Text style={styles.selectedProductInfo}>
                      {selectedProduct.category} {selectedProduct.size ? `• T: ${selectedProduct.size}` : ''} • Stock actuel: {selectedProduct.stock}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setSelectedProduct(null); setShowProductPicker(true); }} style={styles.changeProductBtn}>
                    <Text style={styles.changeProductText}>Changer</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.modalSearchBox}>
                    <Search color={colors.gold} size={16} />
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Rechercher un produit..."
                      placeholderTextColor={colors.textTertiary}
                      value={modalSearchText}
                      onChangeText={(text) => { setModalSearchText(text); setShowProductPicker(true); }}
                      onFocus={() => setShowProductPicker(true)}
                    />
                  </View>
                  {showProductPicker && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredProducts.map(p => (
                          <TouchableOpacity 
                            key={p.id} 
                            style={styles.dropdownItem} 
                            onPress={() => {
                              setSelectedProduct(p);
                              setShowProductPicker(false);
                            }}
                          >
                            <Text style={styles.dropdownName}>{p.name}</Text>
                            <Text style={styles.dropdownStock}>Stock: {p.stock}</Text>
                          </TouchableOpacity>
                        ))}
                        {filteredProducts.length === 0 && (
                          <Text style={styles.dropdownEmpty}>Aucun produit en stock</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>Quantité Reçue *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: 24" 
                placeholderTextColor={colors.textTertiary} 
                keyboardType="numeric" 
                value={arrivageQty} 
                onChangeText={setArrivageQty} 
              />

              <View style={{ gap: 8, marginTop: 15 }}>
                <GoldButton 
                  label="Enregistrer l'Arrivage"
                  onPress={handleRecordArrivage}
                  size="md"
                  icon={<Check color={colors.onGold} size={16} />}
                />
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </ScrollView>
        </View>
      </Modal>
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
  goldAddBtn: { ...chrome.goldBtn },
  goldAddBtnText: { ...chrome.goldBtnText },
  storeSelector: { ...chrome.segGroup, marginBottom: 10 },
  storeBtn: { ...chrome.storeBtn },
  storeBtnActive: { ...chrome.storeBtnActive },
  storeBtnText: { ...chrome.storeBtnText },
  storeBtnTextActive: { ...chrome.storeBtnTextActive },
  searchBar: {
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
  summaryBar: {
    marginBottom: 10,
  },
  summaryText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    gap: 10,
  },
  listWide: {
    paddingHorizontal: 28,
  },
  arrivageCard: {
    padding: 14,
    borderRadius: radius.md,
  },
  arrivageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  userText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  qtyBadge: {
    backgroundColor: alpha(colors.success, 0.12),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.success, 0.3),
  },
  qtyBadgeText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  arrivageBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    paddingTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  storeBadge: {
    backgroundColor: alpha(colors.gold, 0.08),
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  storeBadgeText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  modalCard: {
    width: '100%',
    padding: 22,
    borderRadius: radius.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalEyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.serif,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
    fontFamily: fonts.sans,
  },
  selectedProductBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: alpha(colors.gold, 0.08),
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
  },
  selectedProductName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  selectedProductInfo: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  changeProductBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  changeProductText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    height: 42,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    height: 42,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  dropdownList: {
    backgroundColor: '#121217',
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
    borderRadius: radius.sm,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  dropdownName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  dropdownStock: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  dropdownEmpty: {
    color: colors.textTertiary,
    padding: 12,
    textAlign: 'center',
    fontSize: 12,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    height: 44,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
});
