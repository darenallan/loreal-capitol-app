import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { Trash2, Eye } from 'lucide-react-native';
import { sharedStyles } from './dashboardStyles';

export interface SalesHistoryModalProps {
  salesHistoryModal: boolean;
  setSalesHistoryModal: React.Dispatch<React.SetStateAction<boolean>>;
  historyDate: string;
  setHistoryDate: React.Dispatch<React.SetStateAction<string>>;
  historySales: any[];
  historyTotal: number;
  loadingHistory: boolean;
  handleDeleteSale: (saleOrId: any, context?: string) => void;
  handleOpenSaleDetail: (sale: any) => void;
  loadSalesByDate: (date: string) => Promise<void>;
}

/** Modale historique des ventes par date. */
export default function SalesHistoryModal({
  salesHistoryModal,
  setSalesHistoryModal,
  historyDate,
  setHistoryDate,
  historySales,
  historyTotal,
  loadingHistory,
  handleDeleteSale,
  handleOpenSaleDetail,
  loadSalesByDate,
}: SalesHistoryModalProps) {
  return (
    <Modal visible={salesHistoryModal} animationType="slide" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, { maxHeight: '90%' }]}>
          <Text style={sharedStyles.modalTitle}>🗓️ Historique des Ventes</Text>

          {/* Sélecteur de date */}
          <Text style={sharedStyles.fieldLabel}>Sélectionner une date</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
            <TextInput 
              style={[sharedStyles.input, { flex: 1, marginBottom: 0 }]} 
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

          <TouchableOpacity style={[sharedStyles.cancelBtn, { marginTop: 15 }]} onPress={() => setSalesHistoryModal(false)}>
            <Text style={sharedStyles.cancelBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
