import { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Modal, Alert, ScrollView } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { recordSale, deleteSale, getProducts, getProductByBarcode, updateSalePaymentMethod, transferStock, isUserAdmin, getUsers, getAdvanceStore, getFastCache, getLocalCache } from '../db/database';
import { subscribeResilient } from '../db/resilientSync';
import { getEffectiveTotal, isAnyAdvance, isOnLocalDay, normStore, todayKey } from '../utils/saleMath';
import WebScanner from '../components/WebScanner';
import AIAssistantModal from '../components/AIAssistantModal';
import ReceiptModal from '../components/ReceiptModal';
import LiveTransferBanner from '../components/LiveTransferBanner';
import TransferRequestModal from '../components/TransferRequestModal';
import IncomingTransferAlertModal from '../components/IncomingTransferAlertModal';
import LedgerHeader from '../components/ledger/LedgerHeader';
import LedgerTotalCard from '../components/ledger/LedgerTotalCard';
import LedgerActionsGrid from '../components/ledger/LedgerActionsGrid';
import TodaySalesSection from '../components/ledger/TodaySalesSection';
import NewSaleModal from '../components/ledger/NewSaleModal';
import EditSaleOptionsModal from '../components/ledger/EditSaleOptionsModal';
import DeleteSaleModal from '../components/ledger/DeleteSaleModal';
import PaymentEditModal from '../components/ledger/PaymentEditModal';
import TransferModal from '../components/ledger/TransferModal';
import TransferSearchModal from '../components/ledger/TransferSearchModal';
import { sharedStyles } from '../components/ledger/ledgerStyles';
import { colors, shadow, formatMoney } from '../theme';
import { useResponsive, PressableScale } from '../ui';

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
    const norm = normStore(storeId);
    return Object.keys(cached)
      .map(k => ({ id: k, ...cached[k], stock: parseInt(cached[k]?.stock, 10) || 0 }))
      .filter(p => (norm === 'all' || normStore(p.store) === norm) && p.stock > 0)
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
  const [amountPaid, setAmountPaid] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [pendingAdvancesCount, setPendingAdvancesCount] = useState(0);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null);

  // NFC & Modifs
  const [editOptionsVisible, setEditOptionsVisible] = useState(false);
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<any>(null);
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
    const todayStr = todayKey();
    
    // Listen to Sales with resilient fallback
    const unsubscribeSales = subscribeResilient('sales', (data) => {
      if (!data) {
        setTodaySales([]);
        setTotalToday(0);
        return;
      }
      
      const allSales = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      
      const todaySalesList = allSales
        .filter(s => isOnLocalDay(s.date, todayStr) && (user?.store === 'all' || s.store === storeId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
      const formattedSales = todaySalesList.map(s => {
        const effectiveTotal = getEffectiveTotal(s);
        const baseItems = Array.isArray(s.items)
          ? s.items.map((i: any) => `${i.name} (x${i.quantity || 1})`).join(', ')
          : (s.items || '');
        const clientTag = (s.client_name || s.advanceData?.clientName) ? ` (${s.client_name || s.advanceData?.clientName})` : '';
        const anyAdvance = isAnyAdvance(s);
        const displayItems = s.sale_label
          ? s.sale_label
          : (anyAdvance
              ? (effectiveTotal > 0
                  ? `Avance ${formatMoney(effectiveTotal)} FCFA sur ${baseItems}${clientTag}`
                  : `Avance (0 FCFA versé) sur ${baseItems}${clientTag}`)
              : baseItems);
        return {
          id: s.id,
          total: effectiveTotal,
          article_total: s.article_total || (anyAdvance ? (Number(s.advanceData?.totalArticles) || Number(s.total) || 0) : effectiveTotal),
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
      const norm = normStore(storeId);
      const allItems = Object.keys(data).map(k => ({
        id: k,
        ...data[k],
        stock: parseInt(data[k]?.stock, 10) || 0
      }));
      setAllProducts(allItems);

      const storeItems = allItems.filter(p => 
        (norm === 'all' || normStore(p.store) === norm) && p.stock > 0
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
    const norm = normStore(storeId);
    return allProducts.filter(p => {
      const pStore = normStore(p.store);
      return pStore !== norm && p.stock > 0 && multiCriteriaSearch(p, searchText);
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

  return (
    <View style={styles.container}>
      {/* Luxury Navigation Header */}
      <LedgerHeader
        navigation={navigation}
        user={user}
        storeId={storeId}
        setTransferRequestModalVisible={setTransferRequestModalVisible}
        setShowAIAssistant={setShowAIAssistant}
        pendingAdvancesCount={pendingAdvancesCount}
        inTransitCount={inTransitCount}
        todayFormatted={todayFormatted}
      />

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
        <LedgerTotalCard todaySales={todaySales} totalToday={totalToday} />

        {/* Quick Action Bento Grid */}
        <LedgerActionsGrid
          r={r}
          setScannerVisible={setScannerVisible}
          setScannerMode={setScannerMode}
          openNewSaleModal={openNewSaleModal}
          openTransferSearchModal={openTransferSearchModal}
        />

        {/* Transactions Section */}
        <TodaySalesSection
          user={user}
          todaySales={todaySales}
          totalToday={totalToday}
          setReceiptModalVisible={setReceiptModalVisible}
          setSelectedReceiptSale={setSelectedReceiptSale}
          handleDeleteSale={handleDeleteSale}
          openEditOptions={openEditOptions}
        />
      </ScrollView>

      {/* Floating Sparkles AI Button */}
      <PressableScale 
        style={styles.fab} 
        onPress={() => setShowAIAssistant(true)}
      >
        <Sparkles color="#07070A" size={24} />
      </PressableScale>

      {/* Modal Nouvelle Vente */}
      <NewSaleModal
        storeId={storeId}
        setTransferRequestModalVisible={setTransferRequestModalVisible}
        todaySales={todaySales}
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
        loadingProducts={loadingProducts}
        searchText={searchText}
        setSearchText={setSearchText}
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        quantity={quantity}
        setQuantity={setQuantity}
        salePrice={salePrice}
        setSalePrice={setSalePrice}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cart={cart}
        isAdvance={isAdvance}
        setIsAdvance={setIsAdvance}
        clientName={clientName}
        setClientName={setClientName}
        clientPhone={clientPhone}
        setClientPhone={setClientPhone}
        clientEmail={clientEmail}
        setClientEmail={setClientEmail}
        amountPaid={amountPaid}
        setAmountPaid={setAmountPaid}
        dueDate={dueDate}
        setDueDate={setDueDate}
        beneficiaryName={beneficiaryName}
        setBeneficiaryName={setBeneficiaryName}
        todayFormatted={todayFormatted}
        selectProduct={selectProduct}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        filteredProducts={filteredProducts}
        otherStoreProducts={otherStoreProducts}
        handleInitiateSale={handleInitiateSale}
      />

      {/* Modal Scanner */}
      <Modal visible={scannerVisible} animationType="slide" transparent={true}>
        <View style={sharedStyles.modalOverlay}>
          <WebScanner 
            onScan={handleScan}
            onClose={() => setScannerVisible(false)}
          />
        </View>
      </Modal>

      {/* Modal Options Édition Vente */}
      <EditSaleOptionsModal
        editOptionsVisible={editOptionsVisible}
        setEditOptionsVisible={setEditOptionsVisible}
        selectedSaleForEdit={selectedSaleForEdit}
        setPaymentEditModal={setPaymentEditModal}
        handleDeleteSale={handleDeleteSale}
      />

      {/* Modal Options Suppression & Correction Immédiate de Vente */}
      <DeleteSaleModal
        deleteSaleModalVisible={deleteSaleModalVisible}
        setDeleteSaleModalVisible={setDeleteSaleModalVisible}
        saleToDelete={saleToDelete}
        setSaleToDelete={setSaleToDelete}
        isDeletingSale={isDeletingSale}
        executeDeleteSale={executeDeleteSale}
      />

      {/* Modifier Paiement Modal */}
      <PaymentEditModal paymentEditModal={paymentEditModal} setPaymentEditModal={setPaymentEditModal} submitPaymentChange={submitPaymentChange} />

      {/* Modal Transfert */}
      <TransferModal
        storeId={storeId}
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
        products={products}
        transferSearchModalVisible={transferSearchModalVisible}
        setTransferSearchModalVisible={setTransferSearchModalVisible}
        transferSearchText={transferSearchText}
        setTransferSearchText={setTransferSearchText}
        selectTransferProduct={selectTransferProduct}
        multiCriteriaSearch={multiCriteriaSearch}
      />

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
});
