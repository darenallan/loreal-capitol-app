import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Sparkles, FileText, Download, ArrowRightLeft, ClipboardCheck, Wallet, ShieldCheck, Check } from 'lucide-react-native';
import { LOREAL_LOGO_BASE64 } from '../assets/logoBase64';
import { colors, fonts, radius, shadow } from '../theme';
import { GlassCard, GoldButton } from '../ui';
import { alpha } from '../theme';

const UPDATE_VERSION_KEY = 'loreal_capitol_update_v2_1_seen';

export default function UpdateNotificationModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const seen = window.localStorage.getItem(UPDATE_VERSION_KEY);
      if (!seen) {
        const timer = setTimeout(() => {
          setVisible(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(UPDATE_VERSION_KEY, 'true');
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <GlassCard style={styles.modalCard} glow="gold">
          {/* Header */}
          <View style={styles.header}>
            <Image 
              source={{ uri: LOREAL_LOGO_BASE64 }} 
              style={styles.logo} 
              resizeMode="contain" 
            />
            <View style={styles.badge}>
              <Sparkles color={colors.gold} size={12} style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>VERSION HAUTE PRÉCISION</Text>
            </View>
            <Text style={styles.title}>L'Oréal Capitol évolue</Text>
            <Text style={styles.subtitle}>
              Nouvelles fonctionnalités et interface prestige optimisées :
            </Text>
          </View>

          {/* Features */}
          <ScrollView style={styles.featuresScroll} showsVerticalScrollIndicator={false}>
            {/* 1. Reçu PDF */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(37, 211, 102, 0.1)', borderColor: '#25D366' }]}>
                <FileText color="#25D366" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Reçu de Caisse & PDF WhatsApp</Text>
                <Text style={styles.featureDesc}>
                  Ticket thermique 80mm avec logo officiel L'Oréal Capitol. Génération PDF instantanée et partage client.
                </Text>
              </View>
            </View>

            {/* 2. Sauvegardes Excel */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: alpha(colors.gold, 0.1), borderColor: colors.gold }]}>
                <Download color={colors.gold} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Sauvegardes CSV Distinctes</Text>
                <Text style={styles.featureDesc}>
                  Exportez les ventes et stocks distincts pour La Falaise et Tougou au format tableur Excel.
                </Text>
              </View>
            </View>

            {/* 3. Transferts Live */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(192, 132, 252, 0.1)', borderColor: '#C084FC' }]}>
                <ArrowRightLeft color="#C084FC" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Expéditions Inter-Boutiques Live</Text>
                <Text style={styles.featureDesc}>
                  Suivi en temps réel avec calcul de temps d'arrivée (ETA), coursier moto assigné et itinéraire Google Maps.
                </Text>
              </View>
            </View>

            {/* 4. Inventaire Physique */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: alpha(colors.info, 0.1), borderColor: colors.info }]}>
                <ClipboardCheck color={colors.info} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Inventaire Physique & Écarts</Text>
                <Text style={styles.featureDesc}>
                  Comptage tactile en rayon, calcul automatisé des pertes financières et journal d'audit complet.
                </Text>
              </View>
            </View>

            {/* 5. Avances Clients */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: alpha(colors.warning, 0.1), borderColor: colors.warning }]}>
                <Wallet color={colors.warning} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Avances & Acomptes par Tranches</Text>
                <Text style={styles.featureDesc}>
                  Règlement échelonné, alertes de dépassement d'échéance et message de relance personnalisé sur WhatsApp.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Dismiss button */}
          <View style={{ marginTop: 14 }}>
            <GoldButton 
              label="Accéder à l'application"
              onPress={handleDismiss}
              size="lg"
              icon={<Check color={colors.onGold} size={18} />}
            />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    padding: 24,
    borderRadius: radius.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.gold, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
    marginBottom: 8,
  },
  badgeText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: fonts.sans,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.serif,
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
  featuresScroll: {
    maxHeight: 320,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  featureDesc: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
    fontFamily: fonts.sans,
  },
});
