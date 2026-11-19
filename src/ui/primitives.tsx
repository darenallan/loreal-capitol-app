import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, LayoutChangeEvent, Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { alpha, colors, fonts, formatMoney, radius, type } from '../theme';
import PressableScale from './PressableScale';
import { ND, haptic } from './haptics';

/* ------------------------------------------------------------------ */
/* FadeIn — apparition en cascade (opacité + translation + échelle)    */
/* ------------------------------------------------------------------ */
export function FadeIn({ children, delay = 0, distance = 18, duration = 650, style }: {
  children?: React.ReactNode; delay?: number; distance?: number; duration?: number; style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: ND });
    a.start();
    return () => a.stop();
  }, []);
  return (
    <Animated.View
      style={[style, {
        opacity: v,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
        ],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* AnimatedNumber — compteur qui roule jusqu'à la nouvelle valeur       */
/* ------------------------------------------------------------------ */
export function AnimatedNumber({ value, style, suffix = '', format, formatter, duration = 900 }: {
  value: number; style?: StyleProp<TextStyle>; suffix?: string; format?: (n: number) => string; formatter?: (n: number) => string; duration?: number;
}) {
  const actualFormat = format || formatter || formatMoney;
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(actualFormat(0));
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(actualFormat(v)));
    return () => anim.removeListener(id);
  }, [actualFormat]);
  useEffect(() => {
    const a = Animated.timing(anim, { toValue: Number(value) || 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start(({ finished }) => { if (finished) setDisplay(actualFormat(Number(value) || 0)); });
    return () => a.stop();
  }, [value, actualFormat]);
  return <Text style={style}>{display}{suffix}</Text>;
}

/* ------------------------------------------------------------------ */
/* IconButton — bouton rond en verre avec badge optionnel              */
/* ------------------------------------------------------------------ */
export function IconButton({ icon, onPress, badge, size = 44, tone = 'default', accessibilityLabel, style, testID }: {
  icon: React.ReactNode; onPress?: () => void; badge?: number; size?: number; tone?: 'default' | 'gold' | 'danger';
  accessibilityLabel?: string; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const border = tone === 'gold' ? colors.borderGold : tone === 'danger' ? alpha(colors.danger, 0.3) : colors.border;
  const bg = tone === 'gold' ? colors.goldSoft : tone === 'danger' ? colors.dangerSoft : colors.surfaceStrong;
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      hitSlop={size < 44 ? Math.ceil((44 - size) / 2) : undefined}
      hoverStyle={{ borderColor: colors.borderGold, backgroundColor: colors.goldSofter }}
      style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {icon}
      {!!badge && badge > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented — sélecteur à pastille dorée glissante                    */
/* ------------------------------------------------------------------ */
export function Segmented<T extends string>({ options, value, onChange, style, compact }: {
  options: { id: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  const moveTo = (id: string, animate = true) => {
    const l = layouts.current[id];
    if (!l) return;
    if (animate) {
      Animated.parallel([
        Animated.spring(x, { toValue: l.x, speed: 20, bounciness: 7, useNativeDriver: false }),
        Animated.spring(w, { toValue: l.width, speed: 20, bounciness: 7, useNativeDriver: false }),
      ]).start();
    } else { x.setValue(l.x); w.setValue(l.width); }
  };

  useEffect(() => { moveTo(value); }, [value]);

  const onItemLayout = (id: string) => (e: LayoutChangeEvent) => {
    layouts.current[id] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
    if (id === value) { moveTo(id, false); setReady(true); }
  };

  return (
    <View style={[s.segWrap, style]}>
      <View pointerEvents="none" style={s.segBorder} />
      {ready && (
        <Animated.View pointerEvents="none" style={[s.segPill, { left: x, width: w }]} />
      )}
      {options.map(o => {
        const active = o.id === value;
        return (
          <PressableScale
            key={o.id}
            onLayout={onItemLayout(o.id)}
            onPress={() => { haptic('selection'); onChange(o.id); }}
            haptic="none"
            scaleTo={0.94}
            hoverLift={0}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[s.segItem, compact && { paddingHorizontal: 12, height: 34 }]}
          >
            {o.icon}
            <Text numberOfLines={1} style={[s.segText, compact && { fontSize: 12 }, active && { color: colors.goldLight }]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SectionTitle — sur-titre or + titre serif                           */
/* ------------------------------------------------------------------ */
export function SectionTitle({ eyebrow, title, right, style }: { eyebrow?: string; title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, gap: 12 }, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={[type.eyebrow, { marginBottom: 6 }]}>{eyebrow}</Text> : null}
        <Text style={type.h2}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / Pill                                                        */
/* ------------------------------------------------------------------ */
export function Pill({ label, tone = 'gold', size, icon, style }: { label: string; tone?: 'gold' | 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'violet'; size?: 'sm' | 'md' | 'lg' | string; icon?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const map = {
    gold: [colors.goldSoft, colors.gold],
    success: [colors.successSoft, colors.success],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
    violet: [colors.violetSoft, colors.violet],
    neutral: [colors.surfaceStrong, colors.textSecondary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }, style]}>
      {icon}
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: fg, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Divider & EmptyState                                                */
/* ------------------------------------------------------------------ */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 12 }, style]} />;
}

export function EmptyState({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
      {icon ? <View style={s.emptyIcon}>{icon}</View> : null}
      <Text style={[type.title, { textAlign: 'center' }]}>{title}</Text>
      {subtitle ? <Text style={[type.caption, { textAlign: 'center', maxWidth: 320 }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Indicateur de chargement sobre (or), centré, avec libellé optionnel. */
export function LoadingState({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 12 }, style]} accessibilityRole="progressbar" accessibilityLabel={label || 'Chargement'}>
      <ActivityIndicator size="large" color={colors.gold} />
      {label ? <Text style={[type.caption, { textAlign: 'center' }]}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 4,
    borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  badgeText: { color: colors.textPrimary, fontSize: 11, fontFamily: fonts.extrabold },
  segWrap: {
    flexDirection: 'row', alignSelf: 'flex-start', padding: 4, borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as any) : null),
  },
  segBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  segPill: {
    position: 'absolute', top: 4, bottom: 4, borderRadius: radius.pill,
    backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.borderGold,
  },
  segItem: { height: 38, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.goldSofter, borderWidth: 1, borderColor: colors.borderGold, alignItems: 'center', justifyContent: 'center' },
});
