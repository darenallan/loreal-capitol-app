import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { PlusCircle, Search, Trash2, X, Check, MessageCircle } from 'lucide-react-native';
import { cleanWhatsAppNumber } from '../../utils/receiptShare';
import { colors, fonts, radius, formatMoney, shadow } from '../../theme';
import { GlassCard, GoldButton } from '../../ui';
import { sharedStyles } from './ledgerStyles';
import { alpha } from '../../theme';

export interface NewSaleModalProps {
  storeId: any;
  setTransferRequestModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  todaySales: any[];
  modalVisible: boolean;
  setModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  loadingProducts: boolean;
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
  selectedProduct: any;
  setSelectedProduct: React.Dispatch<any>;
  quantity: string;
  setQuantity: React.Dispatch<React.SetStateAction<string>>;
  salePrice: string;
  setSalePrice: React.Dispatch<React.SetStateAction<string>>;
  paymentMethod: string;
  setPaymentMethod: React.Dispatch<React.SetStateAction<string>>;
  cart: any[];
  isAdvance: boolean;
  setIsAdvance: React.Dispatch<React.SetStateAction<boolean>>;
  clientName: string;
  setClientName: React.Dispatch<React.SetStateAction<string>>;
  clientPhone: string;
  setClientPhone: React.Dispatch<React.SetStateAction<string>>;
  clientEmail: string;
  setClientEmail: React.Dispatch<React.SetStateAction<string>>;
  amountPaid: string;
  setAmountPaid: React.Dispatch<React.SetStateAction<string>>;
  dueDate: string;
  setDueDate: React.Dispatch<React.SetStateAction<string>>;
  beneficiaryName: string;
  setBeneficiaryName: React.Dispatch<React.SetStateAction<string>>;
  todayFormatted: string;
  selectProduct: (product: any) => void;
  addToCart: () => void;
  removeFromCart: (index: number) => void;
  filteredProducts: any[];
  otherStoreProducts: any[];
  handleInitiateSale: () => Promise<void>;
}

