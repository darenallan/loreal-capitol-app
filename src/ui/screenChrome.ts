/**
 * Styles partagés des en-têtes d'écran « historiques » (écrans qui n'utilisent pas
 * encore <ScreenHeader>). Objets simples à étaler dans un StyleSheet local :
 *   backBtn: { ...chrome.backBtn, marginRight: 10 }
 * Objectif : même structure eyebrow + titre serif + bouton retour sur tous les écrans,
 * zones tactiles ≥ 44 px et textes ≥ 12 px.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';
import { alpha, colors, fonts, radius } from '../theme';

/** Agrandit la zone tactile d'un petit bouton sans changer son rendu. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/** Taille visuelle des boutons ronds d'en-tête (identique à IconButton / ScreenHeader). */
export const HEADER_BTN = 44;

const header: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: Platform.OS === 'web' ? 20 : 48,
  paddingBottom: 14,
  backgroundColor: colors.chromeBg,
  borderBottomWidth: 1,
  borderBottomColor: colors.glassBorder,
};

const headerRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
};

const roundBtn: ViewStyle = {
  width: HEADER_BTN,
  height: HEADER_BTN,
  borderRadius: HEADER_BTN / 2,
  borderWidth: 1,
  alignItems: 'center',
  justifyContent: 'center',
};

const backBtn: ViewStyle = {
  ...roundBtn,
  backgroundColor: colors.surfaceStrong,
  borderColor: colors.border,
};

/** Bouton-icône d'action (export, carte…) : teinte or discrète. */
const iconBtn: ViewStyle = {
  ...roundBtn,
  backgroundColor: colors.goldSofter,
  borderColor: alpha(colors.gold, 0.3),
};

/** Bouton or compact d'en-tête (Ajouter, Demander, Appliquer…). */
const goldBtn: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: HEADER_BTN,
  backgroundColor: colors.gold,
  paddingHorizontal: 14,
  borderRadius: radius.pill,
  gap: 6,
};

const goldBtnText: TextStyle = {
  color: colors.onGold,
  fontSize: 13,
  fontFamily: fonts.bold,
};

const headerTitleBox: ViewStyle = { flex: 1, minWidth: 0 };

const screenEyebrow: TextStyle = {
  fontSize: 12,
  letterSpacing: 2,
  color: colors.gold,
  fontFamily: fonts.extrabold,
  textTransform: 'uppercase',
};

const title: TextStyle = {
  fontSize: 22,
  lineHeight: 28,
  color: colors.textPrimary,
  fontFamily: fonts.display,
  letterSpacing: -0.3,
};

const subtitle: TextStyle = {
  color: colors.textTertiary,
  fontSize: 12,
  marginTop: 2,
  fontFamily: fonts.semibold,
};

/** Sélecteur de boutique La Falaise / Tougou (Boss). */
const storeBtn: ViewStyle = {
  flex: 1,
  minHeight: HEADER_BTN,
  justifyContent: 'center',
  paddingVertical: 8,
  borderRadius: radius.sm,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.glassBorder,
  alignItems: 'center',
};

const storeBtnActive: ViewStyle = {
  backgroundColor: colors.goldSoft,
  borderColor: colors.gold,
};

export const chrome = {
  header,
  headerRow,
  backBtn,
  iconBtn,
  goldBtn,
  goldBtnText,
  headerTitleBox,
  screenEyebrow,
  title,
  subtitle,
  storeBtn,
  storeBtnActive,
};
