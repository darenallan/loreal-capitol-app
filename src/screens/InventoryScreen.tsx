import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView, SectionList, ActivityIndicator, Platform } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue, remove } from 'firebase/database';
import { 
  ArrowLeft, Plus, Trash2, Package, PackagePlus, AlertTriangle, Edit3, 
  QrCode, Search, ChevronDown, ChevronRight, Download, RefreshCw, X, 
  Check, Store, Tag, Sparkles, Printer, Layers
} from 'lucide-react-native';
import { addProduct, updateProductStock, recordArrivage, updateProduct, getAllProductNames, isUserAdmin, isSuperBoss, getLocalCache, setLocalCache, getFastCache, saveFastCache, RTDB_REST_URL } from '../db/database';
import { subscribeResilient, fetchViaRest } from '../db/resilientSync';
import { exportProductsCSV } from '../utils/exportHelpers';
import QRCode from 'react-qr-code';
import TransferRequestModal from '../components/TransferRequestModal';
import IncomingTransferAlertModal from '../components/IncomingTransferAlertModal';
import NetworkDoctorModal from '../components/NetworkDoctorModal';
import { colors, fonts, radius, shadow, formatMoney } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, SectionTitle, FadeIn, ThemeToggleButton } from '../ui';

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const SHOE_SIZES = Array.from({length: 50 - 34 + 1}, (_, i) => (34 + i).toString());
const SUIT_SIZES = Array.from({length: (70 - 38) / 2 + 1}, (_, i) => (38 + i * 2).toString());

const CATEGORIES = ['Chaussure Homme', 'Chaussure Femme', 'Vêtement Homme', 'Vêtement Femme', 'Chemise', 'Veste', 'Costume', 'Costume Soirée', 'Albacost', 'Boubou', 'Pantalon', 'Cravate', 'Chaussette', 'Lunette', 'Ceinture', 'Sac Homme', 'Sac Femme', 'Autre'];

const NO_SIZE_CATEGORIES = ['Cravate', 'Chaussette', 'Lunette', 'Ceinture', 'Sac Homme', 'Sac Femme'];