/** Modale « Nouvelle Vente » (recherche article, panier, paiement, avance). */
export default function NewSaleModal({
  storeId,
  setTransferRequestModalVisible,
  todaySales,
  modalVisible,
  setModalVisible,
  loadingProducts,
  searchText,
  setSearchText,
  selectedProduct,
  setSelectedProduct,
  quantity,
  setQuantity,
  salePrice,
  setSalePrice,
  paymentMethod,
  setPaymentMethod,
  cart,
  isAdvance,
  setIsAdvance,
  clientName,
  setClientName,
  clientPhone,
  setClientPhone,
  clientEmail,
  setClientEmail,
  amountPaid,
  setAmountPaid,
  dueDate,
  setDueDate,
  beneficiaryName,
  setBeneficiaryName,
  todayFormatted,
  selectProduct,
  addToCart,
  removeFromCart,
  filteredProducts,
  otherStoreProducts,
  handleInitiateSale,
}: NewSaleModalProps) {
  return (
    <Modal visible={modalVisible} animationType="fade" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <GlassCard style={sharedStyles.modalCard} glow="gold">
            <View style={styles.modalHeader}>
              <View>
                <Text style={sharedStyles.modalEyebrow}>ENREGISTREMENT CAISSE</Text>
                <Text style={sharedStyles.modalTitle}>Nouvelle Vente</Text>
                <Text style={sharedStyles.modalDate}>{todayFormatted} — Vente N°{String(todaySales.length + 1).padStart(3, '0')}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            {/* Recherche Article */}
            <Text style={sharedStyles.fieldLabel}>Article vendu</Text>
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
                <View style={sharedStyles.searchBar}>
                  <Search color={colors.gold} size={16} />
                  <TextInput
                    style={sharedStyles.searchInput}
                    placeholder="Rechercher par nom, couleur, taille ou référence..."
                    placeholderTextColor={colors.textTertiary}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setSearchText('')}>
                      <X color={colors.textTertiary} size={16} />
                    </TouchableOpacity>
                  )}
                </View>
                {searchText.length > 0 && (
                  <View style={styles.searchResultsDropdown}>
                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
                      {filteredProducts.slice(0, 15).map(p => (
                        <TouchableOpacity key={p.id} style={sharedStyles.searchResultItem} onPress={() => selectProduct(p)}>
                          <View style={{ flex: 1 }}>
                            <Text style={sharedStyles.searchResultName}>{p.name}</Text>
                            <Text style={sharedStyles.searchResultInfo}>
                              {p.category}
                              {p.size ? ` • T: ${p.size}` : ''}
                              {p.color ? ` • C: ${p.color}` : ''}
                              {p.reference ? ` • Réf: ${p.reference}` : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.searchResultPrice}>{formatMoney(p.price)} F</Text>
                            <Text style={sharedStyles.searchResultStock}>Stock: {p.stock}</Text>
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
                                <View style={{ marginTop: 12, padding: 10, backgroundColor: alpha(colors.gold, 0.1), borderRadius: radius.sm, borderWidth: 1, borderColor: alpha(colors.gold, 0.3) }}>
                                  <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
                                    📍 Disponible à {storeId === 'falaise' ? 'Tougou' : 'La Falaise'} ({otherStoreProducts.reduce((s, p) => s + p.stock, 0)} unité{otherStoreProducts.reduce((s, p) => s + p.stock, 0) > 1 ? 's' : ''}) :
                                  </Text>
                                  {otherStoreProducts.slice(0, 3).map(op => (
                                    <Text key={op.id} style={{ color: colors.textSecondary, fontSize: 12, marginVertical: 1 }}>
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
                                    <Text style={{ color: colors.onGold, fontSize: 12, fontWeight: '700' }}>
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
                <Text style={sharedStyles.fieldLabel}>Quantité</Text>
                <TextInput 
                  style={sharedStyles.input} 
                  keyboardType="numeric" 
                  value={quantity} 
                  onChangeText={setQuantity} 
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={sharedStyles.fieldLabel}>Prix de vente (FCFA)</Text>
                <TextInput 
                  style={sharedStyles.input} 
                  keyboardType="numeric" 
                  value={salePrice} 
                  onChangeText={setSalePrice} 
                />
              </View>
            </View>

            {/* Moyen de paiement */}
            <Text style={sharedStyles.fieldLabel}>Moyen de paiement</Text>
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
                <Text style={sharedStyles.fieldLabel}>Bénéficiaire du don (Obligatoire)</Text>
                <TextInput 
                  style={sharedStyles.input} 
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

                <Text style={sharedStyles.fieldLabel}>Nom du client *</Text>
                <TextInput 
                  style={sharedStyles.input} 
                  placeholder="Ex: M. Dupont" 
                  placeholderTextColor={colors.textTertiary} 
                  value={clientName} 
                  onChangeText={setClientName} 
                />

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={sharedStyles.fieldLabel}>N° WhatsApp (Direct)</Text>
                    <TextInput 
                      style={sharedStyles.input} 
                      placeholder="Ex: 699932024" 
                      placeholderTextColor={colors.textTertiary} 
                      keyboardType="phone-pad"
                      value={clientPhone} 
                      onChangeText={setClientPhone} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={sharedStyles.fieldLabel}>Email (Optionnel)</Text>
                    <TextInput 
                      style={sharedStyles.input} 
                      placeholder="Ex: client@gmail.com" 
                      placeholderTextColor={colors.textTertiary} 
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={clientEmail} 
                      onChangeText={setClientEmail} 
                    />
                  </View>
                </View>

                <Text style={sharedStyles.fieldLabel}>Moyen de paiement du premier acompte</Text>
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
                    <Text style={sharedStyles.fieldLabel}>Montant versé (0 si rien versé)</Text>
                    <TextInput 
                      style={sharedStyles.input} 
                      placeholder="Ex: 0 ou 50000" 
                      placeholderTextColor={colors.textTertiary} 
                      keyboardType="numeric" 
                      value={amountPaid} 
                      onChangeText={setAmountPaid} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={sharedStyles.fieldLabel}>Échéance solde *</Text>
                    <TextInput 
                      style={sharedStyles.input} 
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
              <View style={{ marginTop: 14, backgroundColor: alpha(colors.gold, 0.05), padding: 14, borderRadius: 12, borderWidth: 1, borderColor: alpha(colors.gold, 0.25), gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MessageCircle color={colors.gold} size={16} />
                    <Text style={{ color: colors.goldLight, fontSize: 13, fontWeight: '700' }}>
                      Facture Client (Envoi Direct WhatsApp / Email)
                    </Text>
                  </View>
                  {cleanWhatsAppNumber(clientPhone) ? (
                    <View style={{ backgroundColor: 'rgba(37, 211, 102, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#25D366' }}>
                      <Text style={{ color: '#25D366', fontSize: 12, fontWeight: '700' }}>✓ WhatsApp Direct</Text>
                    </View>
                  ) : null}
                </View>

                <View>
                  <Text style={sharedStyles.fieldLabel}>Nom complet du client</Text>
                  <TextInput 
                    style={sharedStyles.input} 
                    placeholder="Ex: M. Jean Dupont / Mme Ngo" 
                    placeholderTextColor={colors.textTertiary} 
                    value={clientName} 
                    onChangeText={setClientName} 
                  />
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={sharedStyles.fieldLabel}>N° WhatsApp (9 chiffres Cameroun)</Text>
                    <TextInput 
                      style={[sharedStyles.input, cleanWhatsAppNumber(clientPhone) ? { borderColor: '#25D366', backgroundColor: 'rgba(37, 211, 102, 0.04)' } : null]} 
                      placeholder="Ex: 699932024" 
                      placeholderTextColor={colors.textTertiary} 
                      keyboardType="phone-pad"
                      value={clientPhone} 
                      onChangeText={setClientPhone} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={sharedStyles.fieldLabel}>Email du client (Optionnel)</Text>
                    <TextInput 
                      style={sharedStyles.input} 
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
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Supprimer" hitSlop={{ top: 8, bottom: 8 }} onPress={() => removeFromCart(index)} style={styles.cartRemoveBtn}>
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
                  icon={<Check color={colors.onGold} size={18} />}
                />
              </View>
              <TouchableOpacity style={sharedStyles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={sharedStyles.modalCancelBtnText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#121217',
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.4),
    borderRadius: radius.sm,
    overflow: 'hidden',
    ...shadow.lg,
  },
  searchResultPrice: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: alpha(colors.gold, 0.06),
    padding: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.35),
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
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: fonts.sans,
  },
  changeProductBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: alpha(colors.danger, 0.1),
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
  },
  changeProductText: {
    color: colors.danger,
    fontSize: 12,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  paymentPillActive: {
    backgroundColor: alpha(colors.gold, 0.15),
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
    backgroundColor: alpha(colors.warning, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.3),
    borderRadius: radius.sm,
    padding: 14,
    marginTop: 12,
  },
  advanceCardTitle: {
    color: colors.warning,
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
    fontSize: 12,
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
});
