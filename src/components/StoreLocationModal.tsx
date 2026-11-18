import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ActivityIndicator, Linking, ScrollView } from 'react-native';
import { MapPin, Navigation, Compass, Check, X, ExternalLink, RefreshCw } from 'lucide-react-native';
import { getStoreLocations, updateStoreLocation, calculateDistanceKm, calculateTravelMinutes, StoreLocation } from '../db/database';
import { colors, alpha } from '../theme';

interface StoreLocationModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
}

export default function StoreLocationModal({ visible, onClose, user }: StoreLocationModalProps) {
  const [locations, setLocations] = useState<Record<string, StoreLocation>>({});
  const [loading, setLoading] = useState(true);
  const [capturingStore, setCapturingStore] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState<string | null>(null);

  // Form states
  const [falaiseAddress, setFalaiseAddress] = useState('');
  const [falaiseLat, setFalaiseLat] = useState('3.870472');
  const [falaiseLng, setFalaiseLng] = useState('11.516083');

  const [tougouAddress, setTougouAddress] = useState('');
  const [tougouLat, setTougouLat] = useState('3.882472');
  const [tougouLng, setTougouLng] = useState('11.523361');

  const loadLocations = async () => {
    setLoading(true);
    try {
      const locs = await getStoreLocations();
      setLocations(locs);
      if (locs.falaise) {
        setFalaiseAddress(locs.falaise.address || '');
        setFalaiseLat(locs.falaise.lat?.toString() || '3.870472');
        setFalaiseLng(locs.falaise.lng?.toString() || '11.516083');
      }
      if (locs.tougou) {
        setTougouAddress(locs.tougou.address || '');
        setTougouLat(locs.tougou.lat?.toString() || '3.882472');
        setTougouLng(locs.tougou.lng?.toString() || '11.523361');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadLocations();
    }
  }, [visible]);

  // Capturer la position GPS du téléphone en direct
  const captureCurrentGps = (storeId: 'falaise' | 'tougou') => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      Alert.alert('Erreur', 'La géolocalisation GPS n\'est pas disponible sur cet appareil.');
      return;
    }

    setCapturingStore(storeId);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);

        if (storeId === 'falaise') {
          setFalaiseLat(lat);
          setFalaiseLng(lng);
        } else {
          setTougouLat(lat);
          setTougouLng(lng);
        }
        setCapturingStore(null);
        const msg = `Position GPS capturée pour ${storeId === 'falaise' ? 'La Falaise' : 'Tougou'} : ${lat}, ${lng} (Précision: ~${Math.round(pos.coords.accuracy)}m)`;
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
        else Alert.alert('GPS Capturé', msg);
      },
      (err) => {
        setCapturingStore(null);
        Alert.alert('Erreur GPS', err.message || 'Impossible d\'obtenir la position.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Enregistrer les coordonnées d'un magasin
  const handleSaveStore = async (storeId: 'falaise' | 'tougou') => {
    setSavingStore(storeId);
    try {
      const address = storeId === 'falaise' ? falaiseAddress : tougouAddress;
      const lat = parseFloat(storeId === 'falaise' ? falaiseLat : tougouLat);
      const lng = parseFloat(storeId === 'falaise' ? falaiseLng : tougouLng);

      if (isNaN(lat) || isNaN(lng)) {
        Alert.alert('Erreur', 'Coordonnées GPS invalides.');
        return;
      }

      await updateStoreLocation(storeId, { address, lat, lng }, user?.name || 'Vendeur');
      const storeName = storeId === 'falaise' ? 'La Falaise' : 'Tougou';
      const msg = `Adresse et position GPS de ${storeName} enregistrées avec succès ! Tous les prochains transferts calculeront le trajet et l'heure exacte d'arrivée à partir de cette adresse.`;
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      else Alert.alert('Succès', msg);
      loadLocations();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d\'enregistrer.');
    } finally {
      setSavingStore(null);
    }
  };

  // Ouvrir l'itinéraire Google Maps
  const openInGoogleMaps = () => {
    const lat1 = parseFloat(falaiseLat);
    const lng1 = parseFloat(falaiseLng);
    const lat2 = parseFloat(tougouLat);
    const lng2 = parseFloat(tougouLng);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${lat1},${lng1}&destination=${lat2},${lng2}&travelmode=driving`;
    Linking.openURL(url);
  };

  const currentDistance = calculateDistanceKm(
    parseFloat(falaiseLat),
    parseFloat(falaiseLng),
    parseFloat(tougouLat),
    parseFloat(tougouLng)
  );

  const currentDuration = calculateTravelMinutes(currentDistance);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Compass color={colors.gold} size={24} />
              <View>
                <Text style={styles.title}>Adresses & GPS des Boutiques</Text>
                <Text style={styles.subtitle}>Calcul automatique du trajet et de l'heure d'arrivée</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onClose} style={styles.closeBtn}>
              <X color={colors.textTertiary} size={20} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={{ color: colors.textTertiary, marginTop: 10 }}>Chargement des adresses...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Carte Récapitulative du Trajet Falaise <-> Tougou */}
              <View style={styles.summaryCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.summaryTitle}>🗺️ Trajet La Falaise ⟷ Tougou</Text>
                  <TouchableOpacity onPress={openInGoogleMaps} style={styles.gmapsBtn}>
                    <ExternalLink color={colors.info} size={14} />
                    <Text style={styles.gmapsBtnText}>Ouvrir Google Maps</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Distance réelle</Text>
                    <Text style={styles.metricVal}>{currentDistance} km</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Durée estimée (Moto/Taxi)</Text>
                    <Text style={[styles.metricVal, { color: colors.success }]}>~{currentDuration} min</Text>
                  </View>
                </View>
                <Text style={styles.metricSub}>
                  L'heure d'arrivée des livraisons est calculée automatiquement à partir de ces positions GPS.
                </Text>
              </View>

              {/* Section 1 : Boutique La Falaise */}
              <View style={styles.storeCard}>
                <View style={styles.storeCardHeader}>
                  <View style={[styles.storeDot, { backgroundColor: colors.gold }]} />
                  <Text style={styles.storeCardTitle}>1. Boutique La Falaise</Text>
                </View>

                <Text style={styles.inputLabel}>Adresse / Emplacement</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Carrefour La Falaise, Douala"
                  placeholderTextColor={colors.inputPlaceholder}
                  value={falaiseAddress}
                  onChangeText={setFalaiseAddress}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Latitude</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={falaiseLat}
                      onChangeText={setFalaiseLat}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Longitude</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={falaiseLng}
                      onChangeText={setFalaiseLng}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.gpsCaptureBtn, capturingStore === 'falaise' && { opacity: 0.6 }]}
                    disabled={capturingStore === 'falaise'}
                    onPress={() => captureCurrentGps('falaise')}
                  >
                    {capturingStore === 'falaise' ? (
                      <ActivityIndicator size="small" color={colors.gold} />
                    ) : (
                      <>
                        <MapPin color={colors.gold} size={16} />
                        <Text style={styles.gpsCaptureBtnText}>Prendre ma position actuelle</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveStoreBtn, savingStore === 'falaise' && { opacity: 0.6 }]}
                    disabled={savingStore === 'falaise'}
                    onPress={() => handleSaveStore('falaise')}
                  >
                    {savingStore === 'falaise' ? (
                      <ActivityIndicator size="small" color={colors.onGold} />
                    ) : (
                      <>
                        <Check color={colors.onGold} size={16} />
                        <Text style={styles.saveStoreBtnText}>Sauvegarder</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Section 2 : Boutique Tougou */}
              <View style={styles.storeCard}>
                <View style={styles.storeCardHeader}>
                  <View style={[styles.storeDot, { backgroundColor: colors.violet }]} />
                  <Text style={styles.storeCardTitle}>2. Boutique Tougou</Text>
                </View>

                <Text style={styles.inputLabel}>Adresse / Emplacement</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Marché Tougou, Douala"
                  placeholderTextColor={colors.inputPlaceholder}
                  value={tougouAddress}
                  onChangeText={setTougouAddress}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Latitude</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={tougouLat}
                      onChangeText={setTougouLat}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Longitude</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={tougouLng}
                      onChangeText={setTougouLng}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.gpsCaptureBtn, capturingStore === 'tougou' && { opacity: 0.6 }]}
                    disabled={capturingStore === 'tougou'}
                    onPress={() => captureCurrentGps('tougou')}
                  >
                    {capturingStore === 'tougou' ? (
                      <ActivityIndicator size="small" color={colors.violet} />
                    ) : (
                      <>
                        <MapPin color={colors.violet} size={16} />
                        <Text style={[styles.gpsCaptureBtnText, { color: colors.violet }]}>Prendre ma position actuelle</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveStoreBtn, { backgroundColor: colors.violet }, savingStore === 'tougou' && { opacity: 0.6 }]}
                    disabled={savingStore === 'tougou'}
                    onPress={() => handleSaveStore('tougou')}
                  >
                    {savingStore === 'tougou' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Check color="#fff" size={16} />
                        <Text style={[styles.saveStoreBtnText, { color: '#fff' }]}>Sauvegarder</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeModalBtn} onPress={onClose}>
            <Text style={styles.closeModalBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surfaceSolidHi,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 8,
  },
  summaryCard: {
    backgroundColor: '#241c08',
    padding: 14,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.4),
  },
  summaryTitle: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: 'bold',
  },
  gmapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a2a3a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.info,
  },
  gmapsBtnText: {
    color: colors.info,
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginVertical: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: colors.surfaceSolid,
    padding: 10,
    borderRadius: 8,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  metricVal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  metricSub: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  storeCard: {
    backgroundColor: colors.surfaceSolidHi,
    padding: 14,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  storeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  storeCardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  inputLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surfaceSolid,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    marginBottom: 8,
  },
  gpsCaptureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 10,
    borderRadius: 8,
  },
  gpsCaptureBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: 'bold',
  },
  saveStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveStoreBtnText: {
    color: colors.onGold,
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeModalBtn: {
    backgroundColor: colors.surfaceStrong,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalBtnText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: 'bold',
  },
});
