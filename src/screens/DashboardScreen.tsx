import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Linking, Animated, FlatList, Platform, RefreshControl } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue, get } from 'firebase/database';
import { 
  LogOut, Package, PackagePlus, TrendingUp, AlertTriangle, Wallet, CreditCard, Banknote, 
  FileText, HelpCircle, User, Users, Bell, Trash2, MapPin, ClipboardList, ArrowRightLeft,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, Edit3, Eye, EyeOff, PlusCircle, Check, ShoppingBag,
  Download, ShieldCheck, FileSpreadsheet, PackageCheck, ClipboardCheck, RefreshCw, Sparkles, ArrowUpRight
} from 'lucide-react-native';
import { 
  addUser, getUsers, updateUser, deleteUser, getSecurityLogs, deleteSecurityLog, 
  deleteSale, transferStock, getProductByBarcode, getProducts, getLocalCache, setLocalCache, isUserAdmin, isSuperBoss,
  getAuditLogs, getAdvanceStore, getFastCache
} from '../db/database';
import { 
  exportSalesCSV, exportProductsCSV, exportAdvancesCSV, exportTransfersCSV, exportAuditLogsCSV 
} from '../utils/exportHelpers';
import { subscribeResilient } from '../db/resilientSync';
import NetworkDoctorModal from '../components/NetworkDoctorModal';
import WebScanner from '../components/WebScanner';
import AIAssistantModal from '../components/AIAssistantModal';
import LiveTransferBanner from '../components/LiveTransferBanner';
import TransferRequestModal from '../components/TransferRequestModal';
import IncomingTransferAlertModal from '../components/IncomingTransferAlertModal';
import DashboardSidebar from '../components/DashboardSidebar';
import ReceiptModal from '../components/ReceiptModal';
import { startAudioKeepAlive, requestDesktopNotificationPermission, playRingToneNow, stopRingtone } from '../utils/ringtone';
import {
  AmbientBackground,
  GlassCard,
  TiltCard,
  PressableScale,
  GoldButton,
  AnimatedNumber,
  FadeIn,
  useResponsive,
  colors,
  fonts,
  radius,
  shadow,
  type,
  formatMoney,
  haptic,
  ThemeToggleButton,
} from '../ui';
import { useAppTheme } from '../theme/ThemeContext';

