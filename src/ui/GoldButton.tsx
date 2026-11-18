import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from './PressableScale';
import { alpha, colors, fonts, gradients, radius, shadow } from '../theme';
import { HapticKind } from './haptics';

type Props = {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  variant?: 'gold' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: HapticKind;
  testID?: string;
  nativeID?: string;
};

const HEIGHT = { sm: 40, md: 50, lg: 58 };
const FONT = { sm: 13, md: 15, lg: 16 };

/** Bouton premium : dégradé or métallisé, contour or, fantôme ou danger. */
export default function GoldButton({
  label, onPress, icon, iconRight, variant = 'gold', size = 'md', loading, disabled, full, style, textStyle, haptic = 'medium', testID, nativeID,
}: Props) {
  const h = HEIGHT[size];
  const isGold = variant === 'gold';
  const textColor = isGold ? colors.onGold : variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.textSecondary : variant === 'glass' ? colors.textPrimary : colors.gold;

  const content = (
    <View style={[styles.row, { height: h, paddingHorizontal: size === 'sm' ? 14 : 22 }]}>
      {loading ? <ActivityIndicator color={textColor} /> : (
        <>
          {icon}
          <Text numberOfLines={1} style={[styles.label, { color: textColor, fontSize: FONT[size] }, textStyle]}>{label}</Text>
          {iconRight}
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic}
      testID={testID}
      nativeID={nativeID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={h < 44 ? { top: (44 - h) / 2, bottom: (44 - h) / 2 } : undefined}
      style={[
        styles.base,
        { borderRadius: radius.pill, minHeight: h },
        full && { alignSelf: 'stretch' },
        isGold && shadow.gold,
        variant === 'outline' && { borderWidth: 1, borderColor: colors.borderGold, backgroundColor: colors.goldSofter },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
        variant === 'glass' && { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceStrong },
        variant === 'danger' && { borderWidth: 1, borderColor: alpha(colors.danger, 0.35), backgroundColor: colors.dangerSoft },
        style,
      ]}
    >
      {isGold ? (
        <LinearGradient colors={gradients.gold as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.pill }}>
          <LinearGradient
            colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
            pointerEvents="none"
          />
          {content}
        </LinearGradient>
      ) : content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontFamily: fonts.bold, letterSpacing: 0.2 },
});
