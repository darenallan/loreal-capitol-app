import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';
import { Download, ShieldCheck } from 'lucide-react-native';
import { exportAuditLogsCSV } from '../../utils/exportHelpers';
import { sharedStyles } from './dashboardStyles';

export interface AuditLogModalProps {
  auditModalVisible: boolean;
  setAuditModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  auditLogsList: any[];
  loadingAudit: boolean;
  auditSearchText: string;
  setAuditSearchText: React.Dispatch<React.SetStateAction<string>>;
}

/** Modale du journal d'audit. */
export default function AuditLogModal({
  auditModalVisible,
  setAuditModalVisible,
  auditLogsList,
  loadingAudit,
  auditSearchText,
  setAuditSearchText,
}: AuditLogModalProps) {
  return (
    <Modal visible={auditModalVisible} animationType="slide" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, { maxHeight: '90%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck color="#d4af37" size={22} />
              <Text style={sharedStyles.modalTitle}>Journal d'Audit des Actions</Text>
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
              style={[sharedStyles.input, { flex: 1, marginBottom: 0, height: 42, fontSize: 13 }]} 
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

          <TouchableOpacity style={[sharedStyles.cancelBtn, { marginTop: 15, marginHorizontal: 0 }]} onPress={() => setAuditModalVisible(false)}>
            <Text style={sharedStyles.cancelBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
