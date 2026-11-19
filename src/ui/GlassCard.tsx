import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, shadow } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';

export type GlassCardProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'gold' | 'solid' | 'danger';
  padded?: boolean;
  glow?: boolean | string;
  intensity?: number;
  children?: React.ReactNode;
};

/**
 * Carte en verre poli : s'adapte dynamiquement au thème Clair / Sombre / Auto
 */
export default function GlassCard({ style, variant = 'default', padded = true, glow, children, ...rest }: GlassCardProps) {
  const { isDark, colors } = useAppTheme();

  const borderColor =
    variant === 'gold' ? colors.borderGold
      : variant === 'danger' ? colors.danger
        : isDark ? colors.cardBorder : colors.border;

  const backgroundColor =
    variant === 'solid' ? colors.surfaceSolid
      : variant === 'gold' ? colors.goldSoft
        : variant === 'danger' ? colors.dangerSoft
          : colors.cardBg;

  return (
    <View
      {...rest}
      style={[
        styles.card,
        { borderColor, backgroundColor },
        padded && styles.padded,
        // `glow` reste accepté pour compatibilité, mais n'ajoute plus de halo doré :
        // la hiérarchie passe par la bordure or (variant="gold"), pas par la lumière.
        shadow.deep,
        Platform.OS === 'web' && ({ backdropFilter: 'blur(16px) saturate(140%)', WebkitBackdropFilter: 'blur(16px) saturate(140%)' } as any),
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={
          variant === 'gold'
            ? [colors.goldSofter, 'rgba(0,0,0,0)']
            : isDark
            ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  padded: { padding: 20 },
});
