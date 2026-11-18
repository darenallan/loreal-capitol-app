import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Animated, RefreshControl } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { 
  addUser, getUsers, updateUser, deleteUser, getSecurityLogs, deleteSecurityLog, 
  deleteSale, transferStock, getProductByBarcode, getProducts, getLocalCache, isSuperBoss,
  getAuditLogs, getAdvanceStore, getFastCache, RTDB_REST_URL
} from '../db/database';
import { 
  exportSalesCSV, exportProductsCSV, exportAdvancesCSV, exportTransfersCSV, exportAuditLogsCSV 
} from '../utils/exportHelpers';
import { subscribeResilient } from '../db/resilientSync';
import WebScanner from '../components/WebScanner';
import AIAssistantModal from '../components/AIAssistantModal';
import LiveTransferBanner from '../components/LiveTransferBanner';
import TransferRequestModal from '../components/TransferRequestModal';
import IncomingTransferAlertModal from '../components/IncomingTransferAlertModal';
import DashboardSidebar from '../components/DashboardSidebar';
import ReceiptModal from '../components/ReceiptModal';
import { startAudioKeepAlive } from '../utils/ringtone';
import {
  AmbientBackground,
  useResponsive,
  colors,
  fonts,
  radius,
  formatMoney,
} from '../ui';
import { useAppTheme } from '../theme/ThemeContext';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import SoundArmBanner from '../components/dashboard/SoundArmBanner';
import StoreFilterControls from '../components/dashboard/StoreFilterControls';
import PeriodNavigator from '../components/dashboard/PeriodNavigator';
import RevenueKpiGrid from '../components/dashboard/RevenueKpiGrid';
import QuickAlertsRow from '../components/dashboard/QuickAlertsRow';
import SalesChartCard from '../components/dashboard/SalesChartCard';
import WeekBreakdown from '../components/dashboard/WeekBreakdown';
import MonthBreakdown from '../components/dashboard/MonthBreakdown';
import YearBreakdown from '../components/dashboard/YearBreakdown';
import RecentTransactionsCard from '../components/dashboard/RecentTransactionsCard';
import ActionsBentoGrid from '../components/dashboard/ActionsBentoGrid';
import SecurityAlertsModal from '../components/dashboard/SecurityAlertsModal';
import UserManagementModal from '../components/dashboard/UserManagementModal';
import SalesHistoryModal from '../components/dashboard/SalesHistoryModal';
import TransferModal from '../components/dashboard/TransferModal';
import TransferSearchModal from '../components/dashboard/TransferSearchModal';
import BackupModal from '../components/dashboard/BackupModal';
import AuditLogModal from '../components/dashboard/AuditLogModal';
import DeleteSaleModal from '../components/dashboard/DeleteSaleModal';
import { sharedStyles } from '../components/dashboard/dashboardStyles';
import { getEffectiveTotal, isAnyAdvance, localDayKey, todayKey, ymdLocal } from '../utils/saleMath';


