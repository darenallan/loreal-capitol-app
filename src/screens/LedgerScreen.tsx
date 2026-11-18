import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { 
  LogOut, PlusCircle, Package, FileText, Wallet, Search, Trash2, 
  HelpCircle, User, ScanLine, Camera, Edit3, ArrowRightLeft, Printer, 
  ArrowLeft, Sparkles, Store, Clock, ChevronRight, X, Check, ShoppingBag, 
  AlertCircle, ShieldAlert, MessageCircle, Mail
} from 'lucide-react-native';
import { recordSale, deleteSale, getProducts, getProductByBarcode, updateSalePaymentMethod, transferStock, isUserAdmin, getUsers, getAdvanceStore, getFastCache, getLocalCache } from '../db/database';
import { subscribeResilient } from '../db/resilientSync';
import { cleanWhatsAppNumber, buildReceiptMessage, buildWhatsAppUrl, buildEmailUrl, openExternalUrl, shareReceiptWhatsApp } from '../utils/receiptShare';
import WebScanner from '../components/WebScanner';
import NfcAuthModal from '../components/NfcAuthModal';
import AIAssistantModal from '../components/AIAssistantModal';
import ReceiptModal from '../components/ReceiptModal';
import LiveTransferBanner from '../components/LiveTransferBanner';
import TransferRequestModal from '../components/TransferRequestModal';
import IncomingTransferAlertModal from '../components/IncomingTransferAlertModal';
import { colors, fonts, radius, shadow, formatMoney } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, SectionTitle, AnimatedNumber, FadeIn } from '../ui';

