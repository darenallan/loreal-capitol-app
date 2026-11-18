import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle, Platform } from 'react-native';
import { haptic, HapticKind, ND } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Échelle au toucher (défaut 0.965) */
  scaleTo?: number;
  /** Soulèvement au survol (web) en px */
  hoverLift?: number;
  haptic?: HapticKind;
  /** Style supplémentaire appliqué au survol (web) */
  hoverStyle?: StyleProp<ViewStyle>;
};

/**
 * Bouton tactile "sensible" : ressort à l'appui, légère élévation au survol (PC),
 * retour haptique sur iPhone / Android. Remplace TouchableOpacity.
 */
export default function PressableScale({
  style, children, scaleTo = 0.965, hoverLift = 2, haptic: hapticKind = 'light',
  hoverStyle, onPressIn, onPressOut, onHoverIn, onHoverOut, onPress, disabled, ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = React.useState(false);

  const springTo = (v: Animated.Value, toValue: number, speed = 40, bounciness = 6) =>
    Animated.spring(v, { toValue, speed, bounciness, useNativeDriver: ND }).start();

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={(e) => { haptic(hapticKind); onPress?.(e); }}
      onPressIn={(e) => { springTo(scale, scaleTo, 50, 0); onPressIn?.(e); }}
      onPressOut={(e) => { springTo(scale, 1, 22, 10); onPressOut?.(e); }}
      onHoverIn={(e) => { setHovered(true); springTo(lift, -hoverLift, 30, 4); onHoverIn?.(e); }}
      onHoverOut={(e) => { setHovered(false); springTo(lift, 0, 30, 4); onHoverOut?.(e); }}
      style={[
        style,
        hovered && hoverStyle,
        disabled && { opacity: 0.45 },
        Platform.OS === 'web' && ({ cursor: disabled ? 'not-allowed' : 'pointer', userSelect: 'none' } as any),
        { transform: [{ translateY: lift }, { scale }] },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