export default function DashboardScreen({ navigation, route }: any) {
  const user = route.params?.user;
  const r = useResponsive();
  const { colors } = useAppTheme();
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
  const [historyDate, setHistoryDate] = useState(todayKey());
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
          const res = await fetch(`${RTDB_REST_URL}/sales.json`);
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
        const effectiveTotal = getEffectiveTotal(s);
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
          if (!s.date || typeof s.date !== 'string' || !localDayKey(s.date).startsWith(date)) return false;
          if (selectedStore === 'all') return true;
          return (s.store || 'falaise').toLowerCase() === selectedStore.toLowerCase();
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(s => {
          const baseItems = Array.isArray(s.items) 
            ? s.items.map((i: any) => `${i.name || 'Article'}${i.size ? ` (T:${i.size})` : ''} (x${i.quantity || 1})`).join(', ') 
            : (s.items || 'Articles');
          const clientTag = (s.client_name || s.advanceData?.clientName) ? ` (${s.client_name || s.advanceData?.clientName})` : '';
          const anyAdvance = isAnyAdvance(s);
          const itemsFormatted = s.sale_label
            ? s.sale_label
            : (anyAdvance
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
    const todayStr = todayKey();
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
          const effectiveTotal = getEffectiveTotal(item);
          const baseItems = Array.isArray(item.items)
            ? item.items.map((i: any) => `${i.name || 'Article'} (x${i.quantity || 1})`).join(', ')
            : (typeof item.items === 'string' ? item.items : 'Article');
          const clientTag = (item.client_name || item.advanceData?.clientName) ? ` (${item.client_name || item.advanceData?.clientName})` : '';
          const anyAdvance = isAnyAdvance(item);
          const displayLabel = item.sale_label
            ? item.sale_label
            : (anyAdvance
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

      // Index des ventes par jour LOCAL (et non UTC) : évite le décalage d'un jour de toISOString()
      const salesByDay: Record<string, any[]> = {};
      allSales.forEach(s => {
        const dayKey = localDayKey(s.date);
        if (!dayKey) return;
        if (!salesByDay[dayKey]) salesByDay[dayKey] = [];
        salesByDay[dayKey].push(s);
      });
      const salesOnDay = (ymd: string) => (salesByDay[ymd] || []).slice();
      
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
        const targetDateStr = ymdLocal(dObj);
        
        setPeriodTitle(
          effectiveOffset === 0 
            ? (effectiveFilter === 'today' ? "Aujourd'hui" : "Hier") 
            : dObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        );

        filteredSales = salesOnDay(targetDateStr);

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
          const dayDateStr = ymdLocal(dayDate);
          const daySales = salesOnDay(dayDateStr);
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
            
            const dayDateStr = ymdLocal(dayDate);
            const daySales = salesOnDay(dayDateStr);
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
              
              const dayDateStr = ymdLocal(dayDate);
              const daySales = salesOnDay(dayDateStr);
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
  };

  return (
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
        <DashboardHeader
          navigation={navigation}
          user={user}
          r={r}
          lowStockCount={lowStockCount}
          selectedStore={selectedStore}
          securityLogs={securityLogs}
          setShowSecurityAssistant={setShowSecurityAssistant}
          handleRefresh={handleRefresh}
          loadData={loadData}
          openUsersModal={openUsersModal}
          handleLogout={handleLogout}
        />

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentInner, { paddingHorizontal: r.gutter, maxWidth: r.maxContent, width: '100%', alignSelf: 'center' }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} colors={[colors.gold]} />
          }
        >
          {/* Bannière audio & notifications si non armée */}
          {!audioAndNotifArmed && (
            <SoundArmBanner setAudioAndNotifArmed={setAudioAndNotifArmed} />
          )}

          {/* Suivi des transferts en direct */}
          <LiveTransferBanner
            user={user}
            currentStore={selectedStore}
            navigation={navigation}
          />

          {/* Contrôles Boutiques & Périodes (Boss) */}
          {isSuperBoss(user) && (
            <StoreFilterControls
              filter={filter}
              setFilter={setFilter}
              selectedStore={selectedStore}
              setSelectedStore={setSelectedStore}
              setPeriodOffset={setPeriodOffset}
              filterLabels={filterLabels}
            />
          )}

          {/* Navigation Temporelle */}
          {isSuperBoss(user) && (
            <PeriodNavigator
              filter={filter}
              periodOffset={periodOffset}
              setPeriodOffset={setPeriodOffset}
              periodTitle={periodTitle}
              filterLabels={filterLabels}
            />
          )}

          {/* BENTO GRID : HERO KPI + PAIEMENTS */}
          <RevenueKpiGrid
            user={user}
            r={r}
            salesTotal={salesTotal}
            cardTotal={cardTotal}
            cashTotal={cashTotal}
            momoTotal={momoTotal}
            omTotal={omTotal}
            filter={filter}
            salesCount={salesCount}
            selectedStore={selectedStore}
            filterLabels={filterLabels}
            calcPercent={calcPercent}
          />

          {/* ALERTES RAPIDES */}
          <QuickAlertsRow
            navigation={navigation}
            user={user}
            lowStockCount={lowStockCount}
            pendingAdvancesCount={pendingAdvancesCount}
            pendingAdvancesTotal={pendingAdvancesTotal}
            selectedStore={selectedStore}
            inTransitTransfersCount={inTransitTransfersCount}
          />

          {/* GRAPHIQUE D'ANALYSE */}
          {chartData.length > 0 && (
            <SalesChartCard chartData={chartData} insightText={insightText} />
          )}

          {/* 1. VUE SEMAINE */}
          {filter === 'week' && (
            <WeekBreakdown
              weekDaysBreakdown={weekDaysBreakdown}
              expandedDayKeys={expandedDayKeys}
              setExpandedDayKeys={setExpandedDayKeys}
              handleOpenSaleDetail={handleOpenSaleDetail}
            />
          )}

          {/* 2. VUE MOIS */}
          {filter === 'month' && (
            <MonthBreakdown
              monthWeeksBreakdown={monthWeeksBreakdown}
              expandedDayKeys={expandedDayKeys}
              setExpandedDayKeys={setExpandedDayKeys}
              expandedWeekKeys={expandedWeekKeys}
              setExpandedWeekKeys={setExpandedWeekKeys}
              handleOpenSaleDetail={handleOpenSaleDetail}
            />
          )}

          {/* 3. VUE ANNÉE */}
          {filter === 'year' && (
            <YearBreakdown yearMonthsBreakdown={yearMonthsBreakdown} />
          )}

          {/* 4. VUE JOUR & HIER : Historique récent */}
          {(filter === 'today' || filter === 'yesterday' || !isSuperBoss(user)) && recentSales.length > 0 && (
            <RecentTransactionsCard
              user={user}
              filter={filter}
              recentSales={recentSales}
              searchSaleText={searchSaleText}
              setSearchSaleText={setSearchSaleText}
              handleDeleteSale={handleDeleteSale}
              handleOpenSaleDetail={handleOpenSaleDetail}
              filterLabels={filterLabels}
            />
          )}

          {/* BENTO GRID DES ACTIONS */}
          <ActionsBentoGrid
            navigation={navigation}
            user={user}
            r={r}
            setTransferRequestModalVisible={setTransferRequestModalVisible}
            selectedStore={selectedStore}
            setScannerVisible={setScannerVisible}
            inTransitTransfersCount={inTransitTransfersCount}
            setBackupModalVisible={setBackupModalVisible}
            openTransferSearchModal={openTransferSearchModal}
            openSalesHistoryModal={openSalesHistoryModal}
            openAuditModal={openAuditModal}
          />
        </ScrollView>
      </View>

      {/* Auto-Toast Alert */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastAnim }] }]}>
          <AlertTriangle color={colors.danger} size={24} />
          <Text style={styles.toastText}>{currentToast}</Text>
        </Animated.View>
      )}

      {/* Assistant Virtuel Notifications */}
      <SecurityAlertsModal
        navigation={navigation}
        user={user}
        lowStockCount={lowStockCount}
        selectedStore={selectedStore}
        securityLogs={securityLogs}
        showSecurityAssistant={showSecurityAssistant}
        setShowSecurityAssistant={setShowSecurityAssistant}
        handleDeleteLog={handleDeleteLog}
      />

      {/* Modal Gestion des Profils & Mots de passe */}
      <UserManagementModal
        editingUser={editingUser}
        showUserPasswords={showUserPasswords}
        setShowUserPasswords={setShowUserPasswords}
        systemUsers={systemUsers}
        handleDeleteUser={handleDeleteUser}
        userModalVisible={userModalVisible}
        setUserModalVisible={setUserModalVisible}
        newUserName={newUserName}
        setNewUserName={setNewUserName}
        newUserRole={newUserRole}
        setNewUserRole={setNewUserRole}
        newUserStore={newUserStore}
        setNewUserStore={setNewUserStore}
        newUserPin={newUserPin}
        setNewUserPin={setNewUserPin}
        startEditUser={startEditUser}
        cancelEditUser={cancelEditUser}
        handleSaveUser={handleSaveUser}
      />

      {/* Modal Historique des Ventes par Date */}
      <SalesHistoryModal
        salesHistoryModal={salesHistoryModal}
        setSalesHistoryModal={setSalesHistoryModal}
        historyDate={historyDate}
        setHistoryDate={setHistoryDate}
        historySales={historySales}
        historyTotal={historyTotal}
        loadingHistory={loadingHistory}
        handleDeleteSale={handleDeleteSale}
        handleOpenSaleDetail={handleOpenSaleDetail}
        loadSalesByDate={loadSalesByDate}
      />

      {/* Modal Transfert */}
      <TransferModal
        selectedStore={selectedStore}
        transferModalVisible={transferModalVisible}
        setTransferModalVisible={setTransferModalVisible}
        transferProduct={transferProduct}
        setTransferProduct={setTransferProduct}
        transferQty={transferQty}
        setTransferQty={setTransferQty}
        transferDest={transferDest}
        setTransferDest={setTransferDest}
        availableUsers={availableUsers}
        selectedCarrier={selectedCarrier}
        setSelectedCarrier={setSelectedCarrier}
        customCarrierName={customCarrierName}
        setCustomCarrierName={setCustomCarrierName}
        estimatedMinutes={estimatedMinutes}
        setEstimatedMinutes={setEstimatedMinutes}
        handleTransferSubmit={handleTransferSubmit}
      />

      {/* Modal Recherche Transfert Manuel */}
      <TransferSearchModal
        transferSearchModalVisible={transferSearchModalVisible}
        setTransferSearchModalVisible={setTransferSearchModalVisible}
        transferSearchText={transferSearchText}
        setTransferSearchText={setTransferSearchText}
        products={products}
        selectTransferProduct={selectTransferProduct}
      />

      {/* Modal Scanner */}
      <Modal visible={scannerVisible} animationType="slide" transparent={true}>
        <View style={sharedStyles.modalOverlay}>
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
      <BackupModal
        backupModalVisible={backupModalVisible}
        setBackupModalVisible={setBackupModalVisible}
        isExportingBackup={isExportingBackup}
        handleFullBackup={handleFullBackup}
      />

      {/* Modal Journal d'Audit & Sécurité */}
      <AuditLogModal
        auditModalVisible={auditModalVisible}
        setAuditModalVisible={setAuditModalVisible}
        auditLogsList={auditLogsList}
        loadingAudit={loadingAudit}
        auditSearchText={auditSearchText}
        setAuditSearchText={setAuditSearchText}
      />

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
      <DeleteSaleModal
        deleteSaleModalVisible={deleteSaleModalVisible}
        setDeleteSaleModalVisible={setDeleteSaleModalVisible}
        saleToDelete={saleToDelete}
        setSaleToDelete={setSaleToDelete}
        deleteSaleReason={deleteSaleReason}
        setDeleteSaleReason={setDeleteSaleReason}
        isDeletingSale={isDeletingSale}
        executeDashboardDeleteSale={executeDashboardDeleteSale}
      />

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
  // paddingBottom : laisse la fin de page défiler au-dessus du bouton flottant de l'assistant IA
  contentInner: { paddingTop: 20, paddingBottom: 110, gap: 18 },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  toast: { position: 'absolute', top: 0, left: 20, right: 20, backgroundColor: colors.bgElevated, padding: 15, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 100, borderWidth: 1, borderColor: colors.danger },
  toastText: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: colors.gold,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    zIndex: 100,
  },
});
