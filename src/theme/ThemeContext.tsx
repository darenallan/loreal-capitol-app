import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Platform } from 'react-native';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface ColorPalette {
  bg: string;
  bgElevated: string;
  bgSunken: string;
  surface: string;
  surfaceStrong: string;
  surfaceSolid: string;
  surfaceSolidHi: string;
  overlay: string;
  /** Fond des barres d'en-tête d'écran (légèrement translucide) */
  chromeBg: string;
  border: string;
  borderStrong: string;
  borderGold: string;
  gold: string;
  goldLight: string;
  goldBright: string;
  goldDeep: string;
  goldSoft: string;
  goldSofter: string;
  goldGlow: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textDim: string;
  onGold: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  violet: string;
  violetSoft: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  pillActiveBg: string;
  pillActiveText: string;
  pillInactiveBg: string;
  pillInactiveText: string;
  pillInactiveBorder: string;
  glassBorder: string;
  obsidian: string;
  isDark: boolean;
}

export const darkPalette: ColorPalette = {
  // Fonds profonds mais avec du contraste pour ne pas noyer les éléments
  bg: '#0A0A10',
  bgElevated: '#12121D',
  bgSunken: '#06060A',
  surface: 'rgba(255,255,255,0.06)',
  surfaceStrong: 'rgba(255,255,255,0.10)',
  surfaceSolid: '#151522',
  surfaceSolidHi: '#1C1C2C',
  overlay: 'rgba(4,4,6,0.88)',
  chromeBg: 'rgba(7,7,10,0.95)',

  // Bordures hautement visibles
  border: 'rgba(255,255,255,0.14)',
  borderStrong: 'rgba(255,255,255,0.24)',
  borderGold: 'rgba(229,193,88,0.55)',

  // Or vibrant & lisible
  gold: '#E5C158',
  goldLight: '#FBE89F',
  goldBright: '#FFF2BF',
  goldDeep: '#B08826',
  goldSoft: 'rgba(229,193,88,0.16)',
  goldSofter: 'rgba(229,193,88,0.08)',
  goldGlow: 'rgba(229,193,88,0.45)',

  // Texte avec un contraste maximal
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#E2DCD0',
  textTertiary: '#B8B0A0',
  textMuted: '#968E7E',
  textDim: '#8C8474', // AA : 4.5:1 min. sur toutes les surfaces sombres (avant #6E6759, 3.0-3.5:1)
  onGold: '#07070A',

  // États
  // Tons accordés au noir & or : pas de bleu ni de violet vifs.
  // info = ivoire (2e boutique dans les graphiques, infos neutres), violet = bronze.
  success: '#7CC79A',
  successSoft: 'rgba(124,199,154,0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.16)',
  warning: '#F5B041',
  warningSoft: 'rgba(245,176,65,0.16)',
  info: '#D9CFBF',
  infoSoft: 'rgba(217,207,191,0.12)',
  violet: '#C8A27A',
  violetSoft: 'rgba(200,162,122,0.14)',

  // Cartes & Formulaires
  cardBg: '#13131F',
  cardBorder: 'rgba(229,193,88,0.35)',
  inputBg: '#161624',
  inputBorder: 'rgba(229,193,88,0.45)',
  inputText: '#FFFFFF',
  inputPlaceholder: '#A39B8B',
  pillActiveBg: 'rgba(229,193,88,0.16)', // pastille active translucide (comme le tableau de bord)
  pillActiveText: '#FBE89F',
  pillInactiveBg: '#1A1A28',
  pillInactiveText: '#E2DCD0',
  pillInactiveBorder: 'rgba(255,255,255,0.20)',
  glassBorder: 'rgba(255,255,255,0.14)',
  obsidian: '#0A0A10',
  isDark: true,
};

export const lightPalette: ColorPalette = {
  // Thème Clair : Or & Crème Royale / Ivoire Haute Couture
  bg: '#F6F3EC',
  bgElevated: '#FFFFFF',
  bgSunken: '#EDE7DC',
  surface: 'rgba(255,255,255,0.85)',
  surfaceStrong: 'rgba(255,255,255,0.95)',
  surfaceSolid: '#FFFFFF',
  surfaceSolidHi: '#F9F7F2',
  overlay: 'rgba(30,24,14,0.5)',
  chromeBg: 'rgba(246,243,236,0.95)',

  // Bordures dorées chaudes
  border: 'rgba(166,124,30,0.22)',
  borderStrong: 'rgba(166,124,30,0.40)',
  borderGold: 'rgba(166,124,30,0.55)',

  // Or royal / ambré profond
  gold: '#7F5F10', // AA : or bronze lisible en texte (avant #A67C1E, 3.4:1)
  goldLight: '#C99D36',
  goldBright: '#8B6510',
  goldDeep: '#73520A',
  goldSoft: 'rgba(166,124,30,0.12)',
  goldSofter: 'rgba(166,124,30,0.06)',
  goldGlow: 'rgba(166,124,30,0.30)',

  // Texte sombre sur fond clair avec contraste maximal
  text: '#14120E',
  textPrimary: '#14120E',
  textSecondary: '#3C3529',
  textTertiary: '#5C5342',
  textMuted: '#655B4A',
  textDim: '#776C58',
  onGold: '#FFFFFF',

  // États adaptés au clair
  success: '#256B29',
  successSoft: 'rgba(46,125,50,0.12)',
  danger: '#B71C1C',
  dangerSoft: 'rgba(211,47,47,0.12)',
  warning: '#9C4505',
  warningSoft: 'rgba(237,108,2,0.12)',
  info: '#5A4E3C',
  infoSoft: 'rgba(90,78,60,0.10)',
  violet: '#7A5230',
  violetSoft: 'rgba(122,82,48,0.10)',

  // Cartes & Formulaires
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(166,124,30,0.28)',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(166,124,30,0.45)',
  inputText: '#14120E',
  inputPlaceholder: '#655B4A',
  pillActiveBg: '#7F5F10',
  pillActiveText: '#FFFFFF',
  pillInactiveBg: '#EAE4D8',
  pillInactiveText: '#2C261D',
  pillInactiveBorder: 'rgba(166,124,30,0.22)',
  glassBorder: 'rgba(166,124,30,0.22)',
  obsidian: '#FAF7EE',
  isDark: false,
};

/** Vérifie si l'on est en journée (06h00 à 18h30) pour le mode temps automatique */
export function isDayTimeNow(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const decimalHour = hours + minutes / 60;
  // Lever du soleil ~06:00, coucher du soleil ~18:30
  return decimalHour >= 6.0 && decimalHour < 18.5;
}

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  isDark: boolean;
  colors: ColorPalette;
  isDayTime: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  setMode: () => {},
  toggleMode: () => {},
  isDark: true,
  colors: darkPalette,
  isDayTime: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Mode sombre permanent imposé par l'utilisateur (suppression du mode clair)
  const isDark = true;
  const mode: ThemeMode = 'dark';
  const colors = darkPalette;

  const setMode = () => {};
  const toggleMode = () => {};

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode, isDark, colors, isDayTime: false }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
