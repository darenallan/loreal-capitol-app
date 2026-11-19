import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Animated, Modal, ScrollView, Linking, Platform } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { 
  ArrowLeft, ArrowRightLeft, CheckCircle2, Clock, Download, PackageCheck, 
  Truck, Package, MapPin, Navigation, Timer, ChevronDown, ChevronUp, X, 
  ExternalLink, Plus, PhoneCall, RotateCcw, XCircle, Store, Check, AlertCircle, Sparkles
} from 'lucide-react-native';
import { confirmTransferReceipt, isUserAdmin, updateTransferTrackingStep, acceptTransferRequest, rejectTransferRequest, cancelTransfer, returnUnsoldTransfer, getLocalCache } from '../db/database';
import { subscribeResilient } from '../db/resilientSync';
import { exportTransfersCSV } from '../utils/exportHelpers';
import StoreLocationModal from '../components/StoreLocationModal';
import TransferRequestModal from '../components/TransferRequestModal';
import IncomingTransferAlertModal from '../components/IncomingTransferAlertModal';
import { colors, fonts, radius, shadow, formatMoney } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, SectionTitle, FadeIn } from '../ui';
import { chrome } from '../ui/screenChrome';
import { alpha } from '../theme';

// ====== TRACKING STEP CONFIG ======
const TRACKING_STEPS = [
  { key: 'preparing', label: 'Préparation', description: 'Colis en cours de préparation en magasin' },
  { key: 'picked_up', label: 'Prise en charge', description: 'Le coursier a récupéré le colis' },
  { key: 'in_transit', label: 'En transit', description: 'Le colis est en route vers la boutique' },
  { key: 'arriving', label: 'Arrivée imminente', description: 'Le livreur approche de la boutique' },
  { key: 'received', label: 'Livré & Validé', description: 'Colis réceptionné et intégré au stock' },
];

// ====== ETA COUNTDOWN COMPONENT ======
function ETACountdown({ estimatedArrival, status }: { estimatedArrival: string; status: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (status === 'received') {
      setTimeLeft('Livré');
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const eta = new Date(estimatedArrival).getTime();
      const diff = eta - now;

      if (diff <= 0) {
        setTimeLeft('En retard');
        setIsLate(true);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
        setIsLate(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [estimatedArrival, status]);

  return (
    <View style={[
      etaStyles.container, 
      isLate && etaStyles.containerLate, 
      status === 'received' && etaStyles.containerDone
    ]}>
      <Timer color={status === 'received' ? colors.success : isLate ? colors.danger : colors.gold} size={12} />
      <Text style={[
        etaStyles.text,
        isLate && { color: colors.danger },
        status === 'received' && { color: colors.success }
      ]}>
        {status === 'received' ? 'Livré' : timeLeft}
      </Text>
    </View>
  );
}

const etaStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.gold, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
  },
  containerLate: {
    backgroundColor: alpha(colors.danger, 0.1),
    borderColor: alpha(colors.danger, 0.3),
  },
  containerDone: {
    backgroundColor: alpha(colors.success, 0.1),
    borderColor: alpha(colors.success, 0.3),
  },
  text: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.sans,
  }
});

