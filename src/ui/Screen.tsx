import React from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import AmbientBackground from './AmbientBackground';
import { FadeIn, IconButton } from './primitives';
import { useResponsive } from './useResponsive';
import { fonts, type } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';
import ThemeToggleButton from './ThemeToggleButton';

/**
 * Conteneur d'écran : fond vivant, zones sûres (encoche iPhone, barre Android),
 * contenu centré avec largeur max adaptée au téléphone / iPad / PC.
 */
export function Screen({ children, maxWidth, padded = false, style, intensity }: {
  children?: React.ReactNode; maxWidth?: number | 'none'; padded?: boolean; style?: StyleProp<ViewStyle>; intensity?: number;
}) {
  const insets = useSafeAreaInsets();
  const r = useResponsive();
  const { colors } = useAppTheme();
  const mw = maxWidth === 'none' ? undefined : (maxWidth ?? r.maxContent);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Fond discret par défaut (comme le tableau de bord) ; la connexion passe sa propre intensité. */}
      <AmbientBackground intensity={intensity ?? 0.35} />
      <FadeIn distance={10} duration={500} style={{ flex: 1 }}>
        <View
          style={[
            styles.inner,
            { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 0), maxWidth: mw },
            padded && { paddingHorizontal: r.gutter },
            style,
          ]}
        >
          {children}
        </View>
      </FadeIn>
    </View>
  );
}

/** En-tête d'écran : retour, sur-titre, titre serif, basculeur de thème et actions à droite. */
export function ScreenHeader({ title, eyebrow, subtitle, onBack, right, hideThemeToggle = false, style }: {
  title: string; eyebrow?: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; hideThemeToggle?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const r = useResponsive();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.header, { paddingHorizontal: r.gutter, paddingTop: r.pick({ phone: 12, laptop: 24 }) }, style]}>
      {onBack ? (
        <IconButton
          icon={<ChevronLeft color={colors.textPrimary} size={22} />}
          onPress={onBack}
          accessibilityLabel="Retour"
          testID="header-back"
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Text numberOfLines={1} style={[type.eyebrow, { color: colors.gold, marginBottom: 4 }]}>{eyebrow}</Text> : null}
        <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary, fontSize: r.pick({ phone: 22, tablet: 26, laptop: 30 }) }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[type.caption, { color: colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {!hideThemeToggle && <ThemeToggleButton compact />}
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', ...(Platform.OS === 'web' ? ({ minHeight: '100dvh' } as any) : null) },
  inner: { flex: 1, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14 },
  title: { fontFamily: fonts.display, letterSpacing: -0.4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
