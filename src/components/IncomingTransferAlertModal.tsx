import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Animated, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue, get } from 'firebase/database';
import { 
  PhoneCall, 
  PhoneOff, 
  CheckCircle2, 
  XCircle, 
  Package, 
  MapPin, 
  Tag, 
  Truck, 
  Volume2, 
  VolumeX, 
  Clock, 
  AlertTriangle 
} from 'lucide-react-native';
import { 
  acceptTransferRequest, 
  rejectTransferRequest, 
  silenceTransferRinging, 
  cancelTransfer,
  isSuperBoss, 
  isUserAdmin,
  getUsers
} from '../db/database';
import { 
  startRingtone, 
  stopRingtone, 
  isRingtonePlaying, 
  testRingtone, 
  initAudioUnlock, 
  playRingToneNow,
  startAudioKeepAlive,
  requestDesktopNotificationPermission,
  sendDesktopNotification,
  startFlashingTabTitle,
  stopFlashingTabTitle
} from '../utils/ringtone';

interface IncomingTransferAlertModalProps {
  user: any;
  currentStore?: string;
}

export default function IncomingTransferAlertModal({ user, currentStore }: IncomingTransferAlertModalProps) {
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<any>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [productMetaCache, setProductMetaCache] = useState<Record<string, any>>({});

  // Animations pour la sonnerie & Gyrophare visuel à distance
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const strobeAnim = useRef(new Animated.Value(0)).current;

  // Débloquer l'audio au premier clic et demander les notifications système
  useEffect(() => {
    initAudioUnlock();
    startAudioKeepAlive();
    requestDesktopNotificationPermission();
  }, []);

  // Animation pulsation continue et gyrophare stroboscopique (visible même de loin à travers la boutique)
  useEffect(() => {
    if (activeRequests.length > 0) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

      const shakeLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 6, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
          Animated.delay(1200),
        ])
      );

      const strobeLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(strobeAnim, { toValue: 1, duration: 450, useNativeDriver: false }),
          Animated.timing(strobeAnim, { toValue: 0, duration: 450, useNativeDriver: false }),
        ])
      );

      pulseLoop.start();
      shakeLoop.start();
      strobeLoop.start();

      return () => {
        pulseLoop.stop();
        shakeLoop.stop();
        strobeLoop.stop();
      };
    }
  }, [activeRequests.length]);

  // Récupérer les métadonnées complètes de chaque article depuis Firebase (pour tout voir tel qu'enregistré)
  useEffect(() => {
    if (!selectedRequest) return;
    const items = selectedRequest.items && Array.isArray(selectedRequest.items) && selectedRequest.items.length > 0
      ? selectedRequest.items
      : [{
          product_id: selectedRequest.product_id,
          name: selectedRequest.product_name,
          reference: selectedRequest.reference,
          size: selectedRequest.size,
          color: selectedRequest.color,
          category: selectedRequest.category,
          barcode: selectedRequest.barcode,
          stock: selectedRequest.available_stock,
          price: selectedRequest.price,
          quantity: selectedRequest.quantity
        }];

    items.forEach(async (it: any) => {
      const pId = it.product_id || selectedRequest.product_id;
      if (pId && (!it.category || !it.barcode || !it.price || it.stock === undefined)) {
        try {
          const snap = await get(ref(db, `products/${pId}`));
          if (snap.exists()) {
            const data = snap.val();
            setProductMetaCache(prev => ({
              ...prev,
              [pId]: data
            }));
          }
        } catch (e) {}
      }
    });
  }, [selectedRequest]);

  // Charger les livreurs/personnel pour affectation
  useEffect(() => {
    getUsers().then(list => {
      setCarriers(list);
      if (list.length > 0) setSelectedCarrier(list[0]);
    }).catch(() => {});
  }, []);

  // Écouter les transferts en temps réel sur Firebase
  useEffect(() => {
    const effectiveStore = currentStore || user?.store || 'falaise';
    const isBoss = isSuperBoss(user) || isUserAdmin(user);

    const transfersRef = ref(db, 'transfers');
    const unsubscribe = onValue(transfersRef, (snapshot) => {
      if (!snapshot.exists()) {
        setActiveRequests([]);
        setSelectedRequest(null);
        stopRingtone();
        stopFlashingTabTitle();
        return;
      }

      const data = snapshot.val();
      const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));

      const userStoreLower = (user?.store || '').toLowerCase();
      const currentStoreLower = (currentStore || '').toLowerCase();
      const isBoss = isSuperBoss(user) || isUserAdmin(user) || userStoreLower === 'all';

      // Filtrer les demandes en attente : boutique source, boutique demanderesse ou Boss
      const incoming = list.filter(t => {
        if (t.status !== 'requested') return false;

        const fromStoreLower = (t.from_store || '').toLowerCase();
        const toStoreLower = (t.to_store || '').toLowerCase();

        // Le Boss et les admins reçoivent et entendent TOUTES les demandes
        if (isBoss) return true;

        // La boutique détentrice du stock OU la boutique émettrice de la demande
        return fromStoreLower === currentStoreLower || fromStoreLower === userStoreLower ||
               toStoreLower === currentStoreLower || toStoreLower === userStoreLower;
      });

      incoming.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActiveRequests(incoming);

      if (incoming.length > 0) {
        setSelectedRequest(incoming[0]);

        const req = incoming[0];
        const srcName = req.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
        const destName = req.to_store === 'falaise' ? 'La Falaise' : 'Tougou';
        const totalItemsCount = req.quantity || 1;

        // 1. Clignotement de l'onglet de navigation si la personne est sur une autre application
        startFlashingTabTitle(`🚨 NOUVEAU TRANSFERT (${req.product_name || 'Article'}) !`);

        // 2. Notification système de bureau (Windows / Mac / Android)
        sendDesktopNotification('🚨 DEMANDE DE TRANSFERT CAPITOL !', {
          body: `📦 ${req.requested_by_name || 'Vendeur'} demande ${totalItemsCount}x "${req.product_name || 'Article'}" (${srcName} ➔ ${destName}). Cliquez pour répondre !`,
          tag: 'transfer-' + req.id
        });

        // 3. Maintenir le flux audio éveillé
        startAudioKeepAlive();

        // 4. Déclencher la sonnerie forte (30 cycles en continu = ~100 secondes) si la demande est active et non coupée
        const shouldRing = incoming.some(t => t.request_ringing !== false);
        if (shouldRing && !soundMuted) {
          startRingtone({
            maxRings: 30,
            onEnd: () => {
              // Sonnerie terminée
            }
          });
        }
      } else {
        setSelectedRequest(null);
        stopRingtone();
        stopFlashingTabTitle();
      }
    });

    return () => {
      unsubscribe();
      stopRingtone();
      stopFlashingTabTitle();
    };
  }, [user, currentStore, soundMuted]);

  const handleMuteSound = () => {
    stopRingtone();
    stopFlashingTabTitle();
    setSoundMuted(true);
    if (selectedRequest?.id) {
      silenceTransferRinging(selectedRequest.id).catch(() => {});
    }
  };

  const handleAccept = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    stopRingtone();
    stopFlashingTabTitle();

    try {
      const carrierName = selectedCarrier?.name || 'Livreur Express';
      const carrierId = selectedCarrier?.id || '';

      await acceptTransferRequest(
        selectedRequest.id,
        user?.id || 'admin',
        user?.name || 'Responsable',
        carrierName,
        carrierId,
        15 // 15 minutes estimées
      );

      const destName = selectedRequest.to_store === 'falaise' ? 'La Falaise' : 'Tougou';
      const msg = `Transfert validé ! Le colis est en route vers ${destName} avec ${carrierName}. Le trajet de 15 minutes est en direct sur la carte !`;
      
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      else Alert.alert('Succès', msg);
    } catch (e: any) {
      const err = e?.message || 'Erreur lors de la validation.';
      if (typeof window !== 'undefined' && window.alert) window.alert(err);
      else Alert.alert('Erreur', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    const doReject = async (reason: string) => {
      setIsProcessing(true);
      stopRingtone();
      try {
        await rejectTransferRequest(
          selectedRequest.id,
          user?.id || 'admin',
          user?.name || 'Responsable',
          reason
        );
        const msg = 'Demande de transfert refusée.';
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Information', msg);
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Erreur lors du refus.');
      } finally {
        setIsProcessing(false);
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Voulez-vous refuser cette demande de transfert ?')) {
        const reason = window.prompt('Motif du refus (optionnel) :', 'Rupture de stock / Article réservé');
        doReject(reason || 'Stock indisponible');
      }
      return;
    }

    Alert.alert(
      'Refuser la demande',
      'Êtes-vous sûr de vouloir refuser cette demande de transfert ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Refuser', style: 'destructive', onPress: () => doReject('Stock indisponible') }
      ]
    );
  };

  // Annuler la demande (Accessible par la boutique demanderesse ou le Boss)
  const handleCancelRequest = async () => {
    if (!selectedRequest) return;
    stopRingtone();

    const doCancel = async () => {
      setIsProcessing(true);
      try {
        await cancelTransfer(
          selectedRequest.id,
          user?.id || 'staff',
          user?.name || 'Vendeur',
          'Demande annulée par le demandeur'
        );
        const msg = '✅ Demande de transfert annulée.';
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Information', msg);
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Erreur lors de l\'annulation.');
      } finally {
        setIsProcessing(false);
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Voulez-vous annuler votre demande de transfert ?')) {
        doCancel();
      }
      return;
    }

    Alert.alert(
      'Annuler la demande',
      'Êtes-vous sûr de vouloir annuler cette demande de transfert ?',
      [
        { text: 'Non, garder', style: 'cancel' },
        { text: 'Oui, annuler', style: 'destructive', onPress: doCancel }
      ]
    );
  };

  if (!selectedRequest) return null;

  const userStoreLower = (user?.store || '').toLowerCase();
  const currentStoreLower = (currentStore || '').toLowerCase();
  const isBossUser = isSuperBoss(user) || isUserAdmin(user) || userStoreLower === 'all';
  const isRequesterSide = !isBossUser && (
    (selectedRequest.to_store && (selectedRequest.to_store.toLowerCase() === currentStoreLower || selectedRequest.to_store.toLowerCase() === userStoreLower)) ||
    (user?.id && selectedRequest.requested_by_id === user.id)
  );

  const fromStoreName = selectedRequest.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
  const toStoreName = selectedRequest.to_store === 'falaise' ? 'La Falaise' : 'Tougou';

  const itemsList = selectedRequest.items && Array.isArray(selectedRequest.items) && selectedRequest.items.length > 0
    ? selectedRequest.items
    : [{
        product_id: selectedRequest.product_id,
        name: selectedRequest.product_name,
        reference: selectedRequest.reference,
        size: selectedRequest.size,
        color: selectedRequest.color,
        category: selectedRequest.category,
        barcode: selectedRequest.barcode,
        stock: selectedRequest.available_stock,
        price: selectedRequest.price,
        quantity: selectedRequest.quantity
      }];

  const totalQty = itemsList.reduce((s: number, it: any) => s + (it.quantity || 1), 0);

  const borderColorAnim = strobeAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#d4af37', '#ff3b30', '#ffaa00']
  });

  const strobeBannerBg = strobeAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#ffaa00', '#ff3b30', '#d4af37']
  });

  return (
    <Modal visible={true} transparent={true} animationType="fade">
      <TouchableOpacity 
        activeOpacity={1} 
        style={styles.overlay}
        onPress={() => {
          // Un clic n'importe où sur l'écran débloque l'audio et garantit la sonnerie
          startAudioKeepAlive();
          if (!soundMuted) {
            playRingToneNow(30);
          }
        }}
      >
        <Animated.View style={[styles.container, { borderColor: borderColorAnim }]}>
          {/* Gyrophare Visuel Stroboscopique (attire l'attention même de loin à travers la boutique) */}
          <Animated.View style={[styles.strobeBanner, { backgroundColor: strobeBannerBg }]}>
            <AlertTriangle color="#121212" size={18} style={{ marginRight: 8 }} />
            <Text style={styles.strobeBannerText}>
              🚨 ATTENTION : DEMANDE DE TRANSFERT ENTRANTE (SONNERIE ACTIVE)
            </Text>
          </Animated.View>

          {/* Alerte Sonnerie Animée */}
          <View style={styles.topAlarmBar}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }, { translateX: shakeAnim }] }}>
              <View style={styles.phoneIconCircle}>
                <PhoneCall color="#121212" size={28} />
              </View>
            </Animated.View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.topAlarmTitle}>
                {isRequesterSide ? '📞 DEMANDE ENVOYÉE — EN COURS' : '🚨 NOUVELLE DEMANDE DE TRANSFERT !'}
              </Text>
              <Text style={styles.topAlarmSubtitle}>
                {isRequesterSide 
                  ? `En attente de validation par ${fromStoreName} (Leur téléphone sonne)`
                  : `📞 Téléphone sonne fort (${activeRequests.length} demande${activeRequests.length > 1 ? 's' : ''} en attente)`
                }
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleMuteSound} 
              style={[styles.muteBtn, soundMuted && { backgroundColor: '#2d1010', borderColor: '#ff5252' }]}
            >
              {soundMuted ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <VolumeX color="#ff5252" size={18} />
                  <Text style={{ color: '#ff5252', fontSize: 12, fontWeight: 'bold' }}>Coupé</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Volume2 color="#d4af37" size={18} />
                  <Text style={{ color: '#d4af37', fontSize: 12, fontWeight: 'bold' }}>Couper le son</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Bannière d'activation sonore garantie (déclenchée par un tap direct à 100% de puissance) */}
          <TouchableOpacity 
            style={styles.soundTriggerBanner}
            onPress={() => {
              setSoundMuted(false);
              startAudioKeepAlive();
              playRingToneNow(30);
            }}
          >
            <Volume2 color="#121212" size={20} />
            <Text style={styles.soundTriggerText}>
              🔊 SONNERIE FORTE AUTOMATIQUE (Cliquez n'importe où pour forcer à 100%)
            </Text>
          </TouchableOpacity>

          <ScrollView style={styles.contentScroll} contentContainerStyle={{ padding: 18 }}>
            {/* Bannière magasins */}
            <View style={styles.routeBox}>
              <View style={styles.storeBadge}>
                <Text style={styles.storeBadgeLabel}>DEPUIS VOTRE STOCK</Text>
                <Text style={styles.storeBadgeName}>{fromStoreName}</Text>
              </View>
              <View style={styles.arrowBox}>
                <Text style={{ fontSize: 22 }}>➔</Text>
              </View>
              <View style={[styles.storeBadge, { backgroundColor: '#1a2a1a', borderColor: '#4CAF5060' }]}>
                <Text style={[styles.storeBadgeLabel, { color: '#4CAF50' }]}>POUR LA BOUTIQUE</Text>
                <Text style={[styles.storeBadgeName, { color: '#4CAF50' }]}>{toStoreName}</Text>
              </View>
            </View>

            {/* Demandeur */}
            <View style={styles.requesterCard}>
              <Text style={styles.requesterLabel}>Demandé par :</Text>
              <Text style={styles.requesterName}>
                👤 {selectedRequest.requested_by_name || selectedRequest.requester_name || 'Vendeur'}
              </Text>
              {selectedRequest.note ? (
                <Text style={styles.requesterNote}>💬 "{selectedRequest.note}"</Text>
              ) : null}
            </View>

            {/* Liste des articles demandés avec TOUTES leurs caractéristiques d'enregistrement */}
            <Text style={styles.sectionTitle}>
              Articles demandés à sortir du stock ({totalQty} unité{totalQty > 1 ? 's' : ''}) :
            </Text>

            {itemsList.map((item: any, idx: number) => {
              const pId = item.product_id || selectedRequest.product_id;
              const meta = (pId && productMetaCache[pId]) || {};

              const name = item.name || item.product_name || meta.name || 'Article sans nom';
              const reference = item.reference || meta.reference || '';
              const size = item.size || meta.size || '';
              const color = item.color || meta.color || '';
              const category = item.category || meta.category || '';
              const barcode = item.barcode || meta.barcode || '';
              const price = item.price || meta.price || 0;
              const stock = item.stock !== undefined 
                ? item.stock 
                : (item.available_stock !== undefined ? item.available_stock : (meta.stock !== undefined ? meta.stock : null));
              const qty = item.quantity || 1;

              return (
                <View key={idx} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemNameRow}>
                      <Package color="#d4af37" size={18} style={{ marginRight: 6 }} />
                      <Text style={styles.itemName}>{name}</Text>
                    </View>

                    {/* Tous les détails tels qu'enregistrés dans la base de données */}
                    <View style={styles.specsRow}>
                      {reference ? (
                        <View style={styles.specBadgeRef}>
                          <Tag color="#d4af37" size={11} style={{ marginRight: 4 }} />
                          <Text style={styles.specBadgeRefText}>Réf : {reference}</Text>
                        </View>
                      ) : null}

                      {size ? (
                        <View style={styles.specBadgeSize}>
                          <Text style={styles.specBadgeSizeText}>📏 Taille/Pointure : {size}</Text>
                        </View>
                      ) : null}

                      {color ? (
                        <View style={styles.specBadgeColor}>
                          <Text style={styles.specBadgeColorText}>🎨 Couleur : {color}</Text>
                        </View>
                      ) : null}

                      {category ? (
                        <View style={styles.specBadgeCategory}>
                          <Text style={styles.specBadgeCategoryText}>📁 {category}</Text>
                        </View>
                      ) : null}

                      {price ? (
                        <View style={styles.specBadgePrice}>
                          <Text style={styles.specBadgePriceText}>💰 {Number(price).toLocaleString('fr-FR')} FCFA</Text>
                        </View>
                      ) : null}

                      {stock !== null && stock !== undefined ? (
                        <View style={styles.specBadgeStock}>
                          <Text style={styles.specBadgeStockText}>📦 Stock restant chez vous : {stock} unité(s)</Text>
                        </View>
                      ) : null}

                      {barcode ? (
                        <View style={styles.specBadgeBarcode}>
                          <Text style={styles.specBadgeBarcodeText}>🔢 Code : {barcode}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyLabel}>DEMANDÉ</Text>
                    <Text style={styles.qtyText}>x{qty}</Text>
                  </View>
                </View>
              );
            })}

            {/* Choix Livreur */}
            <View style={styles.carrierBox}>
              <Text style={styles.carrierBoxTitle}>🏍️ Livreur / Transporteur :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.carrierChip, !selectedCarrier && styles.carrierChipActive]}
                  onPress={() => setSelectedCarrier({ name: 'Livreur Express' })}
                >
                  <Text style={[styles.carrierChipText, !selectedCarrier && styles.carrierChipTextActive]}>
                    ⚡ Livreur Express
                  </Text>
                </TouchableOpacity>
                {carriers.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.carrierChip, selectedCarrier?.id === c.id && styles.carrierChipActive]}
                    onPress={() => setSelectedCarrier(c)}
                  >
                    <Text style={[styles.carrierChipText, selectedCarrier?.id === c.id && styles.carrierChipTextActive]}>
                      👤 {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.travelEstBox}>
              <Clock color="#d4af37" size={16} />
              <Text style={styles.travelEstText}>
                Durée de trajet estimée : <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>~15 minutes</Text> (Départ immédiat)
              </Text>
            </View>
          </ScrollView>

          {/* Boutons d'Action */}
          <View style={styles.actionsFooter}>
            {isRequesterSide ? (
              <>
                <TouchableOpacity 
                  style={[styles.rejectBtn, { backgroundColor: '#2b1010', borderColor: '#ff5252' }]}
                  onPress={handleCancelRequest}
                  disabled={isProcessing}
                >
                  <XCircle color="#ff5252" size={18} style={{ marginRight: 6 }} />
                  <Text style={[styles.rejectBtnText, { color: '#ff5252' }]}>Annuler ma Demande</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.acceptBtn, { backgroundColor: '#332408', borderColor: '#d4af37', borderWidth: 1 }]}
                  onPress={() => playRingToneNow(30)}
                  disabled={isProcessing}
                >
                  <Volume2 color="#d4af37" size={20} style={{ marginRight: 8 }} />
                  <Text style={[styles.acceptBtnText, { color: '#d4af37' }]}>Réécouter Sonnerie Forte</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.rejectBtn}
                  onPress={handleReject}
                  disabled={isProcessing}
                >
                  <XCircle color="#ff5252" size={18} style={{ marginRight: 6 }} />
                  <Text style={styles.rejectBtnText}>Refuser</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.acceptBtn, isProcessing && styles.btnDisabled]}
                  onPress={handleAccept}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#121212" />
                  ) : (
                    <>
                      <CheckCircle2 color="#121212" size={20} style={{ marginRight: 8 }} />
                      <Text style={styles.acceptBtnText}>Accepter & Expédier</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#181818',
    borderRadius: 22,
    width: '100%',
    maxWidth: 540,
    maxHeight: '92%',
    borderWidth: 3,
    borderColor: '#d4af37',
    overflow: 'hidden',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
  },
  strobeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  strobeBannerText: {
    color: '#121212',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topAlarmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b2005',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d4af3750',
  },
  phoneIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d4af37',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  topAlarmTitle: {
    color: '#d4af37',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  topAlarmSubtitle: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  muteBtn: {
    padding: 8,
    backgroundColor: '#1f1f1f',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  contentScroll: {
    maxHeight: 520,
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#262626',
  },
  storeBadge: {
    flex: 1,
    backgroundColor: '#262010',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4af3740',
  },
  storeBadgeLabel: {
    color: '#d4af37',
    fontSize: 10,
    fontWeight: 'bold',
  },
  storeBadgeName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  arrowBox: {
    paddingHorizontal: 10,
  },
  requesterCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  requesterLabel: {
    color: '#888',
    fontSize: 11,
  },
  requesterName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  requesterNote: {
    color: '#d4af37',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specBadgeRef: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252008',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  specBadgeRefText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  specBadgeSize: {
    backgroundColor: '#0c2238',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  specBadgeSizeText: {
    color: '#64B5F6',
    fontSize: 11,
    fontWeight: 'bold',
  },
  specBadgeColor: {
    backgroundColor: '#261233',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#AB47BC',
  },
  specBadgeColorText: {
    color: '#CE93D8',
    fontSize: 11,
    fontWeight: '600',
  },
  specBadgeCategory: {
    backgroundColor: '#2b1b08',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  specBadgeCategoryText: {
    color: '#FFB74D',
    fontSize: 11,
    fontWeight: '600',
  },
  specBadgePrice: {
    backgroundColor: '#0c2617',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  specBadgePriceText: {
    color: '#81C784',
    fontSize: 11,
    fontWeight: 'bold',
  },
  specBadgeStock: {
    backgroundColor: '#1b2b10',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8BC34A',
  },
  specBadgeStockText: {
    color: '#AED581',
    fontSize: 11,
    fontWeight: 'bold',
  },
  specBadgeBarcode: {
    backgroundColor: '#1c1c1c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555',
  },
  specBadgeBarcodeText: {
    color: '#bbb',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qtyBox: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  qtyLabel: {
    color: '#121212',
    fontSize: 8,
    fontWeight: '900',
  },
  qtyText: {
    color: '#121212',
    fontSize: 18,
    fontWeight: '900',
  },
  carrierBox: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  carrierBoxTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  carrierChip: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  carrierChipActive: {
    backgroundColor: '#2e240a',
    borderColor: '#d4af37',
  },
  carrierChipText: {
    color: '#aaa',
    fontSize: 12,
  },
  carrierChipTextActive: {
    color: '#d4af37',
    fontWeight: 'bold',
  },
  travelEstBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#141414',
    borderRadius: 10,
  },
  travelEstText: {
    color: '#aaa',
    fontSize: 12,
  },
  actionsFooter: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: 12,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a1515',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff525250',
  },
  rejectBtnText: {
    color: '#ff5252',
    fontSize: 14,
    fontWeight: 'bold',
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#d4af37',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  acceptBtnText: {
    color: '#121212',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  soundTriggerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 8,
  },
  soundTriggerText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
