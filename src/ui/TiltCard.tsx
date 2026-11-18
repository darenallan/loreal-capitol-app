import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleProp, StyleSheet, ViewStyle, GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic, HapticKind, ND } from './haptics';

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onPress?: () => void;
  /** Inclinaison maximale en degrés */
  maxTilt?: number;
  intensity?: number;
  haptic?: HapticKind;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  nativeID?: string;
};

/**
 * Carte 3D : s'incline vers le pointeur (souris sur PC, doigt sur mobile),
 * avec reflet lumineux mobile et léger zoom. Revient en place avec un ressort.
 */
export default function TiltCard({ style, children, onPress, maxTilt = 7, haptic: hapticKind = 'light', disabled, accessibilityLabel, testID, nativeID }: Props) {
  const rx = useRef(new Animated.Value(0)).current; // -1..1
  const ry = useRef(new Animated.Value(0)).current; // -1..1
  const sc = useRef(new Animated.Value(1)).current;
  const glare = useRef(new Animated.Value(0)).current;
  const size = useRef({ w: 1, h: 1 });

  const to = (v: Animated.Value, toValue: number, speed = 18, bounciness = 6) =>
    Animated.spring(v, { toValue, speed, bounciness, useNativeDriver: ND }).start();

  const tiltAt = (x: number, y: number) => {
    const nx = Math.max(-1, Math.min(1, (x / size.current.w) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, (y / size.current.h) * 2 - 1));
    to(ry, nx, 30, 0);
    to(rx, -ny, 30, 0);
  };

  const reset = () => {
    to(rx, 0, 12, 8);
    to(ry, 0, 12, 8);
    to(sc, 1, 16, 8);
    to(glare, 0, 16, 0);
  };

  // Web : suivi de la souris
  const webHandlers = Platform.OS === 'web' ? {
    onMouseMove: (e: any) => {
      const rect = e.currentTarget?.getBoundingClientRect?.();
      if (!rect) return;
      size.current = { w: rect.width || 1, h: rect.height || 1 };
      tiltAt(e.clientX - rect.left, e.clientY - rect.top);
    },
    onMouseEnter: () => { to(sc, 1.015, 20, 4); to(glare, 1, 20, 0); },
    onMouseLeave: reset,
  } : {};

  const onPressIn = (e: GestureResponderEvent) => {
    if (Platform.OS !== 'web') {
      tiltAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      to(glare, 1, 20, 0);
    }
    to(sc, 0.975, 40, 0);
  };

  const rotateX = rx.interpolate({ inputRange: [-1, 1], outputRange: [`${-maxTilt}deg`, `${maxTilt}deg`] });
  const rotateY = ry.interpolate({ inputRange: [-1, 1], outputRange: [`${-maxTilt}deg`, `${maxTilt}deg`] });
  const glareX = ry.interpolate({ inputRange: [-1, 1], outputRange: [-60, 60] });
  const glareY = rx.interpolate({ inputRange: [-1, 1], outputRange: [40, -40] });

  return (
    <Animated.View
      {...(webHandlers as any)}
      onLayout={(e) => { size.current = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 }; }}
      style={[style, { transform: [{ perspective: 900 }, { rotateX }, { rotateY }, { scale: sc }] }]}
    >
      <Pressable
        disabled={disabled || !onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        nativeID={nativeID}
        onPressIn={onPressIn}
        onPressOut={reset}
        onPress={() => { haptic(hapticKind); onPress?.(); }}
        style={[{ flexGrow: 1 }, Platform.OS === 'web' && onPress ? ({ cursor: 'pointer' } as any) : null]}
      >
        {children}
      </Pressable>
      {/* Reflet lumineux */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glare, overflow: 'hidden', borderRadius: 26 }]}>
        <Animated.View style={{ position: 'absolute', top: '-30%', left: '-30%', width: '160%', height: '160%', transform: [{ translateX: glareX }, { translateY: glareY }] }}>
          <LinearGradient
            colors={['rgba(255,240,200,0)', 'rgba(255,240,200,0.10)', 'rgba(255,240,200,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

