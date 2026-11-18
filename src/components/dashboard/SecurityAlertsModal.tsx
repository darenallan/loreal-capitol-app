import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Linking, StyleSheet } from 'react-native';
import { Trash2, MapPin } from 'lucide-react-native';

export interface SecurityAlertsModalProps {
  navigation: any;
  user: any;
  lowStockCount: number;
  selectedStore: any;
  securityLogs: any[];
  showSecurityAssistant: boolean;
  setShowSecurityAssistant: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteLog: (id: string) => Promise<void>;
}

/** Modale des alertes système (sécurité + stock faible). */
export default function SecurityAlertsModal({
  navigation,
  user,
  lowStockCount,
  selectedStore,
  securityLogs,
  showSecurityAssistant,
  setShowSecurityAssistant,
  handleDeleteLog,
}: SecurityAlertsModalProps) {
  return (
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
  );
}

const styles = StyleSheet.create({
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
});
