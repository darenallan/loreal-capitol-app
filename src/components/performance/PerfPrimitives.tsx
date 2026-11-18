import React from 'react';
import { Pressable, Text, View, StyleProp, ViewStyle } from 'react-native';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react-native';
import { formatMoney } from '../../theme';
import { haptic } from '../../ui';
import { PERF_STORE_LABELS, PerfStore } from '../../db/services/analytics';
import { formatPct, storeColor, usePerfStyles } from './perfStyles';

/* ------------------------------------------------------------------ */
/* Groupe de pastilles sélectionnables (retour à la ligne, ≥ 44 px)    */
/* ------------------------------------------------------------------ */
export function ChipGroup<T extends string | number>({ options, value, onChange, label, style }: {
  options: { id: T; label: string; icon?: (active: boolean) => React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  /** Libellé d'accessibilité du groupe. */
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { s } = usePerfStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>
      {options.map(o => {
        const active = o.id === value;
        return (
          <Pressable
            key={String(o.id)}
            onPress={() => { if (!active) { haptic('selection'); onChange(o.id); } }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={`${label} : ${o.label}`}
            style={({ pressed }) => [s.chip, active && s.chipActive, pressed && { opacity: 0.8 }]}
          >
            {o.icon ? o.icon(active) : null}
            <Text numberOfLines={1} style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Barre horizontale (≤ 12 px, bout arrondi, valeur lisible au bout)   */
/* ------------------------------------------------------------------ */
export function HBar({ value, max, color, display, accessibilityLabel }: {
  value: number; max: number; color: string; display?: string; accessibilityLabel?: string;
}) {
  const { s } = usePerfStyles();
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={[s.row, { gap: 8 }]} accessible accessibilityLabel={accessibilityLabel}>
      <View style={s.barTrack}>
        {value > 0 ? <View style={[s.barFill, { width: `${Math.max(pct * 100, 1.5)}%`, backgroundColor: color }]} /> : null}
      </View>
      <Text style={s.barValue} numberOfLines={1}>{display ?? formatMoney(value)}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Légende des boutiques                                               */
/* ------------------------------------------------------------------ */
export function StoreLegend({ stores = ['falaise', 'tougou'] }: { stores?: PerfStore[] }) {
  const { s, c } = usePerfStyles();
  return (
    <View style={s.legend} accessibilityLabel={`Légende : ${stores.map(k => PERF_STORE_LABELS[k]).join(', ')}`}>
      {stores.map(k => (
        <View key={k} style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: storeColor(c, k) }]} />
          <Text style={s.label}>{PERF_STORE_LABELS[k]}</Text>
        </View>
      ))}
    </View>
  );
}

/** Pastille de boutique : carré de couleur + nom (identité jamais par la couleur seule). */
export function StoreTag({ store }: { store: PerfStore }) {
  const { s, c } = usePerfStyles();
  return (
    <View style={s.legendItem}>
      <View style={[s.swatch, { width: 10, height: 10, backgroundColor: storeColor(c, store) }]} />
      <Text style={s.muted}>{PERF_STORE_LABELS[store]}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Évolution vs période précédente                                     */
/* ------------------------------------------------------------------ */
export function DeltaBadge({ pct, previous, compareLabel }: { pct: number | null; previous: number; compareLabel: string }) {
  const { s, c } = usePerfStyles();
  if (pct === null) {
    return <Text style={s.muted}>{previous === 0 ? `Aucune recette sur ${compareLabel}` : '—'}</Text>;
  }
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <View style={[s.row, { gap: 6, flexWrap: 'wrap' }]} accessible accessibilityLabel={`Évolution ${formatPct(pct)} par rapport à ${compareLabel} (${formatMoney(previous)} FCFA)`}>
      <Icon size={16} color={up ? c.success : c.danger} />
      <Text style={[s.valueSm, up ? s.up : s.down]}>{formatPct(pct)}</Text>
      <Text style={s.muted}>vs {compareLabel} ({formatMoney(previous)})</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Bandeau d'information (saisies antérieures, exclusions…)            */
/* ------------------------------------------------------------------ */
export function Notice({ children }: { children: React.ReactNode }) {
  const { s, c } = usePerfStyles();
  return (
    <View style={s.notice} accessibilityRole="text">
      <AlertTriangle size={16} color={c.warning} style={{ marginTop: 1 }} />
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

/** Statistique compacte « libellé / valeur ». */
export function Stat({ label, value }: { label: string; value: string }) {
  const { s } = usePerfStyles();
  return (
    <Text style={s.muted} accessibilityLabel={`${label} : ${value}`}>
      {label} <Text style={s.valueSm}>{value}</Text>
    </Text>
  );
}
