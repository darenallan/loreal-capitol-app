import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Linking, StyleSheet } from 'react-native';
import { Trash2, MapPin } from 'lucide-react-native';
import { colors } from '../../theme';

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
                        <MapPin color={colors.success} size={16} />
                        <Text style={styles.mapBtnText}>Voir sur Google Maps ({log.location.city})</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Supprimer" hitSlop={{ top: 8, bottom: 8 }} onPress={() => handleDeleteLog(log.id)} style={{ padding: 5 }}>
                    <Trash2 color={colors.danger} size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {securityLogs.length === 0 && <Text style={{ color: colors.textMuted }}>Aucune alerte récente.</Text>}

            <Text style={[styles.assistantSectionTitle, { marginTop: 20 }]}>📦 Stock Faible ({lowStockCount})</Text>
            {lowStockCount > 0 ? (
              <TouchableOpacity style={styles.stockAlertBtn} onPress={() => { setShowSecurityAssistant(false); navigation.navigate('Inventory', { filter: 'low_stock', user, storeId: selectedStore }); }}>
                <Text style={styles.stockAlertBtnText}>Voir les articles en rupture</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: colors.textMuted }}>Le stock est bon !</Text>
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
  assistantPanel: { width: 320, maxWidth: '88%', height: '100%', backgroundColor: colors.surfaceSolidHi, borderLeftWidth: 1, borderLeftColor: colors.gold },
  assistantHeader: { padding: 20, paddingTop: 40, backgroundColor: colors.bgElevated, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  assistantTitle: { color: colors.gold, fontSize: 18, fontWeight: 'bold' },
  assistantSectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  securityLogCard: { backgroundColor: colors.surfaceStrong, padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.borderStrong },
  logText: { color: '#fff', fontWeight: 'bold' },
  logDate: { color: colors.textTertiary, fontSize: 12, marginTop: 4 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5 },
  mapBtnText: { color: colors.success, fontSize: 12 },
  stockAlertBtn: { backgroundColor: colors.surfaceStrong, padding: 15, borderRadius: 10, alignItems: 'center' },
  stockAlertBtnText: { color: colors.danger, fontWeight: 'bold' },
});
