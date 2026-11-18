import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Retour haptique discret (iOS / Android uniquement — silencieux sur le web). */
export type HapticKind = 'none' | 'selection' | 'light' | 'medium' | 'heavy' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'success' | 'warning' | 'error';

export function haptic(kind: HapticKind = 'light') {
  if (Platform.OS === 'web' || kind === 'none') return;
  try {
    switch (kind) {
      case 'selection': Haptics.selectionAsync(); break;
      case 'light':
      case 'impactLight': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium':
      case 'impactMedium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'heavy':
      case 'impactHeavy': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
      case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
      case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
      case 'error': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
    }
  } catch {
    // jamais bloquant
  }
}

/** useNativeDriver n'existe pas sur le web : on l'active seulement en natif */
export const ND = Platform.OS !== 'web';
