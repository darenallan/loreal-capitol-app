import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { startAudioKeepAlive, requestDesktopNotificationPermission, playRingToneNow, stopRingtone } from '../../utils/ringtone';
import { PressableScale } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';

export interface SoundArmBannerProps {
  setAudioAndNotifArmed: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Bannière d'activation des alertes sonores et notifications. */
export default function SoundArmBanner({ setAudioAndNotifArmed }: SoundArmBannerProps) {
  const { colors } = useAppTheme();
  return (
    <PressableScale
      style={styles.soundArmBanner}
      haptic="medium"
      onPress={async () => {
        startAudioKeepAlive();
        playRingToneNow(1);
        setTimeout(() => stopRingtone(), 500);
        await requestDesktopNotificationPermission();
        setAudioAndNotifArmed(true);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert("Sonneries et notifications d'arrière-plan activées avec succès !");
        }
      }}
    >
      <View style={styles.soundArmIcon}>
        <Bell color={colors.onGold} size={18} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.soundArmTitle}>Activer les alertes sonores & notifications</Text>
        <Text style={styles.soundArmSubtitle}>
          Autoriser les alertes automatiques en cas de demande de transfert ou stock critique.
        </Text>
      </View>
      <View style={styles.soundArmBadge}>
        <Text style={styles.soundArmBadgeText}>Activer</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  soundArmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b2005',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#d4af37',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  soundArmIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundArmTitle: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  soundArmSubtitle: {
    color: '#bbb',
    fontSize: 11,
    marginTop: 2,
  },
  soundArmBadge: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  soundArmBadgeText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
