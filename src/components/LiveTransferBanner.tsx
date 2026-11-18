import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated, Linking } from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { Truck, MapPin, CheckCircle2, Clock, Navigation, ChevronRight, ChevronLeft, ShieldCheck, Sparkles, Radio, ExternalLink, Settings, XCircle, RotateCcw } from 'lucide-react-native';
import { confirmTransferReceipt, isUserAdmin, updateTransferLocation, cancelTransfer, returnUnsoldTransfer } from '../db/database';
import StoreLocationModal from './StoreLocationModal';

interface LiveTransferBannerProps {
  user: any;
  currentStore?: string;
  onOpenDetails?: (transfer: any) => void;
  navigation?: any;
}

export default function LiveTransferBanner({ user, currentStore, onOpenDetails, navigation }: LiveTransferBannerProps) {
  const [activeTransfers, setActiveTransfers] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Animation pour le véhicule en mouvement (style Yango / InDrive / Glovo)
  const vehicleAnim = useRef(new Animated.Value(0)).current;

  // 1. Écouter les transferts actifs en temps réel sur Firebase
  useEffect(() => {
    const transfersRef = ref(db, 'transfers');
    const unsubscribe = onValue(transfersRef, (snapshot) => {
      if (!snapshot.exists()) {
        setActiveTransfers([]);
        return;
      }
      const data = snapshot.val();
      const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));

      // Filtrer les transferts en cours (non encore reçus, non annulés, non retournés, non rejetés)
      const inTransit = list.filter(t => 
        t.status !== 'received' && 
        t.status !== 'rejected' && 
        t.status !== 'cancelled' && 
        t.status !== 'returned_unsold'
      );

      // Trier par le plus récent
      inTransit.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActiveTransfers(inTransit);

      if (currentIndex >= inTransit.length && inTransit.length > 0) {
        setCurrentIndex(0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Horloge chaque seconde pour actualiser le compte à rebours et l'avancement automatique
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTransfer = activeTransfers[currentIndex];

  // 3. Calcul de la progression automatique en temps réel (Style Glovo / Yango)
  const progressData = React.useMemo(() => {
    if (!currentTransfer) return { percent: 0, timeLeftText: '', stageText: '', isArrived: false };

    if (currentTransfer.status === 'requested') {
      const fromName = currentTransfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
      return {
        percent: 0,
        timeLeftText: 'En attente',
        stageText: `📞 Demande envoyée — En attente validation par ${fromName}`,
        isArrived: false
      };
    }

    const startTime = currentTransfer.start_time 
      ? Number(currentTransfer.start_time) 
      : new Date(currentTransfer.date).getTime();
    const durationMinutes = Number(currentTransfer.estimated_minutes) || 15;
    const durationMs = durationMinutes * 60 * 1000;
    const elapsedMs = Math.max(0, now - startTime);
    const rawPercent = (elapsedMs / durationMs) * 100;
    const percent = Math.min(100, Math.max(5, Math.floor(rawPercent)));

    const remainingMs = Math.max(0, durationMs - elapsedMs);
    const remMins = Math.floor(remainingMs / 60000);
    const remSecs = Math.floor((remainingMs % 60000) / 1000);

    const isArrived = percent >= 100 || remainingMs <= 0;

    let stageText = '📦 Colis en préparation';
    if (percent >= 100) {
      stageText = '🏁 Arrivé à destination ! Prêt pour réception';
    } else if (percent >= 80) {
      stageText = '📍 Arrivée imminente (~2 min)';
    } else if (percent >= 40) {
      stageText = '🏍️ En plein trajet (Trajet en direct)';
    } else if (percent >= 15) {
      stageText = `🤝 Récupéré par ${currentTransfer.carrier_name || currentTransfer.driver_name || 'le livreur'}`;
    }

    const timeLeftText = isArrived 
      ? 'Arrivé à destination !' 
      : `${remMins} min ${remSecs.toString().padStart(2, '0')} s`;

    return { percent, timeLeftText, stageText, isArrived };
  }, [currentTransfer, now]);

  // 4. Animer le déplacement fluide du véhicule
  useEffect(() => {
    Animated.timing(vehicleAnim, {
      toValue: progressData.percent,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progressData.percent]);

  // 5. Suivi GPS automatique si le livreur clique ou si le navigateur le permet
  const toggleGpsTracking = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      Alert.alert('GPS non disponible', 'La géolocalisation n\'est pas supportée sur ce navigateur.');
      return;
    }

    if (gpsActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
    } else {
      try {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            if (currentTransfer?.id) {
              updateTransferLocation(currentTransfer.id, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed: pos.coords.speed || 0,
                heading: pos.coords.heading || 0
              });
            }
          },
          (err) => console.log('Erreur GPS:', err?.message),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
        watchIdRef.current = id;
        setGpsActive(true);
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Impossible d\'activer le GPS');
      }
    }
  };

  // 6. Confirmer la réception en 1 clic
  const handleConfirmReceipt = async () => {
    if (!currentTransfer) return;
    setConfirmingId(currentTransfer.id);
    try {
      await confirmTransferReceipt(currentTransfer.id, user?.id || 'staff', user?.name || 'Vendeur');
      const msg = `✅ Transfert validé avec succès ! ${currentTransfer.quantity}x "${currentTransfer.product_name}" ont été ajoutés au stock de ${currentTransfer.to_store === 'falaise' ? 'La Falaise' : 'Tougou'}.`;
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      else Alert.alert('Succès', msg);
    } catch (e: any) {
      if (typeof window !== 'undefined' && window.alert) window.alert(e?.message || 'Erreur lors de la réception');
      else Alert.alert('Erreur', e?.message || 'Impossible de réceptionner');
    } finally {
      setConfirmingId(null);
    }
  };

  // 7. Annuler le transfert (Le stock revient immédiatement au magasin d'origine)
  const handleCancelTransfer = async () => {
    if (!currentTransfer) return;
    const fromName = currentTransfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';

    const confirmPrompt = async () => {
      try {
        await cancelTransfer(currentTransfer.id, user?.id || 'staff', user?.name || 'Vendeur', 'Annulé depuis la bannière de suivi');
        const msg = `✅ Transfert annulé avec succès ! ${currentTransfer.quantity}x "${currentTransfer.product_name}" a été restitué au stock de ${fromName}.`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Transfert annulé', msg);
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Impossible d\'annuler le transfert');
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`⚠️ Annuler ce transfert ?\n\nLe stock (${currentTransfer.quantity}x "${currentTransfer.product_name}") sera immédiatement restitué au magasin d'origine (${fromName}).`)) {
        confirmPrompt();
      }
      return;
    }

    Alert.alert(
      'Annuler le transfert',
      `Le stock (${currentTransfer.quantity}x "${currentTransfer.product_name}") sera immédiatement restitué à ${fromName}.`,
      [
        { text: 'Non, garder', style: 'cancel' },
        { text: 'Oui, annuler & restituer stock', style: 'destructive', onPress: confirmPrompt }
      ]
    );
  };

  // 8. Article Non Vendu / Pas Vendre (Le stock part à la boutique qui a transféré)
  const handleReturnUnsold = async () => {
    if (!currentTransfer) return;
    const fromName = currentTransfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';

    const confirmPrompt = async () => {
      try {
        await returnUnsoldTransfer(currentTransfer.id, user?.id || 'staff', user?.name || 'Vendeur', 'Client n\'a pas acheté / Article non vendu');
        const msg = `✅ Article non vendu ! ${currentTransfer.quantity}x "${currentTransfer.product_name}" a été retourné au stock de ${fromName}.`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('Article non vendu', msg);
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Impossible d\'enregistrer le retour');
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`↩️ Article Non Vendu ?\n\nLe client n'a pas acheté l'article ?\nLe stock (${currentTransfer.quantity}x "${currentTransfer.product_name}") sera automatiquement retourné au stock de ${fromName}.`)) {
        confirmPrompt();
      }
      return;
    }

    Alert.alert(
      'Article non vendu',
      `Le client n'a pas acheté cet article ? Le stock sera automatiquement retourné à ${fromName}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Oui, retourner à ' + fromName, onPress: confirmPrompt }
      ]
    );
  };

  // S'il n'y a aucun transfert en cours, ne rien afficher
  if (activeTransfers.length === 0) {
    return null;
  }

  const fromLabel = currentTransfer.from_store === 'falaise' ? 'La Falaise' : 'Tougou';
  const toLabel = currentTransfer.to_store === 'falaise' ? 'La Falaise' : 'Tougou';

  // Qui peut valider la réception ? La boutique de destination, le récepteur/coursier assigné ou le Boss
  const canValidate = isUserAdmin(user) || 
                      user?.store === 'all' || 
                      user?.store === currentTransfer.to_store ||
                      user?.id === currentTransfer.carrier_id;

  const isAssignedCarrier = user?.id === currentTransfer.carrier_id || 
                           (user?.name && currentTransfer.carrier_name && user.name.toLowerCase() === currentTransfer.carrier_name.toLowerCase());

  const isSender = user?.id === currentTransfer.sender_id || user?.id === currentTransfer.user_id;

  // Interpolation de la position du véhicule sur la barre (0% à 90%)
  const vehicleLeft = vehicleAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['2%', '90%'],
  });

  return (
    <View style={styles.wrapper}>
      {/* Header du Widget Live */}
      <View style={styles.topBar}>
        <View style={styles.liveIndicator}>
          <View style={styles.pulsingDot} />
          <Text style={styles.liveTitle}>SUIVI DE LIVRAISON EN DIRECT</Text>
          <Text style={styles.liveBadge}>LIVE YANGO/GLOVO</Text>
        </View>

        {activeTransfers.length > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity 
              disabled={currentIndex === 0} 
              onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              style={[styles.pageBtn, currentIndex === 0 && { opacity: 0.3 }]}
            >
              <ChevronLeft color="#d4af37" size={16} />
            </TouchableOpacity>
            <Text style={styles.pageText}>{currentIndex + 1} / {activeTransfers.length}</Text>
            <TouchableOpacity 
              disabled={currentIndex === activeTransfers.length - 1} 
              onPress={() => setCurrentIndex(prev => Math.min(activeTransfers.length - 1, prev + 1))}
              style={[styles.pageBtn, currentIndex === activeTransfers.length - 1 && { opacity: 0.3 }]}
            >
              <ChevronRight color="#d4af37" size={16} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Carte du Transfert */}
      <View style={styles.card}>
        {/* Ligne 1 : Info Produit & Qui l'a envoyé */}
        <View style={styles.productRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.productName}>{currentTransfer.product_name}</Text>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyBadgeText}>x{currentTransfer.quantity}</Text>
              </View>
            </View>
            <Text style={styles.productSub}>
              {currentTransfer.reference ? `Réf: ${currentTransfer.reference} • ` : ''}
              {currentTransfer.size ? `Taille: ${currentTransfer.size} • ` : ''}
              {currentTransfer.color ? `Couleur: ${currentTransfer.color} • ` : ''}
              {currentTransfer.category ? `Catégorie: ${currentTransfer.category} • ` : ''}
              {currentTransfer.price ? `${Number(currentTransfer.price).toLocaleString()} FCFA • ` : ''}
              Demandé par <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>{currentTransfer.requested_by_name || currentTransfer.sender_name || currentTransfer.user_name || 'Vendeur'}</Text>
            </Text>
          </View>

          {/* Badge du rôle de la personne connectée */}
          {isSender && (
            <View style={[styles.roleTag, { backgroundColor: '#332410', borderColor: '#FF9800' }]}>
              <Text style={{ color: '#FF9800', fontSize: 10, fontWeight: 'bold' }}>📤 Vous avez envoyé</Text>
            </View>
          )}
          {isAssignedCarrier && (
            <View style={[styles.roleTag, { backgroundColor: '#103020', borderColor: '#4CAF50' }]}>
              <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: 'bold' }}>🏍️ Vous êtes coursier</Text>
            </View>
          )}
        </View>

        {/* Ligne 2 : Profil sélectionné (Livreur / Transporteur / Réceptionnaire) */}
        <View style={styles.carrierRow}>
          <View style={styles.carrierBadge}>
            <Text style={{ fontSize: 14 }}>🏍️</Text>
            <Text style={styles.carrierLabel}>Livreur / Coursier :</Text>
            <Text style={styles.carrierName}>
              {currentTransfer.carrier_name || currentTransfer.driver_name || 'Livreur'}
            </Text>
          </View>

          <View style={[styles.etaBadge, progressData.isArrived && styles.etaBadgeArrived]}>
            <Clock color={progressData.isArrived ? '#4CAF50' : '#d4af37'} size={14} />
            <Text style={[styles.etaText, progressData.isArrived && { color: '#4CAF50' }]}>
              {progressData.timeLeftText}
            </Text>
          </View>
        </View>

        {/* Visualisation Interactive du Chemin en Temps Réel (Style InDrive / Glovo) */}
        <View style={styles.routeContainer}>
          {/* Ligne des magasins Départ -> Arrivée avec Adresses */}
          <View style={styles.routeHeader}>
            <View style={styles.storePin}>
              <View style={[styles.pinCircle, { backgroundColor: '#d4af37' }]} />
              <View>
                <Text style={styles.storeName}>📍 {fromLabel}</Text>
                {currentTransfer.from_address && (
                  <Text style={styles.storeAddressText} numberOfLines={1}>{currentTransfer.from_address}</Text>
                )}
              </View>
            </View>

            <View style={styles.routeMiddleLabel}>
              <Text style={styles.stageLabelText}>{progressData.stageText}</Text>
              <Text style={styles.progressPercentText}>
                {progressData.percent}% du trajet {currentTransfer.distance_km ? `• ${currentTransfer.distance_km} km` : ''}
              </Text>
              {currentTransfer.estimated_arrival && (
                <Text style={styles.etaClockText}>
                  🕒 Arrivée prévue : {new Date(currentTransfer.estimated_arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>

            <View style={[styles.storePin, { alignItems: 'flex-end' }]}>
              <View style={[styles.pinCircle, { backgroundColor: progressData.isArrived ? '#4CAF50' : '#ff9800' }]} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.storeName}>🏁 {toLabel}</Text>
                {currentTransfer.to_address && (
                  <Text style={styles.storeAddressText} numberOfLines={1}>{currentTransfer.to_address}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Barre de trajet animée avec icône Moto / Véhicule en direct */}
          <View style={styles.routeTrack}>
            <Animated.View style={[styles.routeFill, { width: vehicleAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%']
            }) }]} />
            
            <Animated.View style={[styles.movingVehicle, { left: vehicleLeft }]}>
              <View style={styles.vehicleBubble}>
                <Text style={{ fontSize: 16 }}>🏍️</Text>
              </View>
              <View style={styles.vehiclePulse} />
            </Animated.View>
          </View>
        </View>

        {/* Boutons d'Action Rapide */}
        <View style={styles.actionRow}>
          {canValidate && (
            <TouchableOpacity 
              style={[styles.validateBtn, confirmingId === currentTransfer.id && { opacity: 0.6 }]}
              disabled={confirmingId === currentTransfer.id}
              onPress={handleConfirmReceipt}
            >
              {confirmingId === currentTransfer.id ? (
                <ActivityIndicator size="small" color="#121212" />
              ) : (
                <>
                  <CheckCircle2 color="#121212" size={16} />
                  <Text style={styles.validateBtnText}>Valider la Réception & Stock</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Bouton Google Maps direct */}
          <TouchableOpacity 
            style={styles.gmapsBtn} 
            onPress={() => {
              const isFromFalaise = (currentTransfer.from_store || '').toLowerCase() === 'falaise';
              const originLat = currentTransfer.origin_coords?.lat || (isFromFalaise ? 3.870472 : 3.882472);
              const originLng = currentTransfer.origin_coords?.lng || (isFromFalaise ? 11.516083 : 11.523361);
              const destLat = currentTransfer.dest_coords?.lat || (isFromFalaise ? 3.882472 : 3.870472);
              const destLng = currentTransfer.dest_coords?.lng || (isFromFalaise ? 11.523361 : 11.516083);
              const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
              if (typeof window !== 'undefined' && window.open) {
                window.open(url, '_blank');
              } else {
                Linking.openURL(url).catch(() => {});
              }
            }}
          >
            <Navigation color="#2196F3" size={14} />
            <Text style={styles.gmapsBtnText}>🗺️ Voir le Chemin GPS</Text>
          </TouchableOpacity>

          {isAssignedCarrier && (
            <TouchableOpacity 
              style={[styles.gpsBtn, gpsActive && styles.gpsBtnActive]} 
              onPress={toggleGpsTracking}
            >
              <Radio color={gpsActive ? '#4CAF50' : '#aaa'} size={14} />
              <Text style={[styles.gpsBtnText, gpsActive && { color: '#4CAF50' }]}>
                {gpsActive ? 'GPS Actif 🟢' : 'Partager GPS'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Bouton réglage adresses GPS magasins */}
          <TouchableOpacity 
            style={styles.settingsBtn} 
            onPress={() => setShowLocationModal(true)}
          >
            <MapPin color="#d4af37" size={14} />
            <Text style={styles.settingsBtnText}>Adresses GPS</Text>
          </TouchableOpacity>

          {/* Bouton Annuler le transfert */}
          <TouchableOpacity 
            style={styles.cancelBtn} 
            onPress={handleCancelTransfer}
          >
            <XCircle color="#ff5252" size={14} />
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>

          {/* Bouton Article Pas Vendu (Retour Magasin) */}
          <TouchableOpacity 
            style={styles.unsoldBtn} 
            onPress={handleReturnUnsold}
          >
            <RotateCcw color="#FF9800" size={14} />
            <Text style={styles.unsoldBtnText}>Pas Vendu (Retour)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.detailsBtn} 
            onPress={() => {
              if (onOpenDetails) {
                onOpenDetails(currentTransfer);
              } else if (navigation) {
                navigation.navigate('Transfers', { user, storeId: currentStore });
              }
            }}
          >
            <Navigation color="#d4af37" size={14} />
            <Text style={styles.detailsBtnText}>Voir le Suivi</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de configuration des adresses GPS Tougou & Falaise */}
      <StoreLocationModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        user={user}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#181818',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#241c08',
    borderBottomWidth: 1,
    borderBottomColor: '#d4af3744',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00e676',
    shadowColor: '#00e676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  liveTitle: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveBadge: {
    backgroundColor: '#00e67622',
    color: '#00e676',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00e67655',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageBtn: {
    padding: 3,
    backgroundColor: '#2a2008',
    borderRadius: 4,
  },
  pageText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  card: {
    padding: 14,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  qtyBadge: {
    backgroundColor: '#d4af3722',
    borderColor: '#d4af37',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  qtyBadgeText: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productSub: {
    color: '#888',
    fontSize: 11,
    marginTop: 3,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  carrierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#202020',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  carrierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  carrierLabel: {
    color: '#888',
    fontSize: 12,
  },
  carrierName: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: 'bold',
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2a2008',
    borderColor: '#d4af3766',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  etaBadgeArrived: {
    backgroundColor: '#0a2a0a',
    borderColor: '#4CAF5066',
  },
  etaText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  routeContainer: {
    backgroundColor: '#121212',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storePin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storeName: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: 'bold',
  },
  routeMiddleLabel: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  stageLabelText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressPercentText: {
    color: '#777',
    fontSize: 10,
    marginTop: 2,
  },
  routeTrack: {
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    position: 'relative',
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  routeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#d4af37',
    borderRadius: 3,
  },
  movingVehicle: {
    position: 'absolute',
    top: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleBubble: {
    backgroundColor: '#2a2008',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 5,
  },
  vehiclePulse: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4af3766',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  validateBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d4af37',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  validateBtnText: {
    color: '#121212',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#202020',
    borderColor: '#444',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  gpsBtnActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#0a200a',
  },
  gpsBtnText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#252525',
    borderColor: '#d4af3755',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  detailsBtnText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  storeAddressText: {
    color: '#777',
    fontSize: 9,
    maxWidth: 120,
    marginTop: 1,
  },
  etaClockText: {
    color: '#00e676',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  gmapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#102030',
    borderColor: '#2196F3',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  gmapsBtnText: {
    color: '#2196F3',
    fontSize: 11,
    fontWeight: 'bold',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#241c08',
    borderColor: '#d4af3766',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  settingsBtnText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2b1010',
    borderColor: '#ff525266',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#ff5252',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unsoldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2b1d08',
    borderColor: '#FF980066',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  unsoldBtnText: {
    color: '#FF9800',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
