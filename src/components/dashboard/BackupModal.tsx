import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { Package, Wallet, ArrowRightLeft, Download, ShieldCheck, FileSpreadsheet } from 'lucide-react-native';
import { exportSalesCSV, exportProductsCSV, exportAdvancesCSV, exportTransfersCSV, exportAuditLogsCSV } from '../../utils/exportHelpers';
import { sharedStyles } from './dashboardStyles';
import { colors } from '../../theme';

export interface BackupModalProps {
  backupModalVisible: boolean;
  setBackupModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isExportingBackup: boolean;
  handleFullBackup: () => Promise<void>;
}

/** Modale sauvegarde complète & exports CSV. */
export default function BackupModal({ backupModalVisible, setBackupModalVisible, isExportingBackup, handleFullBackup }: BackupModalProps) {
  return (
    <Modal visible={backupModalVisible} animationType="slide" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, { maxHeight: '90%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Download color={colors.gold} size={22} />
              <Text style={sharedStyles.modalTitle}>Sauvegarde & Exports Excel</Text>
            </View>
            <TouchableOpacity onPress={() => setBackupModalVisible(false)} style={{ padding: 5 }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 15 }}>
            Exportez instantanément vos bases de données en fichiers CSV encodés en UTF-8 avec séparateur point-virgule (compatibles directement avec Microsoft Excel et Google Sheets).
          </Text>

          {/* Pack complet */}
          <TouchableOpacity 
            style={[sharedStyles.saveBtn, { marginHorizontal: 0, marginBottom: 15, padding: 14, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}
            disabled={isExportingBackup}
            onPress={handleFullBackup}
          >
            <Download color={colors.onGold} size={20} />
            <Text style={[sharedStyles.saveBtnText, { fontSize: 13 }]}>
              {isExportingBackup ? 'Téléchargement en cours...' : '📥 Télécharger la Sauvegarde Complète (Pack Tout-en-Un)'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: colors.surfaceStrong, marginBottom: 12 }} />
          <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 13, marginBottom: 10 }}>Ou télécharger fichier par fichier :</Text>

          <ScrollView style={{ maxHeight: 300 }}>
            {/* Ventes Falaise */}
            <TouchableOpacity 
              style={styles.backupRowBtn} 
              onPress={() => exportSalesCSV(undefined, 'falaise')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <FileSpreadsheet color={colors.success} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>1a. Ventes — La Falaise (Excel / CSV)</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Toutes les ventes enregistrées à La Falaise</Text>
                </View>
              </View>
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>

            {/* Ventes Tougou */}
            <TouchableOpacity 
              style={styles.backupRowBtn} 
              onPress={() => exportSalesCSV(undefined, 'tougou')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <FileSpreadsheet color={colors.success} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>1b. Ventes — Tougou (Excel / CSV)</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Toutes les ventes enregistrées à Tougou</Text>
                </View>
              </View>
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>

            {/* Stocks Falaise */}
            <TouchableOpacity 
              style={styles.backupRowBtn} 
              onPress={() => exportProductsCSV(undefined, 'falaise')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Package color={colors.info} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>2a. Stock Réel — La Falaise (Excel / CSV)</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Rayons, tailles, codes-barres et quantités La Falaise</Text>
                </View>
              </View>
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>

            {/* Stocks Tougou */}
            <TouchableOpacity 
              style={styles.backupRowBtn} 
              onPress={() => exportProductsCSV(undefined, 'tougou')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Package color={colors.info} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>2b. Stock Réel — Tougou (Excel / CSV)</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Rayons, tailles, codes-barres et quantités Tougou</Text>
                </View>
              </View>
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>

            {/* Avances */}
            <TouchableOpacity 
              style={styles.backupRowBtn} 
              onPress={() => exportAdvancesCSV()}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Wallet color={colors.warning} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>3. Avances & Réservations (Excel / CSV)</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Acomptes, soldes restants, clients, dates limites</Text>
                </View>
              </View>
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>

            {/* Transferts */}
            <TouchableOpacity 
              style={styles.backupRowBtn} 
              onPress={() => exportTransfersCSV()}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <ArrowRightLeft color={colors.violet} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>4. Historique des Transferts (Excel / CSV)</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Mouvements entre magasins, transit et réceptions</Text>
                </View>
              </View>
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>

            {/* Audit */}
            <TouchableOpacity 
              style={styles.backupRowBtn} 
              onPress={() => exportAuditLogsCSV()}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <ShieldCheck color={colors.danger} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>5. Journal d'Audit & Sécurité (Excel / CSV)</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Annulations de vente, ajustements de stocks, motifs</Text>
                </View>
              </View>
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity style={[sharedStyles.cancelBtn, { marginTop: 15, marginHorizontal: 0 }]} onPress={() => setBackupModalVisible(false)}>
            <Text style={sharedStyles.cancelBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Sauvegarde & Exports
  backupRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceStrong,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