export default function DashboardScreen({ navigation, route }: any) {
  const user = route.params?.user;
  const r = useResponsive();
  const { colors, isDark } = useAppTheme();
  const [transferRequestModalVisible, setTransferRequestModalVisible] = useState(false);
  const [audioAndNotifArmed, setAudioAndNotifArmed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setAudioAndNotifArmed(true);
        startAudioKeepAlive();
      }
    }
  }, []);
  
  const [salesTotal, setSalesTotal] = useState(0);
  const [cardTotal, setCardTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [momoTotal, setMomoTotal] = useState(0);
  const [omTotal, setOmTotal] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingAdvancesCount, setPendingAdvancesCount] = useState(0);
  const [pendingAdvancesTotal, setPendingAdvancesTotal] = useState(0);
  const [filter, setFilter] = useState('today');
  const [salesCount, setSalesCount] = useState(0);
  const [selectedStore, setSelectedStore] = useState(isSuperBoss(user) ? (user?.store === 'all' ? 'falaise' : (user?.store || 'falaise')) : (user?.store || 'falaise'));
  const [chartData, setChartData] = useState<{label: string, value: number}[]>([]);
  const [insightText, setInsightText] = useState('');
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [searchSaleText, setSearchSaleText] = useState('');

  // Période et navigations temporelles
  const [periodOffset, setPeriodOffset] = useState(0);
  const [periodTitle, setPeriodTitle] = useState('');
  const [weekDaysBreakdown, setWeekDaysBreakdown] = useState<any[]>([]);
  const [monthWeeksBreakdown, setMonthWeeksBreakdown] = useState<any[]>([]);
  const [yearMonthsBreakdown, setYearMonthsBreakdown] = useState<any[]>([]);
  const [expandedDayKeys, setExpandedDayKeys] = useState<Record<string, boolean>>({});
  const [expandedWeekKeys, setExpandedWeekKeys] = useState<Record<string, boolean>>({});
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Record<string, boolean>>({});

  // Gestion des profils boss
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showUserPasswords, setShowUserPasswords] = useState(false);

  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [showSecurityAssistant, setShowSecurityAssistant] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [currentToast, setCurrentToast] = useState('');
  const [toastAnim] = useState(new Animated.Value(-100));
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const toastQueueRef = React.useRef<string[]>([]);
  const isToasting = React.useRef(false);
  const alertsShownRef = React.useRef({ stock: false, security: false });

  // Historique des ventes par date (boss)
  const [salesHistoryModal, setSalesHistoryModal] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [historySales, setHistorySales] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal de suppression de vente avec choix stock / suppression définitive / correction immédiate
  const [deleteSaleModalVisible, setDeleteSaleModalVisible] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [deleteSaleContext, setDeleteSaleContext] = useState<string>('dashboard');
  const [deleteSaleReason, setDeleteSaleReason] = useState<string>('Erreur de saisie / retour client');
  const [isDeletingSale, setIsDeletingSale] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  // Transfert de stock par Scan
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [transferProduct, setTransferProduct] = useState<any>(null);
  const [transferQty, setTransferQty] = useState('1');
  const [transferDest, setTransferDest] = useState(selectedStore === 'falaise' ? 'tougou' : 'falaise');

  // Suivi des transferts en transit
  const [inTransitTransfersCount, setInTransitTransfersCount] = useState(0);

  // Sauvegarde & Export CSV
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);

  // Journal d'Audit
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditSearchText, setAuditSearchText] = useState('');

  const [transferSearchModalVisible, setTransferSearchModalVisible] = useState(false);
  const [transferSearchText, setTransferSearchText] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  // Transporteur / Livreur sélectionné (Esther, Angela, Ivy, Maya, Yaya, etc.)
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<any>(null);
  const [customCarrierName, setCustomCarrierName] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);

  const prepareTransferModal = async (product: any) => {
    setTransferProduct(product);
    setTransferDest(selectedStore === 'falaise' ? 'tougou' : 'falaise');
    setTransferQty('1');
    setCustomCarrierName('');
    setEstimatedMinutes(15);
    try {
      const uList = await getUsers();
      setAvailableUsers(uList);
      const dest = selectedStore === 'falaise' ? 'tougou' : 'falaise';
      const destUsers = uList.filter((u: any) => u.store === dest && u.id !== user?.id);
      setSelectedCarrier(destUsers.length > 0 ? destUsers[0] : (uList.find((u: any) => u.id !== user?.id) || uList[0]));
    } catch (e) {
      console.log('Error loading users for carrier selection:', e);
    }
    setTransferModalVisible(true);
  };

  const openTransferSearchModal = async () => {
    try {
      const result = await getProducts(selectedStore);
      setProducts(result.filter((p: any) => p.stock > 0));
    } catch (e) {
      console.error(e);
    }
    setTransferSearchText('');
    setTransferSearchModalVisible(true);
  };

  const selectTransferProduct = (product: any) => {
    setTransferSearchModalVisible(false);
    prepareTransferModal(product);
  };

  const triggerNextToast = () => {
    if (toastQueueRef.current.length > 0 && !isToasting.current) {
      isToasting.current = true;
      const nextMessage = toastQueueRef.current.shift();
      setCurrentToast(nextMessage!);
      setToastVisible(true);
      Animated.spring(toastAnim, { toValue: 50, useNativeDriver: false }).start();
      
      setTimeout(() => {
        Animated.spring(toastAnim, { toValue: -100, useNativeDriver: false }).start(() => {
          setToastVisible(false);
          isToasting.current = false;
          setTimeout(triggerNextToast, 500);
        });
      }, 3000);
    }
  };

  const addToast = (msg: string) => {
    toastQueueRef.current.push(msg);
    triggerNextToast();
  };

  // Load static data and check alerts
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await getUsers();
    setSystemUsers(u);
    const logs = await getSecurityLogs();
    setSecurityLogs(logs);
    
    if (logs.length > 0 && !alertsShownRef.current.security) {
      addToast(`Alerte de Sécurité : ${logs.length} intrusion(s)`);
      alertsShownRef.current.security = true;
    }
  };

  const openUsersModal = () => {
    loadData();
    setUserModalVisible(true);
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === 'boss' || name?.toLowerCase() === 'boss') {
      Alert.alert('Action refusée', 'Le compte Administrateur Principal ne peut pas être supprimé.');
      return;
    }
    const confirmDelete = () => {
      deleteUser(id).then(() => {
        loadData();
        addToast(`Profil "${name}" supprimé.`);
      }).catch(err => {
        console.error(err);
        Alert.alert('Erreur', 'Impossible de supprimer ce profil.');
      });
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`Voulez-vous vraiment supprimer le profil de ${name} ?`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Supprimer le profil',
        `Voulez-vous vraiment supprimer le profil de ${name} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: confirmDelete }
        ]
      );
    }
  };

  // Gestion des profils (Création & Modification)
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('caissiere');
  const [newUserStore, setNewUserStore] = useState('falaise');
  const [newUserPin, setNewUserPin] = useState('');

  const startEditUser = (u: any) => {
    setEditingUser(u);
    setNewUserName(u.name || '');
    setNewUserRole(u.role || 'caissiere');
    setNewUserStore(u.store || 'falaise');
    setNewUserPin(u.pin || '');
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setNewUserName('');
    setNewUserPin('');
    setNewUserRole('caissiere');
    setNewUserStore('falaise');
  };

  const handleSaveUser = async () => {
    const cleanName = newUserName.trim();
    const cleanPin = newUserPin.trim();

    if (!cleanName || !cleanPin) {
      Alert.alert('Erreur', 'Veuillez renseigner le nom complet et le mot de passe / code PIN.');
      return;
    }

    try {
      if (editingUser) {
        // Modification d'un profil existant
        await updateUser(editingUser.id, {
          name: cleanName,
          role: newUserRole,
          pin: cleanPin,
          store: newUserStore,
        });

        if (typeof window !== 'undefined' && window.alert) {
          window.alert(`Succès: Profil de ${cleanName} mis à jour.`);
        } else {
          Alert.alert('Succès', `Profil de ${cleanName} mis à jour.`);
        }
      } else {
        // Création d'un nouveau profil
        await addUser(cleanName, newUserRole, cleanPin, newUserStore);

        if (typeof window !== 'undefined' && window.alert) {
          window.alert(`Succès: Profil de ${cleanName} créé.`);
        } else {
          Alert.alert('Succès', `Profil de ${cleanName} créé.`);
        }
      }

      cancelEditUser();
      loadData();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Erreur', e?.message || 'Une erreur est survenue lors de l\'enregistrement.');
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await deleteSecurityLog(id);
      setSecurityLogs(logs => logs.filter(l => l.id !== id));
      addToast('Alerte supprimée');
    } catch(e) {
      console.error(e);
    }
  };

  // Supprimer ou corriger une vente avec choix : entrer dans le stock / supprimer définitivement / corriger de suite
  const handleDeleteSale = (saleOrId: any, context: string = 'dashboard') => {
    const targetSale = typeof saleOrId === 'string'
      ? (recentSales.find(s => s.id === saleOrId) || historySales.find(s => s.id === saleOrId) || { id: saleOrId, total: 0, items: 'Article' })
      : saleOrId;
    setSaleToDelete(targetSale);
    setDeleteSaleContext(context);
    setDeleteSaleReason('Erreur de saisie / retour client');
    setDeleteSaleModalVisible(true);
  };

  const executeDashboardDeleteSale = async (restoreStock: boolean = true, reopenInLedger: boolean = false) => {
    if (!saleToDelete) return;
    setIsDeletingSale(true);
    try {
      const targetId = saleToDelete.id;
      const saleSnapshot = { ...saleToDelete };
      const finalReason = deleteSaleReason.trim() || (restoreStock ? 'Suppression + remise en stock' : 'Suppression définitive sans stock');

      await deleteSale(targetId, user?.id || 'boss', user?.name || 'Boss', finalReason, restoreStock);

      // Mise à jour immédiate de l'état local
      setRecentSales(prev => prev.filter(s => s.id !== targetId));
      setHistorySales(prev => {
        const updated = prev.filter(s => s.id !== targetId);
        setHistoryTotal(updated.reduce((acc, s) => acc + (s.total || 0), 0));
        return updated;
      });
      if (deleteSaleContext === 'history') {
        loadSalesByDate(historyDate);
      }

      setDeleteSaleModalVisible(false);
      setSaleToDelete(null);

      if (reopenInLedger) {
        setSalesHistoryModal(false);
        navigation.navigate('Ledger', {
          user,
          storeId: saleSnapshot.store || selectedStore,
          prefillSale: saleSnapshot
        });
      } else {
        const msg = restoreStock
          ? 'Vente supprimée et articles réintégrés dans le stock.'
          : 'Vente supprimée définitivement (sans modification du stock).';
        addToast(msg);
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      }
    } catch (e: any) {
      console.error(e);
      if (typeof window !== 'undefined' && window.alert) window.alert('Erreur lors de la suppression.');
    } finally {
      setIsDeletingSale(false);
    }
  };

  // Ouvrir les détails intégraux d'un achat / article dans le Reçu officiel
  const handleOpenSaleDetail = (sale: any) => {
    if (!sale) return;
    let itemsToPass = sale.items;
    if (Array.isArray(sale.rawItems) && sale.rawItems.length > 0) {
      itemsToPass = sale.rawItems;
    } else if (Array.isArray(sale.items) && sale.items.length > 0) {
      itemsToPass = sale.items;
    } else if (typeof sale.items === 'string') {
      itemsToPass = [{ name: sale.items, price: sale.total, quantity: 1 }];
    } else {
      itemsToPass = [{ name: 'Articles', price: sale.total, quantity: 1 }];
    }

    const clientName = sale.client_name || sale.clientName || sale.advanceData?.clientName || '';
    const clientPhone = sale.client_phone || sale.phone || sale.advanceData?.clientPhone || '';
    const clientEmail = sale.client_email || sale.email || sale.advanceData?.clientEmail || '';

    setSelectedReceiptSale({
      ...sale,
      items: itemsToPass,
      client_name: clientName,
      clientName: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      seller_name: sale.seller_name || user?.name || 'Vendeur'
    });
    setReceiptModalVisible(true);
  };

  // Charger les ventes d'une date spécifique (résilient, avec support 'all' et cache local 0ms)
  const loadSalesByDate = async (date: string) => {
    setLoadingHistory(true);
    try {
      // 1. Priorité au cache mémoire et localStorage ultra-rapide
      let data = getFastCache('loreal_cache_sales') || getLocalCache('loreal_cache_sales');

      // 2. Si le cache est absent, fallback HTTPS REST résilient
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        try {
          const res = await fetch('https://l-oreal-capitol-default-rtdb.firebaseio.com/sales.json');
          if (res.ok) data = await res.json();
        } catch (e) {
          console.warn('Fallback REST sales warning:', e);
        }
      }

      if (!data) {
        setHistorySales([]);
        setHistoryTotal(0);
        setLoadingHistory(false);
        return;
      }

      const allSales = Object.keys(data).map(k => {
        const s = data[k] || {};
        const isAdvInitial = s.is_advance === 1 && !s.is_advance_installment && s.advanceData && s.advanceData.amountPaid !== undefined;
        const effectiveTotal = isAdvInitial
          ? (Number(s.advanceData.amountPaid) || 0)
          : (Number(s.total) || 0);
        return { 
          id: k, 
          ...s,
          rawItems: s.items,
          date: (s.date && typeof s.date === 'string') ? s.date : (s.created_at || new Date().toISOString()),
          total: effectiveTotal,
        };
      });

      const dateSales = allSales
        .filter(s => {
          if (!s.date || typeof s.date !== 'string' || !s.date.startsWith(date)) return false;
          if (selectedStore === 'all') return true;
          return (s.store || 'falaise').toLowerCase() === selectedStore.toLowerCase();
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(s => {
          const baseItems = Array.isArray(s.items) 
            ? s.items.map((i: any) => `${i.name || 'Article'}${i.size ? ` (T:${i.size})` : ''} (x${i.quantity || 1})`).join(', ') 
            : (s.items || 'Articles');
          const clientTag = (s.client_name || s.advanceData?.clientName) ? ` (${s.client_name || s.advanceData?.clientName})` : '';
          const isAnyAdvance = s.is_advance === 1 || s.is_advance_installment === 1 || !!s.advanceData || s.payment_method === 'Avance';
          const itemsFormatted = s.sale_label
            ? s.sale_label
            : (isAnyAdvance
                ? (s.total > 0
                    ? `Avance ${formatMoney(s.total)} FCFA sur ${baseItems}${clientTag}`
                    : `Avance (0 FCFA versé) sur ${baseItems}${clientTag}`)
                : baseItems);
          return {
            ...s,
            rawItems: s.rawItems || s.items,
            itemsFormatted,
          };
        });

      setHistorySales(dateSales);
      setHistoryTotal(dateSales.reduce((sum, s) => sum + s.total, 0));
    } catch (e) {
      console.error('Erreur loadSalesByDate:', e);
    }
    setLoadingHistory(false);
  };

  const openSalesHistoryModal = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setHistoryDate(todayStr);
    loadSalesByDate(todayStr);
    setSalesHistoryModal(true);
  };

  // Gestion du Scanner pour transfert
  const handleScanTransfer = async (barcode: string) => {
    setScannerVisible(false);
    const product = await getProductByBarcode(barcode, selectedStore);
    if (product) {
      if (product.stock > 0) {
        prepareTransferModal(product);
      } else {
        if (typeof window !== 'undefined' && window.alert) window.alert('Attention: Produit en rupture de stock.');
        else Alert.alert('Attention', 'Ce produit est en rupture de stock (0).');
      }
    } else {
      if (typeof window !== 'undefined' && window.alert) window.alert('Produit introuvable dans ce magasin.');
      else Alert.alert('Erreur', 'Produit introuvable dans ce magasin.');
    }
  };

  const handleTransferSubmit = async () => {
    if (!transferProduct) return;
    const qty = parseInt(transferQty, 10);
    if (isNaN(qty) || qty <= 0 || qty > transferProduct.stock) {
      if (typeof window !== 'undefined' && window.alert) window.alert(`Quantité invalide. Stock disponible : ${transferProduct.stock}`);
      else Alert.alert('Erreur', `Quantité invalide. Stock disponible : ${transferProduct.stock}`);
      return;
    }

    const carrierName = customCarrierName.trim() || selectedCarrier?.name || user?.name || 'Livreur';
    const carrierId = selectedCarrier?.id || '';

    // Récupérer la position GPS actuelle si disponible
    let currentGps: { lat: number; lng: number } | undefined = undefined;
    if (typeof window !== 'undefined' && navigator.geolocation) {
      try {
        const pos: any = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3000, enableHighAccuracy: true });
        });
        if (pos?.coords) {
          currentGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch (e) {}
    }

    try {
      await transferStock(
        transferProduct.id, 
        selectedStore, 
        transferDest, 
        qty, 
        user?.id || 'boss', 
        user?.name || 'Boss',
        carrierId,
        carrierName,
        estimatedMinutes,
        currentGps
      );
      setTransferModalVisible(false);
      setTransferProduct(null);
      const destLabel = transferDest === 'falaise' ? 'La Falaise' : 'Tougou';
      const msg = `Transfert initié ! Les ${qty} article(s) sont EN ROUTE avec ${carrierName} vers ${destLabel}. Le calcul automatique de la distance et de l'heure d'arrivée est actif sur Google Maps !`;
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      else Alert.alert('Succès', msg);
    } catch (e: any) {
      if (typeof window !== 'undefined' && window.alert) window.alert(e.message || 'Erreur lors du transfert.');
      else Alert.alert('Erreur', e.message || 'Impossible de transférer.');
    }
  };

  useEffect(() => {
    // 1. Temps réel pour les ventes (avec fallback HTTPS REST et cache local)
    const unsubscribeSales = subscribeResilient('sales', (data) => {
      if (!data) {
        setSalesTotal(0); setSalesCount(0); setCardTotal(0); setCashTotal(0); setMomoTotal(0); setOmTotal(0);
        setChartData([]); setWeekDaysBreakdown([]); setMonthWeeksBreakdown([]); setYearMonthsBreakdown([]);
        return;
      }
      const allSales = Object.keys(data)
        .map(k => {
          const item = data[k] || {};
          const rawDate = item.date || item.created_at || '';
          const isAdvInitial = item.is_advance === 1 && !item.is_advance_installment && item.advanceData && item.advanceData.amountPaid !== undefined;
          const effectiveTotal = isAdvInitial
            ? (Number(item.advanceData.amountPaid) || 0)
            : (Number(item.total) || 0);
          const baseItems = Array.isArray(item.items)
            ? item.items.map((i: any) => `${i.name || 'Article'} (x${i.quantity || 1})`).join(', ')
            : (typeof item.items === 'string' ? item.items : 'Article');
          const clientTag = (item.client_name || item.advanceData?.clientName) ? ` (${item.client_name || item.advanceData?.clientName})` : '';
          const isAnyAdvance = item.is_advance === 1 || item.is_advance_installment === 1 || !!item.advanceData || item.payment_method === 'Avance';
          const displayLabel = item.sale_label
            ? item.sale_label
            : (isAnyAdvance
                ? (effectiveTotal > 0
                    ? `Avance ${formatMoney(effectiveTotal)} FCFA sur ${baseItems}${clientTag}`
                    : `Avance (0 FCFA versé) sur ${baseItems}${clientTag}`)
                : baseItems);
          return {
            id: k,
            ...item,
            rawItems: item.items,
            sale_label: displayLabel,
            date: typeof rawDate === 'string' ? rawDate : '',
            total: effectiveTotal
          };
        })
        .filter(s => selectedStore === 'all' || (s.store || 'falaise').toLowerCase() === selectedStore.toLowerCase());
      
      const WORKING_DAYS_NAMES = [
        { name: 'Lundi', short: 'Lun' },
        { name: 'Mardi', short: 'Mar' },
        { name: 'Mercredi', short: 'Mer' },
        { name: 'Jeudi', short: 'Jeu' },
        { name: 'Vendredi', short: 'Ven' },
        { name: 'Samedi', short: 'Sam' },
      ];

      const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      const moisNomsComplets = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

      let filteredSales: any[] = [];
      let groupedChart: { label: string, value: number }[] = [];

      // Helper pour synthétiser les articles vendus
      const aggregateItems = (salesList: any[]) => {
        const itemsMap: Record<string, { name: string; quantity: number; amount: number }> = {};
        salesList.forEach(s => {
          if (Array.isArray(s.items)) {
            s.items.forEach((it: any) => {
              const key = it.name || 'Article';
              if (!itemsMap[key]) itemsMap[key] = { name: key, quantity: 0, amount: 0 };
              itemsMap[key].quantity += (it.quantity || 1);
              itemsMap[key].amount += ((it.price || 0) * (it.quantity || 1));
            });
          }
        });
        return Object.values(itemsMap).sort((a, b) => b.quantity - a.quantity);
      };

      const isBoss = isSuperBoss(user);
      const effectiveFilter = isBoss ? filter : 'today';
      const effectiveOffset = isBoss ? periodOffset : 0;

      if (effectiveFilter === 'today' || effectiveFilter === 'yesterday') {
        const dObj = new Date();
        if (effectiveFilter === 'yesterday') dObj.setDate(dObj.getDate() - 1);
        dObj.setDate(dObj.getDate() + effectiveOffset);
        const targetDateStr = dObj.toISOString().split('T')[0];
        
        setPeriodTitle(
          effectiveOffset === 0 
            ? (effectiveFilter === 'today' ? "Aujourd'hui" : "Hier") 
            : dObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        );

        filteredSales = allSales.filter(s => s.date && s.date.startsWith(targetDateStr));

        // Groupement par heure pour le graphique
        const hours: Record<string, number> = {};
        filteredSales.forEach(s => {
          const h = s.date ? new Date(s.date).getHours() : 0;
          const label = `${isNaN(h) ? 0 : h}h`;
          hours[label] = (hours[label] || 0) + (s.total || 0);
        });
        groupedChart = Object.keys(hours).sort((a, b) => parseInt(a) - parseInt(b)).map(k => ({ label: k, value: hours[k] }));

      } else if (effectiveFilter === 'week') {
        // Semaine du Lundi au Samedi (Dimanche exclu : non travaillé)
        const now = new Date();
        const currentDay = now.getDay(); // 0: Dimanche, 1: Lundi, etc.
        const diffToMonday = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1) + (periodOffset * 7);
        const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + 5);

        setPeriodTitle(`Semaine : ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${saturday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`);

        const weekDays = WORKING_DAYS_NAMES.map((w, idx) => {
          const dayDate = new Date(monday);
          dayDate.setDate(monday.getDate() + idx);
          const dayDateStr = dayDate.toISOString().split('T')[0];
          const daySales = allSales.filter(s => s.date && s.date.startsWith(dayDateStr));
          const dayTotal = daySales.reduce((sum, s) => sum + s.total, 0);
          
          return {
            key: `wday_${dayDateStr}`,
            dayName: w.name,
            shortName: w.short,
            dateStr: dayDateStr,
            formattedDate: `${dayDate.getDate().toString().padStart(2, '0')}/${(dayDate.getMonth() + 1).toString().padStart(2, '0')}`,
            fullFormattedDate: dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
            total: dayTotal,
            salesCount: daySales.length,
            sales: daySales,
            itemsSummary: aggregateItems(daySales),
          };
        });

        setWeekDaysBreakdown(weekDays);
        filteredSales = weekDays.flatMap(w => w.sales);

        // Bar Chart : 6 barres Lundi à Samedi avec la date
        groupedChart = weekDays.map(w => ({
          label: `${w.shortName} ${w.formattedDate}`,
          value: w.total,
        }));

      } else if (filter === 'month') {
        // Mois en terme de Semaine 1, Semaine 2, jusqu'à Semaine 4 (et Semaine 5 si jours restants)
        // et chaque semaine affiche du Lundi au Samedi (Dimanche exclu)
        const refMonth = new Date();
        refMonth.setDate(1);
        refMonth.setMonth(refMonth.getMonth() + periodOffset);
        const targetYear = refMonth.getFullYear();
        const targetMonthIdx = refMonth.getMonth();
        const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();

        setPeriodTitle(`Mois : ${refMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`);

        const weekDefinitions = [
          { label: 'Semaine 1', start: 1, end: 7 },
          { label: 'Semaine 2', start: 8, end: 14 },
          { label: 'Semaine 3', start: 15, end: 21 },
          { label: 'Semaine 4', start: 22, end: 28 },
          { label: 'Semaine 5', start: 29, end: daysInMonth },
        ].filter(w => w.start <= daysInMonth);

        const monthWeeks = weekDefinitions.map((wDef, wIdx) => {
          const daysOfWeek: any[] = [];
          for (let d = wDef.start; d <= Math.min(wDef.end, daysInMonth); d++) {
            const dayDate = new Date(targetYear, targetMonthIdx, d);
            if (dayDate.getDay() === 0) continue; // EXCLUSION DU DIMANCHE (NON TRAVAILLÉ)
            
            const dayDateStr = dayDate.toISOString().split('T')[0];
            const daySales = allSales.filter(s => s.date && s.date.startsWith(dayDateStr));
            const dayTotal = daySales.reduce((sum, s) => sum + s.total, 0);
            const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

            daysOfWeek.push({
              key: `mweek_${wIdx}_${dayDateStr}`,
              dayName: dayNames[dayDate.getDay()],
              shortName: dayNames[dayDate.getDay()].substring(0, 3),
              dateStr: dayDateStr,
              formattedDate: `${d.toString().padStart(2, '0')}/${(targetMonthIdx + 1).toString().padStart(2, '0')}`,
              fullFormattedDate: dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
              total: dayTotal,
              salesCount: daySales.length,
              sales: daySales,
              itemsSummary: aggregateItems(daySales),
            });
          }

          const weekTotal = daysOfWeek.reduce((sum, d) => sum + d.total, 0);
          const weekSalesCount = daysOfWeek.reduce((sum, d) => sum + d.salesCount, 0);

          return {
            key: `week_${wIdx}`,
            weekLabel: wDef.label,
            dateRange: `${wDef.start.toString().padStart(2, '0')} - ${Math.min(wDef.end, daysInMonth).toString().padStart(2, '0')} ${moisNoms[targetMonthIdx]}`,
            total: weekTotal,
            salesCount: weekSalesCount,
            days: daysOfWeek, // Du Lundi au Samedi exclusivement
          };
        });

        setMonthWeeksBreakdown(monthWeeks);
        filteredSales = monthWeeks.flatMap(w => w.days.flatMap(d => d.sales));

        // Bar Chart : Semaine 1, Semaine 2, Semaine 3, Semaine 4 (Semaine 5 si > 28 jours)
        groupedChart = monthWeeks.map(w => ({
          label: w.weekLabel.replace('Semaine', 'Sem'),
          value: w.total,
        }));

      } else if (filter === 'year') {
        // Année : 12 Mois, chacun découpé en Semaines (Semaine 1 à 4/5) et Lundi à Samedi
        const targetYear = new Date().getFullYear() + periodOffset;
        setPeriodTitle(`Année : ${targetYear}`);

        const yearMonths = moisNomsComplets.map((mNom, mIdx) => {
          const daysInMonth = new Date(targetYear, mIdx + 1, 0).getDate();
          const weekDefinitions = [
            { label: 'Semaine 1', start: 1, end: 7 },
            { label: 'Semaine 2', start: 8, end: 14 },
            { label: 'Semaine 3', start: 15, end: 21 },
            { label: 'Semaine 4', start: 22, end: 28 },
            { label: 'Semaine 5', start: 29, end: daysInMonth },
          ].filter(w => w.start <= daysInMonth);

          const weeks = weekDefinitions.map((wDef, wIdx) => {
            const daysOfWeek: any[] = [];
            for (let d = wDef.start; d <= Math.min(wDef.end, daysInMonth); d++) {
              const dayDate = new Date(targetYear, mIdx, d);
              if (dayDate.getDay() === 0) continue; // EXCLUSION DU DIMANCHE
              
              const dayDateStr = dayDate.toISOString().split('T')[0];
              const daySales = allSales.filter(s => s.date && s.date.startsWith(dayDateStr));
              const dayTotal = daySales.reduce((sum, s) => sum + s.total, 0);
              const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

              daysOfWeek.push({
                key: `y_${mIdx}_${wIdx}_${dayDateStr}`,
                dayName: dayNames[dayDate.getDay()],
                shortName: dayNames[dayDate.getDay()].substring(0, 3),
                dateStr: dayDateStr,
                formattedDate: `${d.toString().padStart(2, '0')}/${(mIdx + 1).toString().padStart(2, '0')}`,
                fullFormattedDate: dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
                total: dayTotal,
                salesCount: daySales.length,
                sales: daySales,
                itemsSummary: aggregateItems(daySales),
              });
            }

            return {
              key: `yweek_${mIdx}_${wIdx}`,
              weekLabel: wDef.label,
              dateRange: `${wDef.start.toString().padStart(2, '0')} - ${Math.min(wDef.end, daysInMonth).toString().padStart(2, '0')} ${moisNoms[mIdx]}`,
              total: daysOfWeek.reduce((sum, d) => sum + d.total, 0),
              salesCount: daysOfWeek.reduce((sum, d) => sum + d.salesCount, 0),
              days: daysOfWeek,
            };
          });

          const monthTotal = weeks.reduce((sum, w) => sum + w.total, 0);
          const monthSalesCount = weeks.reduce((sum, w) => sum + w.salesCount, 0);

          return {
            key: `month_${mIdx}`,
            monthIndex: mIdx,
            monthName: mNom,
            shortName: moisNoms[mIdx],
            total: monthTotal,
            salesCount: monthSalesCount,
            weeks,
          };
        });

        setYearMonthsBreakdown(yearMonths);
        filteredSales = yearMonths.flatMap(m => m.weeks.flatMap(w => w.days.flatMap(d => d.sales)));

        // Bar Chart : 12 Mois
        groupedChart = yearMonths.map(m => ({
          label: m.shortName,
          value: m.total,
        }));
      }

      setSalesTotal(filteredSales.reduce((sum, s) => sum + s.total, 0));
      setSalesCount(filteredSales.length);
      setCardTotal(filteredSales.filter(s => s.payment_method === 'Carte Bancaire').reduce((sum, s) => sum + s.total, 0));
      setCashTotal(filteredSales.filter(s => s.payment_method === 'Espèces').reduce((sum, s) => sum + s.total, 0));
      setMomoTotal(filteredSales.filter(s => s.payment_method === 'MoMo').reduce((sum, s) => sum + s.total, 0));
      setOmTotal(filteredSales.filter(s => s.payment_method === 'OM').reduce((sum, s) => sum + s.total, 0));

      // Recent sales (last 15)
      const sorted = [...filteredSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentSales(sorted.slice(0, 15));

      setChartData(groupedChart);

      // Generate insight
      if (groupedChart.length > 0) {
        const best = groupedChart.reduce((max, item) => item.value > max.value ? item : max, groupedChart[0]);
        if (best.value > 0) {
          setInsightText(`🏆 Meilleure période : ${best.label} avec ${best.value.toLocaleString()} FCFA`);
        } else {
          setInsightText('Aucune vente enregistrée pour cette sélection.');
        }
      } else {
        setInsightText('');
      }
    }, { cacheKey: 'loreal_cache_sales' });

    // 2. Temps réel pour les alertes de stock (avec fallback HTTPS REST et cache local)
    const unsubscribeStock = subscribeResilient('products', (data) => {
      if (!data) {
        setLowStockCount(0);
        return;
      }
      const count = Object.keys(data).filter(k => {
        const item = data[k];
        if ((item.stock || 0) > 3) return false;
        if (selectedStore === 'all') return true;
        return (item.store || 'falaise').toLowerCase() === selectedStore.toLowerCase();
      }).length;
      setLowStockCount(count);
      
      if (count > 0 && !alertsShownRef.current.stock) {
        addToast(`Alerte : ${count} article(s) en rupture !`);
        alertsShownRef.current.stock = true;
      }
    }, { cacheKey: 'loreal_cache_products' });

    // 3. Temps réel pour les avances en cours
    const unsubscribeAdvances = subscribeResilient('advances', (data) => {
      if (!data) {
        setPendingAdvancesCount(0);
        setPendingAdvancesTotal(0);
        return;
      }
      const pendingAdvances = Object.keys(data)
        .map(k => data[k])
        .filter(a => {
          if (a.status !== 'pending') return false;
          if (selectedStore === 'all') return true;
          const aStore = getAdvanceStore(a);
          return aStore === selectedStore.toLowerCase();
        });
      setPendingAdvancesCount(pendingAdvances.length);
      setPendingAdvancesTotal(pendingAdvances.reduce((sum, a) => sum + (a.amount_paid || 0), 0));
    }, { cacheKey: 'loreal_cache_advances' });

    // 4. Temps réel pour les transferts en transit
    const unsubscribeTransfers = subscribeResilient('transfers', (data) => {
      if (!data) {
        setInTransitTransfersCount(0);
        return;
      }
      const pendingTransfers = Object.keys(data).filter(k => data[k].status === 'in_transit').length;
      setInTransitTransfersCount(pendingTransfers);
    }, { cacheKey: 'loreal_cache_transfers' });

    return () => {
      unsubscribeSales();
      unsubscribeStock();
      unsubscribeAdvances();
      unsubscribeTransfers();
    };
  }, [filter, selectedStore, periodOffset, refreshKey]);

  // Sauvegarde complète pack (avec séparation Falaise et Tougou)
  const handleFullBackup = async () => {
    setIsExportingBackup(true);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    try {
      addToast('Téléchargement des sauvegardes séparées par boutique...');
      // 1. Ventes La Falaise
      await exportSalesCSV(undefined, 'falaise');
      await delay(600);
      // 2. Ventes Tougou
      await exportSalesCSV(undefined, 'tougou');
      await delay(600);
      // 3. Stocks La Falaise
      await exportProductsCSV(undefined, 'falaise');
      await delay(600);
      // 4. Stocks Tougou
      await exportProductsCSV(undefined, 'tougou');
      await delay(600);
      // 5. Avances
      await exportAdvancesCSV();
      await delay(600);
      // 6. Transferts
      await exportTransfersCSV();
      await delay(600);
      // 7. Audit
      await exportAuditLogsCSV();
      
      addToast('✅ Sauvegardes séparées téléchargées avec succès !');
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Succès : Les sauvegardes séparées (La Falaise & Tougou) ont été téléchargées dans votre dossier Téléchargements.');
      } else {
        Alert.alert('Succès', 'Les sauvegardes séparées ont été téléchargées.');
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de générer certains fichiers d’export.');
    }
    setIsExportingBackup(false);
  };

  // Ouvrir le journal d'audit
  const openAuditModal = async () => {
    setLoadingAudit(true);
    setAuditModalVisible(true);
    try {
      const logs = await getAuditLogs();
      setAuditLogsList(logs);
    } catch (e) {
      console.error('Erreur chargement logs audit:', e);
    }
    setLoadingAudit(false);
  };

  const filterLabels: Record<string, string> = {
    today: "Jour",
    yesterday: "Hier",
    week: 'Semaine',
    month: 'Mois',
    year: 'Année',
  };

  
  const calcPercent = (val: number) => {
    if (!salesTotal || salesTotal === 0) return '0%';
    return Math.round((val / salesTotal) * 100) + '%';
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('savedUserId');
      window.localStorage.removeItem('savedUserPin');
    }
    navigation.replace('Login');
  };  return (
    <View style={[styles.container, r.isWide && styles.containerWide]}>
      <AmbientBackground intensity={0.8} />

      {/* Sidebar sur grand écran (Laptop, Desktop, iPad Paysage) */}
      {r.isWide && (
        <DashboardSidebar
          user={user}
          selectedStore={selectedStore}
          navigation={navigation}
          onOpenBackup={() => setBackupModalVisible(true)}
          onOpenAudit={openAuditModal}
          onLogout={handleLogout}
        />
      )}

      {/* Zone Principale */}
      <View style={styles.dashboardMain}>
        {/* En-tête supérieur */}
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

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentInner, { paddingHorizontal: r.gutter }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} colors={[colors.gold]} />
          }
        >
          {/* Bannière audio & notifications si non armée */}
          {!audioAndNotifArmed && (
            <PressableScale
              style={styles.soundArmBanner}
              haptic="medium"
              onPress={async () => {
                startAudioKeepAlive();
                playRingToneNow(1);
                setTimeout(() => stopRingtone(), 500);
                await requestDesktopNotificationPermission();
                setAudioAndNotifArmed(true);
                if (typeof window !== 'undefined' && window.alert) {
                  window.alert("Sonneries et notifications d'arrière-plan activées avec succès !");
                }
              }}
            >
              <View style={styles.soundArmIcon}>
                <Bell color={colors.onGold} size={18} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.soundArmTitle}>Activer les alertes sonores & notifications</Text>
                <Text style={styles.soundArmSubtitle}>
                  Autoriser les alertes automatiques en cas de demande de transfert ou stock critique.
                </Text>
              </View>
              <View style={styles.soundArmBadge}>
                <Text style={styles.soundArmBadgeText}>Activer</Text>
              </View>
            </PressableScale>
          )}

          {/* Suivi des transferts en direct */}
          <LiveTransferBanner
            user={user}
            currentStore={selectedStore}
            navigation={navigation}
          />

          {/* Contrôles Boutiques & Périodes (Boss) */}
          {isSuperBoss(user) && (
            <View style={styles.controlsBar}>
              <View style={styles.storeSelectorWrap}>
                {[
                  { id: 'falaise', label: 'La Falaise' },
                  { id: 'tougou', label: 'Tougou' },
                  { id: 'all', label: 'Vue Globale' },
                ].map((s) => {
                  const active = selectedStore === s.id;
                  return (
                    <PressableScale
                      key={s.id}
                      style={[styles.storePill, active && styles.storePillActive]}
                      onPress={() => setSelectedStore(s.id)}
                      haptic="selection"
                      scaleTo={0.96}
                    >
                      <Text style={[styles.storePillText, active && styles.storePillTextActive]}>
                        {s.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <View style={styles.filterPillsWrap}>
                {['today', 'yesterday', 'week', 'month', 'year'].map((f) => {
                  const active = filter === f;
                  return (
                    <PressableScale
                      key={f}
                      style={[styles.filterPill, active && styles.filterPillActive]}
                      onPress={() => {
                        setFilter(f);
                        setPeriodOffset(0);
                      }}
                      haptic="selection"
                      scaleTo={0.96}
                    >
                      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                        {filterLabels[f]}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          )}

          {/* Navigation Temporelle */}
          {isSuperBoss(user) && (
            <GlassCard style={styles.periodBar} padded={false}>
              <PressableScale
                style={styles.periodBtn}
                onPress={() => setPeriodOffset((p) => p - 1)}
                haptic="selection"
              >
                <ChevronLeft color={colors.goldLight} size={18} />
                <Text style={styles.periodBtnText}>Précédent</Text>
              </PressableScale>

              <View style={styles.periodCenter}>
                <Text style={styles.periodTitle}>{periodTitle || filterLabels[filter]}</Text>
                {periodOffset !== 0 && (
                  <PressableScale onPress={() => setPeriodOffset(0)} haptic="light">
                    <Text style={styles.periodReset}>Revenir à aujourd'hui ↺</Text>
                  </PressableScale>
                )}
              </View>

              <PressableScale
                style={styles.periodBtn}
                onPress={() => setPeriodOffset((p) => p + 1)}
                haptic="selection"
              >
                <Text style={styles.periodBtnText}>Suivant</Text>
                <ChevronRight color={colors.goldLight} size={18} />
              </PressableScale>
            </GlassCard>
          )}

          {/* BENTO GRID : HERO KPI + PAIEMENTS */}
          <View style={[styles.kpiBentoGrid, r.isWide && styles.kpiBentoGridWide]}>
            {/* HERO CARD RECETTE TOTALE */}
            <View style={[styles.heroCardCol, r.isWide && styles.heroCardColWide]}>
              <TiltCard maxTilt={5}>
                <GlassCard variant="gold" glow style={styles.heroCard}>
                  <View style={styles.heroTopRow}>
                    <View style={styles.heroEyebrowWrap}>
                      <TrendingUp color={colors.gold} size={16} />
                      <Text style={styles.heroEyebrow}>
                        {!isSuperBoss(user)
                          ? "RECETTE DU JOUR"
                          : filter === 'week' ? 'RECETTE DE LA SEMAINE' : filter === 'month' ? 'RECETTE DU MOIS' : filter === 'year' ? "RECETTE DE L'ANNÉE" : `RECETTE · ${filterLabels[filter].toUpperCase()}`}
                      </Text>
                    </View>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>{salesCount} vente{salesCount > 1 ? 's' : ''}</Text>
                    </View>
                  </View>

                  <View style={styles.heroAmountWrap}>
                    <AnimatedNumber
                      value={salesTotal}
                      suffix=" FCFA"
                      style={styles.heroAmount}
                    />
                  </View>

                  <Text style={styles.heroSubText}>
                    Enregistrements certifiés · {selectedStore === 'all' ? 'Toutes boutiques' : selectedStore === 'tougou' ? 'Tougou' : 'La Falaise'}
                  </Text>
                </GlassCard>
              </TiltCard>
            </View>

            {/* 4 CARTES MODES DE PAIEMENT */}
            <View style={[styles.paymentsGrid, r.isWide && styles.paymentsGridWide]}>
              <GlassCard style={styles.paymentCard} padded={false}>
                <View style={styles.paymentCardInner}>
                  <View style={styles.paymentCardTop}>
                    <View style={[styles.paymentIconWrap, { backgroundColor: colors.successSoft }]}>
                      <Banknote color={colors.success} size={18} />
                    </View>
                    <Text style={[styles.paymentPercent, { color: colors.success }]}>{calcPercent(cashTotal)}</Text>
                  </View>
                  <AnimatedNumber value={cashTotal} suffix=" F" style={styles.paymentValue} />
                  <Text style={styles.paymentLabel}>Espèces</Text>
                </View>
              </GlassCard>

              <GlassCard style={styles.paymentCard} padded={false}>
                <View style={styles.paymentCardInner}>
                  <View style={styles.paymentCardTop}>
                    <View style={[styles.paymentIconWrap, { backgroundColor: colors.infoSoft }]}>
                      <CreditCard color={colors.info} size={18} />
                    </View>
                    <Text style={[styles.paymentPercent, { color: colors.info }]}>{calcPercent(cardTotal)}</Text>
                  </View>
                  <AnimatedNumber value={cardTotal} suffix=" F" style={styles.paymentValue} />
                  <Text style={styles.paymentLabel}>Carte Bancaire</Text>
                </View>
              </GlassCard>

              <GlassCard style={styles.paymentCard} padded={false}>
                <View style={styles.paymentCardInner}>
                  <View style={styles.paymentCardTop}>
                    <View style={[styles.paymentIconWrap, { backgroundColor: colors.warningSoft }]}>
                      <Wallet color={colors.warning} size={18} />
                    </View>
                    <Text style={[styles.paymentPercent, { color: colors.warning }]}>{calcPercent(momoTotal)}</Text>
                  </View>
                  <AnimatedNumber value={momoTotal} suffix=" F" style={styles.paymentValue} />
                  <Text style={styles.paymentLabel}>MTN MoMo</Text>
                </View>
              </GlassCard>

              <GlassCard style={styles.paymentCard} padded={false}>
                <View style={styles.paymentCardInner}>
                  <View style={styles.paymentCardTop}>
                    <View style={[styles.paymentIconWrap, { backgroundColor: 'rgba(255,87,34,0.14)' }]}>
                      <Wallet color="#FF5722" size={18} />
                    </View>
                    <Text style={[styles.paymentPercent, { color: '#FF5722' }]}>{calcPercent(omTotal)}</Text>
                  </View>
                  <AnimatedNumber value={omTotal} suffix=" F" style={styles.paymentValue} />
                  <Text style={styles.paymentLabel}>Orange Money</Text>
                </View>
              </GlassCard>
            </View>
          </View>

          {/* ALERTES RAPIDES */}
          <View style={styles.alertsRow}>
            <PressableScale
              style={{ flex: 1 }}
              onPress={() => navigation.navigate('Inventory', { filter: 'low_stock', user, storeId: selectedStore })}
              haptic="selection"
            >
              <GlassCard
                variant={lowStockCount > 0 ? 'danger' : 'default'}
                style={styles.alertCard}
                padded={false}
              >
                <View style={styles.alertCardInner}>
                  <View style={[styles.alertIconWrap, lowStockCount > 0 && { backgroundColor: colors.dangerSoft }]}>
                    <AlertTriangle color={lowStockCount > 0 ? colors.danger : colors.textMuted} size={18} />
                  </View>
                  <Text style={[styles.alertCount, lowStockCount > 0 && { color: colors.danger }]}>{lowStockCount}</Text>
                  <Text numberOfLines={1} style={styles.alertTitle}>Stock faible (≤ 3)</Text>
                </View>
              </GlassCard>
            </PressableScale>

            <PressableScale
              style={{ flex: 1 }}
              onPress={() => navigation.navigate('Advances', { user, storeId: selectedStore })}
              haptic="selection"
            >
              <GlassCard style={styles.alertCard} padded={false}>
                <View style={styles.alertCardInner}>
                  <View style={[styles.alertIconWrap, pendingAdvancesCount > 0 && { backgroundColor: colors.warningSoft }]}>
                    <Wallet color={pendingAdvancesCount > 0 ? colors.warning : colors.textMuted} size={18} />
                  </View>
                  <Text style={[styles.alertCount, pendingAdvancesCount > 0 && { color: colors.warning }]}>
                    {pendingAdvancesTotal > 0 ? `${formatMoney(pendingAdvancesTotal)} F` : '0 F'}
                  </Text>
                  <Text numberOfLines={1} style={styles.alertTitle}>
                    {pendingAdvancesCount > 0 ? `${pendingAdvancesCount} avance(s)` : 'Avances en cours'}
                  </Text>
                </View>
              </GlassCard>
            </PressableScale>

            {inTransitTransfersCount > 0 && (
              <PressableScale
                style={{ flex: 1 }}
                onPress={() => navigation.navigate('Transfers', { user, storeId: selectedStore })}
                haptic="selection"
              >
                <GlassCard style={styles.alertCard} padded={false}>
                  <View style={styles.alertCardInner}>
                    <View style={[styles.alertIconWrap, { backgroundColor: colors.goldSoft }]}>
                      <ArrowRightLeft color={colors.gold} size={18} />
                    </View>
                    <Text style={[styles.alertCount, { color: colors.gold }]}>{inTransitTransfersCount}</Text>
                    <Text numberOfLines={1} style={styles.alertTitle}>En transit</Text>
                  </View>
                </GlassCard>
              </PressableScale>
            )}
          </View>

          {/* GRAPHIQUE D'ANALYSE */}
          {chartData.length > 0 && (
            <GlassCard style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Analyse des Ventes</Text>
                {insightText ? <Text style={styles.insightText}>{insightText}</Text> : null}
              </View>
              <View style={styles.chartArea}>
                {(() => {
                  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
                  return chartData.map((bar, i) => {
                    const isTop = bar.value === maxVal && bar.value > 0;
                    return (
                      <View key={i} style={styles.barWrapper}>
                        <Text style={styles.barValue}>
                          {bar.value > 0 ? (bar.value >= 1000 ? `${Math.round(bar.value / 1000)}k` : bar.value) : ''}
                        </Text>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: Math.max((bar.value / maxVal) * 120, 6),
                              backgroundColor: isTop ? colors.gold : colors.surfaceStrong,
                              borderColor: isTop ? colors.goldLight : colors.border,
                            },
                          ]}
                        />
                        <Text style={[styles.barLabel, isTop && { color: colors.goldLight, fontFamily: fonts.bold }]}>
                          {bar.label}
                        </Text>
                      </View>
                    );
                  });
                })()}
              </View>
            </GlassCard>
          )}

          {/* 1. VUE SEMAINE */}
          {filter === 'week' && (
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownHeader}>
                <Calendar color={colors.gold} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownSectionTitle}>Détail de la Semaine (Lundi à Samedi)</Text>
                  <Text style={styles.breakdownSectionSubtitle}>Dimanche non ouvré</Text>
                </View>
              </View>

              {weekDaysBreakdown.map((dayItem) => {
                const isExpanded = !!expandedDayKeys[dayItem.key];
                return (
                  <GlassCard key={dayItem.key} style={styles.dayCard} padded={false}>
                    <PressableScale
                      style={styles.dayCardHeader}
                      onPress={() => setExpandedDayKeys((prev) => ({ ...prev, [dayItem.key]: !prev[dayItem.key] }))}
                      haptic="selection"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayCardName}>
                          {dayItem.dayName} <Text style={styles.dayCardDate}>({dayItem.formattedDate})</Text>
                        </Text>
                        <Text style={styles.dayCardSub}>{dayItem.salesCount} vente(s)</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
                        <Text style={styles.dayCardTotal}>{formatMoney(dayItem.total)} F</Text>
                        {isExpanded ? <ChevronUp color={colors.gold} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
                      </View>
                    </PressableScale>

                    {isExpanded && (
                      <View style={styles.dayCardContent}>
                        {dayItem.salesCount === 0 ? (
                          <Text style={styles.emptyDayText}>Aucune vente enregistrée ce jour.</Text>
                        ) : (
                          <>
                            <Text style={styles.articlesSoldTitle}>Articles vendus ce {dayItem.dayName} :</Text>
                            {dayItem.itemsSummary.map((item: any, itemIdx: number) => {
                              const matchingSale = dayItem.sales.find((s: any) =>
                                (Array.isArray(s.items) && s.items.some((it: any) => it.name === item.name)) ||
                                (typeof s.items === 'string' && s.items.includes(item.name))
                              ) || dayItem.sales[0];
                              return (
                                <TouchableOpacity 
                                  key={itemIdx} 
                                  style={[styles.itemSummaryRow, { cursor: 'pointer' as any }]}
                                  onPress={() => matchingSale && handleOpenSaleDetail(matchingSale)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.itemSummaryName}>• {item.name}</Text>
                                  <Text style={styles.itemSummaryQty}>x{item.quantity}</Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.itemSummaryPrice}>{formatMoney(item.amount)} F</Text>
                                    <Eye color={colors.goldLight} size={14} />
                                  </View>
                                </TouchableOpacity>
                              );
                            })}

                            <Text style={[styles.articlesSoldTitle, { marginTop: 12 }]}>Transactions ({dayItem.sales.length}) :</Text>
                            {dayItem.sales.map((sale: any, sIdx: number) => (
                              <TouchableOpacity 
                                key={sale.id || sIdx} 
                                style={[styles.subSaleRow, { cursor: 'pointer' as any }]}
                                onPress={() => handleOpenSaleDetail(sale)}
                                activeOpacity={0.7}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.subSaleTime}>
                                    {new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {sale.payment_method}
                                  </Text>
                                  <Text style={styles.subSaleItems} numberOfLines={1}>
                                    {typeof sale.items === 'string' ? sale.items : (Array.isArray(sale.items) ? sale.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ') : 'Article')}
                                  </Text>
                                  <Text style={{ color: colors.goldLight, fontSize: 10, marginTop: 2 }}>
                                    👁️ Toucher pour voir le reçu complet
                                  </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={styles.subSaleAmount}>{formatMoney(sale.total)} F</Text>
                                  <Eye color={colors.goldLight} size={15} />
                                </View>
                              </TouchableOpacity>
                            ))}
                          </>
                        )}
                      </View>
                    )}
                  </GlassCard>
                );
              })}
            </View>
          )}

          {/* 2. VUE MOIS */}
          {filter === 'month' && (
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownHeader}>
                <Calendar color={colors.gold} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownSectionTitle}>Détail du Mois par Semaines</Text>
                  <Text style={styles.breakdownSectionSubtitle}>Semaines 1 à 5 (Lundi à Samedi)</Text>
                </View>
              </View>

              {monthWeeksBreakdown.map((weekItem) => {
                const isWeekExpanded = !!expandedWeekKeys[weekItem.key];
                return (
                  <GlassCard key={weekItem.key} style={styles.weekCard} padded={false}>
                    <PressableScale
                      style={styles.weekCardHeader}
                      onPress={() => setExpandedWeekKeys((prev) => ({ ...prev, [weekItem.key]: !prev[weekItem.key] }))}
                      haptic="selection"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.weekCardTitle}>{weekItem.weekLabel} <Text style={styles.weekCardRange}>({weekItem.dateRange})</Text></Text>
                        <Text style={styles.weekCardSub}>{weekItem.salesCount} vente(s)</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
                        <Text style={styles.weekCardTotal}>{formatMoney(weekItem.total)} F</Text>
                        {isWeekExpanded ? <ChevronUp color={colors.gold} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
                      </View>
                    </PressableScale>

                    {isWeekExpanded && (
                      <View style={styles.weekCardDaysContainer}>
                        {weekItem.days.map((dayItem: any) => {
                          const isDayExpanded = !!expandedDayKeys[dayItem.key];
                          return (
                            <View key={dayItem.key} style={styles.nestedDayCard}>
                              <PressableScale
                                style={styles.nestedDayHeader}
                                onPress={() => setExpandedDayKeys((prev) => ({ ...prev, [dayItem.key]: !prev[dayItem.key] }))}
                                haptic="selection"
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.nestedDayName}>{dayItem.dayName} ({dayItem.formattedDate})</Text>
                                  <Text style={styles.nestedDaySub}>{dayItem.salesCount} vente(s)</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                                  <Text style={styles.nestedDayTotal}>{formatMoney(dayItem.total)} F</Text>
                                  {isDayExpanded ? <ChevronUp color={colors.gold} size={16} /> : <ChevronDown color={colors.textMuted} size={16} />}
                                </View>
                              </PressableScale>

                              {isDayExpanded && (
                                <View style={styles.nestedDayContent}>
                                  {dayItem.salesCount === 0 ? (
                                    <Text style={styles.emptyDayText}>Aucune vente enregistrée ce jour.</Text>
                                  ) : (
                                    dayItem.sales.map((sale: any, sIdx: number) => (
                                      <TouchableOpacity 
                                        key={sale.id || sIdx} 
                                        style={[styles.subSaleRow, { cursor: 'pointer' as any }]}
                                        onPress={() => handleOpenSaleDetail(sale)}
                                        activeOpacity={0.7}
                                      >
                                        <View style={{ flex: 1 }}>
                                          <Text style={styles.subSaleTime}>
                                            {new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {sale.payment_method}
                                          </Text>
                                          <Text style={styles.subSaleItems} numberOfLines={1}>
                                            {sale.sale_label || (typeof sale.items === 'string' ? sale.items : (Array.isArray(sale.items) ? sale.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ') : 'Article'))}
                                          </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                          <Text style={styles.subSaleAmount}>{formatMoney(sale.total)} F</Text>
                                          <Eye color={colors.goldLight} size={14} />
                                        </View>
                                      </TouchableOpacity>
                                    ))
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </GlassCard>
                );
              })}
            </View>
          )}

          {/* 3. VUE ANNÉE */}
          {filter === 'year' && (
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownHeader}>
                <Calendar color={colors.gold} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownSectionTitle}>Détail de l'Année par Mois</Text>
                  <Text style={styles.breakdownSectionSubtitle}>Janvier à Décembre</Text>
                </View>
              </View>

              {yearMonthsBreakdown.map((monthItem) => (
                <GlassCard key={monthItem.key} style={styles.monthCard} padded={false}>
                  <View style={styles.monthCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.monthCardTitle}>{monthItem.monthName}</Text>
                      <Text style={styles.monthCardSub}>{monthItem.salesCount} vente(s)</Text>
                    </View>
                    <Text style={styles.monthCardTotal}>{formatMoney(monthItem.total)} F</Text>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {/* 4. VUE JOUR & HIER : Historique récent */}
          {(filter === 'today' || filter === 'yesterday' || !isSuperBoss(user)) && recentSales.length > 0 && (
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
                      <Text style={{ color: colors.gold, fontSize: 10.5, marginTop: 2, fontFamily: fonts.semibold }}>
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
                            sale.payment_method === 'Avance' && { color: '#FF9800' },
                          ]}
                        >
                          {sale.payment_method}
                        </Text>
                      </View>
                      <View style={{ padding: 4, justifyContent: 'center' }}>
                        <Eye color={colors.goldLight} size={18} />
                      </View>
                      <TouchableOpacity 
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
          )}

          {/* BENTO GRID DES ACTIONS */}
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
        </ScrollView>
      </View>

      {/* Auto-Toast Alert */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastAnim }] }]}>
          <AlertTriangle color="#ff4444" size={24} />
          <Text style={styles.toastText}>{currentToast}</Text>
        </Animated.View>
      )}

      {/* Assistant Virtuel Notifications */}
      <Modal visible={showSecurityAssistant} animationType="fade" transparent={true}>
        <View style={styles.assistantOverlay}>
          <View style={styles.assistantPanel}>
            <View style={styles.assistantHeader}>
              <Text style={styles.assistantTitle}>🚨 Alertes Système</Text>
              <TouchableOpacity onPress={() => setShowSecurityAssistant(false)}>
                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 15 }}>
              <Text style={styles.assistantSectionTitle}>⚠️ Alertes de Sécurité ({securityLogs.length})</Text>
              {securityLogs.map(log => (
                <View key={log.id} style={styles.securityLogCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logText}>
                        {log.type === 'chat_violation' ? '⚠️ Chat suspect:' : 'Tentative:'} {log.userName}
                      </Text>
                      <Text style={styles.logDate}>{new Date(log.timestamp).toLocaleString('fr-FR')}</Text>
                      {log.location?.lat !== 0 && log.type !== 'chat_violation' && (
                        <TouchableOpacity style={styles.mapBtn} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${log.location.lat},${log.location.lon}`)}>
                          <MapPin color="#4CAF50" size={16} />
                          <Text style={styles.mapBtnText}>Voir sur Google Maps ({log.location.city})</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteLog(log.id)} style={{ padding: 5 }}>
                      <Trash2 color="#ff4444" size={20} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {securityLogs.length === 0 && <Text style={{ color: '#888' }}>Aucune alerte récente.</Text>}

              <Text style={[styles.assistantSectionTitle, { marginTop: 20 }]}>📦 Stock Faible ({lowStockCount})</Text>
              {lowStockCount > 0 ? (
                <TouchableOpacity style={styles.stockAlertBtn} onPress={() => { setShowSecurityAssistant(false); navigation.navigate('Inventory', { filter: 'low_stock', user, storeId: selectedStore }); }}>
                  <Text style={styles.stockAlertBtnText}>Voir les articles en rupture</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: '#888' }}>Le stock est bon !</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Gestion des Profils & Mots de passe */}
      <Modal visible={userModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.modalTitle}>Gestion des Profils & Accès</Text>
              <TouchableOpacity onPress={() => { cancelEditUser(); setUserModalVisible(false); }}>
                <Text style={{ color: '#fff', fontSize: 18, padding: 5 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Toggle Afficher / Masquer mots de passe */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: '#aaa', fontSize: 13 }}>Équipe enregistrée ({systemUsers.length})</Text>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                onPress={() => setShowUserPasswords(!showUserPasswords)}
              >
                {showUserPasswords ? <EyeOff color="#d4af37" size={16} /> : <Eye color="#d4af37" size={16} />}
                <Text style={{ color: '#d4af37', fontSize: 12, fontWeight: '600' }}>
                  {showUserPasswords ? 'Masquer codes' : 'Voir codes/PIN'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 220, marginBottom: 15 }}>
              {systemUsers.map(u => (
                <View key={u.id} style={[styles.userItem, editingUser?.id === u.id && { borderColor: '#d4af37', borderWidth: 1 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{u.name}</Text>
                      <View style={[styles.roleBadge, isUserAdmin(u) ? styles.roleBadgeAdmin : styles.roleBadgeStaff]}>
                        <Text style={styles.roleBadgeText}>
                          {isUserAdmin(u) ? '👑 Admin' : u.role === 'employe' ? 'Employé' : 'Caissière'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 3 }}>
                      Magasin: <Text style={{ color: '#d4af37' }}>{u.store === 'all' ? 'Tous les magasins' : u.store === 'tougou' ? 'Tougou' : 'La Falaise'}</Text>
                      {'  '}| Code/PIN: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{showUserPasswords ? (u.pin || 'Non défini') : '••••••••'}</Text>
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => startEditUser(u)} style={{ padding: 6, backgroundColor: '#333', borderRadius: 6 }}>
                      <Edit3 color="#d4af37" size={16} />
                    </TouchableOpacity>
                    {u.id !== 'boss' && u.name?.toLowerCase() !== 'boss' && (
                      <TouchableOpacity onPress={() => handleDeleteUser(u.id, u.name)} style={{ padding: 6, backgroundColor: '#3a1a1a', borderRadius: 6 }}>
                        <Trash2 color="#ff4444" size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ height: 1, backgroundColor: '#333', marginBottom: 15 }} />
            
            <ScrollView style={{ maxHeight: 320 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 15 }}>
                  {editingUser ? `✏️ Modifier : ${editingUser.name}` : '➕ Créer un nouveau profil'}
                </Text>
                {editingUser && (
                  <TouchableOpacity onPress={cancelEditUser}>
                    <Text style={{ color: '#ff4444', fontSize: 12 }}>Annuler modif</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <Text style={styles.fieldLabel}>Nom complet</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: Jean Dupont" 
                placeholderTextColor="#666" 
                value={newUserName} 
                onChangeText={setNewUserName} 
              />
              
              <Text style={styles.fieldLabel}>Mot de passe / Code PIN (8 caractères)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: B000000. (Majuscule, chiffres, point)" 
                placeholderTextColor="#666" 
                value={newUserPin} 
                onChangeText={setNewUserPin} 
                secureTextEntry={!showUserPasswords}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Magasin Assigné</Text>
              <View style={styles.pickerContainer}>
                {[
                  { id: 'falaise', label: 'La Falaise' },
                  { id: 'tougou', label: 'Tougou' },
                  { id: 'all', label: 'Tous les magasins' }
                ].map(s => (
                  <TouchableOpacity key={s.id} style={[styles.pickerItem, newUserStore === s.id && styles.pickerItemActive]} onPress={() => setNewUserStore(s.id)}>
                    <Text style={[styles.pickerItemText, newUserStore === s.id && styles.pickerItemTextActive]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Rôle de l'utilisateur</Text>
              <View style={styles.pickerContainer}>
                {[
                  { id: 'caissiere', label: 'Caissière (+Stock)' },
                  { id: 'employe', label: 'Employé (Caisse info)' },
                  { id: 'admin', label: 'Administrateur / Boss' }
                ].map(r => (
                  <TouchableOpacity key={r.id} style={[styles.pickerItem, newUserRole === r.id && styles.pickerItemActive]} onPress={() => setNewUserRole(r.id)}>
                    <Text style={[styles.pickerItemText, newUserRole === r.id && styles.pickerItemTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => { cancelEditUser(); setUserModalVisible(false); }}
              >
                <Text style={styles.cancelBtnText}>Fermer</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUser}>
                <Text style={styles.saveBtnText}>
                  {editingUser ? 'Enregistrer' : 'Créer profil'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Historique des Ventes par Date */}
      <Modal visible={salesHistoryModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>🗓️ Historique des Ventes</Text>
            
            {/* Sélecteur de date */}
            <Text style={styles.fieldLabel}>Sélectionner une date</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                placeholder="YYYY-MM-DD" 
                placeholderTextColor="#666" 
                value={historyDate} 
                onChangeText={setHistoryDate}
              />
              <TouchableOpacity 
                style={{ backgroundColor: '#d4af37', paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center' }} 
                onPress={() => loadSalesByDate(historyDate)}
              >
                <Text style={{ color: '#121212', fontWeight: 'bold' }}>Rechercher</Text>
              </TouchableOpacity>
            </View>

            {/* Résumé */}
            <View style={{ backgroundColor: '#2a2a2a', padding: 15, borderRadius: 12, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#d4af37' }}>
              <View>
                <Text style={{ color: '#aaa', fontSize: 13 }}>Total de la journée</Text>
                <Text style={{ color: '#888', fontSize: 12 }}>{historySales.length} vente(s)</Text>
              </View>
              <Text style={{ color: '#d4af37', fontSize: 22, fontWeight: 'bold' }}>{historyTotal.toLocaleString()} F</Text>
            </View>

            {/* Liste des ventes */}
            {loadingHistory ? (
              <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>Chargement...</Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {historySales.length === 0 ? (
                  <Text style={{ color: '#888', textAlign: 'center', padding: 40 }}>Aucune vente pour cette date.</Text>
                ) : (
                  historySales.map((sale, idx) => (
                    <TouchableOpacity 
                      key={sale.id} 
                      onPress={() => handleOpenSaleDetail(sale)}
                      activeOpacity={0.7}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: idx % 2 === 0 ? '#1e1e1e' : '#252525', padding: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: sale.is_advance === 1 ? '#FF9800' : '#333', cursor: 'pointer' as any }}
                    >
                      <Text style={{ color: '#d4af37', fontWeight: 'bold', width: 45 }}>N°{String(idx + 1).padStart(3, '0')}</Text>
                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }} numberOfLines={2}>
                          {sale.itemsFormatted || sale.items}
                        </Text>
                        <Text style={{ color: '#888', fontSize: 11, marginTop: 3 }}>
                          {new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {sale.seller_name ? ` • Vendeur : ${sale.seller_name}` : ''}
                        </Text>
                        <Text style={{ color: '#d4af37', fontSize: 10, marginTop: 2 }}>
                          👁️ Toucher pour voir le reçu complet
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                        <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 15 }}>{sale.total.toLocaleString()} F</Text>
                        <Text style={[{ color: '#4CAF50', fontSize: 11, marginTop: 2 }, 
                          sale.payment_method === 'MoMo' && { color: '#ffcc00' },
                          sale.payment_method === 'OM' && { color: '#FF5722' },
                          sale.payment_method === 'Carte Bancaire' && { color: '#2196F3' },
                          sale.payment_method === 'Avance' && { color: '#FF9800' }
                        ]}>{sale.payment_method}</Text>
                      </View>
                      <View style={{ padding: 6, marginRight: 4 }}>
                        <Eye color="#d4af37" size={16} />
                      </View>
                      <TouchableOpacity 
                        onPress={(e) => {
                          if (e && e.stopPropagation) e.stopPropagation();
                          handleDeleteSale(sale, 'history');
                        }} 
                        style={{ padding: 8, backgroundColor: '#3a1a1a', borderRadius: 8 }}
                      >
                        <Trash2 color="#ff4444" size={18} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 15 }]} onPress={() => setSalesHistoryModal(false)}>
              <Text style={styles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Transfert */}
      <Modal visible={transferModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 22, maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>🚚 Nouveau Transfert (Suivi en Direct)</Text>
            
            {transferProduct && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#2a2a2a', padding: 14, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#9C27B0' }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>{transferProduct.name}</Text>
                  <Text style={{ color: '#d4af37', marginTop: 4, fontWeight: 'bold' }}>Stock disponible à {selectedStore.toUpperCase()} : {transferProduct.stock}</Text>
                  <Text style={{ color: '#aaa', marginTop: 2, fontSize: 12 }}>
                    {transferProduct.category} {transferProduct.size ? `• Taille: ${transferProduct.size}` : ''} {transferProduct.color ? `• Couleur: ${transferProduct.color}` : ''}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Quantité à expédier</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={transferQty} onChangeText={setTransferQty} />

                <Text style={styles.fieldLabel}>Boutique Destinataire</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                  <TouchableOpacity 
                    style={[styles.input, { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: transferDest === 'falaise' ? '#9C27B0' : '#444', backgroundColor: transferDest === 'falaise' ? '#4a1555' : '#2a2a2a' }]}
                    onPress={() => setTransferDest('falaise')}
                  >
                    <Text style={{ color: transferDest === 'falaise' ? '#fff' : '#888', fontWeight: 'bold' }}>📍 La Falaise</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.input, { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: transferDest === 'tougou' ? '#9C27B0' : '#444', backgroundColor: transferDest === 'tougou' ? '#4a1555' : '#2a2a2a' }]}
                    onPress={() => setTransferDest('tougou')}
                  >
                    <Text style={{ color: transferDest === 'tougou' ? '#fff' : '#888', fontWeight: 'bold' }}>📍 Tougou</Text>
                  </TouchableOpacity>
                </View>

                {/* Sélecteur du Transporteur / Livreur (Style Glovo / Yango) */}
                <Text style={styles.fieldLabel}>🏍️ Qui transporte ou reçoit le colis ?</Text>
                <Text style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
                  Ce transfert sera notifié et affiché sur le tableau de bord de cette personne, du magasin et du Boss !
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                  {availableUsers.map((u) => {
                    const isSelected = selectedCarrier?.id === u.id && !customCarrierName;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        onPress={() => {
                          setSelectedCarrier(u);
                          setCustomCarrierName('');
                        }}
                        style={{
                          backgroundColor: isSelected ? '#d4af3722' : '#222',
                          borderColor: isSelected ? '#d4af37' : '#444',
                          borderWidth: 1.5,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 14 }}>{u.role === 'admin' ? '👑' : '🛍️'}</Text>
                        <View>
                          <Text style={{ color: isSelected ? '#d4af37' : '#fff', fontWeight: 'bold', fontSize: 12 }}>
                            {u.name}
                          </Text>
                          <Text style={{ color: '#888', fontSize: 10 }}>
                            {u.store === 'all' ? 'Direction' : u.store === 'falaise' ? 'La Falaise' : 'Tougou'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Saisie libre optionnelle coursier moto / taxi */}
                <Text style={[styles.fieldLabel, { fontSize: 11 }]}>Ou nom d'un taxi / moto externe :</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 15 }]}
                  placeholder="Ex: Taxi Moto Douala / Roger Moto..."
                  placeholderTextColor="#666"
                  value={customCarrierName}
                  onChangeText={(text) => {
                    setCustomCarrierName(text);
                    if (text) setSelectedCarrier(null);
                  }}
                />

                {/* Durée estimée du trajet */}
                <Text style={styles.fieldLabel}>⏱️ Durée estimée du trajet</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {[10, 15, 20, 30].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      onPress={() => setEstimatedMinutes(mins)}
                      style={{
                        flex: 1,
                        backgroundColor: estimatedMinutes === mins ? '#d4af37' : '#252525',
                        paddingVertical: 9,
                        borderRadius: 8,
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderColor: estimatedMinutes === mins ? '#d4af37' : '#444'
                      }}
                    >
                      <Text style={{ color: estimatedMinutes === mins ? '#121212' : '#ccc', fontWeight: 'bold', fontSize: 12 }}>
                        {mins} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                  <TouchableOpacity style={[styles.cancelBtn, { flex: 1, margin: 0 }]} onPress={() => { setTransferProduct(null); setTransferQty('1'); }}>
                    <Text style={styles.cancelBtnText}>Changer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, { flex: 2, backgroundColor: '#9C27B0', margin: 0 }]} onPress={handleTransferSubmit}>
                    <Text style={[styles.saveBtnText, { color: '#fff', fontWeight: 'bold' }]}>🚀 Lancer le Suivi Live</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
            
            {!transferProduct && (
              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 20 }]} onPress={() => setTransferModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Fermer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Recherche Transfert Manuel */}
      <Modal visible={transferSearchModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Recherche Article (Transfert)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 15, borderWidth: 1, borderColor: '#444' }}>
              <TextInput
                style={{ flex: 1, height: 50, color: '#fff' }}
                placeholder="Rechercher par nom ou référence..."
                placeholderTextColor="#888"
                value={transferSearchText}
                onChangeText={setTransferSearchText}
                autoFocus
              />
            </View>
            <ScrollView style={{ marginTop: 10 }}>
              {products.filter(p => {
                const searchTerms = transferSearchText.toLowerCase().split(/\s+/).filter(t => t.trim() !== '');
                if (searchTerms.length === 0) return true;
                return searchTerms.every(term => p.name.toLowerCase().includes(term) || (p.reference && p.reference.toLowerCase().includes(term)));
              }).slice(0, 15).map(p => (
                <TouchableOpacity key={p.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' }} onPress={() => selectTransferProduct(p)}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{p.name}</Text>
                  <Text style={{ color: '#888', fontSize: 12, marginTop: 3 }}>
                    {p.category} {p.size ? `| Taille: ${p.size}` : ''} {p.color ? `| Couleur: ${p.color}` : ''} — Stock: {p.stock}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 20, width: '100%', marginHorizontal: 0 }]} onPress={() => setTransferSearchModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Scanner */}
      <Modal visible={scannerVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <WebScanner 
            onScan={handleScanTransfer}
            onClose={() => setScannerVisible(false)}
          />
        </View>
      </Modal>

      {/* Floating Action Button for AI Chat */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setShowAIAssistant(true)}
      >
        <Text style={{ fontSize: 28 }}>🤖</Text>
      </TouchableOpacity>

      {/* AIAssistant Modal */}
      <AIAssistantModal 
        visible={showAIAssistant} 
        onClose={() => setShowAIAssistant(false)} 
        user={user} 
      />

      {/* Modal Sauvegarde Complète & Exports Excel / CSV */}
      <Modal visible={backupModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Download color="#d4af37" size={22} />
                <Text style={styles.modalTitle}>Sauvegarde & Exports Excel</Text>
              </View>
              <TouchableOpacity onPress={() => setBackupModalVisible(false)} style={{ padding: 5 }}>
                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 15 }}>
              Exportez instantanément vos bases de données en fichiers CSV encodés en UTF-8 avec séparateur point-virgule (compatibles directement avec Microsoft Excel et Google Sheets).
            </Text>

            {/* Pack complet */}
            <TouchableOpacity 
              style={[styles.saveBtn, { marginHorizontal: 0, marginBottom: 15, padding: 14, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}
              disabled={isExportingBackup}
              onPress={handleFullBackup}
            >
              <Download color="#121212" size={20} />
              <Text style={[styles.saveBtnText, { fontSize: 13 }]}>
                {isExportingBackup ? 'Téléchargement en cours...' : '📥 Télécharger la Sauvegarde Complète (Pack Tout-en-Un)'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: '#333', marginBottom: 12 }} />
            <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 13, marginBottom: 10 }}>Ou télécharger fichier par fichier :</Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {/* Ventes Falaise */}
              <TouchableOpacity 
                style={styles.backupRowBtn} 
                onPress={() => exportSalesCSV(undefined, 'falaise')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <FileSpreadsheet color="#4CAF50" size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>1a. Ventes — La Falaise (Excel / CSV)</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Toutes les ventes enregistrées à La Falaise</Text>
                  </View>
                </View>
                <Download color="#d4af37" size={18} />
              </TouchableOpacity>

              {/* Ventes Tougou */}
              <TouchableOpacity 
                style={styles.backupRowBtn} 
                onPress={() => exportSalesCSV(undefined, 'tougou')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <FileSpreadsheet color="#4CAF50" size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>1b. Ventes — Tougou (Excel / CSV)</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Toutes les ventes enregistrées à Tougou</Text>
                  </View>
                </View>
                <Download color="#d4af37" size={18} />
              </TouchableOpacity>

              {/* Stocks Falaise */}
              <TouchableOpacity 
                style={styles.backupRowBtn} 
                onPress={() => exportProductsCSV(undefined, 'falaise')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Package color="#2196F3" size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>2a. Stock Réel — La Falaise (Excel / CSV)</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Rayons, tailles, codes-barres et quantités La Falaise</Text>
                  </View>
                </View>
                <Download color="#d4af37" size={18} />
              </TouchableOpacity>

              {/* Stocks Tougou */}
              <TouchableOpacity 
                style={styles.backupRowBtn} 
                onPress={() => exportProductsCSV(undefined, 'tougou')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Package color="#2196F3" size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>2b. Stock Réel — Tougou (Excel / CSV)</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Rayons, tailles, codes-barres et quantités Tougou</Text>
                  </View>
                </View>
                <Download color="#d4af37" size={18} />
              </TouchableOpacity>

              {/* Avances */}
              <TouchableOpacity 
                style={styles.backupRowBtn} 
                onPress={() => exportAdvancesCSV()}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Wallet color="#FF9800" size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>3. Avances & Réservations (Excel / CSV)</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Acomptes, soldes restants, clients, dates limites</Text>
                  </View>
                </View>
                <Download color="#d4af37" size={18} />
              </TouchableOpacity>

              {/* Transferts */}
              <TouchableOpacity 
                style={styles.backupRowBtn} 
                onPress={() => exportTransfersCSV()}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <ArrowRightLeft color="#9C27B0" size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>4. Historique des Transferts (Excel / CSV)</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Mouvements entre magasins, transit et réceptions</Text>
                  </View>
                </View>
                <Download color="#d4af37" size={18} />
              </TouchableOpacity>

              {/* Audit */}
              <TouchableOpacity 
                style={styles.backupRowBtn} 
                onPress={() => exportAuditLogsCSV()}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <ShieldCheck color="#ff4444" size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>5. Journal d'Audit & Sécurité (Excel / CSV)</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Annulations de vente, ajustements de stocks, motifs</Text>
                  </View>
                </View>
                <Download color="#d4af37" size={18} />
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 15, marginHorizontal: 0 }]} onPress={() => setBackupModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Journal d'Audit & Sécurité */}
      <Modal visible={auditModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShieldCheck color="#d4af37" size={22} />
                <Text style={styles.modalTitle}>Journal d'Audit des Actions</Text>
              </View>
              <TouchableOpacity onPress={() => setAuditModalVisible(false)} style={{ padding: 5 }}>
                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>
              Consultation réservée à la Direction : historique infalsifiable de toutes les suppressions de ventes, modifications de stock et transferts.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0, height: 42, fontSize: 13 }]} 
                placeholder="Filtrer par auteur, motif, article..." 
                placeholderTextColor="#666" 
                value={auditSearchText} 
                onChangeText={setAuditSearchText} 
              />
              <TouchableOpacity 
                style={{ backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#d4af37', paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 }}
                onPress={() => exportAuditLogsCSV()}
              >
                <Download color="#d4af37" size={16} />
                <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 12 }}>Excel</Text>
              </TouchableOpacity>
            </View>

            {loadingAudit ? (
              <Text style={{ color: '#888', textAlign: 'center', padding: 30 }}>Chargement du journal d'audit...</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {auditLogsList
                  .filter(item => {
                    if (!auditSearchText) return true;
                    const q = auditSearchText.toLowerCase();
                    const textContent = `${item.action} ${item.userName} ${item.reason} ${item.store} ${JSON.stringify(item.details)}`.toLowerCase();
                    return textContent.includes(q);
                  })
                  .map((log) => {
                    const actionBadge = (() => {
                      switch (log.action) {
                        case 'SALE_DELETED':
                          return { text: '🗑️ Vente Supprimée', color: '#ff4444', bg: '#3a1a1a' };
                        case 'STOCK_MANUAL_CHANGE':
                          return { text: '✏️ Stock Modifié', color: '#FF9800', bg: '#3a2a1a' };
                        case 'TRANSFER_INITIATED':
                          return { text: '🚚 Transfert Émis', color: '#9C27B0', bg: '#2a1a3a' };
                        case 'TRANSFER_RECEIVED':
                          return { text: '✅ Transfert Validé', color: '#2196F3', bg: '#1a2a3a' };
                        case 'INVENTORY_APPLIED':
                          return { text: '📝 Inventaire Physique', color: '#4CAF50', bg: '#1a3a2a' };
                        default:
                          return { text: log.action || 'Action', color: '#d4af37', bg: '#2a2a2a' };
                      }
                    })();

                    return (
                      <View key={log.id} style={styles.auditCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <View style={[styles.auditBadge, { backgroundColor: actionBadge.bg, borderColor: actionBadge.color }]}>
                            <Text style={[styles.auditBadgeText, { color: actionBadge.color }]}>{actionBadge.text}</Text>
                          </View>
                          <Text style={{ color: '#888', fontSize: 11 }}>
                            {new Date(log.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>

                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                          Auteur : <Text style={{ color: '#d4af37' }}>{log.userName || log.userId}</Text>
                          {log.store ? `  | Magasin : ${log.store.toUpperCase()}` : ''}
                        </Text>

                        {log.reason ? (
                          <Text style={{ color: '#ffcc00', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                            Motif : "{log.reason}"
                          </Text>
                        ) : null}

                        {log.details ? (
                          <View style={{ backgroundColor: '#181818', padding: 8, borderRadius: 6, marginTop: 6 }}>
                            {log.details.saleId && (
                              <Text style={{ color: '#aaa', fontSize: 11 }}>Vente N°: {log.details.saleId} {log.details.total ? `(${log.details.total.toLocaleString()} F)` : ''}</Text>
                            )}
                            {log.details.productName && (
                              <Text style={{ color: '#aaa', fontSize: 11 }}>Article : {log.details.productName}</Text>
                            )}
                            {log.details.previousStock !== undefined && log.details.newStock !== undefined && (
                              <Text style={{ color: '#aaa', fontSize: 11 }}>Stock : {log.details.previousStock} ➔ {log.details.newStock}</Text>
                            )}
                            {log.details.sourceStore && log.details.destinationStore && (
                              <Text style={{ color: '#aaa', fontSize: 11 }}>Trajet : {log.details.sourceStore} ➔ {log.details.destinationStore} (Qté: {log.details.quantity})</Text>
                            )}
                            {log.details.itemsCount !== undefined && (
                              <Text style={{ color: '#aaa', fontSize: 11 }}>Articles ajustés : {log.details.itemsCount} (Écart financier : {log.details.financialDiscrepancy?.toLocaleString()} F)</Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                {auditLogsList.length === 0 && (
                  <Text style={{ color: '#888', textAlign: 'center', padding: 30 }}>Aucun événement d'audit enregistré.</Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 15, marginHorizontal: 0 }]} onPress={() => setAuditModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Demande de Transfert Inter-Magasin */}
      <TransferRequestModal
        visible={transferRequestModalVisible}
        onClose={() => setTransferRequestModalVisible(false)}
        user={user}
        currentStore={selectedStore}
      />

      {/* Alerte Sonnerie Téléphonique pour Demandes de Transfert Reçues */}
      <IncomingTransferAlertModal
        user={user}
        currentStore={selectedStore}
      />

      {/* Modal Suppression & Correction de Vente */}
      <Modal visible={deleteSaleModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 480, width: '94%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Trash2 color="#ff4444" size={20} />
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Supprimer ou Corriger la Vente</Text>
            </View>

            {saleToDelete && (
              <>
                <View style={{ backgroundColor: '#251a1a', borderColor: '#ff4444', borderWidth: 1, borderRadius: 10, padding: 12, marginVertical: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                    {saleToDelete.itemsFormatted || (typeof saleToDelete.items === 'string' ? saleToDelete.items : 'Articles vendus')}
                  </Text>
                  <Text style={{ color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginTop: 4 }}>
                    Montant : {formatMoney(saleToDelete.total || 0)} FCFA • {saleToDelete.payment_method || 'Espèces'}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Motif (optionnel)</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 12 }]}
                  placeholder="Motif de la suppression / correction..."
                  placeholderTextColor="#666"
                  value={deleteSaleReason}
                  onChangeText={setDeleteSaleReason}
                />

                <Text style={{ color: '#ccc', fontSize: 12, marginBottom: 10, fontWeight: '600' }}>
                  Choisissez l'option souhaitée :
                </Text>

                <View style={{ gap: 10 }}>
                  {/* Option Correction immédiate en Caisse */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#d4af37',
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingSale ? 0.6 : 1
                    }}
                    onPress={() => executeDashboardDeleteSale(true, true)}
                    disabled={isDeletingSale}
                  >
                    <Edit3 color="#121212" size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#121212', fontWeight: 'bold', fontSize: 13.5 }}>
                        ✏️ Supprimer & Corriger l'erreur de suite
                      </Text>
                      <Text style={{ color: '#222', fontSize: 11, marginTop: 2 }}>
                        Remet en stock et ouvre la Caisse avec ces articles prêts à corriger
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 1 : Entrer dans le stock */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#16A34A',
                      borderWidth: 1,
                      borderColor: '#4ADE80',
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingSale ? 0.6 : 1
                    }}
                    onPress={() => executeDashboardDeleteSale(true, false)}
                    disabled={isDeletingSale}
                  >
                    <PackagePlus color="#fff" size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13.5 }}>
                        1. Entrer dans le stock & Supprimer
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>
                        Annule la vente et remet automatiquement les articles en stock
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2 : Supprimer définitivement */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#dc2626',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingSale ? 0.6 : 1
                    }}
                    onPress={() => executeDashboardDeleteSale(false, false)}
                    disabled={isDeletingSale}
                  >
                    <Trash2 color="#fff" size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13.5 }}>
                        2. Supprimer définitivement (sans stock)
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>
                        Supprime définitivement la vente sans toucher au stock
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cancelBtn, { marginTop: 4, marginHorizontal: 0 }]}
                    onPress={() => {
                      if (!isDeletingSale) {
                        setDeleteSaleModalVisible(false);
                        setSaleToDelete(null);
                      }
                    }}
                    disabled={isDeletingSale}
                  >
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Reçu & Détail Intégral de l'Achat */}
      <ReceiptModal
        visible={receiptModalVisible}
        onClose={() => setReceiptModalVisible(false)}
        sale={selectedReceiptSale}
        storeName={selectedReceiptSale?.store === 'tougou' ? 'Tougou' : (selectedReceiptSale?.store === 'falaise' ? 'La Falaise' : (selectedStore === 'tougou' ? 'Tougou' : 'La Falaise'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({

  containerWide: { flexDirection: 'row', height: '100vh' as any },
  dashboardMain: { flex: 1, minWidth: 0, height: '100%' as any },
  contentInner: { paddingVertical: 20, gap: 18 },

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

  controlsBar: { gap: 12, marginVertical: 4 },
  storeSelectorWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  storePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storePillActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  storePillText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textMuted },
  storePillTextActive: { fontFamily: fonts.bold, color: colors.gold },

  filterPillsWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.gold, borderColor: colors.goldLight },
  filterPillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  filterPillTextActive: { fontFamily: fonts.bold, color: colors.onGold },

  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  periodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8 },
  periodBtnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.goldLight },
  periodCenter: { alignItems: 'center', flex: 1 },
  periodTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  periodReset: { ...type.caption, fontSize: 10.5, color: colors.gold, marginTop: 2 },

  // KPI Bento Grid
  kpiBentoGrid: { gap: 14 },
  kpiBentoGridWide: { flexDirection: 'row', alignItems: 'stretch' },
  heroCardCol: { width: '100%' },
  heroCardColWide: { flex: 1.2 },
  heroCard: { padding: 24, borderRadius: radius.xxl, minHeight: 180, justifyContent: 'space-between' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroEyebrowWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroEyebrow: { ...type.eyebrow, color: colors.goldLight },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  heroBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.goldLight },
  heroAmountWrap: { marginVertical: 12 },
  heroAmount: { fontFamily: fonts.extrabold, fontSize: 34, color: colors.text, letterSpacing: -0.8 },
  heroSubText: { ...type.caption, color: colors.textMuted },

  paymentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentsGridWide: { flex: 1.3 },
  paymentCard: { flex: 1, minWidth: '45%' as any, borderRadius: radius.xl },
  paymentCardInner: { padding: 14, gap: 6 },
  paymentCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  paymentPercent: { fontFamily: fonts.bold, fontSize: 11.5 },
  paymentValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  paymentLabel: { ...type.caption, fontSize: 11.5, color: colors.textMuted },

  alertsRow: { flexDirection: 'row', gap: 10 },
  alertCard: { borderRadius: radius.xl },
  alertCardInner: { padding: 14, alignItems: 'center', gap: 4 },
  alertIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  alertCount: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  alertTitle: { ...type.caption, fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  chartCard: { padding: 20, borderRadius: radius.xxl },
  chartHeader: { marginBottom: 16 },

  // Actions Bento Grid
  actionsSection: { marginTop: 6, gap: 14 },
  actionsSectionTitle: { ...type.eyebrow, color: colors.gold, fontSize: 11 },
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
  actionBadgeText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' },

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

  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border },
  content: { padding: 15 },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: colors.danger, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.bold },
  chartTitle: { ...type.title, color: colors.gold, marginBottom: 5 },
  insightText: { ...type.caption, color: colors.success, marginBottom: 15, fontStyle: 'italic' },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 160, paddingTop: 20 },
  barWrapper: { alignItems: 'center', flex: 1 },
  barValue: { color: colors.textSecondary, fontSize: 9, marginBottom: 4 },
  bar: { width: 16, borderRadius: 4, minWidth: 12 },
  barLabel: { color: colors.textMuted, fontSize: 10, marginTop: 6, textAlign: 'center' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyItemName: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  historyItemDate: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  historyItemTotal: { color: colors.gold, fontSize: 15, fontFamily: fonts.bold },
  historyItemMethod: { color: colors.info, fontSize: 11, marginTop: 2 },
  toast: { position: 'absolute', top: 0, left: 20, right: 20, backgroundColor: colors.bgElevated, padding: 15, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 100, borderWidth: 1, borderColor: colors.danger },
  toastText: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  fab: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    backgroundColor: colors.gold,
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    zIndex: 100,
  },

  // Assistant
  assistantOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  assistantPanel: { width: 320, height: '100%', backgroundColor: '#1e1e1e', borderLeftWidth: 1, borderLeftColor: '#d4af37' },
  assistantHeader: { padding: 20, paddingTop: 40, backgroundColor: '#121212', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  assistantTitle: { color: '#d4af37', fontSize: 18, fontWeight: 'bold' },
  assistantSectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  securityLogCard: { backgroundColor: '#2a2a2a', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#444' },
  logText: { color: '#fff', fontWeight: 'bold' },
  logDate: { color: '#aaa', fontSize: 12, marginTop: 4 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5 },
  mapBtnText: { color: '#4CAF50', fontSize: 12 },
  stockAlertBtn: { backgroundColor: '#333', padding: 15, borderRadius: 10, alignItems: 'center' },
  stockAlertBtnText: { color: '#ff4444', fontWeight: 'bold' },

  // Modal (User)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333', maxHeight: '80%' },
  modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#2a2a2a', borderRadius: 8, marginBottom: 8 },
  fieldLabel: { color: '#d4af37', fontSize: 13, fontWeight: '600', marginBottom: 5 },
  input: { backgroundColor: '#2a2a2a', color: '#fff', height: 50, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#444' },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  pickerItem: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#444' },
  pickerItemActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
  pickerItemText: { color: '#ccc', fontSize: 13 },
  pickerItemTextActive: { color: '#121212', fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center', marginRight: 10, backgroundColor: '#333', borderRadius: 10 },
  cancelBtnText: { color: '#fff', fontWeight: 'bold' },
  saveBtn: { flex: 1, padding: 15, alignItems: 'center', marginLeft: 10, backgroundColor: '#d4af37', borderRadius: 10 },
  saveBtnText: { color: '#121212', fontWeight: 'bold' },

  // Period Nav Bar
  periodNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  periodNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  periodNavBtnText: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  periodNavCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 6,
  },
  periodNavTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resetPeriodBtn: {
    marginTop: 4,
  },
  resetPeriodText: {
    color: '#d4af37',
    fontSize: 11,
    textDecorationLine: 'underline',
  },

  // Breakdown Sections (Week, Month, Year)
  breakdownSection: {
    backgroundColor: '#1e1e1e',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  breakdownSectionTitle: {
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 'bold',
  },
  breakdownSectionSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },

  // Day Card (Monday to Saturday)
  dayCard: {
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  dayCardName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dayCardDate: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: 'normal',
  },
  dayCardSub: {
    color: '#888',
    fontSize: 11,
    marginTop: 3,
  },
  dayCardTotal: {
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dayCardContent: {
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  emptyDayText: {
    color: '#777',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  articlesSoldTitle: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  itemSummaryName: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  itemSummaryQty: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  itemSummaryPrice: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: 'bold',
  },
  subSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  subSaleTime: {
    color: '#aaa',
    fontSize: 11,
  },
  subSaleItems: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  subSaleAmount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // Week Card (Month view)
  weekCard: {
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    overflow: 'hidden',
  },
  weekCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  weekCardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  weekCardRange: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'normal',
  },
  weekCardSub: {
    color: '#888',
    fontSize: 11,
    marginTop: 3,
  },
  weekCardTotal: {
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 'bold',
  },
  weekCardDaysContainer: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 8,
  },

  // Nested Day Card inside Month view
  nestedDayCard: {
    backgroundColor: '#252525',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  nestedDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  nestedDayName: {
    color: '#eee',
    fontSize: 13,
    fontWeight: '600',
  },
  nestedDaySub: {
    color: '#777',
    fontSize: 10,
    marginTop: 2,
  },
  nestedDayTotal: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: 'bold',
  },
  nestedDayContent: {
    padding: 12,
    backgroundColor: colors.surfaceSolid,
    gap: 8,
  },
  monthCard: {
    marginBottom: 10,
    borderRadius: radius.lg,
  },
  monthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  monthCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  monthCardSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  monthCardTotal: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.gold,
  },

  // Role Badges
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeAdmin: {
    backgroundColor: '#4a3b10',
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  roleBadgeStaff: {
    backgroundColor: '#2a3a4a',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Sauvegarde & Exports
  backupRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },

  // Journal d'Audit
  auditCard: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  auditBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  auditBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  requestTransferQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1a0a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#d4af3780',
    gap: 12,
    shadowColor: '#d4af37',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  requestTransferQuickIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestTransferQuickTitle: {
    color: '#d4af37',
    fontSize: 14,
    fontWeight: 'bold',
  },
  requestTransferQuickSubtitle: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 2,
  },
  requestTransferQuickArrow: {
    paddingLeft: 6,
  },
  soundArmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b2005',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#d4af37',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  soundArmIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundArmTitle: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  soundArmSubtitle: {
    color: '#bbb',
    fontSize: 11,
    marginTop: 2,
  },
  soundArmBadge: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  soundArmBadgeText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
