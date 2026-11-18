import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { db } from '../db/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import {
  getUsers,
  logIntrusion,
  DEFAULT_USERS,
  getLocalCache,
  setLocalCache,
  isUserAdmin,
} from '../db/database';
import { useAppTheme } from '../theme/ThemeContext';
import {
  Lock,
  Fingerprint,
  Eye,
  EyeOff,
  Crown,
  Store,
  Building2,
  Users,
  Smartphone,
  CheckCircle2,
} from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import {
  Screen,
  GlassCard,
  TiltCard,
  GoldButton,
  PressableScale,
  FadeIn,
  ThemeToggleButton,
  useResponsive,
  colors,
  fonts,
  radius,
  shadow,
  type,
  haptic,
} from '../ui';

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function LoginScreen({ navigation }: any) {
  const { colors: themeColors, isDark } = useAppTheme();
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState<any[]>(DEFAULT_USERS);
  const [selectedUser, setSelectedUser] = useState<any>(DEFAULT_USERS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const r = useResponsive();

  useEffect(() => {
    // 1. Initialise depuis cache local
    const cached = getLocalCache('loreal_cached_users');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setUsers(cached);
      setSelectedUser(cached[0]);
    }

    // 2. Synchronisation temps réel Firebase
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedUsers = Object.keys(data).map((key) => {
          const u = { id: key, ...data[key] };
          if (isUserAdmin(u) && u.role !== 'admin') {
            u.role = 'admin';
          }
          return u;
        });
        if (loadedUsers.length > 0) {
          setUsers(loadedUsers);
          setLocalCache('loreal_cached_users', loadedUsers);
          setSelectedUser((prev: any) => {
            const found = loadedUsers.find((u) => u.id === prev?.id);
            return found || loadedUsers[0];
          });
        }
      }
    });

    // 3. Auto login check
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedId = window.localStorage.getItem('savedUserId');
      const savedPin = window.localStorage.getItem('savedUserPin');
      if (savedId && savedPin) {
        getUsers().then((loadedUsers) => {
          const u = loadedUsers.find((user: any) => user.id === savedId);
          if (u && u.pin === savedPin) {
            navigation.replace('Dashboard', { user: u });
          }
        });
      }
    }

    return () => unsubscribe();
  }, [navigation]);

  const handleLogin = async () => {
    if (!selectedUser || isSubmitting) return;

    if (pin === selectedUser.pin) {
      haptic('success');
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('savedUserId', selectedUser.id);
        window.localStorage.setItem('savedUserPin', pin);
      }
      setPin('');
      navigation.replace('Dashboard', { user: selectedUser });
    } else {
      haptic('error');
      setIsSubmitting(true);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Code d\'accès incorrect');
      } else {
        Alert.alert('Erreur', 'Code d\'accès incorrect');
      }

      try {
        let locationData = { city: 'Inconnu', country: 'Inconnu', lat: 0, lon: 0 };
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (res.ok) {
          const data = await res.json();
          locationData = {
            city: data.city || 'Inconnu',
            country: data.country || 'Inconnu',
            lat: parseFloat(data.latitude) || 0,
            lon: parseFloat(data.longitude) || 0,
          };
        }
        await logIntrusion(selectedUser.name, locationData);
      } catch (e) {
        console.error('Erreur localisation:', e);
        await logIntrusion(selectedUser.name, { city: 'Inconnu', country: 'Inconnu', lat: 0, lon: 0 });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert('Non disponible', 'La sécurité biométrique n\'est pas configurée sur cet appareil.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Connexion pour ${selectedUser?.name || 'utilisateur'}`,
        fallbackLabel: 'Utiliser le code',
      });

      if (result.success) {
        haptic('success');
        setPin('');
        navigation.replace('Dashboard', { user: selectedUser });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const bossUsers = users.filter((u) => isUserAdmin(u));
  const falaiseUsers = users.filter((u) => u.store === 'falaise' && !isUserAdmin(u));
  const tougouUsers = users.filter((u) => u.store === 'tougou' && !isUserAdmin(u));
  const otherUsers = users.filter((u) => !isUserAdmin(u) && u.store !== 'falaise' && u.store !== 'tougou');

  const renderUserChip = (u: any) => {
    const isSelected = selectedUser?.id === u.id;
    const admin = isUserAdmin(u);
    const initials = getInitials(u.name);

    return (
      <PressableScale
        key={u.id}
        onPress={() => setSelectedUser(u)}
        haptic="selection"
        scaleTo={0.95}
        hoverLift={2}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected
              ? themeColors.gold
              : isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
            borderColor: isSelected
              ? themeColors.gold
              : isDark
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(0,0,0,0.1)',
          },
          admin && !isSelected && {
            borderColor: isDark ? 'rgba(212,175,55,0.35)' : 'rgba(166,124,30,0.35)',
            backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(166,124,30,0.05)',
          },
          isSelected && shadow.gold,
        ]}
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: isSelected
                ? (isDark ? '#07070A' : '#14120E')
                : isDark
                ? '#1C1C2C'
                : 'rgba(166,124,30,0.12)',
              borderColor: isSelected
                ? (isDark ? '#07070A' : '#14120E')
                : isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(166,124,30,0.3)',
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              {
                color: isSelected
                  ? themeColors.gold
                  : isDark
                  ? colors.goldLight
                  : themeColors.gold,
              },
            ]}
          >
            {initials}
          </Text>
        </View>
        <View style={styles.chipTextWrapper}>
          <Text
            numberOfLines={1}
            style={[
              styles.chipName,
              {
                color: isSelected
                  ? (isDark ? '#07070A' : '#FFFFFF')
                  : themeColors.textPrimary,
                fontFamily: isSelected ? fonts.bold : fonts.semibold,
              },
            ]}
          >
            {u.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.chipRole,
              {
                color: isSelected
                  ? (isDark ? 'rgba(7,7,10,0.85)' : 'rgba(255,255,255,0.85)')
                  : themeColors.textSecondary,
              },
            ]}
          >
            {admin ? 'Directeur' : u.role === 'caissiere' ? 'Caisse' : 'Vente'}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.chipCheck}>
            <CheckCircle2 color={isDark ? '#07070A' : '#FFFFFF'} size={15} />
          </View>
        )}
      </PressableScale>
    );
  };

  const renderSection = (title: string, icon: React.ReactNode, list: any[]) => {
    if (!list || list.length === 0) return null;
    return (
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          {icon}
          <Text style={[styles.sectionTitle, { color: isDark ? colors.textMuted : themeColors.gold }]}>
            {title}
          </Text>
          <View
            style={[
              styles.sectionBadge,
              { backgroundColor: isDark ? colors.surfaceStrong : 'rgba(0,0,0,0.06)' },
            ]}
          >
            <Text style={[styles.sectionBadgeText, { color: themeColors.textSecondary }]}>
              {list.length}
            </Text>
          </View>
        </View>
        <View style={styles.chipsGrid}>
          {list.map(renderUserChip)}
        </View>
      </View>
    );
  };

  const isWide = r.isWide;

  return (
    <Screen maxWidth={isWide ? 1040 : 540} padded intensity={1.1}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingVertical: r.pick({ phone: 24, tablet: 40, desktop: 56 }) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar with Theme Toggle */}
          <View style={styles.topThemeBar}>
            <ThemeToggleButton />
          </View>

          {/* Logo & Brand Header */}
          <FadeIn distance={16} duration={700}>
            <View style={styles.brandContainer}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={[styles.brandTitle, { color: themeColors.textPrimary }]}>
                L'ORÉAL CAPITOL
              </Text>
              <Text style={styles.brandTagline}>LA CAPITALE DU PRÊT À PORTER</Text>
            </View>
          </FadeIn>

          {/* Corps responsive : sur écran large, 2 colonnes (profils à gauche, saisie à droite) */}
          <View style={[styles.mainLayout, isWide && styles.mainLayoutWide]}>
            {/* Colonne Profils */}
            <FadeIn delay={120} distance={18} duration={700} style={[styles.col, isWide && styles.colLeft]}>
              <GlassCard style={styles.profilesCard} padded={false}>
                <View
                  style={[
                    styles.profilesCardHeader,
                    { borderBottomColor: themeColors.border },
                  ]}
                >
                  <Text style={[styles.cardHeaderTitle, { color: themeColors.textPrimary }]}>
                    Sélectionnez votre profil
                  </Text>
                  <Text style={[styles.cardHeaderSubtitle, { color: themeColors.textSecondary }]}>
                    Choisissez un compte pour ouvrir votre session
                  </Text>
                </View>

                <View style={styles.profilesInner}>
                  {renderSection('Direction & Administration', <Crown color={themeColors.gold} size={15} />, bossUsers)}
                  {renderSection('Boutique La Falaise', <Store color={themeColors.textSecondary} size={15} />, falaiseUsers)}
                  {renderSection('Boutique Tougou', <Building2 color={themeColors.textSecondary} size={15} />, tougouUsers)}
                  {otherUsers.length > 0 &&
                    renderSection('Autres collaborateurs', <Users color={themeColors.textSecondary} size={15} />, otherUsers)}
                </View>
              </GlassCard>
            </FadeIn>

            {/* Colonne Authentification (PIN/Code) */}
            <FadeIn delay={220} distance={22} duration={700} style={[styles.col, isWide && styles.colRight]}>
              <TiltCard maxTilt={5}>
                <GlassCard variant="gold" glow style={styles.authCard}>
                  {/* Profil actif */}
                  <View
                    style={[
                      styles.activeUserBanner,
                      {
                        backgroundColor: isDark ? colors.surfaceStrong : '#FFFFFF',
                        borderColor: isDark ? colors.borderGold : 'rgba(166,124,30,0.35)',
                      },
                    ]}
                  >
                    <View style={styles.activeAvatar}>
                      <Text style={styles.activeAvatarText}>
                        {getInitials(selectedUser?.name || 'U')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.activeUserLabel, { color: themeColors.gold }]}>
                        Profil sélectionné
                      </Text>
                      <Text numberOfLines={1} style={[styles.activeUserName, { color: themeColors.textPrimary }]}>
                        {selectedUser?.name || 'Sélectionnez un profil'}
                      </Text>
                    </View>
                    <View style={styles.activeStoreBadge}>
                      <Text style={styles.activeStoreBadgeText}>
                        {isUserAdmin(selectedUser)
                          ? 'Direction'
                          : selectedUser?.store === 'tougou'
                          ? 'Tougou'
                          : 'La Falaise'}
                      </Text>
                    </View>
                  </View>

                  {/* Champ Mot de passe / Code */}
                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                      Code d'accès
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? colors.surfaceSolid : '#FFFFFF',
                          borderColor: isDark ? colors.borderStrong : 'rgba(0,0,0,0.15)',
                        },
                      ]}
                    >
                      <Lock color={themeColors.gold} size={18} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: themeColors.textPrimary }]}
                        placeholder="Ex : B000000."
                        placeholderTextColor={themeColors.textSecondary}
                        secureTextEntry={!showPassword}
                        value={pin}
                        onChangeText={setPin}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="go"
                        onSubmitEditing={handleLogin}
                      />
                      <PressableScale
                        onPress={() => setShowPassword(!showPassword)}
                        haptic="light"
                        scaleTo={0.9}
                        style={styles.eyeBtn}
                      >
                        {showPassword ? (
                          <EyeOff color={themeColors.gold} size={18} />
                        ) : (
                          <Eye color={themeColors.textSecondary} size={18} />
                        )}
                      </PressableScale>
                    </View>
                    <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>
                      Format standard : 8 caractères · Majuscule au début · Symbole à la fin
                    </Text>
                  </View>

                  {/* Bouton Connexion */}
                  <GoldButton
                    label={isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
                    onPress={handleLogin}
                    loading={isSubmitting}
                    full
                    size="lg"
                    style={{ marginTop: 8 }}
                  />

                  {/* Biométrie (Natif) */}
                  {Platform.OS !== 'web' && (
                    <PressableScale
                      onPress={handleBiometricLogin}
                      haptic="medium"
                      style={styles.bioButton}
                    >
                      <View style={styles.bioIconWrap}>
                        <Fingerprint color={colors.gold} size={22} />
                      </View>
                      <Text style={styles.bioButtonText}>Connexion par biométrie</Text>
                    </PressableScale>
                  )}

                  {/* Aide Mobile / PWA */}
                  <View
                    style={[
                      styles.pwaTip,
                      {
                        backgroundColor: isDark ? colors.surface : 'rgba(166,124,30,0.08)',
                        borderColor: isDark ? colors.border : 'rgba(166,124,30,0.25)',
                      },
                    ]}
                  >
                    <Smartphone color={themeColors.gold} size={15} style={{ marginTop: 1 }} />
                    <Text style={[styles.pwaTipText, { color: themeColors.textSecondary }]}>
                      <Text style={{ color: themeColors.textPrimary, fontFamily: fonts.bold }}>Installation mobile :</Text>{' '}
                      sur Safari (iOS) touchez Partager ➔ Sur l'écran d'accueil. Sur Android : Menu ⋮ ➔ Ajouter à l'écran d'accueil.
                    </Text>
                  </View>
                </GlassCard>
              </TiltCard>
            </FadeIn>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topThemeBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogo: {
    width: 130,
    height: 130,
    borderRadius: 20,
    marginBottom: 12,
  },
  brandTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: 4,
    color: colors.text,
    textAlign: 'center',
  },
  brandTagline: {
    ...type.eyebrow,
    color: colors.gold,
    marginTop: 6,
    textAlign: 'center',
  },

  // Main layout
  mainLayout: {
    width: '100%',
    gap: 20,
  },
  mainLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  col: {
    width: '100%',
  },
  colLeft: {
    flex: 1.15,
  },
  colRight: {
    flex: 1,
    position: 'sticky' as any,
    top: 24,
  },

  // Profiles card
  profilesCard: {
    borderRadius: radius.xxl,
  },
  profilesCardHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardHeaderTitle: {
    ...type.h2,
    fontSize: 18,
    color: colors.text,
  },
  cardHeaderSubtitle: {
    ...type.caption,
    marginTop: 2,
  },
  profilesInner: {
    padding: 16,
    gap: 16,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
    flex: 1,
  },
  sectionBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  sectionBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textMuted,
  },
  chipsGrid: {
    gap: 8,
  },

  // Individual chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  chipAdmin: {
    borderColor: 'rgba(212,175,55,0.22)',
    backgroundColor: 'rgba(212,175,55,0.03)',
  },
  chipSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.goldLight,
    ...shadow.gold,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: colors.onGold,
    borderColor: colors.onGold,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.goldLight,
  },
  avatarTextSelected: {
    color: colors.gold,
  },
  chipTextWrapper: {
    flex: 1,
    minWidth: 0,
  },
  chipName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  chipNameSelected: {
    color: colors.onGold,
    fontFamily: fonts.bold,
  },
  chipRole: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
  chipCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Auth card
  authCard: {
    padding: 24,
    borderRadius: radius.xxl,
    gap: 18,
  },
  activeUserBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  activeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.gold,
  },
  activeUserLabel: {
    ...type.eyebrow,
    fontSize: 9.5,
    color: colors.goldLight,
  },
  activeUserName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  activeStoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  activeStoreBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: colors.goldLight,
  },

  // Form field
  fieldWrapper: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    height: 52,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        } as any)
      : null),
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    height: '100%',
  },
  eyeBtn: {
    padding: 8,
  },
  hintText: {
    ...type.caption,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },

  // Biometrics
  bioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.goldSofter,
  },
  bioIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.goldLight,
  },

  // PWA Tip
  pwaTip: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  pwaTipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 17,
  },
});
