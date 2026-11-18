import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Modal, Linking, Platform, ActivityIndicator } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { 
  ArrowLeft, Clock, CheckCircle, MessageCircle, Download, AlertTriangle, 
  Search, X, Calendar, CheckCheck, FileText, Store, ChevronRight, Check,
  Wallet, User, Tag, Sparkles, Printer, Trash2
} from 'lucide-react-native';
import { addAdvancePayment, deleteAdvanceAndRestoreStock, isSuperBoss, getAdvanceStore, getLocalCache } from '../db/database';
import { subscribeResilient } from '../db/resilientSync';
import { exportAdvancesCSV } from '../utils/exportHelpers';
import { cleanWhatsAppNumber, buildReceiptMessage, buildWhatsAppUrl, openExternalUrl, shareReceiptWhatsApp } from '../utils/receiptShare';
import ReceiptModal from '../components/ReceiptModal';
import { colors, fonts, radius, shadow, formatMoney } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, SectionTitle, FadeIn } from '../ui';
import { chrome } from '../ui/screenChrome';
import { alpha } from '../theme';

export default function AdvancesScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const initialStore = (!isSuperBoss(user) && user?.store) 
    ? (user.store === 'all' ? (route.params?.storeId || 'falaise') : user.store)
    : (route.params?.storeId || 'falaise');
  const [storeId, setStoreId] = useState(initialStore);
  const effectiveStore = isSuperBoss(user) ? storeId : (user?.store || initialStore || 'falaise');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [advances, setAdvances] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Espèces');

  // État suppression d'avance et réintégration en stock
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState<any>(null);
  const [isDeletingAdvance, setIsDeletingAdvance] = useState(false);

  const filteredAdvances = advances.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchClient = (a.client_name || '').toLowerCase().includes(q);
    const matchProduct = (a.product_name || '').toLowerCase().includes(q);
    const matchRef = (a.reference || '').toLowerCase().includes(q);
    const matchSize = (a.size || '').toLowerCase().includes(q);
    const matchColor = (a.color || '').toLowerCase().includes(q);
    const matchItems = Array.isArray(a.items) && a.items.some((it: any) =>
      (it.name || '').toLowerCase().includes(q) ||
      (it.reference || '').toLowerCase().includes(q) ||
      (it.size || '').toLowerCase().includes(q) ||
      (it.color || '').toLowerCase().includes(q)
    );
    return matchClient || matchProduct || matchRef || matchSize || matchColor || matchItems;
  });

  const processAdvancesData = (data: any) => {
    if (!data) {
      setAdvances([]);
      return;
    }
    const allList = Object.keys(data)
      .map(k => ({ id: k, ...data[k] }))
      .filter(a => {
        if (effectiveStore === 'all') return true;
        const aStore = getAdvanceStore(a);
        return aStore === effectiveStore.toLowerCase();
      })
      .sort((a, b) => {
        if (a.status === 'completed' && b.status === 'completed') {
          return new Date(b.completed_at || b.last_payment_date || 0).getTime() - new Date(a.completed_at || a.last_payment_date || 0).getTime();
        }
        if (a.status === 'pending' && b.status === 'pending') {
          return (a.due_date || '').localeCompare(b.due_date || '');
        }
        return a.status === 'pending' ? -1 : 1;
      });
    setAdvances(allList);
  };

  useEffect(() => {
    // 1. Lecture immédiate du cache local (0ms)
    const cached = getLocalCache('loreal_cache_advances');
    if (cached) {
      processAdvancesData(cached);
    }

    // 2. Souscription résiliente double transport (HTTPS REST + WebSocket)
    const unsubscribe = subscribeResilient(
      'advances',
      (data) => {
        if (data) processAdvancesData(data);
      },
      { cacheKey: 'loreal_cache_advances' }
    );

    return () => unsubscribe();
  }, [effectiveStore]);

  const openAdvanceReceipt = (advance: any, specificPayment?: any, trancheIndex?: number) => {
    const totalVal = (advance.amount_paid || 0) + (advance.amount_remaining || 0);
    const isCompleted = (advance.amount_remaining || 0) <= 0 || advance.status === 'completed';
    
    const receiptAmount = specificPayment
      ? specificPayment.amount
      : (advance.amount_paid !== undefined && advance.amount_paid !== null ? Number(advance.amount_paid) : totalVal);
    const receiptMethod = specificPayment ? specificPayment.method : (advance.payments?.[advance.payments.length - 1]?.method || 'Espèces');
    const receiptDate = specificPayment ? specificPayment.date : (advance.completed_at || advance.last_payment_date || advance.created_at || new Date().toISOString());

    const receiptObj = {
      id: advance.sale_id || advance.id,
      advance_id: advance.id,
      ticketType: specificPayment ? 'installment' : 'advance',
      installmentNum: trancheIndex,
      client_name: advance.client_name,
      clientName: advance.client_name,
      client_phone: advance.client_phone || advance.phone || '',
      total: receiptAmount,
      article_total: totalVal,
      date: receiptDate,
      payment_method: receiptMethod,
      items: Array.isArray(advance.items) && advance.items.length > 0 
        ? advance.items 
        : [{ 
            name: advance.product_name || 'Articles Réservés', 
            quantity: 1, 
            price: totalVal, 
            reference: advance.reference, 
            size: advance.size, 
            color: advance.color 
          }],
      store: advance.store || effectiveStore,
      seller_name: advance.seller_name || user?.name || 'L\'Oréal Capitol',
      is_advance: 1,
      advanceData: {
        clientName: advance.client_name,
        clientPhone: advance.client_phone || advance.phone || '',
        amountPaid: advance.amount_paid || 0,
        amountRemaining: advance.amount_remaining || 0,
        totalArticles: totalVal,
        dueDate: advance.due_date,
        isCompleted: isCompleted,
        payments: advance.payments || [],
        specificPayment: specificPayment || null,
        installmentNum: trancheIndex
      }
    };

    setSelectedReceiptSale(receiptObj);
    setReceiptModalVisible(true);
  };

  const openPaymentModal = (advance: any) => {
    setSelectedAdvance(advance);
    setPaymentAmount(advance.amount_remaining.toString());
    setPaymentMethod('Espèces');
    setPaymentModalVisible(true);
  };

  const handlePaymentSubmit = async (channel: 'whatsapp' | 'none' = 'none') => {
    if (!selectedAdvance) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedAdvance.amount_remaining) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Montant invalide.');
      else Alert.alert('Erreur', 'Montant invalide.');
      return;
    }

    const cleanPhone = cleanWhatsAppNumber(selectedAdvance.client_phone || selectedAdvance.phone);
    const currentPaid = (selectedAdvance.amount_paid || 0) + amount;
    const currentRemain = Math.max(0, (selectedAdvance.amount_remaining || 0) - amount);
    const isCompleted = currentRemain <= 0;
    const totalVal = (selectedAdvance.amount_paid || 0) + (selectedAdvance.amount_remaining || 0);
    
    const receiptObj = {
      id: `REC-${Date.now().toString(36).toUpperCase()}`,
      client_name: selectedAdvance.client_name,
      clientName: selectedAdvance.client_name,
      client_phone: selectedAdvance.client_phone || selectedAdvance.phone || '',
      total: amount,
      article_total: totalVal,
      date: new Date().toISOString(),
      payment_method: paymentMethod,
      items: Array.isArray(selectedAdvance.items) && selectedAdvance.items.length > 0 
        ? selectedAdvance.items 
        : [{ name: selectedAdvance.product_name || 'Articles Réservés', quantity: 1, price: totalVal, size: selectedAdvance.size, color: selectedAdvance.color, reference: selectedAdvance.reference }],
      store: selectedAdvance.store || effectiveStore,
      seller_name: user?.name || 'Vendeur',
      is_advance: 1,
      ticketType: isCompleted ? 'advance' : 'installment',
      advanceData: {
        clientName: selectedAdvance.client_name,
        clientPhone: selectedAdvance.client_phone || selectedAdvance.phone || '',
        amountPaid: currentPaid,
        amountRemaining: currentRemain,
        totalArticles: totalVal,
        dueDate: selectedAdvance.due_date,
        isCompleted,
        payments: [...(selectedAdvance.payments || []), { amount, method: paymentMethod, date: new Date().toISOString() }],
        specificPayment: { amount, method: paymentMethod, date: new Date().toISOString() },
        installmentNum: (selectedAdvance.payments?.length || 0) + 1
      }
    };

    setPaymentModalVisible(false);

    try {
      const result = await addAdvancePayment(selectedAdvance.id, amount, paymentMethod, user?.id, user?.name);
      if (result?.saleId) {
        receiptObj.id = result.saleId;
      }
      setAdvances(prev => prev.map(a => a.id === selectedAdvance.id ? {
        ...a,
        amount_paid: currentPaid,
        amount_remaining: currentRemain,
        status: isCompleted ? 'completed' : 'pending',
        payments: [...(a.payments || []), { amount, method: paymentMethod, date: new Date().toISOString() }]
      } : a));
      setSelectedReceiptSale(receiptObj);
      setReceiptModalVisible(true);
      setSelectedAdvance(null);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(result?.isCompleted ? 'Avance entièrement soldée ! Vente enregistrée en caisse.' : 'Versement enregistré avec succès en caisse !');
      } else {
        Alert.alert('Succès', result?.isCompleted ? 'Avance soldée !' : 'Tranche enregistrée en caisse !');
      }
    } catch (e: any) {
      if (typeof window !== 'undefined' && window.alert) window.alert(e?.message || 'Erreur lors du paiement.');
      else Alert.alert('Erreur', e?.message || 'Impossible d\'enregistrer le paiement.');
    }
  };

  const openDeleteConfirmModal = (advance: any) => {
    setAdvanceToDelete(advance);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteAdvance = async (restoreStock: boolean = true) => {
    if (!advanceToDelete) return;
    setIsDeletingAdvance(true);
    try {
      const targetId = advanceToDelete.id;
      const res = await deleteAdvanceAndRestoreStock(targetId, user, restoreStock);
      // Mise à jour immédiate de l'état local
      setAdvances(prev => prev.filter(a => a.id !== targetId));
      setDeleteModalVisible(false);
      setAdvanceToDelete(null);

      const storeName = res.store === 'tougou' ? 'Tougou' : 'La Falaise';
      if (restoreStock) {
        const itemsDetail = res.restoredItems && res.restoredItems.length > 0 
          ? res.restoredItems.join('\n') 
          : (advanceToDelete.product_name || 'Articles réservés');
        const successMsg = `L'avance a été supprimée avec succès.\n\nArticles automatiquement remis dans le stock (${storeName}) :\n${itemsDetail}`;
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(successMsg);
        } else {
          Alert.alert('Avance Supprimée & Stock Réintégré', successMsg);
        }
      } else {
        const successMsg = `L'avance a été supprimée définitivement (sans modification du stock de ${storeName}).`;
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(successMsg);
        } else {
          Alert.alert('Suppression Définitive', successMsg);
        }
      }
    } catch (e: any) {
      console.error('Erreur suppression avance:', e);
      const errMsg = e?.message || "Impossible de supprimer l'avance.";
      if (typeof window !== 'undefined' && window.alert) window.alert(errMsg);
      else Alert.alert('Erreur', errMsg);
    } finally {
      setIsDeletingAdvance(false);
    }
  };

  const getDueStatus = (dueDateStr: string) => {
    if (!dueDateStr) return { isOverdue: false, label: 'Date non définie', color: colors.textTertiary, tone: 'neutral' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return { 
        isOverdue: true, 
        label: `Retard : +${diffDays} jour${diffDays > 1 ? 's' : ''}`, 
        color: colors.danger,
        tone: 'danger'
      };
    } else if (diffDays === 0) {
      return { 
        isDueToday: true, 
        label: `Échéance aujourd'hui`, 
        color: colors.warning,
        tone: 'warning'
      };
    } else if (Math.abs(diffDays) <= 3) {
      return { 
        isDueSoon: true, 
        label: `Reste ${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? 's' : ''}`, 
        color: colors.warning,
        tone: 'warning'
      };
    }
    return { isNormal: true, label: `Échéance : ${dueDateStr}`, color: colors.textSecondary, tone: 'neutral' };
  };

  const handleWhatsAppReminder = (item: any) => {
    const totalVal = (item.amount_paid || 0) + (item.amount_remaining || 0);
    const isCompleted = (item.amount_remaining || 0) <= 0 || item.status === 'completed';
    const receiptObj = {
      id: item.sale_id || item.id,
      client_name: item.client_name,
      total: item.amount_paid || totalVal,
      article_total: totalVal,
      date: item.created_at || new Date().toISOString(),
      payment_method: 'Avance',
      items: Array.isArray(item.items) && item.items.length > 0 ? item.items : [{ name: item.product_name || 'Articles Réservés', quantity: 1, price: totalVal, size: item.size, color: item.color, reference: item.reference }],
      store: item.store || effectiveStore,
      is_advance: 1,
      advanceData: {
        clientName: item.client_name,
        clientPhone: item.client_phone || item.phone || '',
        amountPaid: item.amount_paid || 0,
        amountRemaining: item.amount_remaining || 0,
        totalArticles: totalVal,
        dueDate: item.due_date,
        isCompleted
      }
    };

    const targetPhone = cleanWhatsAppNumber(item.client_phone || item.phone);
    shareReceiptWhatsApp(receiptObj, item.client_name, item.store === 'tougou' ? 'Tougou' : 'La Falaise', targetPhone);
  };

  const overdueCount = advances.filter(a => getDueStatus(a.due_date).isOverdue).length;
  const pendingCount = advances.filter(a => a.status === 'pending').length;
  const completedCount = advances.filter(a => a.status === 'completed').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retour" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.screenEyebrow} numberOfLines={1}>RÉSERVATIONS & CRÉDITS</Text>
            <Text style={styles.title} numberOfLines={1}>Avances Clients</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {pendingCount} en cours • {completedCount} soldée{completedCount > 1 ? 's' : ''}
              {overdueCount > 0 ? ` • ${overdueCount} en retard` : ''}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.exportBtn} 
            onPress={() => exportAdvancesCSV(advances, storeId)}
            accessibilityLabel="Exporter en CSV"
          >
            <Download color={colors.gold} size={18} />
          </TouchableOpacity>
        </View>

        {/* Retards Banner */}
        {overdueCount > 0 && statusFilter !== 'completed' && (
          <View style={styles.overdueAlertBanner}>
            <AlertTriangle color={colors.danger} size={16} />
            <Text style={styles.overdueAlertText}>
              Attention : {overdueCount} réservation{overdueCount > 1 ? 's' : ''} ont dépassé leur date limite convenue.
            </Text>
          </View>
        )}

        {/* Store Selector (Super Boss) */}
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
                Toutes
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Tabs */}
        <View style={styles.statusTabsRow}>
          <TouchableOpacity 
            style={[styles.statusTabBtn, statusFilter === 'pending' && styles.statusTabBtnActiveAmber]} 
            onPress={() => setStatusFilter('pending')}
          >
            <Clock color={statusFilter === 'pending' ? colors.warning : colors.textTertiary} size={14} />
            <Text style={[styles.statusTabText, statusFilter === 'pending' && { color: colors.warning, fontWeight: '700' }]}>
              En cours ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statusTabBtn, statusFilter === 'completed' && styles.statusTabBtnActiveGreen]} 
            onPress={() => setStatusFilter('completed')}
          >
            <CheckCheck color={statusFilter === 'completed' ? colors.success : colors.textTertiary} size={14} />
            <Text style={[styles.statusTabText, statusFilter === 'completed' && { color: colors.success, fontWeight: '700' }]}>
              Soldées ({completedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statusTabBtn, statusFilter === 'all' && styles.statusTabBtnActive]} 
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.statusTabText, statusFilter === 'all' && { color: colors.gold, fontWeight: '700' }]}>
              Tout ({advances.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search color={colors.gold} size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par client, article, référence..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X color={colors.textTertiary} size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Advance Cards List */}
      <FlatList
        data={filteredAdvances}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[styles.list, r.isWide && styles.listWide]}
        renderItem={({ item }) => {
          const isCompleted = item.status === 'completed';
          const status: any = isCompleted 
            ? { isCompleted: true, isOverdue: false, label: 'Entièrement Soldée', color: colors.success }
            : getDueStatus(item.due_date);
          const totalVal = (item.amount_paid || 0) + (item.amount_remaining || 0);

          const initialPayment = item.payments && item.payments.length > 0 ? item.payments[0] : null;
          const initialDateStr = initialPayment?.date 
            ? new Date(initialPayment.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : (item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '');

          return (
            <FadeIn>
              <GlassCard 
                style={[
                  styles.card, 
                  !isCompleted && status.isOverdue && styles.cardOverdue, 
                  isCompleted && styles.cardCompleted
                ]}
                glow={!isCompleted && status.isOverdue ? 'none' : 'none'}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{item.client_name}</Text>
                    <View style={[styles.dueBadge, { borderColor: status.color + '40', backgroundColor: status.color + '15' }]}>
                      <Text style={[styles.dueDateBadgeText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.storeTag, isCompleted && { borderColor: alpha(colors.success, 0.4) }]}>
                    <Store color={isCompleted ? colors.success : colors.gold} size={12} style={{ marginRight: 4 }} />
                    <Text style={[styles.storeTagText, isCompleted && { color: colors.success }]}>
                      {item.store === 'falaise' ? 'La Falaise' : 'Tougou'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.cardBody}>
                  <Text style={styles.productName}>{item.product_name}</Text>
                  
                  {/* Specifications */}
                  {(item.reference || item.size || item.color) ? (
                    <View style={styles.specificationsRow}>
                      {item.reference ? (
                        <View style={styles.specBadge}>
                          <Text style={styles.specBadgeText}>Réf: {item.reference}</Text>
                        </View>
                      ) : null}
                      {item.size ? (
                        <View style={styles.specBadge}>
                          <Text style={styles.specBadgeText}>Taille: {item.size}</Text>
                        </View>
                      ) : null}
                      {item.color ? (
                        <View style={styles.specBadge}>
                          <Text style={styles.specBadgeText}>Couleur: {item.color}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {initialDateStr ? (
                    <View style={styles.initialDateRow}>
                      <Calendar color={colors.gold} size={12} style={{ marginRight: 5 }} />
                      <Text style={styles.initialDateText}>
                        Initialisée le : <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{initialDateStr}</Text>
                      </Text>
                    </View>
                  ) : null}

                  {/* Amounts Grid */}
                  <View style={styles.amountsRow}>
                    <View style={styles.amountCol}>
                      <Text style={styles.amountLabel}>Déjà versé</Text>
                      <Text style={[styles.amountPaid, isCompleted && { color: colors.success }]}>
                        {formatMoney(item.amount_paid || 0)} F
                      </Text>
                    </View>
                    <View style={styles.amountCol}>
                      <Text style={styles.amountLabel}>Total Achat</Text>
                      <Text style={styles.amountTotal}>{formatMoney(totalVal)} F</Text>
                    </View>
                    <View style={styles.amountCol}>
                      <Text style={styles.amountLabel}>{isCompleted ? 'Statut' : 'Reste dû'}</Text>
                      <Text style={[styles.amountRemaining, isCompleted && { color: colors.success }]}>
                        {isCompleted ? 'Soldé' : `${formatMoney(item.amount_remaining || 0)} F`}
                      </Text>
                    </View>
                  </View>

                  {/* Installments History */}
                  {item.payments && item.payments.length > 0 && (
                    <View style={styles.historyBox}>
                      <Text style={styles.historyTitle}>Historique des Tranches :</Text>
                      {item.payments.map((p: any, idx: number) => {
                        const pDate = new Date(p.date).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        const isFirst = idx === 0;
                        return (
                          <View key={idx} style={styles.historyRow}>
                            <Text style={styles.historyDate}>
                              {isFirst ? 'Acompte initial' : `Tranche N°${idx + 1}`} ({pDate}) — {p.method || 'Espèces'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.historyAmount}>+{formatMoney(p.amount || 0)} F</Text>
                              <TouchableOpacity 
                                style={styles.historyReceiptBtn}
                                hitSlop={{ top: 11, bottom: 11, left: 4, right: 4 }}
                                accessibilityRole="button"
                                onPress={() => openAdvanceReceipt(item, p, idx + 1)}
                                activeOpacity={0.7}
                              >
                                <Printer color={colors.gold} size={11} />
                                <Text style={styles.historyReceiptBtnText}>Reçu</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {isCompleted && item.completed_at && (
                    <View style={styles.completedNoticeBox}>
                      <CheckCheck color={colors.success} size={15} style={{ marginRight: 6 }} />
                      <Text style={styles.completedNoticeText}>
                        Soldé le {new Date(item.completed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Actions */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity 
                    style={styles.whatsAppReminderBtn}
                    onPress={() => handleWhatsAppReminder(item)}
                  >
                    <MessageCircle color="#25D366" size={15} />
                    <Text style={styles.whatsAppReminderBtnText}>
                      {isCompleted ? 'WhatsApp' : 'Relance'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      styles.receiptActionBtn,
                      isCompleted && { borderColor: colors.success, backgroundColor: alpha(colors.success, 0.1) }
                    ]}
                    onPress={() => openAdvanceReceipt(item)}
                    activeOpacity={0.7}
                  >
                    <Printer color={isCompleted ? colors.success : colors.gold} size={15} />
                    <Text style={[
                      styles.receiptActionBtnText,
                      isCompleted && { color: colors.success }
                    ]}>
                      {isCompleted ? 'Reçu Soldé' : 'Reçu Avance'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.deleteActionBtn}
                    onPress={() => openDeleteConfirmModal(item)}
                    activeOpacity={0.7}
                    accessibilityLabel="Supprimer l'avance et restituer l'article au stock"
                  >
                    <Trash2 color={colors.danger} size={14} />
                    <Text style={styles.deleteActionBtnText}>Supprimer</Text>
                  </TouchableOpacity>

                  {!isCompleted && (
                    <GoldButton 
                      label="Payer Tranche"
                      onPress={() => openPaymentModal(item)}
                      size="sm"
                      icon={<CheckCircle color={colors.onGold} size={15} />}
                    />
                  )}
                </View>
              </GlassCard>
            </FadeIn>
          );
        }}
        ListEmptyComponent={
          <GlassCard style={styles.emptyBox}>
            <Clock color={colors.textTertiary} size={42} />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? `Aucune avance trouvée pour "${searchQuery}"` : 'Aucune avance répertoriée.'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim() ? 'Vérifiez le nom du client ou les filtres.' : 'Toutes les réservations sont à jour.'}
            </Text>
          </GlassCard>
        }
      />

      {/* Modal Règlement Tranche */}
      <Modal visible={paymentModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 440, alignSelf: 'center' }]} glow="gold">
            <Text style={styles.modalEyebrow}>RÈGLEMENT DE TRANCHE</Text>
            <Text style={styles.modalTitle}>Ajouter un Versement</Text>
            
            {selectedAdvance && (
              <>
                <View style={styles.paymentSummaryBox}>
                  <Text style={styles.paymentClientName}>{selectedAdvance.client_name}</Text>
                  <Text style={styles.paymentDueRemain}>
                    Reste à régler : {formatMoney(selectedAdvance.amount_remaining || 0)} FCFA
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Montant Versé (FCFA)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={paymentAmount} 
                  onChangeText={setPaymentAmount}
                  placeholder="Ex: 50000"
                  placeholderTextColor={colors.textTertiary} 
                  autoFocus
                />

                <Text style={styles.fieldLabel}>Moyen de Règlement</Text>
                <View style={styles.methodGrid}>
                  {['Espèces', 'MoMo', 'OM', 'Carte Bancaire'].map(m => (
                    <TouchableOpacity 
                      key={m}
                      style={[styles.methodPill, paymentMethod === m && styles.methodPillActive]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text style={[styles.methodPillText, paymentMethod === m && styles.methodPillTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ gap: 10, marginTop: 15 }}>
                  {cleanWhatsAppNumber(selectedAdvance.client_phone || selectedAdvance.phone) ? (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#25D366',
                        paddingVertical: 13,
                        paddingHorizontal: 16,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer' as any
                      }}
                      onPress={() => handlePaymentSubmit('whatsapp')}
                    >
                      <MessageCircle color={colors.onGold} size={18} />
                      <Text style={{ color: colors.onGold, fontWeight: '800', fontSize: 13 }}>
                        Valider & Envoyer Reçu WhatsApp (+{cleanWhatsAppNumber(selectedAdvance.client_phone || selectedAdvance.phone)})
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <GoldButton 
                    label="Valider l'Encaissement (Ticket seul)"
                    onPress={() => handlePaymentSubmit('none')}
                    size="md"
                    icon={<Check color={colors.onGold} size={16} />}
                  />
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPaymentModalVisible(false)}>
                    <Text style={styles.modalCancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Confirmation Suppression Avance & Choix Stock */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 480, alignSelf: 'center' }]} glow="none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Trash2 color={colors.danger} size={18} />
              <Text style={[styles.modalEyebrow, { color: colors.danger }]}>OPTIONS DE SUPPRESSION D'AVANCE</Text>
            </View>
            <Text style={styles.modalTitle}>Supprimer cette Avance ?</Text>
            
            {advanceToDelete && (
              <>
                <View style={[styles.paymentSummaryBox, { borderColor: alpha(colors.danger, 0.3), backgroundColor: alpha(colors.danger, 0.06) }]}>
                  <Text style={styles.paymentClientName}>{advanceToDelete.client_name}</Text>
                  {advanceToDelete.client_phone ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Tél : {advanceToDelete.client_phone}
                    </Text>
                  ) : null}
                  <Text style={[styles.paymentDueRemain, { color: colors.goldLight, marginTop: 6 }]}>
                    Acompte versé : {formatMoney(advanceToDelete.amount_paid || 0)} FCFA (sur {formatMoney((advanceToDelete.amount_paid || 0) + (advanceToDelete.amount_remaining || 0))} FCFA)
                  </Text>
                </View>

                <View style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.glassBorder,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  padding: 12,
                  marginBottom: 14
                }}>
                  <Text style={{ color: colors.goldLight, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                    Articles concernés ({advanceToDelete.store === 'tougou' ? 'Boutique Tougou' : 'Boutique La Falaise'}) :
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                    {Array.isArray(advanceToDelete.items) && advanceToDelete.items.length > 0 
                      ? advanceToDelete.items.map((it: any) => `• ${it.name} (Qté : ${it.quantity || 1}${it.size ? `, T. ${it.size}` : ''}${it.color ? `, ${it.color}` : ''}${it.reference ? `, Réf: ${it.reference}` : ''})`).join('\n')
                      : `• ${advanceToDelete.product_name || 'Article réservé'} (1 unité)`
                    }
                  </Text>
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: '600' }}>
                  Choisissez comment supprimer cette avance :
                </Text>

                <View style={{ gap: 10 }}>
                  {/* Option 1 : Entrer dans le stock */}
                  <TouchableOpacity 
                    style={{
                      backgroundColor: '#16A34A',
                      borderWidth: 1,
                      borderColor: colors.success,
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: radius.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingAdvance ? 0.6 : 1,
                      cursor: 'pointer' as any
                    }} 
                    onPress={() => handleConfirmDeleteAdvance(true)}
                    disabled={isDeletingAdvance}
                  >
                    {isDeletingAdvance ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <CheckCircle color="#FFFFFF" size={18} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                        1. Entrer dans le stock & Supprimer
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
                        Remet automatiquement les articles réservés dans le stock disponible
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2 : Supprimer définitivement (sans toucher au stock) */}
                  <TouchableOpacity 
                    style={{
                      backgroundColor: colors.danger,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: radius.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingAdvance ? 0.6 : 1,
                      cursor: 'pointer' as any
                    }} 
                    onPress={() => handleConfirmDeleteAdvance(false)}
                    disabled={isDeletingAdvance}
                  >
                    {isDeletingAdvance ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Trash2 color="#FFFFFF" size={18} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                        2. Supprimer définitivement (sans stock)
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
                        Efface définitivement l'avance sans modifier les quantités en stock
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Annuler */}
                  <TouchableOpacity 
                    style={[styles.modalCancelBtn, { marginTop: 2 }]} 
                    onPress={() => {
                      if (!isDeletingAdvance) {
                        setDeleteModalVisible(false);
                        setAdvanceToDelete(null);
                      }
                    }}
                    disabled={isDeletingAdvance}
                  >
                    <Text style={styles.modalCancelBtnText}>Annuler (Conserver l'avance)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </GlassCard>
        </View>
      </Modal>

      {/* Reçu Modal */}
      <ReceiptModal 
        visible={receiptModalVisible} 
        onClose={() => setReceiptModalVisible(false)} 
        sale={selectedReceiptSale} 
        storeName={selectedReceiptSale?.store === 'falaise' ? 'La Falaise' : 'Tougou'} 
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
  subtitle: { ...chrome.subtitle },
  exportBtn: { ...chrome.iconBtn },
  overdueAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: alpha(colors.danger, 0.1),
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    marginBottom: 10,
  },
  overdueAlertText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
    flex: 1,
  },
  storeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  storeBtn: { ...chrome.storeBtn },
  storeBtnActive: { ...chrome.storeBtnActive },
  storeBtnText: { color: colors.textTertiary, fontSize: 13, fontWeight: '600', fontFamily: fonts.sans },
  storeBtnTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  statusTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  statusTabBtn: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  statusTabBtnActive: {
    backgroundColor: alpha(colors.gold, 0.1),
    borderColor: colors.gold,
  },
  statusTabBtnActiveAmber: {
    backgroundColor: alpha(colors.warning, 0.12),
    borderColor: colors.warning,
  },
  statusTabBtnActiveGreen: {
    backgroundColor: alpha(colors.success, 0.1),
    borderColor: colors.success,
  },
  statusTabText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
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
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  listWide: {
    paddingHorizontal: 28,
  },
  card: {
    padding: 16,
    borderRadius: radius.md,
  },
  cardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: alpha(colors.danger, 0.04),
  },
  cardCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  clientName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  dueBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    marginTop: 4,
  },
  dueDateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  storeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.gold, 0.08),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.25),
  },
  storeTagText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  cardBody: {
    marginBottom: 12,
  },
  productName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.sans,
    marginBottom: 6,
  },
  specificationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  specBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  specBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  initialDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  initialDateText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  amountsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 10,
  },
  amountCol: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontFamily: fonts.sans,
  },
  amountPaid: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  amountTotal: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  amountRemaining: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  historyBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 4,
    marginBottom: 8,
  },
  historyTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: fonts.sans,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  historyDate: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  historyAmount: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  completedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.success, 0.08),
    padding: 8,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.success, 0.3),
  },
  completedNoticeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    paddingTop: 10,
  },
  whatsAppReminderBtn: {
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.3)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.xs,
  },
  whatsAppReminderBtnText: {
    color: '#25D366',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  receiptActionBtn: {
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: alpha(colors.gold, 0.1),
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
  },
  receiptActionBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  historyReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: alpha(colors.gold, 0.12),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 0.8,
    borderColor: alpha(colors.gold, 0.4),
  },
  historyReceiptBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    padding: 22,
    borderRadius: radius.lg,
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
    marginBottom: 12,
  },
  paymentSummaryBox: {
    backgroundColor: alpha(colors.gold, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 14,
  },
  paymentClientName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  paymentDueRemain: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: fonts.sans,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    fontFamily: fonts.sans,
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
    marginBottom: 14,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  methodPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  methodPillActive: {
    backgroundColor: alpha(colors.gold, 0.15),
    borderColor: colors.gold,
  },
  methodPillText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  methodPillTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  deleteActionBtn: {
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: alpha(colors.danger, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.35),
  },
  deleteActionBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
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
