import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { Wifi, Radio, Database, RefreshCw, CheckCircle2, AlertTriangle, XCircle, X, ShieldCheck, Copy, DownloadCloud } from 'lucide-react-native';
import { runNetworkDiagnostics, NetworkDiagnosticResult, fetchViaRest, saveFastCache } from '../db/resilientSync';
import { colors, fonts, radius } from '../theme';
import { GlassCard, GoldButton } from '../ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onForceRefreshDone?: () => void;
}

export default function NetworkDoctorModal({ visible, onClose, onForceRefreshDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [diag, setDiag] = useState<NetworkDiagnosticResult | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const runTests = async () => {
    setLoading(true);
    try {
      const res = await runNetworkDiagnostics();
      setDiag(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      runTests();
      setCopied(false);
    }
  }, [visible]);

  const handleForceRefresh = async () => {
    setSyncingAll(true);
    try {
      const data = await fetchViaRest('products', 10000);
      if (data) {
        saveFastCache('loreal_cache_products', data);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(`Succès : ${Object.keys(data).length} articles actualisés via HTTPS direct !`);
        } else {
          Alert.alert('Succès', `${Object.keys(data).length} articles actualisés via HTTPS direct !`);
        }
        if (onForceRefreshDone) onForceRefreshDone();
        runTests();
      }
    } catch (err: any) {
      Alert.alert('Erreur', 'Impossible de récupérer le stock : ' + (err.message || 'Problème de réseau'));
    } finally {
      setSyncingAll(false);
    }
  };

  const handleCopyReport = () => {
    if (!diag) return;
    const report = `[DIAGNOSTIC RÉSEAU L'ORÉAL CAPITOL]
Date: ${new Date().toLocaleString('fr-FR')}
Connexion: ${diag.networkType === 'cellular' ? 'Données Mobiles (MTN/Orange)' : diag.networkType === 'wifi' ? 'Wi-Fi' : 'Inconnu'}
HTTPS REST Firebase: ${diag.restOk ? `OK (${diag.restPingMs}ms)` : 'Échec'}
WebSocket Temps Réel: ${diag.socketOk ? `OK (${diag.socketPingMs}ms)` : 'Bloqué ou Throttlé'}
Articles en ligne: ${diag.productsCount}
Articles en mémoire locale: ${diag.cachedProductsCount}
Remarque: ${diag.operatorNote}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <GlassCard style={styles.container} glow="gold">
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>ASSISTANCE RÉSEAU CAMEROUN</Text>
              <Text style={styles.title}>Docteur Réseau & Données</Text>
              <Text style={styles.subtitle}>Optimisé pour MTN & Orange Cameroun</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.gold} size="large" />
                <Text style={styles.loadingText}>Analyse de votre connexion MTN / Orange en cours...</Text>
              </View>
            ) : diag ? (
              <View style={styles.content}>
                {/* Statut Global */}
                <View style={[styles.statusBanner, { backgroundColor: diag.restOk ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  {diag.restOk ? <CheckCircle2 color="#22C55E" size={20} /> : <AlertTriangle color="#EF4444" size={20} />}
                  <Text style={[styles.statusBannerText, { color: diag.restOk ? '#22C55E' : '#EF4444' }]}>
                    {diag.operatorNote}
                  </Text>
                </View>

                {/* Grille de tests */}
                <View style={styles.testGrid}>
                  {/* Test 1 : HTTPS REST */}
                  <View style={styles.testCard}>
                    <View style={styles.testCardHeader}>
                      <Radio color={colors.gold} size={16} />
                      <Text style={styles.testCardTitle}>Protocole HTTPS</Text>
                    </View>
                    <Text style={[styles.testResult, { color: diag.restOk ? '#22C55E' : '#EF4444' }]}>
                      {diag.restOk ? `Opérationnel (${diag.restPingMs}ms)` : 'Non disponible'}
                    </Text>
                    <Text style={styles.testNote}>Standard web universel (jamais filtré par MTN/Orange).</Text>
                  </View>

                  {/* Test 2 : WebSocket */}
                  <View style={styles.testCard}>
                    <View style={styles.testCardHeader}>
                      <Wifi color={colors.gold} size={16} />
                      <Text style={styles.testCardTitle}>WebSockets Firebase</Text>
                    </View>
                    <Text style={[styles.testResult, { color: diag.socketOk ? '#22C55E' : '#F59E0B' }]}>
                      {diag.socketOk ? `Connecté (${diag.socketPingMs}ms)` : 'Filtré par le réseau mobile'}
                    </Text>
                    <Text style={styles.testNote}>Souvent bloqué sur données mobiles au Cameroun (bascule REST active).</Text>
                  </View>

                  {/* Test 3 : Cache Local */}
                  <View style={styles.testCard}>
                    <View style={styles.testCardHeader}>
                      <Database color={colors.gold} size={16} />
                      <Text style={styles.testCardTitle}>Stock Hors-Ligne</Text>
                    </View>
                    <Text style={[styles.testResult, { color: colors.gold }]}>
                      {diag.cachedProductsCount > 0 ? `${diag.cachedProductsCount} articles sauvés` : 'Aucun cache'}
                    </Text>
                    <Text style={styles.testNote}>Permet de consulter et vendre même avec 0 signal.</Text>
                  </View>
                </View>

                {/* Boutons d'action */}
                <View style={styles.actions}>
                  <GoldButton
                    label={syncingAll ? "Actualisation en cours..." : "Recharger tout via HTTPS Direct"}
                    onPress={handleForceRefresh}
                    disabled={syncingAll}
                    size="md"
                    icon={<DownloadCloud color="#07070A" size={16} />}
                  />

                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyReport}>
                    <Copy color={colors.gold} size={15} />
                    <Text style={styles.secondaryBtnText}>
                      {copied ? 'Rapport copié dans le presse-papier !' : 'Copier le Rapport Technique'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.retestBtn} onPress={runTests}>
                    <RefreshCw color={colors.textSecondary} size={14} />
                    <Text style={styles.retestBtnText}>Relancer le test de connexion</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: 480,
    maxWidth: '96%',
    borderRadius: radius.md,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: '#0E0E12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.serif,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.sans,
    textAlign: 'center',
  },
  content: {
    gap: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
    lineHeight: 18,
  },
  testGrid: {
    gap: 10,
  },
  testCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  testCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  testCardTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  testResult: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
    marginBottom: 2,
  },
  testNote: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.sans,
    lineHeight: 15,
  },
  actions: {
    gap: 10,
    marginTop: 6,
    paddingBottom: 6,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  secondaryBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  retestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  retestBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.sans,
  },
});
