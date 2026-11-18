import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { 
  X, 
  Search, 
  Package, 
  Send, 
  Plus, 
  Minus, 
  Trash2, 
  Store, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  Maximize2
} from 'lucide-react-native';
import { searchOtherStoreProducts, requestTransferStock, isSuperBoss } from '../db/database';
import { playRingToneNow } from '../utils/ringtone';

interface TransferRequestModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  currentStore?: string;
  onSuccess?: () => void;
}

export default function TransferRequestModal({
  visible,
  onClose,
  user,
  currentStore = 'falaise',
  onSuccess
}: TransferRequestModalProps) {
  // Le magasin source (qui possède le stock à demander) :
  // Si on est à La Falaise, on demande à Tougou. Si on est à Tougou, on demande à La Falaise.
  const defaultSourceStore = currentStore === 'falaise' ? 'tougou' : 'falaise';
  const [sourceStore, setSourceStore] = useState<'falaise' | 'tougou'>(defaultSourceStore);
  const [targetStore, setTargetStore] = useState<'falaise' | 'tougou'>(currentStore === 'tougou' ? 'tougou' : 'falaise');

  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allStoreStock, setAllStoreStock] = useState<any[]>([]);
  
  // Panier d'articles demandés
  const [requestedItems, setRequestedItems] = useState<{ [productId: string]: { product: any; quantity: number } }>({});
  const [clientNote, setClientNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      const fromSt = currentStore === 'falaise' ? 'tougou' : 'falaise';
      const toSt = currentStore === 'tougou' ? 'tougou' : 'falaise';
      setSourceStore(fromSt);
      setTargetStore(toSt);
      setSearchQuery('');
      setRequestedItems({});
      setClientNote('');
      loadTargetStock(fromSt);
    }
  }, [visible, currentStore]);

  const loadTargetStock = async (store: 'falaise' | 'tougou') => {
    setLoadingSearch(true);
    try {
      const prods = await searchOtherStoreProducts(store, '');
      setAllStoreStock(prods);
      setSearchResults(prods);
    } catch (e) {
      console.error('Erreur chargement stock cible:', e);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults(allStoreStock);
      return;
    }
    const terms = text.toLowerCase().trim().split(/\s+/);
    const filtered = allStoreStock.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pNameNoSpace = pName.replace(/\s+/g, '');
      const pRef = (p.reference || '').toLowerCase().replace(/\s+/g, '');
      const pSize = (p.size || '').toLowerCase();
      const pColor = (p.color || '').toLowerCase();
      const pCat = (p.category || '').toLowerCase();

      return terms.every(t => {
        const cleanT = t.replace(/\s+/g, '');
        return (
          pName.includes(t) ||
          pNameNoSpace.includes(cleanT) ||
          pRef.includes(cleanT) ||
          pSize.includes(t) ||
          pColor.includes(t) ||
          pCat.includes(t)
        );
      });
    });
    setSearchResults(filtered);
  };

  const addItemToRequest = (product: any) => {
    setRequestedItems(prev => {
      const existing = prev[product.id];
      const currentQty = existing ? existing.quantity : 0;
      const maxStock = Number(product.stock) || 1;
      if (currentQty >= maxStock) {
        const msg = `Stock maximum disponible atteint (${maxStock} en stock).`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Attention', msg);
        return prev;
      }
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: currentQty + 1
        }
      };
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setRequestedItems(prev => {
      const existing = prev[productId];
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      const maxStock = Number(existing.product.stock) || 1;

      if (newQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      if (newQty > maxStock) {
        const msg = `Quantité maximale en stock : ${maxStock} unité(s).`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Stock insuffisant', msg);
        return prev;
      }
      return {
        ...prev,
        [productId]: {
          ...existing,
          quantity: newQty
        }
      };
    });
  };

  const removeItem = (productId: string) => {
    setRequestedItems(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleSubmitRequest = async () => {
    const itemsList = Object.values(requestedItems);
    if (itemsList.length === 0) {
      const msg = 'Veuillez sélectionner au moins un article à demander.';
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      else Alert.alert('Panier vide', msg);
      return;
    }

    setIsSubmitting(true);
    try {
      // Si un seul article
      const firstItem = itemsList[0];
      const itemsPayload = itemsList.map(it => ({
        product_id: it.product.id,
        name: it.product.name,
        reference: it.product.reference || '',
        size: it.product.size || '',
        color: it.product.color || '',
        category: it.product.category || '',
        price: it.product.price || 0,
        barcode: it.product.barcode || '',
        stock: it.product.stock || 0,
        quantity: it.quantity
      }));

      const totalQuantity = itemsList.reduce((sum, it) => sum + it.quantity, 0);

      await requestTransferStock({
        productId: firstItem.product.id,
        productName: firstItem.product.name,
        reference: firstItem.product.reference,
        size: firstItem.product.size,
        color: firstItem.product.color,
        category: firstItem.product.category,
        barcode: firstItem.product.barcode,
        availableStock: firstItem.product.stock,
        price: firstItem.product.price,
        quantity: totalQuantity,
        fromStoreId: sourceStore,
        toStoreId: targetStore,
        requesterId: user?.id || 'vendeur',
        requesterName: user?.name || 'Vendeur',
        note: clientNote,
        items: itemsPayload
      });

      // Déclencher immédiatement la sonnerie téléphonique (garanti sans blocage car action tactile directe)
      try {
        playRingToneNow(5);
      } catch (e) {}

      const srcName = sourceStore === 'falaise' ? 'La Falaise' : 'Tougou';
      const successMsg = `Demande de transfert envoyée avec succès ! La sonnerie téléphonique retentit pour avertir la boutique ${srcName} de préparer l'envoi.`;
      
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(successMsg);
      } else {
        Alert.alert('Demande envoyée !', successMsg);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      const errMsg = e?.message || 'Erreur lors de l\'envoi de la demande.';
      if (typeof window !== 'undefined' && window.alert) window.alert(errMsg);
      else Alert.alert('Erreur', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(requestedItems).length;
  const totalItemsCount = Object.values(requestedItems).reduce((sum, it) => sum + it.quantity, 0);

  const sourceStoreLabel = sourceStore === 'falaise' ? 'La Falaise' : 'Tougou';
  const targetStoreLabel = targetStore === 'falaise' ? 'La Falaise' : 'Tougou';

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.titleIcon}>📦</Text>
                <Text style={styles.headerTitle}>Demande de Transfert Inter-Magasin</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Recherchez et demandez des articles disponibles à <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>{sourceStoreLabel}</Text> pour <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>{targetStoreLabel}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#fff" size={22} />
            </TouchableOpacity>
          </View>

          {/* Switcher magasin source si Boss */}
          {isSuperBoss(user) && (
            <View style={styles.storeSwitcher}>
              <Text style={styles.switchLabel}>Magasin possesseur :</Text>
              <TouchableOpacity 
                style={[styles.switchTab, sourceStore === 'tougou' && styles.switchTabActive]}
                onPress={() => {
                  setSourceStore('tougou');
                  setTargetStore('falaise');
                  loadTargetStock('tougou');
                }}
              >
                <Text style={[styles.switchTabText, sourceStore === 'tougou' && styles.switchTabTextActive]}>Tougou</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.switchTab, sourceStore === 'falaise' && styles.switchTabActive]}
                onPress={() => {
                  setSourceStore('falaise');
                  setTargetStore('tougou');
                  loadTargetStock('falaise');
                }}
              >
                <Text style={[styles.switchTabText, sourceStore === 'falaise' && styles.switchTabTextActive]}>La Falaise</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Barre de Recherche Multi-Critères */}
          <View style={styles.searchContainer}>
            <Search color="#d4af37" size={20} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Réf (ex: 4217), Nom (Macjames), Taille (43), Couleur (Noir)..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')} style={{ padding: 4 }}>
                <X color="#888" size={18} />
              </TouchableOpacity>
            )}
          </View>

          {/* Badge Résumé Résultats */}
          <View style={styles.resultsBadgeRow}>
            <Text style={styles.resultsBadgeText}>
              Stock disponible à {sourceStoreLabel} : <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>{searchResults.reduce((acc, it) => acc + (Number(it.stock) || 0), 0)} pièce(s)</Text> ({searchResults.length} modèles)
            </Text>
            {selectedCount > 0 && (
              <Text style={styles.selectedBadgeText}>
                🛒 {totalItemsCount} article(s) sélectionné(s)
              </Text>
            )}
          </View>

          {/* Liste des Produits Trouvés */}
          <View style={styles.listContainer}>
            {loadingSearch ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#d4af37" />
                <Text style={styles.loadingText}>Recherche du stock à {sourceStoreLabel}...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.centerBox}>
                <AlertCircle color="#666" size={40} />
                <Text style={styles.emptyTitle}>Aucun article trouvé</Text>
                <Text style={styles.emptySubtitle}>
                  Vérifiez l'orthographe de la référence, du nom ou de la taille.
                </Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const inCart = requestedItems[item.id];
                  const requestedQty = inCart ? inCart.quantity : 0;
                  const availableStock = Number(item.stock) || 0;

                  return (
                    <View style={[styles.productCard, inCart && styles.productCardSelected]}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                        
                        {/* Spécifications : Réf, Taille, Couleur */}
                        <View style={styles.specsRow}>
                          {item.reference ? (
                            <View style={styles.specBadgeRef}>
                              <Tag color="#d4af37" size={11} style={{ marginRight: 3 }} />
                              <Text style={styles.specBadgeRefText}>Réf {item.reference}</Text>
                            </View>
                          ) : null}

                          {item.size ? (
                            <View style={styles.specBadge}>
                              <Text style={styles.specBadgeText}>Taille {item.size}</Text>
                            </View>
                          ) : null}

                          {item.color ? (
                            <View style={styles.specBadge}>
                              <Text style={styles.specBadgeText}>{item.color}</Text>
                            </View>
                          ) : null}

                          {item.category ? (
                            <View style={styles.specBadge}>
                              <Text style={styles.specBadgeText}>{item.category}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Stock & Prix */}
                        <View style={styles.bottomInfoRow}>
                          <Text style={styles.stockText}>
                            📦 Disponible : <Text style={styles.stockNumber}>{availableStock}</Text> à {sourceStoreLabel}
                          </Text>
                          {item.price ? (
                            <Text style={styles.priceText}>{Number(item.price).toLocaleString()} FCFA</Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Sélecteur de Quantité */}
                      <View style={styles.actionCol}>
                        {!inCart ? (
                          <TouchableOpacity 
                            style={styles.addBtn}
                            onPress={() => addItemToRequest(item)}
                          >
                            <Plus color="#121212" size={16} />
                            <Text style={styles.addBtnText}>Demander</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.counterRow}>
                            <TouchableOpacity 
                              style={styles.counterBtn}
                              onPress={() => updateQuantity(item.id, -1)}
                            >
                              <Minus color="#fff" size={14} />
                            </TouchableOpacity>
                            <Text style={styles.counterQty}>{requestedQty}</Text>
                            <TouchableOpacity 
                              style={[styles.counterBtn, requestedQty >= availableStock && styles.counterBtnDisabled]}
                              onPress={() => updateQuantity(item.id, 1)}
                              disabled={requestedQty >= availableStock}
                            >
                              <Plus color="#fff" size={14} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>

          {/* Section Récapitulatif Panier & Envoi */}
          {selectedCount > 0 && (
            <View style={styles.footer}>
              {/* Note facultative */}
              <View style={styles.noteBox}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Note pour l'autre magasin (ex: Client attend au magasin Falaise)"
                  placeholderTextColor="#666"
                  value={clientNote}
                  onChangeText={setClientNote}
                />
              </View>

              <View style={styles.footerActionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.footerSummaryTitle}>
                    {totalItemsCount} article{totalItemsCount > 1 ? 's' : ''} à transférer
                  </Text>
                  <Text style={styles.footerSummarySubtitle}>
                    {sourceStoreLabel} ➔ {targetStoreLabel}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                  onPress={handleSubmitRequest}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#121212" />
                  ) : (
                    <>
                      <Send color="#121212" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.submitBtnText}>Envoyer la Demande</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    display: 'flex',
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    fontSize: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  closeBtn: {
    backgroundColor: '#262626',
    padding: 8,
    borderRadius: 20,
  },
  storeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1f1f1f',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 8,
  },
  switchLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  switchTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  switchTabActive: {
    backgroundColor: '#d4af37',
  },
  switchTabText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  switchTabTextActive: {
    color: '#121212',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#383838',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 0,
  },
  resultsBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  resultsBadgeText: {
    color: '#ddd',
    fontSize: 13.5,
    fontWeight: '500',
  },
  selectedBadgeText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#d4af37',
    fontSize: 13,
    marginTop: 10,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#282828',
  },
  productCardSelected: {
    borderColor: '#d4af37',
    backgroundColor: '#221e12',
  },
  productName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  specBadgeRef: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2208',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d4af3760',
  },
  specBadgeRefText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  specBadge: {
    backgroundColor: '#292929',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specBadgeText: {
    color: '#ccc',
    fontSize: 11,
  },
  bottomInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockText: {
    color: '#888',
    fontSize: 12,
  },
  stockNumber: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 13,
  },
  priceText: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: 'bold',
  },
  actionCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#121212',
    fontSize: 12,
    fontWeight: 'bold',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 3,
    gap: 6,
  },
  counterBtn: {
    backgroundColor: '#3a3a3a',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnDisabled: {
    opacity: 0.3,
  },
  counterQty: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: '#1b1b1b',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    padding: 14,
  },
  noteBox: {
    backgroundColor: '#242424',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  noteInput: {
    color: '#fff',
    fontSize: 12,
    padding: 0,
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerSummaryTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footerSummarySubtitle: {
    color: '#d4af37',
    fontSize: 12,
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4af37',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#d4af37',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#121212',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