// ====== PROGRESS BAR COMPONENT ======
function TrackingProgressBar({ steps, currentStep }: { steps: any; currentStep: string }) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const allSteps = ['preparing', 'picked_up', 'in_transit', 'arriving', 'received'];
  const currentIndex = allSteps.indexOf(currentStep);
  const progress = currentIndex >= 0 ? (currentIndex / (allSteps.length - 1)) * 100 : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.track}>
        <Animated.View style={[progressStyles.fill, { width: progressWidth }]} />
      </View>
      <View style={progressStyles.dots}>
        {allSteps.map((step, i) => {
          const isDone = steps?.[step]?.done || i <= currentIndex;
          const isCurrent = step === currentStep;
          return (
            <View key={step} style={[
              progressStyles.dot,
              isDone && progressStyles.dotDone,
              isCurrent && progressStyles.dotCurrent,
            ]}>
              {isCurrent && <View style={progressStyles.dotPulse} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: { marginVertical: 10, paddingHorizontal: 4 },
  track: {
    height: 3,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E1E24',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  dotDone: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  dotCurrent: {
    backgroundColor: colors.gold,
    borderColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: -1,
  },
  dotPulse: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: alpha(colors.gold, 0.5),
  },
});

// ====== TRACKING DETAIL MODAL ======
function TrackingDetailModal({ visible, transfer, onClose, user, onCancel, onReturnUnsold, onConfirm }: any) {
  if (!transfer) return null;

  const isPending = transfer.status !== 'received';
  const fromName = transfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
  const toName = transfer.to_store === 'falaise' ? 'La Falaise' : 'Tougou';
  const allSteps = ['preparing', 'picked_up', 'in_transit', 'arriving', 'received'];

  let currentStepKey = 'preparing';
  for (const step of allSteps) {
    if (transfer.tracking_steps?.[step]?.done) {
      currentStepKey = step;
    }
  }

  const handleStepUpdate = async (stepKey: string) => {
    try {
      await updateTransferTrackingStep(transfer.id, stepKey as any, user?.id || '', user?.name || 'Utilisateur');
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Statut mis à jour !');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de mettre à jour');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <GlassCard style={modalStyles.container} glow="gold">
          {/* Header */}
          <View style={modalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.headerEyebrow}>EXPÉDITION INTER-BOUTIQUE</Text>
              <Text style={modalStyles.headerTitle}>Suivi en Direct</Text>
              <Text style={modalStyles.headerSubtitle}>{transfer.product_name}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onClose} style={modalStyles.closeBtn}>
              <X color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Route Visual */}
            <View style={modalStyles.routeVisual}>
              <View style={modalStyles.routePoint}>
                <View style={[modalStyles.routeDot, { backgroundColor: colors.gold }]} />
                <Text style={modalStyles.routePointLabel}>{fromName}</Text>
                <Text style={modalStyles.routePointTime}>
                  {new Date(transfer.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <View style={modalStyles.routeLine}>
                {isPending && (
                  <View style={modalStyles.driverIndicator}>
                    <Truck color={colors.gold} size={14} />
                    <Text style={modalStyles.driverName}>
                      {transfer.carrier_name || transfer.driver_name || 'Coursier'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={modalStyles.routePoint}>
                <View style={[modalStyles.routeDot, { backgroundColor: isPending ? 'rgba(255, 255, 255, 0.2)' : colors.success }]} />
                <Text style={modalStyles.routePointLabel}>{toName}</Text>
                {transfer.estimated_arrival && isPending && (
                  <ETACountdown estimatedArrival={transfer.estimated_arrival} status={transfer.status} />
                )}
                {!isPending && (
                  <Text style={[modalStyles.routePointTime, { color: colors.success }]}>
                    {transfer.received_at ? new Date(transfer.received_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Livré'}
                  </Text>
                )}
              </View>
            </View>

            {/* Google Maps Button */}
            <TouchableOpacity 
              style={modalStyles.gmapsBtn}
              onPress={() => {
                const originLat = transfer.origin_coords?.lat || 3.870472;
                const originLng = transfer.origin_coords?.lng || 11.516083;
                const destLat = transfer.dest_coords?.lat || 3.882472;
                const destLng = transfer.dest_coords?.lng || 11.523361;
                const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
                Linking.openURL(url);
              }}
            >
              <ExternalLink color={colors.info} size={14} />
              <Text style={modalStyles.gmapsBtnText}>
                Ouvrir l'Itinéraire dans Google Maps
              </Text>
            </TouchableOpacity>

            {/* Product Info */}
            <View style={modalStyles.infoCard}>
              <Text style={modalStyles.infoTitle}>Détails du Colis</Text>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Article</Text>
                <Text style={modalStyles.infoValue}>{transfer.product_name}</Text>
              </View>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Quantité</Text>
                <Text style={[modalStyles.infoValue, { color: colors.gold, fontWeight: '700' }]}>x{transfer.quantity}</Text>
              </View>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Expédié par</Text>
                <Text style={modalStyles.infoValue}>{transfer.sender_name || transfer.user_name || 'Vendeur'}</Text>
              </View>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Coursier</Text>
                <Text style={[modalStyles.infoValue, { color: colors.gold }]}>
                  {transfer.carrier_name || transfer.driver_name || 'Coursier'}
                </Text>
              </View>
              {transfer.reference ? (
                <View style={modalStyles.infoRow}>
                  <Text style={modalStyles.infoLabel}>Référence</Text>
                  <Text style={modalStyles.infoValue}>{transfer.reference}</Text>
                </View>
              ) : null}
              {transfer.size ? (
                <View style={modalStyles.infoRow}>
                  <Text style={modalStyles.infoLabel}>Taille</Text>
                  <Text style={modalStyles.infoValue}>{transfer.size}</Text>
                </View>
              ) : null}
              {transfer.color ? (
                <View style={modalStyles.infoRow}>
                  <Text style={modalStyles.infoLabel}>Couleur</Text>
                  <Text style={modalStyles.infoValue}>{transfer.color}</Text>
                </View>
              ) : null}
            </View>

            {/* Tracking Timeline */}
            <View style={modalStyles.timelineCard}>
              <Text style={modalStyles.infoTitle}>Étapes de Livraison</Text>
              {TRACKING_STEPS.map((step, index) => {
                const stepData = transfer.tracking_steps?.[step.key];
                const isDone = stepData?.done;
                const isCurrent = step.key === currentStepKey && isPending;
                const canUpdate = isPending && !isDone && (isUserAdmin(user) || user?.store === 'all' || user?.store === transfer.from_store);

                return (
                  <View key={step.key} style={modalStyles.timelineItem}>
                    {index < TRACKING_STEPS.length - 1 && (
                      <View style={[
                        modalStyles.timelineLine,
                        isDone && { backgroundColor: colors.gold }
                      ]} />
                    )}

                    <View style={[
                      modalStyles.timelineDot,
                      isDone && modalStyles.timelineDotDone,
                      isCurrent && modalStyles.timelineDotCurrent,
                    ]}>
                      {isDone ? (
                        <Check color={colors.onGold} size={12} />
                      ) : (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isCurrent ? colors.gold : colors.textTertiary }} />
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 12, paddingBottom: 16 }}>
                      <Text style={[
                        modalStyles.timelineLabel,
                        isDone && { color: colors.textPrimary },
                        isCurrent && { color: colors.gold },
                      ]}>
                        {step.label}
                      </Text>
                      <Text style={modalStyles.timelineDesc}>{step.description}</Text>
                      {isDone && stepData?.time && (
                        <Text style={modalStyles.timelineTime}>
                          {new Date(stepData.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                      {canUpdate && (
                        <TouchableOpacity
                          style={modalStyles.updateStepBtn}
                          onPress={() => handleStepUpdate(step.key)}
                        >
                          <Text style={modalStyles.updateStepBtnText}>
                            Marquer "{step.label}"
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Actions */}
            <View style={{ paddingHorizontal: 4, gap: 8, paddingBottom: 10 }}>
              {isPending && onConfirm && (
                <GoldButton 
                  label={`Confirmer la Réception (+${transfer.quantity} à ${toName})`}
                  onPress={() => onConfirm(transfer)}
                  size="md"
                  icon={<PackageCheck color={colors.onGold} size={16} />}
                />
              )}

              {(isPending || transfer.status === 'requested') && onCancel && (
                <TouchableOpacity
                  style={modalStyles.cancelBtn}
                  onPress={() => onCancel(transfer)}
                >
                  <XCircle color={colors.danger} size={15} />
                  <Text style={modalStyles.cancelBtnText}>
                    Annuler le Transfert (Restituer à {fromName})
                  </Text>
                </TouchableOpacity>
              )}

              {(isPending || transfer.status === 'received') && onReturnUnsold && (
                <TouchableOpacity
                  style={modalStyles.unsoldBtn}
                  onPress={() => onReturnUnsold(transfer)}
                >
                  <RotateCcw color={colors.warning} size={15} />
                  <Text style={modalStyles.unsoldBtnText}>
                    Article Non Vendu (Retourner à {fromName})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </GlassCard>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 550,
    maxHeight: '90%',
    padding: 22,
    borderRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    paddingBottom: 12,
  },
  headerEyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.serif,
    marginTop: 2,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  routeVisual: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routePointLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    fontFamily: fonts.sans,
  },
  routePointTime: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  routeLine: {
    marginLeft: 4,
    borderLeftWidth: 1.5,
    borderLeftColor: alpha(colors.gold, 0.4),
    borderStyle: 'dashed',
    paddingVertical: 10,
    paddingLeft: 14,
    marginVertical: 4,
  },
  driverIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: alpha(colors.gold, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
    alignSelf: 'flex-start',
  },
  driverName: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  gmapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: alpha(colors.info, 0.08),
    borderColor: alpha(colors.info, 0.3),
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  gmapsBtnText: {
    color: colors.info,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 12,
  },
  infoTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: fonts.sans,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  infoLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  timelineCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 10,
    top: 20,
    bottom: 0,
    width: 1.5,
    backgroundColor: colors.glassBorder,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    zIndex: 1,
  },
  timelineDotDone: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  timelineDotCurrent: {
    backgroundColor: alpha(colors.gold, 0.2),
    borderColor: colors.gold,
  },
  timelineLabel: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  timelineDesc: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  timelineTime: {
    color: colors.success,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  updateStepBtn: {
    marginTop: 6,
    backgroundColor: colors.gold,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
  },
  updateStepBtnText: {
    color: colors.onGold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: alpha(colors.danger, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  cancelBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  unsoldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: alpha(colors.warning, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.3),
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  unsoldBtnText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
});

// ====== MAIN TRANSFERS SCREEN ======
export default function TransfersScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const initialStore = route.params?.storeId || (user?.store === 'all' ? 'all' : (user?.store || 'falaise'));
  
  const [selectedFilterStore, setSelectedFilterStore] = useState<string>(initialStore);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'completed' | 'requested' | 'all'>('pending');
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const processTransfersData = (data: any) => {
    if (!data) {
      setTransfers([]);
      setLoading(false);
      return;
    }
    const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransfers(list);
    setLoading(false);
  };

  useEffect(() => {
    // 1. Lecture immédiate du cache local (0ms)
    const cached = getLocalCache('loreal_cache_transfers');
    if (cached) {
      processTransfersData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Souscription résiliente double transport (HTTPS REST + WebSocket)
    const unsubscribe = subscribeResilient(
      'transfers',
      (data) => {
        if (data) processTransfersData(data);
      },
      { cacheKey: 'loreal_cache_transfers' }
    );

    return () => unsubscribe();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async (transfer: any) => {
    const destName = transfer.to_store === 'falaise' ? 'La Falaise' : 'Tougou';
    const confirmPrompt = async () => {
      try {
        await confirmTransferReceipt(transfer.id, user.id, user.name || 'Responsable');
        try {
          await updateTransferTrackingStep(transfer.id, 'received', user.id, user.name || 'Responsable');
        } catch (e) {}
        const msg = `Transfert validé ! Les ${transfer.quantity}x "${transfer.product_name}" sont maintenant dans le stock de ${destName}.`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Succès', msg);
      } catch (err: any) {
        Alert.alert('Erreur', err?.message || 'Impossible de valider la réception.');
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`Confirmez-vous avoir bien reçu ${transfer.quantity}x "${transfer.product_name}" dans la boutique ${destName} ?`)) {
        confirmPrompt();
      }
      return;
    }

    Alert.alert(
      'Confirmer la réception',
      `Confirmez-vous avoir bien reçu ${transfer.quantity}x "${transfer.product_name}" à ${destName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer & Ajouter au stock', onPress: confirmPrompt }
      ]
    );
  };

  const handleCancel = async (transfer: any) => {
    const fromName = transfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
    const confirmPrompt = async () => {
      try {
        await cancelTransfer(transfer.id, user.id, user.name || 'Responsable', 'Annulé par ' + (user.name || 'Utilisateur'));
        const msg = `Transfert annulé. Les ${transfer.quantity}x "${transfer.product_name}" ont été restitués au stock de ${fromName}.`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Succès', msg);
        if (selectedTransfer?.id === transfer.id) setSelectedTransfer(null);
      } catch (err: any) {
        Alert.alert('Erreur', err?.message || 'Impossible d\'annuler le transfert.');
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`Annuler ce transfert ? Le stock (${transfer.quantity}x "${transfer.product_name}") sera immédiatement restitué à ${fromName}.`)) {
        confirmPrompt();
      }
      return;
    }

    Alert.alert(
      'Annuler le transfert',
      `Confirmez-vous l'annulation ? Le stock (${transfer.quantity}x) sera immédiatement restitué à ${fromName}.`,
      [
        { text: 'Non, garder', style: 'cancel' },
        { text: 'Oui, annuler & restituer stock', style: 'destructive', onPress: confirmPrompt }
      ]
    );
  };

  const handleReturnUnsold = async (transfer: any) => {
    const fromName = transfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
    const confirmPrompt = async () => {
      try {
        await returnUnsoldTransfer(transfer.id, user.id, user.name || 'Responsable', 'Client n\'a pas acheté / Article non vendu');
        const msg = `Article non vendu. Les ${transfer.quantity}x "${transfer.product_name}" ont été retournés au stock de ${fromName}.`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Succès', msg);
        if (selectedTransfer?.id === transfer.id) setSelectedTransfer(null);
      } catch (err: any) {
        Alert.alert('Erreur', err?.message || 'Impossible d\'enregistrer le retour.');
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`Article Non Vendu ? Le stock (${transfer.quantity}x "${transfer.product_name}") sera retourné à ${fromName}.`)) {
        confirmPrompt();
      }
      return;
    }

    Alert.alert(
      'Article non vendu',
      `Le client n'a pas acheté l'article ? Le stock sera automatiquement retourné à ${fromName}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Oui, retourner à ' + fromName, onPress: confirmPrompt }
      ]
    );
  };

  const getCurrentStep = (transfer: any) => {
    const allSteps = ['preparing', 'picked_up', 'in_transit', 'arriving', 'received'];
    let current = 'preparing';
    if (!transfer.tracking_steps) {
      return transfer.status === 'received' ? 'received' : 'in_transit';
    }
    for (const step of allSteps) {
      if (transfer.tracking_steps[step]?.done) current = step;
    }
    return current;
  };

  const requestedCount = transfers.filter(t => t.status === 'requested').length;
  const pendingCount = transfers.filter(t => t.status === 'in_transit' || (!t.status && t.status !== 'requested')).length;

  const filteredTransfers = transfers.filter(t => {
    if (selectedFilterStore !== 'all') {
      if (t.from_store !== selectedFilterStore && t.to_store !== selectedFilterStore) return false;
    }
    if (tab === 'requested') return t.status === 'requested';
    if (tab === 'pending') return t.status === 'in_transit' || (!t.status && t.status !== 'requested');
    if (tab === 'completed') return t.status === 'received';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retour" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.screenEyebrow} numberOfLines={1}>LOGISTIQUE INTER-MAGASINS</Text>
            <Text style={styles.title} numberOfLines={1}>Suivi des Livraisons</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.goldNewBtn}
              onPress={() => setShowRequestModal(true)}
              accessibilityLabel="Nouvelle Demande"
            >
              <Plus color={colors.onGold} size={16} />
              {/* Sur téléphone étroit : icône seule pour laisser la place au titre */}
              {r.width >= 480 && <Text style={styles.goldNewBtnText}>Demander</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconBtn}
              onPress={() => setShowLocationModal(true)}
              accessibilityLabel="Position Magasins"
            >
              <MapPin color={colors.gold} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconBtn}
              onPress={() => exportTransfersCSV(transfers)}
              accessibilityLabel="Exporter en CSV"
            >
              <Download color={colors.gold} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Tracking Status Strip */}
        <View style={styles.liveStrip}>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveStripText}>
              {requestedCount > 0 
                ? `${requestedCount} demande${requestedCount > 1 ? 's' : ''} en attente`
                : (pendingCount > 0 ? `${pendingCount} course${pendingCount > 1 ? 's' : ''} active${pendingCount > 1 ? 's' : ''}` : 'Tous les colis sont livrés')}
            </Text>
          </View>
          <Text style={styles.liveStripClock}>EN TEMPS RÉEL</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {requestedCount > 0 && (
            <TouchableOpacity 
              style={[styles.tabItem, tab === 'requested' && styles.tabItemActiveAmber]}
              onPress={() => setTab('requested')}
            >
              <Text style={[styles.tabText, styles.tabTextActive]}>
                Demandes ({requestedCount})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.tabItem, tab === 'pending' && styles.tabItemActive]}
            onPress={() => setTab('pending')}
          >
            <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
              En cours ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabItem, tab === 'completed' && styles.tabItemActive]}
            onPress={() => setTab('completed')}
          >
            <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
              Livrés ({transfers.filter(t => t.status === 'received').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabItem, tab === 'all' && styles.tabItemActive]}
            onPress={() => setTab('all')}
          >
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
              Tous ({transfers.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Store Filter Pills */}
        <View style={styles.storeFilterRow}>
          {[
            { id: 'all', label: 'Toutes les boutiques' },
            { id: 'falaise', label: 'La Falaise' },
            { id: 'tougou', label: 'Tougou' }
          ].map(s => (
            <TouchableOpacity 
              key={s.id}
              style={[styles.storeFilterBtn, selectedFilterStore === s.id && styles.storeFilterBtnActive]}
              onPress={() => setSelectedFilterStore(s.id)}
            >
              <Text style={[styles.storeFilterText, selectedFilterStore === s.id && styles.storeFilterTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transfer List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Synchronisation logistique en direct...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransfers}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, r.isWide && styles.listWide]}
          renderItem={({ item }) => {
            const isPending = item.status === 'in_transit' || !item.status;
            const fromName = item.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
            const toName = item.to_store === 'falaise' ? 'La Falaise' : 'Tougou';
            const currentStep = getCurrentStep(item);
            const isExpanded = expandedCards.has(item.id);
            const canConfirm = isPending && (
              isUserAdmin(user) || 
              user?.store === 'all' || 
              user?.store === item.to_store
            );
            const currentStepInfo = TRACKING_STEPS.find(s => s.key === currentStep);

            if (item.status === 'requested') {
              const canAccept = isUserAdmin(user) || user?.store === 'all' || user?.store === item.from_store;
              return (
                <FadeIn>
                  <GlassCard style={styles.requestCard} glow="gold">
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={styles.productName}>{item.product_name}</Text>
                          <View style={styles.qtyPill}>
                            <Text style={styles.qtyPillText}>x{item.quantity}</Text>
                          </View>
                        </View>
                        <Text style={styles.productDetails}>
                          {item.reference ? `Réf: ${item.reference} • ` : ''}
                          {item.size ? `T: ${item.size} • ` : ''}
                          {item.color ? `C: ${item.color}` : ''}
                        </Text>
                      </View>
                      <View style={styles.demandBadge}>
                        <Text style={styles.demandBadgeText}>DEMANDE EN ATTENTE</Text>
                      </View>
                    </View>

                    <View style={styles.requestRouteRow}>
                      <Text style={styles.requestRouteText}>
                        De <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{fromName}</Text> vers <Text style={{ color: colors.gold, fontWeight: '700' }}>{toName}</Text>
                      </Text>
                      <Text style={styles.requestSellerText}>
                        Demandé par : {item.requested_by_name || 'Vendeur'}
                      </Text>
                      {item.note ? (
                        <Text style={styles.requestNoteText}>Note : "{item.note}"</Text>
                      ) : null}
                    </View>

                    {canAccept ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <GoldButton 
                          label="Accepter & Expédier (~15 min)"
                          onPress={async () => {
                            try {
                              await acceptTransferRequest(item.id, user?.id || 'staff', user?.name || 'Responsable');
                              const msg = `Transfert validé ! Colis en route vers ${toName}.`;
                              if (typeof window !== 'undefined' && window.alert) window.alert(msg);
                              else Alert.alert('Validé', msg);
                            } catch (e: any) {
                              Alert.alert('Erreur', e?.message || 'Erreur lors de la validation.');
                            }
                          }}
                          size="sm"
                          icon={<Check color={colors.onGold} size={15} />}
                        />
                        <TouchableOpacity 
                          style={styles.refuseBtn}
                          onPress={async () => {
                            try {
                              await rejectTransferRequest(item.id, user?.id || 'staff', user?.name || 'Responsable');
                            } catch (e) {}
                          }}
                        >
                          <Text style={styles.refuseBtnText}>Refuser</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.waitingNotice}>
                        <Text style={styles.waitingNoticeText}>
                          En attente de validation par l'équipe de {fromName}...
                        </Text>
                        <TouchableOpacity style={styles.cancelSmallBtn} onPress={() => handleCancel(item)}>
                          <Text style={styles.cancelSmallBtnText}>Annuler</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </GlassCard>
                </FadeIn>
              );
            }

            return (
              <FadeIn>
                <PressableScale onPress={() => setSelectedTransfer(item)}>
                  <GlassCard style={[styles.card, isPending && styles.cardPending]} glow={isPending ? 'gold' : 'none'}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productName}>{item.product_name}</Text>
                        <Text style={styles.productDetails}>
                          {item.reference ? `Réf: ${item.reference} • ` : ''}
                          {item.size ? `T: ${item.size} • ` : ''}
                          {item.color ? `C: ${item.color}` : ''}
                        </Text>
                      </View>

                      {isPending && item.estimated_arrival && (
                        <ETACountdown estimatedArrival={item.estimated_arrival} status={item.status} />
                      )}
                      {!isPending && item.status === 'received' && (
                        <View style={styles.badgeReceived}>
                          <Text style={styles.badgeReceivedText}>LIVRÉ</Text>
                        </View>
                      )}
                      {item.status === 'cancelled' && (
                        <View style={styles.badgeCancelled}>
                          <Text style={styles.badgeCancelledText}>ANNULÉ</Text>
                        </View>
                      )}
                      {item.status === 'returned_unsold' && (
                        <View style={styles.badgeUnsold}>
                          <Text style={styles.badgeUnsoldText}>RETOURNÉ</Text>
                        </View>
                      )}
                    </View>

                    {/* Route Diagram */}
                    <View style={styles.routeBox}>
                      <View style={styles.routeEndpoint}>
                        <View style={[styles.routeCircle, { backgroundColor: colors.gold }]} />
                        <Text style={styles.routeStoreName}>{fromName}</Text>
                      </View>
                      
                      <View style={styles.routeMiddle}>
                        <View style={styles.routeDash} />
                        {isPending && (
                          <View style={styles.routeDriverIcon}>
                            <Truck color={colors.gold} size={14} />
                          </View>
                        )}
                        <View style={styles.routeDash} />
                      </View>

                      <View style={styles.routeEndpoint}>
                        <View style={[styles.routeCircle, { backgroundColor: isPending ? 'rgba(255, 255, 255, 0.2)' : colors.success }]} />
                        <Text style={styles.routeStoreName}>{toName}</Text>
                      </View>
                      
                      <View style={styles.qtyBox}>
                        <Text style={styles.qtyText}>x{item.quantity}</Text>
                      </View>
                    </View>

                    {/* Tracking Progress Bar */}
                    {item.tracking_steps && (
                      <TrackingProgressBar steps={item.tracking_steps} currentStep={currentStep} />
                    )}

                    {/* Status Info Row */}
                    <View style={styles.statusLine}>
                      <Text style={[styles.statusText, isPending && { color: colors.gold }]}>
                        {currentStepInfo?.label || 'En transit'} {isPending ? `• ${currentStepInfo?.description || ''}` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => toggleExpand(item.id)} style={{ padding: 4 }}>
                        {isExpanded ? <ChevronUp color={colors.textTertiary} size={16} /> : <ChevronDown color={colors.textTertiary} size={16} />}
                      </TouchableOpacity>
                    </View>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Expédié par</Text>
                          <Text style={styles.expandedValue}>{item.sender_name || item.user_name || 'Vendeur'}</Text>
                        </View>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Coursier</Text>
                          <Text style={[styles.expandedValue, { color: colors.gold, fontWeight: '700' }]}>
                            {item.carrier_name || item.driver_name || 'Coursier'}
                          </Text>
                        </View>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Départ le</Text>
                          <Text style={styles.expandedValue}>
                            {new Date(item.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        {item.estimated_arrival && isPending && (
                          <View style={styles.expandedRow}>
                            <Text style={styles.expandedLabel}>Heure estimée d'arrivée</Text>
                            <Text style={[styles.expandedValue, { color: colors.gold }]}>
                              {new Date(item.estimated_arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              {item.estimated_minutes ? ` (~${item.estimated_minutes} min)` : ''}
                            </Text>
                          </View>
                        )}
                        {!isPending && item.received_by_name && (
                          <View style={styles.expandedRow}>
                            <Text style={styles.expandedLabel}>Réceptionné par</Text>
                            <Text style={[styles.expandedValue, { color: colors.success }]}>
                              {item.received_by_name}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.cardActionsRow}>
                      {canConfirm && (
                        <GoldButton 
                          label={`Confirmer Réception (+${item.quantity} au stock)`}
                          onPress={() => handleConfirm(item)}
                          size="sm"
                          icon={<PackageCheck color={colors.onGold} size={15} />}
                        />
                      )}

                      {isPending && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity 
                            style={styles.cancelActionBtn}
                            onPress={() => handleCancel(item)}
                          >
                            <XCircle color={colors.danger} size={14} />
                            <Text style={styles.cancelActionText}>Annuler</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={styles.unsoldActionBtn}
                            onPress={() => handleReturnUnsold(item)}
                          >
                            <RotateCcw color={colors.warning} size={14} />
                            <Text style={styles.unsoldActionText}>Pas Vendu</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {item.status === 'received' && (
                        <TouchableOpacity 
                          style={styles.unsoldActionBtn}
                          onPress={() => handleReturnUnsold(item)}
                        >
                          <RotateCcw color={colors.warning} size={14} />
                          <Text style={styles.unsoldActionText}>Retourner (Non vendu)</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </GlassCard>
                </PressableScale>
              </FadeIn>
            );
          }}
          ListEmptyComponent={
            <GlassCard style={styles.emptyBox}>
              <Package color={colors.textTertiary} size={42} />
              <Text style={styles.emptyTitle}>Aucun transfert répertorié</Text>
              <Text style={styles.emptySubtitle}>Utilisez le bouton "Demander" pour lancer une expédition inter-boutique.</Text>
            </GlassCard>
          }
        />
      )}

      {/* Tracking Detail Modal */}
      <TrackingDetailModal 
        visible={!!selectedTransfer}
        transfer={selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        user={user}
        onCancel={handleCancel}
        onReturnUnsold={handleReturnUnsold}
        onConfirm={handleConfirm}
      />

      {/* Location Modal */}
      <StoreLocationModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        user={user}
      />

      {/* Transfer Request Modal */}
      <TransferRequestModal
        visible={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        user={user}
        currentStore={selectedFilterStore === 'all' ? (user?.store || 'falaise') : selectedFilterStore}
      />

      {/* Incoming Ringtone Alert Modal */}
      <IncomingTransferAlertModal
        user={user}
        currentStore={selectedFilterStore === 'all' ? (user?.store || 'falaise') : selectedFilterStore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  header: { ...chrome.header },
  headerRow: { ...chrome.headerRow },
  backBtn: { ...chrome.backBtn, marginRight: 10 },
  headerTitleBox: { ...chrome.headerTitleBox },
  screenEyebrow: { ...chrome.screenEyebrow },
  title: { ...chrome.title },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goldNewBtn: { ...chrome.goldBtn },
  goldNewBtnText: { ...chrome.goldBtnText },
  iconBtn: { ...chrome.iconBtn },
  liveStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: alpha(colors.gold, 0.06),
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.2),
    marginBottom: 10,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  liveStripText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  liveStripClock: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tabBar: { ...chrome.segGroup, marginBottom: 10 },
  tabItem: { ...chrome.storeBtn },
  tabItemActive: { ...chrome.storeBtnActive },
  tabItemActiveAmber: { ...chrome.storeBtnActive },
  tabText: { ...chrome.storeBtnText },
  tabTextActive: { ...chrome.storeBtnTextActive },
  storeFilterRow: { ...chrome.segGroup },
  storeFilterBtn: { ...chrome.storeBtn, minHeight: 32, paddingHorizontal: 12 },
  storeFilterBtnActive: { ...chrome.storeBtnActive },
  storeFilterText: { ...chrome.storeBtnText, fontSize: 12 },
  storeFilterTextActive: { ...chrome.storeBtnTextActive },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  listWide: {
    paddingHorizontal: 28,
  },
  card: {
    padding: 16,
    borderRadius: radius.md,
  },
  cardPending: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  productDetails: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  badgeReceived: {
    backgroundColor: alpha(colors.success, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.success, 0.3),
  },
  badgeReceivedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  badgeCancelled: {
    backgroundColor: alpha(colors.danger, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
  },
  badgeCancelledText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  badgeUnsold: {
    backgroundColor: alpha(colors.warning, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.3),
  },
  badgeUnsoldText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 8,
  },
  routeEndpoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeStoreName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  routeMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  routeDash: {
    flex: 1,
    height: 1,
    backgroundColor: alpha(colors.gold, 0.3),
  },
  routeDriverIcon: {
    paddingHorizontal: 6,
  },
  qtyBox: {
    backgroundColor: alpha(colors.gold, 0.1),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginLeft: 6,
  },
  qtyText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
    flex: 1,
  },
  expandedSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 6,
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  expandedLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  expandedValue: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  cardActionsRow: {
    marginTop: 10,
    gap: 8,
  },
  cancelActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: alpha(colors.danger, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    paddingVertical: 7,
    borderRadius: radius.xs,
  },
  cancelActionText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  unsoldActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: alpha(colors.warning, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.3),
    paddingVertical: 7,
    borderRadius: radius.xs,
  },
  unsoldActionText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  requestCard: {
    padding: 16,
    borderRadius: radius.md,
    borderColor: alpha(colors.gold, 0.4),
  },
  qtyPill: {
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  qtyPillText: {
    color: colors.onGold,
    fontWeight: '800',
    fontSize: 12,
  },
  demandBadge: {
    backgroundColor: alpha(colors.gold, 0.15),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  demandBadgeText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  requestRouteRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    marginTop: 6,
  },
  requestRouteText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  requestSellerText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  requestNoteText: {
    color: colors.gold,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  refuseBtn: {
    backgroundColor: alpha(colors.danger, 0.1),
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    justifyContent: 'center',
  },
  refuseBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  waitingNotice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 8,
    borderRadius: radius.xs,
    marginTop: 6,
  },
  waitingNoticeText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.sans,
    flex: 1,
  },
  cancelSmallBtn: {
    backgroundColor: alpha(colors.danger, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  cancelSmallBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.gold,
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginTop: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    fontFamily: fonts.sans,
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
});
