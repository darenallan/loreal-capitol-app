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

/**
 * Thème « Haute Joaillerie & Couture Ledger » (design system Stitch).
 * Obsidienne chaude + or couture. Tokens Stitch d'origine en commentaire.
 */
export const darkPalette: ColorPalette = {
  // Obsidienne (--color-obsidian-*)
  bg: '#16130D', // surface
  bgElevated: '#1F1B15', // container-low
  bgSunken: '#110E09', // lowest
  surface: 'rgba(245,240,230,0.05)',
  surfaceStrong: 'rgba(245,240,230,0.09)',
  surfaceSolid: '#26211A', // container
  surfaceSolidHi: '#2F2A22', // container-high
  overlay: 'rgba(17,14,9,0.88)',
  chromeBg: 'rgba(22,19,13,0.95)',

  // Bordures (--color-obsidian-border)
  border: '#3D3932',
  borderStrong: '#575147',
  borderGold: 'rgba(229,193,88,0.35)',

  // Or couture (--color-gold-*)
  gold: '#E5C158',
  goldLight: '#F3DB83',
  goldBright: '#FFF0C2',
  goldDeep: '#947221',
  goldSoft: 'rgba(229,193,88,0.12)', // gold-dim
  goldSofter: 'rgba(229,193,88,0.06)',
  goldGlow: 'rgba(229,193,88,0.25)',

  // Texte (--text-*)
  text: '#F5F0E6',
  textPrimary: '#F5F0E6',
  textSecondary: '#C9C4B8',
  textTertiary: '#ABA598',
  textMuted: '#8C8577',
  textDim: '#8C8577', // AA : 4.5:1 sur fond et cartes
  onGold: '#110E09',

  // États (--color-status-*). Les fonds « soft » reprennent les tokens Stitch ;
  // la couleur de texte est éclaircie dans la même teinte, car sauge #658354 (4.0:1)
  // et rubis #B94A48 (3.4:1) ne passent pas AA en texte sur obsidienne.
  success: '#8DAA7A', // sauge
  successSoft: 'rgba(101,131,84,0.15)',
  danger: '#E07A76', // rubis
  dangerSoft: 'rgba(185,74,72,0.15)',
  warning: '#D97706', // ambre
  warningSoft: 'rgba(217,119,6,0.15)',
  info: '#C9C4B8', // ivoire : 2e boutique dans les graphiques, infos neutres
  infoSoft: 'rgba(201,196,184,0.10)',
  violet: '#C8A27A', // bronze
  violetSoft: 'rgba(200,162,122,0.14)',

  // Cartes & Formulaires (.card-prestige)
  cardBg: '#1F1B15',
  cardBorder: '#3D3932',
  inputBg: '#110E09',
  inputBorder: '#3D3932',
  inputText: '#F5F0E6',
  inputPlaceholder: '#8C8577',
  pillActiveBg: 'rgba(229,193,88,0.12)',
  pillActiveText: '#F3DB83',
  pillInactiveBg: '#1F1B15',
  pillInactiveText: '#C9C4B8',
  pillInactiveBorder: '#3D3932',
  glassBorder: '#3D3932',
  obsidian: '#16130D',
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
