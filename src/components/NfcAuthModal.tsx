import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { ShieldCheck, Radio, X } from 'lucide-react-native';
import { theme } from '../theme';
import { PressableScale, GoldButton } from '../ui';
import { colors, alpha } from '../theme';

interface NfcAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (authId: string) => void;
  actionText: string;
}

export default function NfcAuthModal({ visible, onClose, onSuccess, actionText }: NfcAuthModalProps) {
  const [loading, setLoading] = useState(false);

  const simulateNfcScan = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const authId = `NFC-AUTH-${Date.now()}`;
      onSuccess(authId);
    }, 1200);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <ShieldCheck color={theme.colors.gold} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Autorisation Superviseur</Text>
              <Text style={styles.subtitle}>Validation par badge NFC ou clé maître</Text>
            </View>
            <PressableScale accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onClose} style={styles.closeBtn}>
              <X color={theme.colors.textMuted} size={18} />
            </PressableScale>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Opération sous contrôle :</Text>
            <Text style={styles.actionText}>{actionText}</Text>
          </View>

          <View style={styles.scanArea}>
            <View style={styles.pulseRing}>
              <Radio color={theme.colors.gold} size={32} />
            </View>
            <Text style={styles.scanTitle}>Prêt pour lecture NFC</Text>
            <Text style={styles.scanText}>Approchez le badge ou la carte superviseur du capteur de l'appareil.</Text>
            
            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.gold} style={{ marginVertical: 18 }} />
            ) : (
              <GoldButton
                label="Simuler Badge NFC Boss"
                icon={<Radio color={colors.onGold} size={18} />}
                onPress={simulateNfcScan}
                style={{ width: '100%', marginTop: 8 }}
              />
            )}
          </View>

          <PressableScale style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#0E0E12',
    padding: 24,
    borderRadius: theme.radius.xl,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.35),
    ...theme.shadows.glowGold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: alpha(colors.gold, 0.12),
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  infoText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  actionText: {
    color: theme.colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  scanArea: {
    alignItems: 'center',
    padding: 22,
    backgroundColor: 'rgba(10, 10, 14, 0.8)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.2),
  },
  pulseRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: alpha(colors.gold, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scanTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  scanText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