export default function LedgerScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const storeId = route.params?.storeId || (user?.store === 'all' ? 'falaise' : (user?.store || 'falaise'));
  const [transferRequestModalVisible, setTransferRequestModalVisible] = useState(false);

  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [totalToday, setTotalToday] = useState(0);

  // Fonction d'initialisation instantanée (0ms) depuis le cache local/mémoire
  const getInitialStoreProducts = () => {
    const cached = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
    if (!cached || typeof cached !== 'object') return [];
    const norm = (storeId || 'falaise').trim().toLowerCase();
    return Object.keys(cached)
      .map(k => ({ id: k, ...cached[k], stock: parseInt(cached[k]?.stock, 10) || 0 }))
      .filter(p => (norm === 'all' || (p.store || 'falaise').trim().toLowerCase() === norm) && p.stock > 0)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [products, setProducts] = useState<any[]>(getInitialStoreProducts);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [salePrice, setSalePrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Espèces');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cart, setCart] = useState<any[]>([]);

  // Avance state & Client
  const [isAdvance, setIsAdvance] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [customerPromptModalVisible, setCustomerPromptModalVisible] = useState(false);

  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [pendingAdvancesCount, setPendingAdvancesCount] = useState(0);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null);

  // NFC & Modifs
  const [editOptionsVisible, setEditOptionsVisible] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<any>(null);
  const [nfcActionType, setNfcActionType] = useState('');
  const [nfcActionText, setNfcActionText] = useState('');
  const [paymentEditModal, setPaymentEditModal] = useState(false);

  // Suppression & Correction immédiate de vente
  const [deleteSaleModalVisible, setDeleteSaleModalVisible] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);

  // Transfert
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferProduct, setTransferProduct] = useState<any>(null);
  const [transferQty, setTransferQty] = useState('1');
  const [transferDest, setTransferDest] = useState(storeId === 'falaise' ? 'tougou' : 'falaise');
  const [scannerMode, setScannerMode] = useState<'sale' | 'transfer'>('sale');
  
  const [transferSearchModalVisible, setTransferSearchModalVisible] = useState(false);
  const [transferSearchText, setTransferSearchText] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');

  // Transporteur / coursier
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<any>(null);
  const [customCarrierName, setCustomCarrierName] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [inTransitCount, setInTransitCount] = useState(0);

  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    const prefill = route.params?.prefillSale;
    if (prefill) {
      const rawList = Array.isArray(prefill.rawItems) && prefill.rawItems.length > 0
        ? prefill.rawItems
        : (Array.isArray(prefill.items) ? prefill.items : []);
      if (rawList.length > 0) {
        setCart(rawList.map((it: any) => ({
          id: it.product_id || it.id || '',
          name: it.name || 'Article',
          quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
          price: Number(it.price) || 0,
          size: it.size || null,
          color: it.color || null,
          reference: it.reference || null
        })));
      }
      if (prefill.payment_method && prefill.payment_method !== 'Avance') {
        setPaymentMethod(prefill.payment_method);
      }
      setClientName(prefill.client_name || prefill.clientName || '');
      setClientPhone(prefill.client_phone || '');
      setIsAdvance(prefill.is_advance === 1);
      setModalVisible(true);
    }
  }, [route.params?.prefillSale]);

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Listen to Sales with resilient fallback
    const unsubscribeSales = subscribeResilient('sales', (data) => {
      if (!data) {
        setTodaySales([]);
        setTotalToday(0);
        return;
      }
      
      const allSales = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      
      const todaySalesList = allSales
        .filter(s => s.date && s.date.startsWith(todayStr) && (user?.store === 'all' || s.store === storeId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
      const formattedSales = todaySalesList.map(s => {
        const isAdvInitial = s.is_advance === 1 && !s.is_advance_installment && s.advanceData && s.advanceData.amountPaid !== undefined;
        const effectiveTotal = isAdvInitial
          ? (Number(s.advanceData.amountPaid) || 0)
          : (Number(s.total) || 0);
        const baseItems = Array.isArray(s.items)
          ? s.items.map((i: any) => `${i.name} (x${i.quantity || 1})`).join(', ')
          : (s.items || '');
        const clientTag = (s.client_name || s.advanceData?.clientName) ? ` (${s.client_name || s.advanceData?.clientName})` : '';
        const isAnyAdvance = s.is_advance === 1 || s.is_advance_installment === 1 || !!s.advanceData || s.payment_method === 'Avance';
        const displayItems = s.sale_label
          ? s.sale_label
          : (isAnyAdvance
              ? (effectiveTotal > 0
                  ? `Avance ${formatMoney(effectiveTotal)} FCFA sur ${baseItems}${clientTag}`
                  : `Avance (0 FCFA versé) sur ${baseItems}${clientTag}`)
              : baseItems);
        return {
          id: s.id,
          total: effectiveTotal,
          article_total: s.article_total || (isAnyAdvance ? (Number(s.advanceData?.totalArticles) || Number(s.total) || 0) : effectiveTotal),
          payment_method: s.payment_method,
          date: s.date,
          is_advance: s.is_advance,
          is_advance_installment: s.is_advance_installment,
          advance_id: s.advance_id,
          client_name: s.client_name || s.advanceData?.clientName,
          clientName: s.client_name || s.advanceData?.clientName,
          client_phone: s.client_phone || s.phone || s.advanceData?.clientPhone,
          advanceData: s.advanceData,
          seller_name: s.seller_name || user?.name,
          store: s.store || storeId,
          rawItems: s.items,
          items: displayItems
        };
      });

      setTodaySales(formattedSales);
      setTotalToday(formattedSales.reduce((sum, s) => sum + s.total, 0));
    }, { cacheKey: 'loreal_cache_sales' });

    // Écouteur des avances en cours pour le magasin
    const unsubscribeAdvances = subscribeResilient('advances', (advData) => {
      if (!advData) {
        setPendingAdvancesCount(0);
        return;
      }
      const count = Object.values(advData).filter((a: any) => {
        if (a.status !== 'pending') return false;
        if (storeId === 'all') return true;
        const aStore = getAdvanceStore(a);
        return aStore === storeId.toLowerCase();
      }).length;
      setPendingAdvancesCount(count);
    }, { cacheKey: 'loreal_cache_advances' });

    // Écouteur des transferts en transit pour afficher le badge
    const unsubscribeTransfers = subscribeResilient('transfers', (data) => {
      if (!data) {
        setInTransitCount(0);
        return;
      }
      const count = Object.values(data).filter((t: any) => {
        if (t.status === 'received') return false;
        if (isUserAdmin(user) || user?.id === 'boss') return true;
        if (t.sender_id === user?.id || t.user_id === user?.id) return true;
        if (t.carrier_id === user?.id || (user?.name && t.carrier_name && user.name.toLowerCase() === t.carrier_name.toLowerCase())) return true;
        return t.from_store === storeId || t.to_store === storeId || user?.store === 'all';
      }).length;
      setInTransitCount(count);
    }, { cacheKey: 'loreal_cache_transfers' });

    // Écouteur et préchargement continu des articles en temps réel (0ms)
    const unsubscribeProducts = subscribeResilient('products', (data) => {
      if (!data) return;
      const normStore = (storeId || 'falaise').trim().toLowerCase();
      const allItems = Object.keys(data).map(k => ({
        id: k,
        ...data[k],
        stock: parseInt(data[k]?.stock, 10) || 0
      }));
      setAllProducts(allItems);

      const storeItems = allItems.filter(p => 
        (normStore === 'all' || (p.store || 'falaise').trim().toLowerCase() === normStore) && p.stock > 0
      ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      setProducts(storeItems);
      setLoadingProducts(false);
    }, { cacheKey: 'loreal_cache_products' });

    return () => {
      unsubscribeSales();
      unsubscribeAdvances();
      unsubscribeTransfers();
      unsubscribeProducts();
    };
  }, [storeId, user]);

  const loadProducts = async () => {
    // Si déjà des produits en mémoire, pas besoin d'attendre
    if (products.length === 0) {
      setLoadingProducts(true);
    }
    try {
      const result = await getProducts(storeId);
      if (result && result.length > 0) {
        setProducts(result.filter((p: any) => (parseInt(p.stock, 10) || 0) > 0));
      }
    } catch (e) {
      console.error('Error loading products for ledger:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const openNewSaleModal = () => {
    loadProducts();
    setCart([]);
    setSelectedProduct(null);
    setSearchText('');
    setQuantity('1');
    setSalePrice('');
    setPaymentMethod('Espèces');
    setIsAdvance(false);
    setClientName('');
    setAmountPaid('');
    setBeneficiaryName('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setDueDate(tomorrow.toISOString().split('T')[0]);
    setModalVisible(true);
  };

  const selectProduct = (product: any) => {
    setSelectedProduct(product);
    setSalePrice(product.price.toString());
    setSearchText('');
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    if (paymentMethod !== 'Ami / Don' && (!salePrice || parseFloat(salePrice) <= 0)) {
      Alert.alert('Erreur', 'Veuillez indiquer le prix.');
      return;
    }
    const qty = parseInt(quantity, 10) || 1;
    
    const existingIndex = cart.findIndex(c => c.id === selectedProduct.id);
    const existingQty = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    
    if (existingQty + qty > selectedProduct.stock) {
      Alert.alert('Stock insuffisant', `Pas assez de stock pour cet ajout.`);
      return;
    }
    
    const parsedPrice = salePrice ? parseFloat(salePrice) : 0;
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += qty;
      setCart(newCart);
    } else {
      setCart([...cart, { 
        id: selectedProduct.id, 
        name: selectedProduct.name,
        quantity: qty, 
        price: parsedPrice,
        size: selectedProduct.size || null,
        color: selectedProduct.color || null,
        reference: selectedProduct.reference || null
      }]);
    }
    
    setSelectedProduct(null);
    setSearchText('');
    setQuantity('1');
    setSalePrice('');
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const prepareTransferModal = async (product: any) => {
    setTransferProduct(product);
    setTransferDest(storeId === 'falaise' ? 'tougou' : 'falaise');
    setTransferQty('1');
    setCustomCarrierName('');
    setEstimatedMinutes(15);
    try {
      const uList = await getUsers();
      setAvailableUsers(uList);
      const dest = storeId === 'falaise' ? 'tougou' : 'falaise';
      const destUsers = uList.filter((u: any) => u.store === dest && u.id !== user?.id);
      setSelectedCarrier(destUsers.length > 0 ? destUsers[0] : (uList.find((u: any) => u.id !== user?.id) || uList[0]));
    } catch (e) {
      console.log('Error loading users for carrier selection:', e);
    }
    setTransferModalVisible(true);
  };

  const openTransferSearchModal = () => {
    loadProducts();
    setTransferSearchText('');
    setTransferSearchModalVisible(true);
  };

  const selectTransferProduct = (product: any) => {
    setTransferSearchModalVisible(false);
    prepareTransferModal(product);
  };

  const handleScan = async (data: string) => {
    setScannerVisible(false);
    const product = await getProductByBarcode(data, storeId);
    
    if (scannerMode === 'transfer') {
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
      return;
    }

    // Mode Vente
    if (product) {
      if (product.stock > 0) {
        selectProduct(product);
        setModalVisible(true);
      } else {
        if (typeof window !== 'undefined' && window.alert) window.alert('Attention: Produit en rupture de stock.');
        else Alert.alert('Attention', 'Ce produit est en rupture de stock (0).');
      }
    } else {
      if (typeof window !== 'undefined' && window.alert) window.alert('Produit introuvable pour ce code-barres.');
      else Alert.alert('Erreur', 'Produit introuvable pour ce code-barres.');
    }
  };

  const multiCriteriaSearch = (product: any, text: string) => {
    if (!product || !text) return false;
    const clean = (s: any) => (s ? String(s) : '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    const searchTerms = clean(text).split(/\s+/).filter(t => t !== '');
    if (searchTerms.length === 0) return true;

    const pName = clean(product.name);
    const pSize = clean(product.size);
    const pColor = clean(product.color);
    const pRef = clean(product.reference);
    const pCat = clean(product.category);
    const pNameNoSpace = pName.replace(/\s+/g, '');

    return searchTerms.every(term => {
      const cleanTerm = term.replace(/\s+/g, '');
      return (
        pName.includes(term) ||
        pNameNoSpace.includes(cleanTerm) ||
        pSize.includes(term) ||
        pColor.includes(term) ||
        pRef.includes(cleanTerm) ||
        pCat.includes(term)
      );
    });
  };

  const filteredProducts = useMemo(() => {
    if (!searchText.trim()) return [];
    return products.filter(p => multiCriteriaSearch(p, searchText));
  }, [products, searchText]);

  const otherStoreProducts = useMemo(() => {
    if (!searchText.trim()) return [];
    const normStore = (storeId || 'falaise').trim().toLowerCase();
    return allProducts.filter(p => {
      const pStore = (p.store || 'falaise').trim().toLowerCase();
      return pStore !== normStore && p.stock > 0 && multiCriteriaSearch(p, searchText);
    });
  }, [allProducts, searchText, storeId]);

  // 1. Déclencheur du bouton Valider : Vérifie si le numéro / email est déjà saisi, sinon demande au caissier
  const handleInitiateSale = async () => {
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Le panier est vide.');
      return;
    }

    if (paymentMethod === 'Ami / Don' && !beneficiaryName.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom du bénéficiaire du don.');
      return;
    }

    const totalPrice = paymentMethod === 'Ami / Don' ? 0 : cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (isAdvance) {
      if (!dueDate) {
        Alert.alert('Erreur', 'Veuillez remplir la date d\'échéance.');
        return;
      }
      const paid = amountPaid.trim() === '' ? 0 : parseFloat(amountPaid);
      if (isNaN(paid) || paid < 0) {
        Alert.alert('Erreur', 'Le montant versé est invalide.');
        return;
      }
      if (paid >= totalPrice && totalPrice > 0) {
        Alert.alert('Erreur', 'Le montant de l\'avance doit être inférieur au total.');
        return;
      }
    }

    const saleId = `REC-${Date.now().toString(36).toUpperCase()}`;

    let advanceData = undefined;
    const paidAmount = isAdvance ? Math.max(0, parseFloat(amountPaid) || 0) : totalPrice;
    if (isAdvance) {
      advanceData = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim(),
        amountPaid: paidAmount,
        amountRemaining: Math.max(0, totalPrice - paidAmount),
        totalArticles: totalPrice,
        dueDate,
        initialPaymentMethod: paymentMethod
      };
    }

    const recordedSaleDetails = {
      id: saleId,
      date: new Date().toISOString(),
      store: storeId,
      seller_name: user?.name || 'Vendeur',
      total: isAdvance ? paidAmount : totalPrice,
      article_total: totalPrice,
      payment_method: isAdvance ? 'Avance' : paymentMethod,
      items: [...cart],
      rawItems: [...cart],
      is_advance: isAdvance ? 1 : 0,
      client_name: clientName.trim() || undefined,
      clientName: clientName.trim() || undefined,
      client_phone: clientPhone.trim() || undefined,
      client_email: clientEmail.trim() || undefined,
      advanceData
    };

    setCustomerPromptModalVisible(false);
    setModalVisible(false);

    try {
      await recordSale(
        totalPrice, 
        isAdvance ? 'Avance' : paymentMethod, 
        user.id, 
        cart, 
        advanceData, 
        storeId, 
        user.name || 'Vendeur', 
        paymentMethod === 'Ami / Don' ? beneficiaryName : '',
        { name: clientName.trim(), phone: clientPhone.trim(), email: clientEmail.trim() }
      );
    } catch (e) {
      console.error('Erreur recordSale:', e);
    }

    setSelectedReceiptSale(recordedSaleDetails);
    setReceiptModalVisible(true);

    // Reset
    setCart([]);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setAmountPaid('');
    setDueDate('');
    setIsAdvance(false);
    setShowClientDetails(false);
  };

  const handleDeleteSale = (saleOrId: any) => {
    const targetSale = typeof saleOrId === 'string'
      ? (todaySales.find(s => s.id === saleOrId) || { id: saleOrId, total: 0, items: 'Article' })
      : saleOrId;
    setSaleToDelete(targetSale);
    setDeleteSaleModalVisible(true);
  };

  const executeDeleteSale = async (restoreStock: boolean = true, reopenForCorrection: boolean = false) => {
    if (!saleToDelete) return;
    setIsDeletingSale(true);
    try {
      const targetId = saleToDelete.id;
      const saleSnapshotForEdit = { ...saleToDelete };
      const reason = reopenForCorrection
        ? 'Correction immédiate erreur de saisie'
        : (restoreStock ? 'Suppression vente + remise en stock' : 'Suppression définitive vente (sans stock)');

      await deleteSale(targetId, user?.id || 'caisse', user?.name || 'Vendeur', reason, restoreStock);

      // Mise à jour immédiate de la liste du jour
      setTodaySales(prev => {
        const updated = prev.filter(s => s.id !== targetId);
        setTotalToday(updated.reduce((sum, s) => sum + (s.total || 0), 0));
        return updated;
      });

      setDeleteSaleModalVisible(false);
      setSaleToDelete(null);

      if (reopenForCorrection) {
        // Pré-remplir immédiatement le panier de caisse avec les articles de la vente annulée pour correction directe
        const rawList = Array.isArray(saleSnapshotForEdit.rawItems) && saleSnapshotForEdit.rawItems.length > 0
          ? saleSnapshotForEdit.rawItems
          : [];
        if (rawList.length > 0) {
          const restoredCart = rawList.map((it: any) => ({
            id: it.product_id || it.id || '',
            name: it.name || 'Article',
            quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
            price: Number(it.price) || 0,
            size: it.size || null,
            color: it.color || null,
            reference: it.reference || null
          }));
          setCart(restoredCart);
        }
        if (saleSnapshotForEdit.payment_method && saleSnapshotForEdit.payment_method !== 'Avance') {
          setPaymentMethod(saleSnapshotForEdit.payment_method);
        }
        setClientName(saleSnapshotForEdit.client_name || saleSnapshotForEdit.clientName || '');
        setClientPhone(saleSnapshotForEdit.client_phone || '');
        setIsAdvance(saleSnapshotForEdit.is_advance === 1);
        if (saleSnapshotForEdit.advanceData?.amountPaid) {
          setAmountPaid(String(saleSnapshotForEdit.advanceData.amountPaid));
        }
        if (saleSnapshotForEdit.advanceData?.dueDate) {
          setDueDate(saleSnapshotForEdit.advanceData.dueDate);
        }
        loadProducts();
        setModalVisible(true);
      } else {
        const msg = restoreStock
          ? 'La vente a été supprimée et les articles ont été réintégrés dans le stock.'
          : 'La vente a été supprimée définitivement (sans modification du stock).';
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Succès', msg);
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Impossible de supprimer la vente.';
      if (typeof window !== 'undefined' && window.alert) window.alert(errMsg);
      else Alert.alert('Erreur', errMsg);
    } finally {
      setIsDeletingSale(false);
    }
  };

  const openEditOptions = (sale: any) => {
    setSelectedSaleForEdit(sale);
    setEditOptionsVisible(true);
  };

  const handleNfcSuccess = async (authId: string) => {
    setNfcModalVisible(false);
    if (nfcActionType === 'payment') {
      setPaymentEditModal(true);
    } else if (nfcActionType === 'exchange') {
      if (typeof window !== 'undefined' && window.alert) window.alert('Scanner le nouvel article (bientôt disponible)');
      else Alert.alert('Échange', 'Fonctionnalité d\'échange en cours de finalisation.');
    }
  };

  const submitPaymentChange = async (newMethod: string) => {
    if (!selectedSaleForEdit) return;
    try {
      await updateSalePaymentMethod(selectedSaleForEdit.id, newMethod, `MOCK-NFC-${Date.now()}`);
      setPaymentEditModal(false);
      setSelectedSaleForEdit(null);
      if (typeof window !== 'undefined' && window.alert) window.alert('Paiement modifié avec succès.');
      else Alert.alert('Succès', 'Paiement modifié.');
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Erreur lors de la modification.');
      else Alert.alert('Erreur', 'Impossible de modifier le paiement.');
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
        storeId, 
        transferDest, 
        qty, 
        user.id, 
        user.name || 'Vendeur',
        carrierId,
        carrierName,
        estimatedMinutes,
        currentGps
      );
      setTransferModalVisible(false);
      setTransferProduct(null);
      const destLabel = transferDest === 'falaise' ? 'La Falaise' : 'Tougou';
      const msg = `Transfert initié ! Les ${qty} article(s) sont EN ROUTE avec ${carrierName} vers ${destLabel}.`;
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      else Alert.alert('Succès', msg);
      loadProducts();
    } catch (e: any) {
      if (typeof window !== 'undefined' && window.alert) window.alert(e.message || 'Erreur lors du transfert.');
      else Alert.alert('Erreur', e.message || 'Impossible de transférer.');
    }
  };

  const paymentBadgeColor = (method: string) => {
    switch (method) {
      case 'Carte Bancaire': return { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.4)', text: '#38BDF8' };
      case 'MoMo':
      case 'MoMo Boss': return { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.4)', text: '#EAB308' };
      case 'OM':
      case 'OM Boss': return { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)', text: '#F97316' };
      case 'Avance': return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#F59E0B' };
      case 'Ami / Don': return { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.4)', text: '#C084FC' };
      default: return { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.4)', text: '#4ADE80' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Luxury Navigation Header */}
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

      {/* Live Transfer Banner */}
      <LiveTransferBanner 
        user={user} 
        currentStore={storeId} 
        navigation={navigation} 
      />

      <ScrollView 
        contentContainerStyle={[styles.contentScroll, r.isWide && styles.contentScrollWide]}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Hero Bento */}
        <TiltCard intensity={5} style={styles.heroTilt}>
          <GlassCard style={styles.totalCard} glow="gold">
            <View style={styles.totalCardLeft}>
              <View style={styles.totalCardTag}>
                <Clock color={colors.gold} size={12} style={{ marginRight: 4 }} />
                <Text style={styles.totalCardTagText}>AUJOURD'HUI</Text>
              </View>
              <Text style={styles.totalLabel}>Total Recette du Jour</Text>
              <View style={styles.totalSalesPill}>
                <Text style={styles.totalSalesText}>{todaySales.length} transaction{todaySales.length > 1 ? 's' : ''}</Text>
              </View>
            </View>

            <View style={styles.totalCardRight}>
              <AnimatedNumber 
                value={totalToday} 
                formatter={formatMoney}
                style={styles.totalValue}
              />
              <Text style={styles.currencyBadge}>FCFA</Text>
            </View>
          </GlassCard>
        </TiltCard>

        {/* Quick Action Bento Grid */}
        <View style={styles.actionsGrid}>
          <PressableScale 
            style={[styles.actionGridItem, { flex: 1, minWidth: r.isMobile ? '47%' : 160 }]}
            onPress={openNewSaleModal}
          >
            <GlassCard style={styles.actionCard} glow="gold">
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: colors.gold }]}>
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
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: colors.glassBorder }]}>
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
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(192, 132, 252, 0.12)', borderColor: 'rgba(192, 132, 252, 0.4)' }]}>
                <ArrowRightLeft color="#C084FC" size={22} />
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
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(192, 132, 252, 0.12)', borderColor: 'rgba(192, 132, 252, 0.4)' }]}>
                <ScanLine color="#C084FC" size={22} />
              </View>
              <Text style={styles.actionCardTitle}>Transfert par Scan</Text>
              <Text style={styles.actionCardDesc}>Scan direct sortie</Text>
            </GlassCard>
          </PressableScale>
        </View>

        {/* Transactions Section */}
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
                          <PressableScale 
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

                          <PressableScale 
                            onPress={() => openEditOptions(item)} 
                            style={styles.saleActionBtn}
                          >
                            <Edit3 color={colors.textSecondary} size={16} />
                          </PressableScale>

                          <PressableScale 
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
      </ScrollView>

      {/* Floating Sparkles AI Button */}
      <PressableScale 
        style={styles.fab} 
        onPress={() => setShowAIAssistant(true)}
      >
        <Sparkles color="#07070A" size={24} />
      </PressableScale>

      {/* Modal Nouvelle Vente */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <GlassCard style={styles.modalCard} glow="gold">
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>ENREGISTREMENT CAISSE</Text>
                  <Text style={styles.modalTitle}>Nouvelle Vente</Text>
                  <Text style={styles.modalDate}>{todayFormatted} — Vente N°{String(todaySales.length + 1).padStart(3, '0')}</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <X color={colors.textSecondary} size={20} />
                </TouchableOpacity>
              </View>

              {/* Recherche Article */}
              <Text style={styles.fieldLabel}>Article vendu</Text>
              {selectedProduct ? (
                <View style={styles.selectedProductCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                    <Text style={styles.selectedProductInfo}>
                      {selectedProduct.category}
                      {selectedProduct.size ? ` • Taille: ${selectedProduct.size}` : ''}
                      {selectedProduct.color ? ` • Couleur: ${selectedProduct.color}` : ''}
                      {selectedProduct.reference ? ` • Réf: ${selectedProduct.reference}` : ''}
                    </Text>
                    <Text style={styles.selectedProductStock}>
                      Stock disponible : {selectedProduct.stock}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.changeProductBtn}>
                    <Text style={styles.changeProductText}>Changer</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ zIndex: 10, position: 'relative' }}>
                  <View style={styles.searchBar}>
                    <Search color={colors.gold} size={16} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Rechercher par nom, couleur, taille ou référence..."
                      placeholderTextColor={colors.textTertiary}
                      value={searchText}
                      onChangeText={setSearchText}
                      autoFocus
                    />
                    {searchText.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchText('')}>
                        <X color={colors.textTertiary} size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {searchText.length > 0 && (
                    <View style={styles.searchResultsDropdown}>
                      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
                        {filteredProducts.slice(0, 15).map(p => (
                          <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => selectProduct(p)}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.searchResultName}>{p.name}</Text>
                              <Text style={styles.searchResultInfo}>
                                {p.category}
                                {p.size ? ` • T: ${p.size}` : ''}
                                {p.color ? ` • C: ${p.color}` : ''}
                                {p.reference ? ` • Réf: ${p.reference}` : ''}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.searchResultPrice}>{formatMoney(p.price)} F</Text>
                              <Text style={styles.searchResultStock}>Stock: {p.stock}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                        {filteredProducts.length === 0 && (
                          <View style={{ padding: 14 }}>
                            {loadingProducts ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 }}>
                                <ActivityIndicator size="small" color={colors.gold} />
                                <Text style={{ color: colors.gold, fontSize: 13, fontFamily: fonts.sans }}>
                                  Chargement du stock en cours...
                                </Text>
                              </View>
                            ) : (
                              <>
                                <Text style={styles.searchResultEmpty}>
                                  Aucun article correspondant en stock à {storeId === 'falaise' ? 'La Falaise' : 'Tougou'}
                                </Text>
                                {otherStoreProducts.length > 0 && (
                                  <View style={{ marginTop: 12, padding: 10, backgroundColor: 'rgba(212, 175, 55, 0.1)', borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' }}>
                                    <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
                                      📍 Disponible à {storeId === 'falaise' ? 'Tougou' : 'La Falaise'} ({otherStoreProducts.reduce((s, p) => s + p.stock, 0)} unité{otherStoreProducts.reduce((s, p) => s + p.stock, 0) > 1 ? 's' : ''}) :
                                    </Text>
                                    {otherStoreProducts.slice(0, 3).map(op => (
                                      <Text key={op.id} style={{ color: colors.textSecondary, fontSize: 11, marginVertical: 1 }}>
                                        • {op.name} {op.color ? `(${op.color})` : ''} {op.size ? `T.${op.size}` : ''} — Stock: {op.stock}
                                      </Text>
                                    ))}
                                    <TouchableOpacity 
                                      style={{ marginTop: 8, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.gold, borderRadius: 5 }}
                                      onPress={() => {
                                        setModalVisible(false);
                                        setTransferRequestModalVisible(true);
                                      }}
                                    >
                                      <Text style={{ color: '#07070A', fontSize: 11, fontWeight: '700' }}>
                                        Demander un coursier express ➔
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </>
                            )}
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Quantité et Prix */}
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.fieldLabel}>Quantité</Text>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric" 
                    value={quantity} 
                    onChangeText={setQuantity} 
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Prix de vente (FCFA)</Text>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric" 
                    value={salePrice} 
                    onChangeText={setSalePrice} 
                  />
                </View>
              </View>

              {/* Moyen de paiement */}
              <Text style={styles.fieldLabel}>Moyen de paiement</Text>
              <View style={styles.paymentGrid}>
                {['Espèces', 'MoMo', 'MoMo Boss', 'OM', 'OM Boss', 'Carte Bancaire', 'Ami / Don', 'Avance'].map(method => {
                  const isSelected = method === 'Avance' ? isAdvance : (!isAdvance && paymentMethod === method);
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentPill,
                        isSelected && styles.paymentPillActive,
                      ]}
                      onPress={() => {
                        if (method === 'Avance') {
                          setIsAdvance(true);
                        } else {
                          setIsAdvance(false);
                          setPaymentMethod(method);
                        }
                      }}
                    >
                      <Text style={[
                        styles.paymentPillText,
                        isSelected && styles.paymentPillTextActive
                      ]}>
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {paymentMethod === 'Ami / Don' && !isAdvance && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>Bénéficiaire du don (Obligatoire)</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Nom complet du bénéficiaire" 
                    placeholderTextColor={colors.textTertiary} 
                    value={beneficiaryName} 
                    onChangeText={setBeneficiaryName} 
                  />
                </View>
              )}

              {/* Champs Avance */}
              {isAdvance ? (
                <View style={styles.advanceCard}>
                  <Text style={styles.advanceCardTitle}>Détails de l'Avance Client</Text>
                  
                  <Text style={styles.fieldLabel}>Nom du client *</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Ex: M. Dupont" 
                    placeholderTextColor={colors.textTertiary} 
                    value={clientName} 
                    onChangeText={setClientName} 
                  />

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.fieldLabel}>N° WhatsApp (Direct)</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="Ex: 699932024" 
                        placeholderTextColor={colors.textTertiary} 
                        keyboardType="phone-pad"
                        value={clientPhone} 
                        onChangeText={setClientPhone} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Email (Optionnel)</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="Ex: client@gmail.com" 
                        placeholderTextColor={colors.textTertiary} 
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={clientEmail} 
                        onChangeText={setClientEmail} 
                      />
                    </View>
                  </View>
                  
                  <Text style={styles.fieldLabel}>Moyen de paiement du premier acompte</Text>
                  <View style={styles.paymentGrid}>
                    {['Espèces', 'MoMo', 'MoMo Boss', 'OM', 'OM Boss', 'Carte Bancaire'].map(m => (
                      <TouchableOpacity 
                        key={m}
                        style={[
                          styles.paymentPill,
                          paymentMethod === m && styles.paymentPillActive
                        ]}
                        onPress={() => setPaymentMethod(m)}
                      >
                        <Text style={[styles.paymentPillText, paymentMethod === m && styles.paymentPillTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.fieldLabel}>Montant versé (0 si rien versé)</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="Ex: 0 ou 50000" 
                        placeholderTextColor={colors.textTertiary} 
                        keyboardType="numeric" 
                        value={amountPaid} 
                        onChangeText={setAmountPaid} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Échéance solde *</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="YYYY-MM-DD" 
                        placeholderTextColor={colors.textTertiary} 
                        value={dueDate} 
                        onChangeText={setDueDate} 
                      />
                    </View>
                  </View>
                </View>
              ) : (
                /* Envoi Facture Client (WhatsApp / Mail) pour Vente Standard */
                <View style={{ marginTop: 14, backgroundColor: 'rgba(212, 175, 55, 0.05)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.25)', gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MessageCircle color={colors.gold} size={16} />
                      <Text style={{ color: colors.goldLight, fontSize: 13, fontWeight: '700' }}>
                        Facture Client (Envoi Direct WhatsApp / Email)
                      </Text>
                    </View>
                    {cleanWhatsAppNumber(clientPhone) ? (
                      <View style={{ backgroundColor: 'rgba(37, 211, 102, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#25D366' }}>
                        <Text style={{ color: '#25D366', fontSize: 11, fontWeight: '700' }}>✓ WhatsApp Direct</Text>
                      </View>
                    ) : null}
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Nom complet du client</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Ex: M. Jean Dupont / Mme Ngo" 
                      placeholderTextColor={colors.textTertiary} 
                      value={clientName} 
                      onChangeText={setClientName} 
                    />
                  </View>

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.fieldLabel}>N° WhatsApp (9 chiffres Cameroun)</Text>
                      <TextInput 
                        style={[styles.input, cleanWhatsAppNumber(clientPhone) ? { borderColor: '#25D366', backgroundColor: 'rgba(37, 211, 102, 0.04)' } : null]} 
                        placeholder="Ex: 699932024" 
                        placeholderTextColor={colors.textTertiary} 
                        keyboardType="phone-pad"
                        value={clientPhone} 
                        onChangeText={setClientPhone} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Email du client (Optionnel)</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="Ex: client@gmail.com" 
                        placeholderTextColor={colors.textTertiary} 
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={clientEmail} 
                        onChangeText={setClientEmail} 
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Bouton Ajout Panier */}
              {selectedProduct && (
                <View style={{ marginTop: 15 }}>
                  <GoldButton 
                    label="Ajouter au Panier" 
                    onPress={addToCart} 
                    variant="glass"
                    size="md"
                    icon={<PlusCircle color={colors.gold} size={16} />}
                  />
                </View>
              )}

              {/* Panier */}
              {cart.length > 0 && (
                <View style={styles.cartBox}>
                  <Text style={styles.cartBoxTitle}>Articles du panier ({cart.length})</Text>
                  {cart.map((item, index) => (
                    <View key={index} style={styles.cartRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartItemTitle}>{item.name}</Text>
                        <Text style={styles.cartItemSubtitle}>
                          {item.quantity} × {formatMoney(item.price)} FCFA = {formatMoney(item.quantity * item.price)} FCFA
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFromCart(index)} style={styles.cartRemoveBtn}>
                        <Trash2 color={colors.danger} size={16} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.cartTotalBar}>
                    <Text style={styles.cartTotalBarLabel}>TOTAL NET</Text>
                    <Text style={styles.cartTotalBarValue}>
                      {formatMoney(paymentMethod === 'Ami / Don' ? 0 : cart.reduce((s, i) => s + (i.price * i.quantity), 0))} FCFA
                    </Text>
                  </View>
                </View>
              )}

              {/* Actions Modal */}
              <View style={[styles.modalActions, { flexDirection: 'row', gap: 10 }]}>
                <View style={{ flex: 2 }}>
                  <GoldButton 
                    label={isAdvance ? "Valider l'Avance" : "Valider la Vente"}
                    onPress={handleInitiateSale}
                    disabled={cart.length === 0}
                    size="lg"
                    icon={<Check color="#07070A" size={18} />}
                  />
                </View>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Demande Coordonnées Client & Envoi Facture */}
      <Modal visible={customerPromptModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 440, alignSelf: 'center' }]} glow="gold">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalEyebrow}>ENVOI DE LA FACTURE</Text>
                <Text style={styles.modalTitle}>Coordonnées du Client</Text>
              </View>
              <TouchableOpacity onPress={() => setCustomerPromptModalVisible(false)} style={styles.modalCloseBtn}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 14 }}>
              Renseignez le numéro WhatsApp ou l'email du client pour lui envoyer automatiquement son reçu officiel :
            </Text>

            <Text style={styles.fieldLabel}>Nom complet du client</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: M. Jean Dupont / Mme Ngo" 
              placeholderTextColor={colors.textTertiary} 
              value={clientName} 
              onChangeText={setClientName}
              autoFocus 
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={styles.fieldLabel}>N° WhatsApp (Direct)</Text>
              {cleanWhatsAppNumber(clientPhone) ? (
                <Text style={{ color: '#25D366', fontSize: 11, fontWeight: '700' }}>✓ +{cleanWhatsAppNumber(clientPhone)}</Text>
              ) : (
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>9 chiffres Cameroun (ex: 699932024)</Text>
              )}
            </View>
            <TextInput 
              style={[styles.input, cleanWhatsAppNumber(clientPhone) ? { borderColor: '#25D366', backgroundColor: 'rgba(37, 211, 102, 0.05)' } : null]} 
              placeholder="Ex: 699932024 ou +237..." 
              placeholderTextColor={colors.textTertiary} 
              keyboardType="phone-pad" 
              value={clientPhone} 
              onChangeText={setClientPhone} 
            />

            <Text style={styles.fieldLabel}>Adresse Email (Optionnel)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: client@gmail.com" 
              placeholderTextColor={colors.textTertiary} 
              keyboardType="email-address" 
              autoCapitalize="none"
              value={clientEmail} 
              onChangeText={setClientEmail} 
            />

            <View style={{ gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#25D366',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: cleanWhatsAppNumber(clientPhone) ? 1 : 0.65,
                  cursor: 'pointer' as any
                }}
                onPress={() => {
                  if (!cleanWhatsAppNumber(clientPhone)) {
                    Alert.alert('Numéro WhatsApp manquant', 'Veuillez saisir les 9 chiffres du numéro WhatsApp.');
                    return;
                  }
                  executeSaleValidation('whatsapp');
                }}
              >
                <MessageCircle color="#07070A" size={19} />
                <Text style={{ color: '#07070A', fontWeight: '800', fontSize: 14 }}>
                  {cleanWhatsAppNumber(clientPhone)
                    ? `Valider & Envoyer WhatsApp (+${cleanWhatsAppNumber(clientPhone)})`
                    : "Valider & Envoyer sur WhatsApp"}
                </Text>
              </TouchableOpacity>

              {clientEmail.trim() ? (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#3b82f6',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer' as any
                  }}
                  onPress={() => executeSaleValidation('email')}
                >
                  <Mail color="#fff" size={17} />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    Valider & Envoyer par Email
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(212,175,55,0.4)',
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer' as any
                }}
                onPress={() => executeSaleValidation('none')}
              >
                <Check color={colors.gold} size={17} />
                <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 13 }}>
                  Valider sans envoi (Ticket caisse / Papier uniquement)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setCustomerPromptModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Retourner à la vente</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Scanner */}
      <Modal visible={scannerVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <WebScanner 
            onScan={handleScan}
            onClose={() => setScannerVisible(false)}
          />
        </View>
      </Modal>

      {/* Modal Options Édition Vente */}
      <Modal visible={editOptionsVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: 380, maxWidth: '92%' }]} glow="gold">
            <Text style={styles.modalTitle}>Modifier / Corriger la Vente</Text>
            <Text style={styles.modalDate}>Sélectionnez l'action de correction souhaitée</Text>
            
            <View style={{ gap: 10, marginTop: 15 }}>
              <GoldButton 
                label="Corriger une erreur / Supprimer"
                onPress={() => {
                  const target = selectedSaleForEdit;
                  setEditOptionsVisible(false);
                  if (target) handleDeleteSale(target);
                }}
                size="md"
                icon={<Edit3 color="#07070A" size={16} />}
              />

              <GoldButton 
                label="Modifier Mode de Paiement"
                variant="glass"
                onPress={() => {
                  setEditOptionsVisible(false);
                  setPaymentEditModal(true);
                }}
                size="md"
                icon={<Wallet color={colors.gold} size={16} />}
              />

              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditOptionsVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Options Suppression & Correction Immédiate de Vente */}
      <Modal visible={deleteSaleModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 480, alignSelf: 'center' }]} glow="none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Trash2 color={colors.danger} size={18} />
              <Text style={[styles.modalEyebrow, { color: colors.danger }]}>OPTIONS DE SUPPRESSION & CORRECTION</Text>
            </View>
            <Text style={styles.modalTitle}>Supprimer ou Corriger cette Vente ?</Text>

            {saleToDelete && (
              <>
                <View style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  padding: 12,
                  marginVertical: 12
                }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                    {saleToDelete.items || 'Articles vendus'}
                  </Text>
                  <Text style={{ color: colors.goldLight, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                    Montant : {formatMoney(saleToDelete.total || 0)} FCFA • {saleToDelete.payment_method || 'Espèces'}
                  </Text>
                  {saleToDelete.client_name ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Client : {saleToDelete.client_name}
                    </Text>
                  ) : null}
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: '600' }}>
                  Choisissez l'option souhaitée :
                </Text>

                <View style={{ gap: 10 }}>
                  {/* Option Correction Immédiate */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.gold,
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: radius.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingSale ? 0.6 : 1,
                      cursor: 'pointer' as any
                    }}
                    onPress={() => executeDeleteSale(true, true)}
                    disabled={isDeletingSale}
                  >
                    {isDeletingSale ? (
                      <ActivityIndicator size="small" color="#07070A" />
                    ) : (
                      <Edit3 color="#07070A" size={18} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#07070A', fontWeight: '800', fontSize: 13.5 }}>
                        ✏️ Supprimer & Corriger l'erreur de suite
                      </Text>
                      <Text style={{ color: 'rgba(7,7,10,0.8)', fontSize: 11, marginTop: 2 }}>
                        Remet en stock et rouvre la vente avec ces articles pour corriger immédiatement
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
                      borderRadius: radius.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingSale ? 0.6 : 1,
                      cursor: 'pointer' as any
                    }}
                    onPress={() => executeDeleteSale(true, false)}
                    disabled={isDeletingSale}
                  >
                    {isDeletingSale ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Check color="#FFFFFF" size={18} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                        1. Entrer dans le stock & Supprimer
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>
                        Annule la vente et réintègre les articles dans le stock disponible
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2 : Supprimer définitivement */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.danger,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: radius.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isDeletingSale ? 0.6 : 1,
                      cursor: 'pointer' as any
                    }}
                    onPress={() => executeDeleteSale(false, false)}
                    disabled={isDeletingSale}
                  >
                    {isDeletingSale ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Trash2 color="#FFFFFF" size={18} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                        2. Supprimer définitivement (sans stock)
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>
                        Supprime définitivement la vente sans modifier les quantités en stock
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { marginTop: 2 }]}
                    onPress={() => {
                      if (!isDeletingSale) {
                        setDeleteSaleModalVisible(false);
                        setSaleToDelete(null);
                      }
                    }}
                    disabled={isDeletingSale}
                  >
                    <Text style={styles.modalCancelBtnText}>Annuler (Conserver la vente)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </GlassCard>
        </View>
      </Modal>

      {/* NFC Auth Modal */}
      <NfcAuthModal 
        visible={nfcModalVisible}
        onClose={() => setNfcModalVisible(false)}
        onSuccess={handleNfcSuccess}
        actionText={nfcActionText}
      />

      {/* Modifier Paiement Modal */}
      <Modal visible={paymentEditModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: 340, maxWidth: '90%' }]}>
            <Text style={styles.modalTitle}>Nouveau Mode</Text>
            <Text style={styles.modalDate}>Choisissez le mode de règlement réel</Text>

            <View style={{ gap: 8, marginTop: 12 }}>
              {['Espèces', 'MoMo', 'MoMo Boss', 'OM', 'OM Boss', 'Carte Bancaire'].map(m => (
                <TouchableOpacity 
                  key={m} 
                  style={styles.paymentSelectRow} 
                  onPress={() => submitPaymentChange(m)}
                >
                  <Text style={styles.paymentSelectRowText}>{m}</Text>
                  <ChevronRight color={colors.gold} size={16} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 15 }]} onPress={() => setPaymentEditModal(false)}>
              <Text style={styles.modalCancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Transfert */}
      <Modal visible={transferModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { maxHeight: '90%', width: 500, maxWidth: '94%' }]} glow="gold">
            <Text style={styles.modalEyebrow}>EXPÉDITION INTER-BOUTIQUE</Text>
            <Text style={styles.modalTitle}>Nouveau Transfert Live</Text>
            
            {transferProduct && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
                <View style={styles.transferProductCard}>
                  <Text style={styles.transferProductName}>{transferProduct.name}</Text>
                  <Text style={styles.transferProductStock}>Stock disponible à {storeId.toUpperCase()} : {transferProduct.stock}</Text>
                  <Text style={styles.transferProductMeta}>
                    {transferProduct.category} {transferProduct.size ? `• Taille: ${transferProduct.size}` : ''} {transferProduct.color ? `• Couleur: ${transferProduct.color}` : ''}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Quantité à expédier</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={transferQty} onChangeText={setTransferQty} />

                <Text style={styles.fieldLabel}>Boutique Destinataire</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                  <TouchableOpacity 
                    style={[styles.destPill, transferDest === 'falaise' && styles.destPillActive]}
                    onPress={() => setTransferDest('falaise')}
                  >
                    <Store color={transferDest === 'falaise' ? colors.gold : colors.textTertiary} size={16} style={{ marginRight: 6 }} />
                    <Text style={[styles.destPillText, transferDest === 'falaise' && styles.destPillTextActive]}>La Falaise</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.destPill, transferDest === 'tougou' && styles.destPillActive]}
                    onPress={() => setTransferDest('tougou')}
                  >
                    <Store color={transferDest === 'tougou' ? colors.gold : colors.textTertiary} size={16} style={{ marginRight: 6 }} />
                    <Text style={[styles.destPillText, transferDest === 'tougou' && styles.destPillTextActive]}>Tougou</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Responsable transport ou coursier</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {availableUsers.map((u) => {
                    const isSelected = selectedCarrier?.id === u.id && !customCarrierName;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        onPress={() => {
                          setSelectedCarrier(u);
                          setCustomCarrierName('');
                        }}
                        style={[styles.carrierPill, isSelected && styles.carrierPillActive]}
                      >
                        <User color={isSelected ? colors.gold : colors.textTertiary} size={14} />
                        <View>
                          <Text style={[styles.carrierPillName, isSelected && { color: colors.gold }]}>
                            {u.name}
                          </Text>
                          <Text style={styles.carrierPillRole}>
                            {u.store === 'all' ? 'Direction' : u.store === 'falaise' ? 'La Falaise' : 'Tougou'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.fieldLabel, { fontSize: 11 }]}>Ou taxi / moto coursier externe :</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 15 }]}
                  placeholder="Ex: Roger Moto Douala..."
                  placeholderTextColor={colors.textTertiary}
                  value={customCarrierName}
                  onChangeText={(text) => {
                    setCustomCarrierName(text);
                    if (text) setSelectedCarrier(null);
                  }}
                />

                <Text style={styles.fieldLabel}>Durée estimée du trajet</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {[10, 15, 20, 30].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      onPress={() => setEstimatedMinutes(mins)}
                      style={[styles.minsPill, estimatedMinutes === mins && styles.minsPillActive]}
                    >
                      <Text style={[styles.minsPillText, estimatedMinutes === mins && styles.minsPillTextActive]}>
                        {mins} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ gap: 10, marginTop: 5 }}>
                  <GoldButton 
                    label="Lancer l'Expédition"
                    onPress={handleTransferSubmit}
                    size="lg"
                    icon={<ArrowRightLeft color="#07070A" size={18} />}
                  />
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setTransferProduct(null); setTransferQty('1'); }}>
                    <Text style={styles.modalCancelBtnText}>Changer d'article</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
            
            {!transferProduct && (
              <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 20 }]} onPress={() => setTransferModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Fermer</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Recherche Transfert Manuel */}
      <Modal visible={transferSearchModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { maxHeight: '80%', width: 500, maxWidth: '94%' }]}>
            <Text style={styles.modalEyebrow}>SÉLECTION PRODUIT</Text>
            <Text style={styles.modalTitle}>Recherche Article (Transfert)</Text>
            <View style={[styles.searchBar, { marginTop: 12 }]}>
              <Search color={colors.gold} size={16} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher par nom ou référence..."
                placeholderTextColor={colors.textTertiary}
                value={transferSearchText}
                onChangeText={setTransferSearchText}
                autoFocus
              />
            </View>
            <ScrollView style={{ marginTop: 10, maxHeight: 300 }}>
              {products.filter(p => multiCriteriaSearch(p, transferSearchText)).slice(0, 15).map(p => (
                <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => selectTransferProduct(p)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{p.name}</Text>
                    <Text style={styles.searchResultInfo}>
                      {p.category} {p.size ? `• Taille: ${p.size}` : ''} {p.color ? `• Couleur: ${p.color}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.searchResultStock}>Stock: {p.stock}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 15 }]} onPress={() => setTransferSearchModalVisible(false)}>
              <Text style={styles.modalCancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      {/* Modals & Components */}
      <AIAssistantModal 
        visible={showAIAssistant} 
        onClose={() => setShowAIAssistant(false)} 
        user={user} 
      />

      <ReceiptModal 
        visible={receiptModalVisible} 
        onClose={() => setReceiptModalVisible(false)} 
        sale={selectedReceiptSale} 
        storeName={storeId === 'falaise' ? 'La Falaise' : 'Tougou'} 
      />

      <TransferRequestModal
        visible={transferRequestModalVisible}
        onClose={() => setTransferRequestModalVisible(false)}
        user={user}
        currentStore={storeId}
      />

      <IncomingTransferAlertModal
        user={user}
        currentStore={storeId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
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
  contentScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  contentScrollWide: {
    paddingHorizontal: 28,
  },
  heroTilt: {
    marginBottom: 16,
  },
  totalCard: {
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    flexWrap: 'wrap',
    gap: 15,
  },
  totalCardLeft: {
    flex: 1,
    minWidth: 200,
  },
  totalCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalCardTagText: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.sans,
    marginBottom: 8,
  },
  totalSalesPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  totalSalesText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  totalCardRight: {
    alignItems: 'flex-end',
  },
  totalValue: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: '800',
    fontFamily: fonts.serif,
    letterSpacing: 0.5,
  },
  currencyBadge: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
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
    fontSize: 11,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
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
    fontSize: 10,
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
    borderLeftColor: '#F59E0B',
  },
  saleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleIndexBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  saleIndexText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  saleTimeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saleTimeText: {
    color: colors.textTertiary,
    fontSize: 11,
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
    fontSize: 11,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  saleSellerText: {
    color: colors.textTertiary,
    fontSize: 11,
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
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  saleActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saleActionBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  saleDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
    ...shadow.glowGold,
    zIndex: 100,
  },

  // Modals
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
    maxWidth: 600,
    padding: 24,
    borderRadius: radius.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalEyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.serif,
    marginTop: 2,
  },
  modalDate: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
    fontFamily: fonts.sans,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
  row: {
    flexDirection: 'row',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#121217',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: radius.sm,
    overflow: 'hidden',
    ...shadow.lg,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultName: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  searchResultInfo: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  searchResultPrice: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  searchResultStock: {
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  searchResultEmpty: {
    color: colors.textTertiary,
    padding: 16,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  selectedProductCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    padding: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  selectedProductName: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
    fontFamily: fonts.sans,
  },
  selectedProductInfo: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  selectedProductStock: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: fonts.sans,
  },
  changeProductBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  changeProductText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentPill: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  paymentPillActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.gold,
  },
  paymentPillText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  paymentPillTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  advanceCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radius.sm,
    padding: 14,
    marginTop: 12,
  },
  advanceCardTitle: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: fonts.sans,
    marginBottom: 4,
  },
  cartBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cartBoxTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.5,
    fontFamily: fonts.sans,
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  cartItemTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  cartItemSubtitle: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  cartRemoveBtn: {
    padding: 6,
  },
  cartTotalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
  },
  cartTotalBarLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: fonts.sans,
  },
  cartTotalBarValue: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.serif,
  },
  modalActions: {
    marginTop: 20,
    gap: 8,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  paymentSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  paymentSelectRowText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  transferProductCard: {
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    padding: 14,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  transferProductName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  transferProductStock: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: fonts.sans,
  },
  transferProductMeta: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 3,
    fontFamily: fonts.sans,
  },
  destPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  destPillActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: colors.gold,
  },
  destPillText: {
    color: colors.textTertiary,
    fontWeight: '600',
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  destPillTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  carrierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  carrierPillActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: colors.gold,
  },
  carrierPillName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  carrierPillRole: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: fonts.sans,
  },
  minsPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  minsPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  minsPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  minsPillTextActive: {
    color: '#07070A',
    fontWeight: '800',
  },
});
