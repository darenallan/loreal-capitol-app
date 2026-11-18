import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useAppTheme } from '../theme/ThemeContext';
import { ND } from './haptics';

let uid = 0;

type OrbProps = { size: number; color: string; opacity: number; top: number; left: number; drift: number; duration: number; parallax: Animated.ValueXY; depth: number };

function Orb({ size, color, opacity, top, left, drift, duration, parallax, depth }: OrbProps) {
  const t = useRef(new Animated.Value(0)).current;
  const id = useRef(`orb${++uid}`).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const tx = t.interpolate({ inputRange: [0, 1], outputRange: [-drift, drift] });
  const ty = t.interpolate({ inputRange: [0, 1], outputRange: [drift * 0.6, -drift * 0.6] });
  const sc = t.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top, left, width: size, height: size,
        transform: [
          { translateX: Animated.add(tx, Animated.multiply(parallax.x, depth)) },
          { translateY: Animated.add(ty, Animated.multiply(parallax.y, depth)) },
          { scale: sc },
        ],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="45%" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Fond vivant : adapte dynamiquement ses aurores et son fond selon le thème clair ou sombre
 */
export default function AmbientBackground({ intensity = 1 }: { intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const { isDark, colors } = useAppTheme();
  const parallax = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const gridId = useRef(`grid${++uid}`).current;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        Animated.spring(parallax, { toValue: { x: nx * 18, y: ny * 18 }, speed: 2, bounciness: 0, useNativeDriver: false }).start();
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);

  const big = Math.max(width, height);
  const o = (isDark ? 0.30 : 0.20) * intensity;
  const orbColor1 = isDark ? '#E5C158' : '#C99D36';
  const orbColor2 = isDark ? '#B08826' : '#E5C158';
  const orbColor3 = isDark ? '#FDF1B8' : '#D4AF37';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, overflow: 'hidden' }]}>
      <Orb size={big * 0.9} color={orbColor1} opacity={o} top={-big * 0.38} left={-big * 0.3} drift={40} duration={9000} parallax={parallax} depth={-1.2} />
      <Orb size={big * 0.75} color={orbColor2} opacity={o * 0.8} top={height * 0.45} left={width * 0.55} drift={55} duration={11000} parallax={parallax} depth={1.6} />
      <Orb size={big * 0.45} color={orbColor3} opacity={o * 0.55} top={height * 0.18} left={width * 0.62} drift={30} duration={7000} parallax={parallax} depth={2.4} />

      {/* Grille fine subtile */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gridId} cx="50%" cy="35%" r="75%">
            <Stop offset="0%" stopColor={isDark ? '#ffffff' : '#A67C1E'} stopOpacity={isDark ? 0.05 : 0.04} />
            <Stop offset="100%" stopColor={isDark ? '#ffffff' : '#A67C1E'} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gridId})`} />
      </Svg>
    </View>
  );
}