export default function InventoryScreen({ navigation, route }: any) {
  const r = useResponsive();
  const { colors, isDark } = useAppTheme();
  const filter = route.params?.filter;
  const user = route.params?.user;
  const initialStore = isSuperBoss(user) 
    ? (route.params?.storeId || (user?.store === 'all' ? 'falaise' : (user?.store || 'falaise')))
    : (user?.store || 'falaise');
  const [storeId, setStoreId] = useState(initialStore || 'falaise');
  const [products, setProducts] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [arrivageModal, setArrivageModal] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedQrProduct, setSelectedQrProduct] = useState<any>(null);
  const [transferRequestModalVisible, setTransferRequestModalVisible] = useState(false);
  
  // Formulaire d'ajout produit
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [variants, setVariants] = useState([{ size: '', color: '', stock: '' }]);
  const [reference, setReference] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Formulaire arrivage
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [arrivageQty, setArrivageQty] = useState('');

  // Modal édition produit (boss)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editStock, setEditStock] = useState('');
  const [showEditCategoryPicker, setShowEditCategoryPicker] = useState(false);

  // Nouvelles déclinaisons directes depuis la modale d'édition
  const [newVariantColor, setNewVariantColor] = useState('');
  const [newVariantSize, setNewVariantSize] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('1');
  const [addingVariantLoading, setAddingVariantLoading] = useState(false);

  // Autocomplétion noms d'articles
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [allProductNames, setAllProductNames] = useState<string[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  // Recherche et filtrage
  const [inventorySearchText, setInventorySearchText] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [falaiseCount, setFalaiseCount] = useState(0);
  const [falaiseUnits, setFalaiseUnits] = useState(0);
  const [tougouCount, setTougouCount] = useState(0);
  const [tougouUnits, setTougouUnits] = useState(0);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [doctorModalVisible, setDoctorModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const applyProductsData = (data: any) => {
    if (!data) {
      setProducts(prev => (prev && prev.length > 0 ? prev : []));
      setLoading(false);
      return;
    }
    const allItems = Object.keys(data).map(k => {
      const p = data[k] || {};
      return {
        ...p,
        id: k,
        stock: Math.max(0, parseInt(p.stock, 10) || 0)
      };
    });

    const countF = allItems.filter(p => (p.store || 'falaise').trim().toLowerCase() === 'falaise').length;
    const unitsF = allItems.filter(p => (p.store || 'falaise').trim().toLowerCase() === 'falaise').reduce((sum, p) => sum + p.stock, 0);
    const countT = allItems.filter(p => (p.store || '').trim().toLowerCase() === 'tougou').length;
    const unitsT = allItems.filter(p => (p.store || '').trim().toLowerCase() === 'tougou').reduce((sum, p) => sum + p.stock, 0);
    const unitsTot = allItems.reduce((sum, p) => sum + p.stock, 0);

    setFalaiseCount(countF);
    setFalaiseUnits(unitsF);
    setTougouCount(countT);
    setTougouUnits(unitsT);
    setTotalProductsCount(allItems.length);
    setTotalUnits(unitsTot);

    const targetStore = (storeId || 'falaise').trim().toLowerCase();
    let productsList = allItems.filter(p => {
      if (targetStore === 'all') return true;
      const pStore = (p.store || 'falaise').trim().toLowerCase();
      return pStore === targetStore;
    });
    
    if (filter === 'low_stock') {
      productsList = productsList.filter((p: any) => p.stock <= 3).sort((a: any, b: any) => a.stock - b.stock);
    } else {
      productsList = productsList.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }
    
    setProducts(productsList);
    setLoading(false);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchViaRest('products', 10000);
      if (data) {
        applyProductsData(data);
      }
    } catch (e) {
      console.warn('Manual refresh via HTTPS error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // 1. CHARGEMENT IMMÉDIAT EN 0MS : affiche les articles sauvés sans attendre le réseau
    const cached = getLocalCache('loreal_cache_products') || getLocalCache(`loreal_products_${storeId}`);
    if (cached) {
      applyProductsData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. SOUSCRIPTION RÉSILIENTE : WebSocket + HTTPS REST automatique pour réseaux mobiles MTN/Orange
    const unsubscribe = subscribeResilient(
      'products',
      (data, source) => {
        if (data) {
          applyProductsData(data);
        }
      },
      { cacheKey: 'loreal_cache_products' }
    );

    return () => {
      unsubscribe();
    };
  }, [filter, storeId]);

  useEffect(() => {
    getAllProductNames(storeId || 'falaise').then(names => setAllProductNames(names)).catch(() => {});
  }, [products]);

  const multiCriteriaSearch = (product: any, text: string) => {
    const searchTerms = text.toLowerCase().split(/\s+/).filter(t => t.trim() !== '');
    if (searchTerms.length === 0) return true;

    const pName = (product.name || '').toLowerCase();
    const pNameNoSpace = pName.replace(/\s+/g, '');
    const pRef = (product.reference || '').toLowerCase().replace(/\s+/g, '');
    const pSize = (product.size || '').toLowerCase();
    const pColor = (product.color || '').toLowerCase();
    const pCat = (product.category || '').toLowerCase();
    
    return searchTerms.every(term => {
      const cleanTerm = term.replace(/\s+/g, '');
      return (
        pName.includes(term) ||
        pNameNoSpace.includes(cleanTerm) ||
        pRef.includes(cleanTerm) ||
        pSize.includes(term) ||
        pColor.includes(term) ||
        pCat.includes(term)
      );
    });
  };

  const sections = useMemo(() => {
    let filteredProducts = products;
    
    if (inventorySearchText.trim()) {
      filteredProducts = filteredProducts.filter(p => multiCriteriaSearch(p, inventorySearchText));
    }
    
    const grouped: Record<string, any[]> = {};
    filteredProducts.forEach(p => {
      const cat = p.category || 'Autre';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return Object.keys(grouped).sort().map(cat => {
      const items = grouped[cat];
      const totalUnits = items.reduce((sum: number, p: any) => sum + (Number(p.stock) || 0), 0);
      // Si une recherche est active, ouvrir automatiquement les catégories avec correspondances
      // Sinon, replier par défaut pour fluidité absolue (60 FPS) et éviter tout lag sur mobile
      const isCollapsed = inventorySearchText.trim() ? false : (collapsedSections[cat] ?? true);
      return {
        title: cat,
        variantsCount: items.length,
        count: totalUnits,
        data: isCollapsed ? [] : items
      };
    });
  }, [products, inventorySearchText, collapsedSections]);

  const toggleSection = useCallback((title: string) => {
    setCollapsedSections(prev => {
      const current = prev[title] ?? true;
      return {
        ...prev,
        [title]: !current
      };
    });
  }, []);

  const expandAllSections = useCallback(() => {
    const allExpanded: Record<string, boolean> = {};
    products.forEach(p => {
      const cat = p.category || 'Autre';
      allExpanded[cat] = false;
    });
    setCollapsedSections(allExpanded);
  }, [products]);

  const collapseAllSections = useCallback(() => {
    const allCollapsed: Record<string, boolean> = {};
    products.forEach(p => {
      const cat = p.category || 'Autre';
      allCollapsed[cat] = true;
    });
    setCollapsedSections(allCollapsed);
  }, [products]);

  const handleAddProduct = async () => {
    const finalCategory = category === 'Autre' && customCategory.trim() !== '' ? customCategory.trim() : category;

    if (!name || !finalCategory || !price) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Veuillez remplir le nom, la catégorie et le prix.');
      else Alert.alert('Erreur', 'Veuillez remplir le nom, la catégorie et le prix.');
      return;
    }
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Le prix doit être un nombre valide.');
      else Alert.alert('Erreur', 'Le prix doit être un nombre valide.');
      return;
    }

    const validVariants = variants.filter(v => v.stock.trim() !== '');
    if (validVariants.length === 0) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Veuillez indiquer au moins une quantité en stock.');
      else Alert.alert('Erreur', 'Veuillez indiquer au moins une quantité en stock.');
      return;
    }

    const savedName = name;
    const targetStore = storeId === 'all' ? (user?.store && user.store !== 'all' ? user.store : 'falaise') : storeId;

    setIsAddingProduct(true);
    try {
      for (const v of validVariants) {
        const initialStock = parseInt(v.stock, 10) || 0;
        await addProduct(
          savedName,
          finalCategory,
          priceValue,
          (v.size || '').trim(),
          (v.color || '').trim(),
          reference,
          initialStock,
          targetStore
        );
      }

      // Recharger immédiatement la liste d'articles à l'écran (0ms)
      const updatedCache = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
      if (updatedCache) {
        applyProductsData(updatedCache);
      }

      setModalVisible(false);
      resetForm();

      const successMsg = `✓ "${savedName}" (${validVariants.length} déclinaison${validVariants.length > 1 ? 's' : ''}) enregistré avec succès !`;
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(successMsg);
      } else {
        Alert.alert('Succès', successMsg);
      }
    } catch (e: any) {
      console.error('Erreur addProduct:', e);
      const errMsg = 'Erreur lors de l\'enregistrement : ' + (e?.message || 'Veuillez réessayer');
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(errMsg);
      } else {
        Alert.alert('Erreur', errMsg);
      }
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (text.trim().length >= 1) {
      const filtered = allProductNames.filter(n => n.toLowerCase().includes(text.toLowerCase()));
      setNameSuggestions(filtered);
      setShowNameSuggestions(filtered.length > 0);
    } else {
      setShowNameSuggestions(false);
      setNameSuggestions([]);
    }
  };

  const selectNameSuggestion = (suggestion: string) => {
    setName(suggestion);
    setShowNameSuggestions(false);
    setNameSuggestions([]);
  };

  const openEditModal = (product: any) => {
    setEditProduct(product);
    setEditName(product.name || '');
    setEditCategory(CATEGORIES.includes(product.category) ? product.category : 'Autre');
    setEditCustomCategory(CATEGORIES.includes(product.category) ? '' : (product.category || ''));
    setEditPrice(product.price?.toString() || '');
    setEditSize(product.size || '');
    setEditColor(product.color || '');
    setEditReference(product.reference || '');
    setEditStock(product.stock?.toString() || '0');
    setNewVariantColor('');
    setNewVariantSize('');
    setNewVariantStock('1');
    setShowEditCategoryPicker(false);
    setEditModalVisible(true);
  };

  const handleAddNewVariantToProduct = async () => {
    if (!editProduct) return;
    const finalCategory = editCategory === 'Autre' && editCustomCategory.trim() !== '' ? editCustomCategory.trim() : editCategory;
    const priceValue = parseFloat(editPrice) || editProduct.price || 0;
    const stockQty = parseInt(newVariantStock, 10);
    if (isNaN(stockQty) || stockQty < 0) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Veuillez entrer une quantité/stock valide.');
      else Alert.alert('Erreur', 'Veuillez entrer une quantité/stock valide.');
      return;
    }
    const colorTrimmed = newVariantColor.trim();
    if (!colorTrimmed) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Veuillez préciser le nom de la couleur (ex: Bleu Crocco, Noir...).');
      else Alert.alert('Erreur', 'Veuillez préciser le nom de la couleur.');
      return;
    }
    const targetStore = editProduct.store || (storeId === 'all' ? 'falaise' : storeId);
    setAddingVariantLoading(true);
    try {
      await addProduct(
        editName.trim() || editProduct.name,
        finalCategory,
        priceValue,
        newVariantSize.trim(),
        colorTrimmed,
        editReference.trim() || editProduct.reference || '',
        stockQty,
        targetStore
      );
      setNewVariantColor('');
      setNewVariantSize('');
      setNewVariantStock('1');
      // Recharger immédiatement la vue (0ms)
      const updatedCache = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
      if (updatedCache) {
        applyProductsData(updatedCache);
      }

      if (typeof window !== 'undefined' && window.alert) {
        window.alert(`Déclinaison "${colorTrimmed}" (${stockQty} pcs) ajoutée avec succès au catalogue !`);
      } else {
        Alert.alert('Succès', `Déclinaison "${colorTrimmed}" (${stockQty} pcs) ajoutée avec succès !`);
      }
    } catch (e) {
      console.error('Erreur ajout variante:', e);
      if (typeof window !== 'undefined' && window.alert) window.alert('Erreur lors de l\'ajout de la variante.');
      else Alert.alert('Erreur', 'Impossible d\'ajouter la variante.');
    } finally {
      setAddingVariantLoading(false);
    }
  };

  const handleEditProduct = async () => {
    if (!editProduct) return;
    const finalCategory = editCategory === 'Autre' && editCustomCategory.trim() !== '' ? editCustomCategory.trim() : editCategory;
    if (!editName || !finalCategory || !editPrice) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Veuillez remplir le nom, la catégorie et le prix.');
      else Alert.alert('Erreur', 'Veuillez remplir le nom, la catégorie et le prix.');
      return;
    }
    const priceValue = parseFloat(editPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Le prix doit être un nombre valide.');
      else Alert.alert('Erreur', 'Le prix doit être un nombre valide.');
      return;
    }
    const stockValue = parseInt(editStock, 10);
    if (isNaN(stockValue) || stockValue < 0) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Le stock doit être un nombre valide.');
      else Alert.alert('Erreur', 'Le stock doit être un nombre valide.');
      return;
    }
    try {
      await updateProduct(editProduct.id, {
        name: editName,
        category: finalCategory,
        price: priceValue,
        size: editSize,
        color: editColor,
        reference: editReference,
        stock: stockValue
      });

      // Recharger immédiatement la vue (0ms)
      const updatedCache = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
      if (updatedCache) {
        applyProductsData(updatedCache);
      }

      setEditModalVisible(false);
      if (typeof window !== 'undefined' && window.alert) window.alert(`Produit "${editName}" modifié avec succès.`);
      else Alert.alert('Succès', `Produit "${editName}" modifié avec succès.`);
    } catch (e) {
      console.error('Erreur updateProduct:', e);
      if (typeof window !== 'undefined' && window.alert) window.alert('Erreur lors de la modification du produit.');
      else Alert.alert('Erreur', 'Impossible de modifier le produit.');
    }
  };

  const handleArrivage = async () => {
    if (!selectedProduct || !arrivageQty) return;
    const qty = parseInt(arrivageQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide.');
      return;
    }
    try {
      await recordArrivage(selectedProduct.id, selectedProduct.name, qty, user?.name || 'Inconnu', storeId);
      
      // Recharger immédiatement la vue (0ms)
      const updatedCache = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
      if (updatedCache) {
        applyProductsData(updatedCache);
      }

      setArrivageModal(false);
      setSelectedProduct(null);
      setArrivageQty('');
      Alert.alert('Arrivage enregistré', `+${qty} unités ajoutées au stock de "${selectedProduct.name}".`);
    } catch (e) {
      console.error('Erreur arrivage:', e);
      Alert.alert('Erreur', 'Impossible de mettre à jour le stock.');
    }
  };

  const handleDelete = async (id: string) => {
    const doDelete = async () => {
      try {
        await fetch(`${RTDB_REST_URL}/products/${id}.json`, { method: 'DELETE' }).catch(() => {});
        await remove(ref(db, `products/${id}`)).catch(() => {});
        const cached = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products') || {};
        delete cached[id];
        saveFastCache('loreal_cache_products', cached);
        applyProductsData(cached);
      } catch (err) {
        console.error('Erreur suppression:', err);
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Voulez-vous vraiment supprimer ce produit ?')) {
        await doDelete();
      }
      return;
    }

    Alert.alert('Confirmation', 'Supprimer ce produit ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: doDelete }
    ]);
  };

  const resetForm = () => {
    setName(''); setCategory(''); setCustomCategory(''); setPrice(''); setVariants([{ size: '', color: '', stock: '' }]); setReference('');
    setShowCategoryPicker(false);
  };

  const needsSize = true; // Permet la saisie de la taille pour toutes les catégories (y compris Autre et créations sur-mesure)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgElevated, borderBottomColor: colors.border }]}>
        {/* Ligne 1 : Navigation Retour + Titre Principal (Largeur complète) */}
        <View style={styles.headerTopBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.border }]}>
            <ArrowLeft color={colors.textPrimary} size={18} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={[styles.screenEyebrow, { color: colors.gold }]} numberOfLines={1}>
              CATALOGUE & DISPONIBILITÉS
            </Text>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {filter === 'low_stock' ? 'Alertes Stock Critique' : 'Gestion des Stocks'}
            </Text>
          </View>

          {/* Bouton Ajouter accessible immédiatement en haut sans aucun défilement */}
          <TouchableOpacity 
            style={[styles.goldAddBtnHeader, { backgroundColor: colors.gold }]} 
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Ajouter un article"
          >
            <Plus color={colors.onGold} size={16} />
            <Text style={[styles.goldAddBtnText, { color: colors.onGold }]}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* Ligne 2 : Actions Rapides Déroulantes Horizontalement (Ajouter + Transfert + Export CSV + Réseau) */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.headerActionsToolbarScroll}
        >
          <TouchableOpacity 
            style={[styles.headerActionPill, { borderColor: colors.gold, backgroundColor: colors.goldSoft }]} 
            onPress={() => setModalVisible(true)}
            accessibilityLabel="Ajouter un article"
          >
            <Plus color={colors.gold} size={15} />
            <Text style={[styles.headerActionPillText, { color: colors.gold, fontWeight: '800' }]}>+ Nouvel Article</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.headerActionPill, { borderColor: colors.borderGold, backgroundColor: colors.surface }]} 
            onPress={() => setTransferRequestModalVisible(true)}
            accessibilityLabel="Demande de Transfert"
          >
            <Package color={colors.gold} size={15} />
            <Text style={[styles.headerActionPillText, { color: colors.goldLight }]}>Transfert</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.headerActionPill, { borderColor: colors.border, backgroundColor: colors.surface }]} 
            onPress={() => exportProductsCSV(products, storeId)}
            accessibilityLabel="Exporter en CSV"
          >
            <Download color={colors.textSecondary} size={15} />
            <Text style={[styles.headerActionPillText, { color: colors.textSecondary }]}>Export CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.headerActionPill, { borderColor: 'rgba(56, 189, 248, 0.3)', backgroundColor: 'rgba(56, 189, 248, 0.08)' }]} 
            onPress={() => setDoctorModalVisible(true)}
            accessibilityLabel="Docteur Réseau Cameroun"
          >
            <RefreshCw color="#38BDF8" size={14} />
            <Text style={[styles.headerActionPillText, { color: '#38BDF8' }]}>Réseau</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Store Selector — Défilement fluide sans écrasement */}
        {isSuperBoss(user) ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storeSelectorScroll}
          >
            <TouchableOpacity 
              style={[
                styles.storePill,
                {
                  backgroundColor: storeId === 'falaise' ? colors.pillActiveBg : colors.pillInactiveBg,
                  borderColor: storeId === 'falaise' ? colors.borderGold : colors.pillInactiveBorder,
                }
              ]}
              onPress={() => setStoreId('falaise')}
            >
              <Store color={storeId === 'falaise' ? colors.pillActiveText : colors.gold} size={15} style={{ marginRight: 6 }} />
              <Text style={[
                styles.storePillText,
                { color: storeId === 'falaise' ? colors.pillActiveText : colors.pillInactiveText }
              ]}>
                La Falaise
              </Text>
              <View style={[
                styles.storeCountBadge,
                { backgroundColor: storeId === 'falaise' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)' }
              ]}>
                <Text style={[
                  styles.storeCountText,
                  { color: storeId === 'falaise' ? colors.pillActiveText : colors.pillInactiveText }
                ]}>
                  {falaiseUnits} pcs · {falaiseCount} réf
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.storePill,
                {
                  backgroundColor: storeId === 'tougou' ? colors.pillActiveBg : colors.pillInactiveBg,
                  borderColor: storeId === 'tougou' ? colors.borderGold : colors.pillInactiveBorder,
                }
              ]}
              onPress={() => setStoreId('tougou')}
            >
              <Store color={storeId === 'tougou' ? colors.pillActiveText : colors.gold} size={15} style={{ marginRight: 6 }} />
              <Text style={[
                styles.storePillText,
                { color: storeId === 'tougou' ? colors.pillActiveText : colors.pillInactiveText }
              ]}>
                Tougou
              </Text>
              <View style={[
                styles.storeCountBadge,
                { backgroundColor: storeId === 'tougou' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)' }
              ]}>
                <Text style={[
                  styles.storeCountText,
                  { color: storeId === 'tougou' ? colors.pillActiveText : colors.pillInactiveText }
                ]}>
                  {tougouUnits} pcs · {tougouCount} réf
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.storePill,
                {
                  backgroundColor: storeId === 'all' ? colors.pillActiveBg : colors.pillInactiveBg,
                  borderColor: storeId === 'all' ? colors.borderGold : colors.pillInactiveBorder,
                }
              ]}
              onPress={() => setStoreId('all')}
            >
              <Layers color={storeId === 'all' ? colors.pillActiveText : colors.gold} size={15} style={{ marginRight: 6 }} />
              <Text style={[
                styles.storePillText,
                { color: storeId === 'all' ? colors.pillActiveText : colors.pillInactiveText }
              ]}>
                Tout
              </Text>
              <View style={[
                styles.storeCountBadge,
                { backgroundColor: storeId === 'all' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)' }
              ]}>
                <Text style={[
                  styles.storeCountText,
                  { color: storeId === 'all' ? colors.pillActiveText : colors.pillInactiveText }
                ]}>
                  {totalUnits} pcs · {totalProductsCount} réf
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={[styles.storeSingleBadge, { backgroundColor: colors.goldSoft, borderColor: colors.borderGold }]}>
            <Store color={colors.gold} size={15} style={{ marginRight: 6 }} />
            <Text style={[styles.storeSingleBadgeText, { color: colors.gold }]}>
              {storeId === 'tougou' ? 'Stock Tougou' : 'Stock La Falaise'} — {products.reduce((s, p) => s + (Number(p.stock) || 0), 0)} pièces ({products.length} références)
            </Text>
          </View>
        )}

        {/* Search Bar avec contraste élevé */}
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search color={colors.gold} size={16} />
          <TextInput
            style={[styles.searchInput, { color: colors.inputText }]}
            placeholder="Rechercher par nom, taille, couleur, référence..."
            placeholderTextColor={colors.inputPlaceholder}
            value={inventorySearchText}
            onChangeText={setInventorySearchText}
          />
          {inventorySearchText.length > 0 && (
            <TouchableOpacity onPress={() => setInventorySearchText('')} style={{ padding: 4 }}>
              <X color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          )}
        </View>

        {/* Barre de contrôle du déroulement des catégories */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={expandAllSections}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldSoft, borderColor: colors.borderGold, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}
            >
              <ChevronDown color={colors.gold} size={14} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '700' }}>Tout Dérouler</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={collapseAllSections}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderColor: colors.border, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}
            >
              <ChevronRight color={colors.textSecondary} size={14} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>Tout Réduire</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
            {products.length} réf · {products.reduce((s, p) => s + (p.stock || 0), 0)} pcs
          </Text>
        </View>
      </View>

      {/* Sections and Items */}
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={(item, index) => (item.id ? String(item.id) : `prod-${item.name}-${index}`)}
        contentContainerStyle={[
          styles.listContainer, 
          r.isWide && styles.listContainerWide,
          { paddingBottom: 180 }
        ]}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={Platform.OS === 'web' ? 5 : 7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS !== 'web'}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity onPress={() => toggleSection(section.title)} activeOpacity={0.7} style={styles.sectionHeaderBtn}>
            <View style={[styles.sectionHeader, { backgroundColor: isDark ? '#161625' : '#FFFFFF', borderColor: colors.borderGold, borderLeftWidth: 3, borderLeftColor: colors.gold }]}>
              <View style={styles.sectionTitleRow}>
                {(inventorySearchText.trim() ? false : (collapsedSections[section.title] ?? true)) ? 
                  <ChevronRight color={colors.gold} size={18} /> : 
                  <ChevronDown color={colors.gold} size={18} />
                }
                <Text style={[styles.sectionTitle, { color: colors.gold }]}>{section.title}</Text>
              </View>
              <View style={[styles.sectionStatsBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(166,124,30,0.1)' }]}>
                <Text style={[styles.sectionStatsText, { color: colors.textSecondary }]}>
                  {section.variantsCount} réf · {section.count} unité{section.count > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        renderItem={({ item }) => {
          const isCritical = (Number(item.stock) || 0) <= 3;
          return (
            <View style={[
              styles.productCard,
              {
                backgroundColor: isDark ? '#14141E' : '#FFFFFF',
                borderColor: isCritical ? colors.danger : (isDark ? 'rgba(212,175,55,0.18)' : 'rgba(0,0,0,0.08)'),
                borderWidth: 1,
              },
              isCritical && styles.productCardCritical
            ]}>
              <View style={styles.productTopRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.productName, { color: colors.textPrimary }]}>{item.name}</Text>
                  <View style={styles.tagGroup}>
                    <View style={[styles.tagPill, { backgroundColor: isDark ? '#1C1C2C' : '#EDE7DC', borderColor: colors.border }]}>
                      <Text style={[styles.tagPillText, { color: colors.textSecondary }]}>{item.category}</Text>
                    </View>
                    {item.size ? (
                      <View style={[styles.tagPill, { backgroundColor: isDark ? '#1C1C2C' : '#EDE7DC', borderColor: colors.border }]}>
                        <Text style={[styles.tagPillText, { color: colors.textSecondary }]}>T. {item.size}</Text>
                      </View>
                    ) : null}
                    {item.color ? (
                      <View style={[styles.tagPill, { backgroundColor: isDark ? '#1C1C2C' : '#EDE7DC', borderColor: colors.border }]}>
                        <Text style={[styles.tagPillText, { color: colors.textSecondary }]}>{item.color}</Text>
                      </View>
                    ) : null}
                    {item.reference ? (
                      <View style={[styles.tagPill, { backgroundColor: colors.goldSoft, borderColor: colors.borderGold }]}>
                        <Text style={[styles.tagPillText, { color: colors.gold, fontWeight: '700' }]}>Réf: {item.reference}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.productRightCol}>
                  <Text style={[styles.productPriceText, { color: colors.gold }]}>{formatMoney(item.price)} FCFA</Text>
                  <View style={[
                    styles.stockPill,
                    isCritical ? styles.stockPillCritical : { backgroundColor: isDark ? '#1C1C2C' : '#EDE7DC', borderColor: colors.border }
                  ]}>
                    {isCritical && <AlertTriangle color={colors.danger} size={12} style={{ marginRight: 4 }} />}
                    <Text style={[styles.stockPillText, { color: isCritical ? colors.danger : colors.textPrimary }]}>
                      Stock : {item.stock}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Card Action Bar */}
              <View style={[styles.cardActionsRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                <TouchableOpacity 
                  onPress={() => { setSelectedQrProduct(item); setQrModalVisible(true); }} 
                  style={[styles.cardActionBtn, { backgroundColor: isDark ? '#1A1A28' : '#EDE7DC', borderColor: colors.border }]}
                >
                  <QrCode color={colors.textPrimary} size={15} />
                  <Text style={[styles.cardActionBtnText, { color: colors.textPrimary }]}>QR</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => { setSelectedProduct(item); setArrivageModal(true); }} 
                  style={[styles.cardActionBtn, { backgroundColor: colors.goldSoft, borderColor: colors.borderGold }]}
                >
                  <PackagePlus color={colors.gold} size={15} />
                  <Text style={[styles.cardActionBtnText, { color: colors.gold, fontWeight: '700' }]}>Arrivage</Text>
                </TouchableOpacity>

                {isUserAdmin(user) && (
                  <TouchableOpacity 
                    onPress={() => openEditModal(item)} 
                    style={[styles.cardActionBtn, { backgroundColor: isDark ? '#1A1A28' : '#EDE7DC', borderColor: colors.border }]}
                  >
                    <Edit3 color={colors.textPrimary} size={15} />
                    <Text style={[styles.cardActionBtnText, { color: colors.textPrimary }]}>Modifier</Text>
                  </TouchableOpacity>
                )}

                {isUserAdmin(user) && (
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.cardActionBtn, styles.cardDeleteBtn]}>
                    <Trash2 color={colors.danger} size={15} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Synchronisation du stock en direct...</Text>
            </View>
          ) : (
            <GlassCard style={styles.emptyBox}>
              <Package color={colors.textTertiary} size={44} />
              <Text style={styles.emptyTitle}>Aucun article trouvé</Text>
              <Text style={styles.emptySubtitle}>Ajoutez un nouvel article ou modifiez vos filtres de recherche.</Text>
            </GlassCard>
          )
        }
      />

      {/* Modal Arrivage */}
      <Modal visible={arrivageModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 420, alignSelf: 'center' }]} glow="gold">
            <Text style={styles.modalEyebrow}>RÉAPPROVISIONNEMENT</Text>
            <Text style={styles.modalTitle}>Entrée de Stock</Text>
            <Text style={styles.modalSubheading}>{selectedProduct?.name}</Text>
            <Text style={styles.modalSubInfo}>Stock en rayon : {selectedProduct?.stock} unités</Text>

            <Text style={styles.fieldLabel}>Quantité Reçue</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: 12" 
              placeholderTextColor={colors.textTertiary} 
              keyboardType="numeric" 
              value={arrivageQty} 
              onChangeText={setArrivageQty} 
              autoFocus
            />

            <View style={{ gap: 8, marginTop: 15 }}>
              <GoldButton 
                label="Valider l'Arrivage"
                onPress={handleArrivage}
                size="md"
                icon={<PackagePlus color="#07070A" size={16} />}
              />
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setArrivageModal(false)}>
                <Text style={styles.modalCancelBtnText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal QR Code */}
      <Modal visible={qrModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 420, alignSelf: 'center', alignItems: 'center' }]} glow="gold">
            <Text style={styles.modalEyebrow}>ÉTIQUETTE CODE-BARRES</Text>
            <Text style={styles.modalTitle}>QR Code Article</Text>
            {selectedQrProduct && (
              <>
                <Text style={styles.qrProductName}>{selectedQrProduct.name}</Text>
                <Text style={styles.qrProductMeta}>
                  {selectedQrProduct.category} {selectedQrProduct.size ? `• Taille: ${selectedQrProduct.size}` : ''}
                </Text>
                
                {/* Print container */}
                {/* @ts-ignore */}
                <div id="qr-print-zone" style={{ backgroundColor: '#fff', padding: 18, borderRadius: 12, marginBottom: 16 }}>
                  <QRCode 
                    value={selectedQrProduct.barcode || selectedQrProduct.id} 
                    size={180}
                    level="M"
                  />
                  {/* @ts-ignore */}
                  <p className="qr-label-name" style={{ margin: '8px 0 2px', textAlign: 'center', fontWeight: 'bold', fontSize: 13, color: '#000' }}>
                    {selectedQrProduct.name}
                  </p>
                  {/* @ts-ignore */}
                  <p className="qr-label-price" style={{ margin: 0, textAlign: 'center', fontSize: 11, color: '#333' }}>
                    {formatMoney(selectedQrProduct.price)} FCFA
                    {selectedQrProduct.size ? ` | T.${selectedQrProduct.size}` : ''}
                  </p>
                </div>
                
                <Text style={styles.qrBarcodeText}>
                  {selectedQrProduct.barcode || selectedQrProduct.id}
                </Text>
              </>
            )}
            
            <View style={{ width: '100%', gap: 8, marginTop: 18 }}>
              <GoldButton 
                label="Imprimer Étiquette"
                onPress={() => {
                  if (typeof window !== 'undefined') {
                    let printStyle = document.getElementById('qr-print-style');
                    if (!printStyle) {
                      printStyle = document.createElement('style');
                      printStyle.id = 'qr-print-style';
                      document.head.appendChild(printStyle);
                    }
                    printStyle.textContent = `
                      @media print {
                        body * { visibility: hidden !important; }
                        #qr-print-zone, #qr-print-zone * { visibility: visible !important; }
                        #qr-print-zone {
                          position: fixed !important;
                          left: 50% !important;
                          top: 50% !important;
                          transform: translate(-50%, -50%) !important;
                          width: 5cm !important;
                          padding: 8px !important;
                          border: 1px dashed #ccc !important;
                          border-radius: 4px !important;
                          text-align: center !important;
                          background: #fff !important;
                        }
                        #qr-print-zone svg {
                          width: 3cm !important;
                          height: 3cm !important;
                        }
                        .qr-label-name {
                          font-size: 10px !important;
                          font-weight: bold !important;
                          margin: 4px 0 1px !important;
                        }
                        .qr-label-price {
                          font-size: 8px !important;
                          margin: 0 !important;
                        }
                        @page {
                          size: 5cm 4cm;
                          margin: 0;
                        }
                      }
                    `;
                    window.print();
                  }
                }}
                size="md"
                icon={<Printer color="#07070A" size={16} />}
              />
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setQrModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Ajouter Produit */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView 
            style={{ width: '100%', flex: 1 }} 
            keyboardShouldPersistTaps="handled" 
            contentContainerStyle={styles.modalScroll}
          >
            <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 520, alignSelf: 'center' }]} glow="gold">
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalEyebrow}>NOUVELLE ENTRÉE CATALOGUE</Text>
                  <Text style={styles.modalTitle}>Créer un Article</Text>
                </View>
                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} style={styles.modalCloseBtn}>
                  <X color={colors.textSecondary} size={18} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Nom de l'article *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: Chemise col rond, Mocassin classique..." 
                placeholderTextColor={colors.textTertiary} 
                value={name} 
                onChangeText={handleNameChange} 
              />
              {showNameSuggestions && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                    {nameSuggestions.map((suggestion, idx) => (
                      <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectNameSuggestion(suggestion)}>
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.fieldLabel}>Catégorie *</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                <Text style={{ color: category ? colors.textPrimary : colors.textTertiary, fontFamily: fonts.sans, fontSize: 13 }}>
                  {category || 'Sélectionnez une catégorie'}
                </Text>
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.pickerContainer}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity 
                      key={cat} 
                      style={[styles.pickerItem, category === cat && styles.pickerItemActive]} 
                      onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, category === cat && styles.pickerItemTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {category === 'Autre' && (
                <TextInput 
                  style={[styles.input, { marginTop: 6 }]} 
                  placeholder="Précisez la catégorie..." 
                  placeholderTextColor={colors.textTertiary} 
                  value={customCategory} 
                  onChangeText={setCustomCategory} 
                  autoCorrect={false} 
                />
              )}

              <Text style={styles.fieldLabel}>Prix de vente (FCFA) *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: 15000" 
                placeholderTextColor={colors.textTertiary} 
                keyboardType="numeric" 
                value={price} 
                onChangeText={setPrice} 
              />

              {/* Variantes */}
              <Text style={styles.fieldLabel}>Déclinaisons (Taille, Couleur, Quantité)</Text>
              {variants.map((variant, index) => (
                <View key={index} style={styles.variantRow}>
                  {needsSize && (
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <TextInput 
                        style={styles.variantInput} 
                        placeholder="Taille (42, L...)" 
                        placeholderTextColor={colors.textTertiary} 
                        value={variant.size} 
                        onChangeText={(val) => {
                          const newV = [...variants];
                          newV[index].size = val;
                          setVariants(newV);
                        }} 
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput 
                      style={styles.variantInput} 
                      placeholder="Couleur (Noir...)" 
                      placeholderTextColor={colors.textTertiary} 
                      value={variant.color} 
                      onChangeText={(val) => {
                        const newV = [...variants];
                        newV[index].color = val;
                        setVariants(newV);
                      }} 
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: index > 0 ? 8 : 0 }}>
                    <TextInput 
                      style={styles.variantInput} 
                      placeholder="Qté" 
                      placeholderTextColor={colors.textTertiary} 
                      keyboardType="numeric"
                      value={variant.stock} 
                      onChangeText={(val) => {
                        const newV = [...variants];
                        newV[index].stock = val;
                        setVariants(newV);
                      }} 
                    />
                  </View>
                  {index > 0 && (
                    <TouchableOpacity 
                      style={styles.variantRemoveBtn} 
                      onPress={() => {
                        const newV = [...variants];
                        newV.splice(index, 1);
                        setVariants(newV);
                      }}
                    >
                      <Trash2 color={colors.danger} size={16} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity 
                style={styles.addVariantBtn}
                onPress={() => setVariants([...variants, { size: '', color: '', stock: '' }])}
              >
                <Plus color={colors.gold} size={15} style={{ marginRight: 6 }} />
                <Text style={styles.addVariantBtnText}>Ajouter une autre variante</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Référence Code Produit (optionnel)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: REF-LC-2026" 
                placeholderTextColor={colors.textTertiary} 
                value={reference} 
                onChangeText={setReference} 
              />

              <View style={{ gap: 8, marginTop: 15 }}>
                <GoldButton 
                  label={isAddingProduct ? "Enregistrement en cours..." : "Créer l'Article"}
                  onPress={handleAddProduct}
                  disabled={isAddingProduct}
                  size="lg"
                  icon={isAddingProduct ? <ActivityIndicator size="small" color="#07070A" /> : <Check color="#07070A" size={18} />}
                />
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Text style={styles.modalCancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Modifier Produit */}
      <Modal visible={editModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView 
            style={{ width: '100%', flex: 1 }} 
            keyboardShouldPersistTaps="handled" 
            contentContainerStyle={styles.modalScroll}
          >
            <GlassCard style={[styles.modalCard, { width: '100%', maxWidth: 520, alignSelf: 'center' }]} glow="gold">
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalEyebrow}>ADMINISTRATION</Text>
                  <Text style={styles.modalTitle}>Modifier le Produit</Text>
                </View>
                <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                  <X color={colors.textSecondary} size={18} />
                </TouchableOpacity>
              </View>

              <View style={{ backgroundColor: 'rgba(212, 175, 55, 0.08)', padding: 12, borderRadius: radius.sm, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.25)' }}>
                <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>
                  MODIFIER CETTE DÉCLINAISON
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Modifiez directement le nom de la couleur, la taille, la référence ou les unités de stock.
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Nom de l'article *</Text>
              <TextInput style={styles.input} value={editName} onChangeText={setEditName} />

              <Text style={styles.fieldLabel}>Catégorie *</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowEditCategoryPicker(!showEditCategoryPicker)}>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{editCategory}</Text>
              </TouchableOpacity>
              {showEditCategoryPicker && (
                <View style={styles.pickerContainer}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity 
                      key={cat} 
                      style={[styles.pickerItem, editCategory === cat && styles.pickerItemActive]} 
                      onPress={() => { setEditCategory(cat); setShowEditCategoryPicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, editCategory === cat && styles.pickerItemTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {editCategory === 'Autre' && (
                <TextInput 
                  style={[styles.input, { marginTop: 6 }]} 
                  placeholder="Précisez la catégorie..." 
                  placeholderTextColor={colors.textTertiary} 
                  value={editCustomCategory} 
                  onChangeText={setEditCustomCategory} 
                  autoCorrect={false} 
                />
              )}

              <Text style={styles.fieldLabel}>Prix de vente (FCFA) *</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={editPrice} onChangeText={setEditPrice} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Couleur exacte *</Text>
                  <TextInput 
                    style={styles.input} 
                    value={editColor} 
                    onChangeText={setEditColor}
                    placeholder="Ex: Bleu Crocco, Noir..."
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Taille / Pointure</Text>
                  <TextInput 
                    style={styles.input} 
                    value={editSize} 
                    onChangeText={setEditSize}
                    placeholder="Ex: 42, XL, Standard..."
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Référence Modèle</Text>
                  <TextInput style={styles.input} value={editReference} onChangeText={setEditReference} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Unités en Stock *</Text>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric" 
                    value={editStock} 
                    onChangeText={setEditStock}
                    placeholder="Ex: 10"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <View style={{ marginTop: 10, marginBottom: 18 }}>
                <GoldButton 
                  label="Enregistrer les Modifications"
                  onPress={handleEditProduct}
                  size="md"
                  icon={<Check color="#07070A" size={16} />}
                />
              </View>

              {/* SECTION AJOUT NOUVELLE DÉCLINAISON (COULEUR / TAILLE / UNITÉS) */}
              <View style={{ marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(212, 175, 55, 0.3)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Layers color={colors.gold} size={16} />
                  <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 13 }}>
                    AJOUTER UNE NOUVELLE COULEUR OU TAILLE
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 12 }}>
                  Créez instantanément une nouvelle variante pour "{editName}" avec ses propres unités de stock.
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.fieldLabel}>Nouvelle Couleur *</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Ex: Bleu Crocco, Jaune..." 
                      placeholderTextColor={colors.textTertiary}
                      value={newVariantColor} 
                      onChangeText={setNewVariantColor} 
                    />
                  </View>
                  <View style={{ flex: 0.9 }}>
                    <Text style={styles.fieldLabel}>Taille</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Ex: 43, M..." 
                      placeholderTextColor={colors.textTertiary}
                      value={newVariantSize} 
                      onChangeText={setNewVariantSize} 
                    />
                  </View>
                  <View style={{ flex: 0.9 }}>
                    <Text style={styles.fieldLabel}>Unités (Qté) *</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Ex: 5" 
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={newVariantStock} 
                      onChangeText={setNewVariantStock} 
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.addVariantBtn, 
                    { marginTop: 10, borderColor: colors.borderGold, backgroundColor: 'rgba(212, 175, 55, 0.12)', paddingVertical: 10 }
                  ]}
                  onPress={handleAddNewVariantToProduct}
                  disabled={addingVariantLoading}
                >
                  {addingVariantLoading ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <>
                      <Plus color={colors.gold} size={16} style={{ marginRight: 6 }} />
                      <Text style={[styles.addVariantBtnText, { color: colors.goldLight, fontWeight: '700' }]}>
                        + Ajouter cette déclinaison au catalogue
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 16 }]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Fermer</Text>
              </TouchableOpacity>
            </GlassCard>
          </ScrollView>
        </View>
      </Modal>

      {/* Transfer Modals */}
      <TransferRequestModal
        visible={transferRequestModalVisible}
        onClose={() => setTransferRequestModalVisible(false)}
        user={user}
        currentStore={storeId === 'all' ? (user?.store || 'falaise') : storeId}
      />

      <IncomingTransferAlertModal
        user={user}
        currentStore={storeId === 'all' ? (user?.store || 'falaise') : storeId}
      />

      <NetworkDoctorModal
        visible={doctorModalVisible}
        onClose={() => setDoctorModalVisible(false)}
        onForceRefreshDone={handleManualRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  screenEyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.serif,
  },
  goldAddBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    gap: 5,
    flexShrink: 0,
  },
  headerActionsToolbarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 20,
    marginBottom: 12,
  },
  headerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 6,
    flexShrink: 0,
  },
  headerActionPillText: {
    fontSize: 12,
    fontFamily: fonts.sans,
    fontWeight: '700',
  },
  goldAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    gap: 6,
    marginLeft: 'auto',
  },
  goldAddBtnText: {
    color: '#07070A',
    fontWeight: '700',
    fontSize: 12.5,
    fontFamily: fonts.sans,
  },
  storeSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    marginBottom: 12,
  },
  storeSelectorScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
    paddingBottom: 4,
    marginBottom: 12,
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  storePillActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  storePillText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  storePillTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  storeCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: 6,
  },
  storeCountBadgeActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  storeCountText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  storeCountTextActive: {
    color: colors.gold,
  },
  storeSingleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  storeSingleBadgeText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  listContainerWide: {
    paddingHorizontal: 28,
  },
  sectionHeaderBtn: {
    marginTop: 14,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  sectionStatsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  sectionStatsText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  productCard: {
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  productCardCritical: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  tagGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tagPillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  productRightCol: {
    alignItems: 'flex-end',
  },
  productPriceText: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.serif,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  stockPillCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  stockPillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardActionBtnGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  cardActionBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  cardDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
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

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 10,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 6,
    width: '100%',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    padding: 18,
    borderRadius: radius.lg,
    alignSelf: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
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
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.serif,
    marginTop: 2,
  },
  modalSubheading: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: fonts.sans,
  },
  modalSubInfo: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
    marginBottom: 10,
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
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  suggestionsContainer: {
    backgroundColor: '#121217',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  suggestionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginTop: 6,
  },
  pickerItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pickerItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.gold,
  },
  pickerItemText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.sans,
  },
  pickerItemTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  variantInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: colors.textPrimary,
    height: 42,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  variantRemoveBtn: {
    padding: 8,
  },
  addVariantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    marginVertical: 10,
  },
  addVariantBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
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
  qrProductName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
  qrProductMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
  qrBarcodeText: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
