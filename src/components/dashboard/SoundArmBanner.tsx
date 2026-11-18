import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BellOff } from 'lucide-react-native';
import { startAudioKeepAlive, requestDesktopNotificationPermission, playRingToneNow, stopRingtone } from '../../utils/ringtone';
import { PressableScale } from '../../ui';
import { useAppTheme } from '../../theme/ThemeContext';
import { colors, fonts, radius } from '../../theme';

export interface SoundArmBannerProps {
  setAudioAndNotifArmed: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Rappel discret (une ligne) pour activer les alertes sonores et notifications. */
export default function SoundArmBanner({ setAudioAndNotifArmed }: SoundArmBannerProps) {
  const { colors } = useAppTheme();
  return (
    <PressableScale
      style={styles.strip}
      haptic="medium"
      accessibilityRole="button"
      accessibilityLabel="Activer les alertes sonores et notifications"
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
      <BellOff color={colors.textMuted} size={16} />
      <Text style={styles.text} numberOfLines={1}>
        Alertes sonores désactivées <Text style={styles.hint}>· transferts et stock critique</Text>
      </Text>
      <View style={styles.action}>
        <Text style={styles.actionText}>Activer</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  hint: { fontFamily: fonts.medium, color: colors.textMuted },
  action: {
    paddingHorizontal: 14,
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  actionText: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
});
