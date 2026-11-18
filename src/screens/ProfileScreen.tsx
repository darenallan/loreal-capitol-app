import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ScrollView, Platform } from 'react-native';
import { ArrowLeft, KeyRound, User, Camera, Edit3, Shield, Check, X, Store } from 'lucide-react-native';
import { changeUserPin, updateUserProfile, isUserAdmin } from '../db/database';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, radius, shadow } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, SectionTitle, FadeIn } from '../ui';
import { chrome } from '../ui/screenChrome';
import { alpha } from '../theme';

export default function ProfileScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [userName, setUserName] = useState(user?.name || '');
  const [userPhoto, setUserPhoto] = useState(user?.photo || '');
  const [isEditingName, setIsEditingName] = useState(false);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la galerie photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setUserPhoto(base64Uri);
        try {
          await updateUserProfile(user.id, { photo: base64Uri });
          user.photo = base64Uri;
          Alert.alert('Succès', 'Photo de profil mise à jour.');
        } catch (e) {
          Alert.alert('Erreur', 'Impossible de sauvegarder la photo.');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateName = async () => {
    if (!userName.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide.');
      return;
    }
    try {
      await updateUserProfile(user.id, { name: userName.trim() });
      user.name = userName.trim();
      setIsEditingName(false);
      Alert.alert('Succès', 'Nom mis à jour.');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de modifier le nom.');
    }
  };

  const handleUpdatePin = async () => {
    if (!oldPin || !newPin || !confirmPin) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (oldPin !== user.pin) {
      Alert.alert('Erreur', 'L\'ancien code PIN est incorrect.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Erreur', 'Les nouveaux codes PIN ne correspondent pas.');
      return;
    }
    if (newPin.length < 4) {
      Alert.alert('Erreur', 'Le nouveau code PIN doit contenir au moins 4 chiffres.');
      return;
    }

    try {
      await changeUserPin(user.id, newPin);
      user.pin = newPin;
      Alert.alert('Succès', 'Votre code PIN a été mis à jour.');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de modifier le code PIN.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retour" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.screenEyebrow}>ESPACE PERSONNEL</Text>
          <Text style={styles.title}>Mon Profil</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.contentScroll, r.isWide && styles.contentScrollWide]}>
        <FadeIn>
          {/* Avatar Hero Card */}
          <TiltCard intensity={5} style={{ marginBottom: 16 }}>
            <GlassCard style={styles.profileHeroCard} glow="gold">
              <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
                {userPhoto ? (
                  <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>
                      {(userName || 'U').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <Camera color={colors.onGold} size={14} />
                </View>
              </TouchableOpacity>

              {isEditingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={userName}
                    onChangeText={setUserName}
                    autoFocus
                  />
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Valider" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.nameConfirmBtn} onPress={handleUpdateName}>
                    <Check color={colors.onGold} size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Annuler la modification du nom" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.nameCancelBtn} onPress={() => { setIsEditingName(false); setUserName(user?.name || ''); }}>
                    <X color={colors.textSecondary} size={16} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.nameRow}>
                  <Text style={styles.userName}>{userName}</Text>
                  <Edit3 color={colors.gold} size={16} />
                </TouchableOpacity>
              )}

              <View style={styles.badgesRow}>
                <View style={styles.roleBadge}>
                  <Shield color={colors.gold} size={12} style={{ marginRight: 4 }} />
                  <Text style={styles.roleBadgeText}>
                    {isUserAdmin(user) ? 'Administrateur Général' : 'Collaborateur Vente'}
                  </Text>
                </View>

                <View style={styles.storeBadge}>
                  <Store color={colors.textSecondary} size={12} style={{ marginRight: 4 }} />
                  <Text style={styles.storeBadgeText}>
                    {user?.store === 'all' ? 'Direction Globale' : user?.store === 'falaise' ? 'Boutique La Falaise' : 'Boutique Tougou'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </TiltCard>

          {/* Security / PIN Card */}
          <GlassCard style={styles.securityCard}>
            <View style={styles.cardHeaderRow}>
              <KeyRound color={colors.gold} size={18} style={{ marginRight: 8 }} />
              <Text style={styles.cardSectionTitle}>Sécurité & Code Secret (PIN)</Text>
            </View>

            <Text style={styles.fieldLabel}>Ancien code PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Saisissez votre code actuel"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={oldPin}
              onChangeText={setOldPin}
            />

            <Text style={styles.fieldLabel}>Nouveau code PIN (min. 4 chiffres)</Text>
            <TextInput
              style={styles.input}
              placeholder="Nouveau code PIN"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={newPin}
              onChangeText={setNewPin}
            />

            <Text style={styles.fieldLabel}>Confirmer le nouveau code PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Répétez le nouveau code"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={confirmPin}
              onChangeText={setConfirmPin}
            />

            <View style={{ marginTop: 14 }}>
              <GoldButton
                label="Mettre à jour le code PIN"
                onPress={handleUpdatePin}
                size="md"
                icon={<Check color={colors.onGold} size={16} />}
              />
            </View>
          </GlassCard>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  header: { ...chrome.header, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { ...chrome.backBtn },
  headerTitleBox: {
    alignItems: 'center',
  },
  screenEyebrow: { ...chrome.screenEyebrow },
  title: { ...chrome.title },
  contentScroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  contentScrollWide: {
    paddingHorizontal: 28,
  },
  profileHeroCard: {
    padding: 24,
    alignItems: 'center',
    borderRadius: radius.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: alpha(colors.gold, 0.12),
    borderWidth: 2,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: '800',
    fontFamily: fonts.serif,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.gold,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.serif,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  nameInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    fontFamily: fonts.sans,
    minWidth: 160,
  },
  nameConfirmBtn: {
    backgroundColor: colors.gold,
    padding: 8,
    borderRadius: radius.xs,
  },
  nameCancelBtn: {
    backgroundColor: colors.surfaceStrong,
    padding: 8,
    borderRadius: radius.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.gold, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.3),
  },
  roleBadgeText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  storeBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  securityCard: {
    padding: 20,
    borderRadius: radius.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardSectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
    fontFamily: fonts.sans,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    height: 44,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
});
