import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { colors, fonts, formatMoney, radius } from '../../theme';
import { IconButton, PressableScale } from '../../ui';
import { getUsers, BackdatedItemInput } from '../../db/database';
import type { EntryStore } from '../../utils/backdatedHelpers';
import CatalogPicker from './CatalogPicker';
import PaymentMethodPicker from './PaymentMethodPicker';
import { formStyles } from './formStyles';

export type DraftLine = BackdatedItemInput & { key: string };

export type DetailedDraft = {
  lines: DraftLine[];
  method: string;
  sellerName: string;
  sellerId: string;
  clientName: string;
  clientPhone: string;
  note: string;
};

export const EMPTY_DETAILED_DRAFT: DetailedDraft = {
  lines: [], method: 'Espèces', sellerName: '', sellerId: '', clientName: '', clientPhone: '', note: '',
};

type Props = {
  store: EntryStore;
  draft: DetailedDraft;
  onChange: (patch: Partial<DetailedDraft>) => void;
};

let lineSeq = 0;

/** Formulaire « Vente détaillée » : lignes d'articles, paiement, vendeur, client facultatif. */
export default function DetailedSaleForm({ store, draft, onChange }: Props) {
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let alive = true;
    getUsers()
      .then((users: any[]) => {
        if (!alive) return;
        const list = (Array.isArray(users) ? users : [])
          .filter(u => u && u.name && String(u.store || '').toLowerCase() === store)
          .map(u => ({ id: String(u.id), name: String(u.name) }));
        setSellers(list);
      })
      .catch(() => { if (alive) setSellers([]); });
    return () => { alive = false; };
  }, [store]);

  const addLine = (item: BackdatedItemInput) => {
    const existing = item.productId ? draft.lines.find(l => l.productId === item.productId && l.price === item.price) : null;
    if (existing) {
      onChange({ lines: draft.lines.map(l => (l.key === existing.key ? { ...l, quantity: l.quantity + item.quantity } : l)) });
      return;
    }
    onChange({ lines: [...draft.lines, { ...item, key: `l${Date.now()}_${++lineSeq}` }] });
  };

  const patchLine = (key: string, patch: Partial<DraftLine>) =>
    onChange({ lines: draft.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) });
  const removeLine = (key: string) => onChange({ lines: draft.lines.filter(l => l.key !== key) });

  return (
    <View>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Articles vendus</Text>
        <CatalogPicker store={store} onAdd={addLine} />
      </View>

      {draft.lines.length > 0 && (
        <View style={styles.lines}>
          {draft.lines.map(l => (
            <View key={l.key} style={styles.line}>
              <View style={styles.lineHead}>
                <View style={styles.lineInfo}>
                  <Text numberOfLines={2} style={styles.lineName}>{l.name}</Text>
                  <Text style={styles.lineMeta}>
                    {l.productId ? 'Catalogue' : 'Article libre'}
                    {[l.reference, l.size, l.color].filter(Boolean).length > 0 ? ` · ${[l.reference, l.size, l.color].filter(Boolean).join(' · ')}` : ''}
                  </Text>
                </View>
                <IconButton icon={<X color={colors.danger} size={14} />} tone="danger" size={30} onPress={() => removeLine(l.key)} accessibilityLabel={`Retirer ${l.name}`} />
              </View>
              <View style={styles.lineControls}>
                <View style={styles.qtyBox}>
                  <IconButton
                    icon={<Minus color={colors.textPrimary} size={14} />}
                    size={32}
                    onPress={() => patchLine(l.key, { quantity: Math.max(1, l.quantity - 1) })}
                    accessibilityLabel="Diminuer la quantité"
                  />
                  <Text style={styles.qty}>{l.quantity}</Text>
                  <IconButton
                    icon={<Plus color={colors.textPrimary} size={14} />}
                    size={32}
                    onPress={() => patchLine(l.key, { quantity: l.quantity + 1 })}
                    accessibilityLabel="Augmenter la quantité"
                  />
                </View>
                <TextInput
                  style={[formStyles.input, styles.priceInput]}
                  value={String(l.price)}
                  onChangeText={(v) => patchLine(l.key, { price: parseInt(v.replace(/\D/g, ''), 10) || 0 })}
                  keyboardType="numeric"
                  accessibilityLabel="Prix unitaire"
                />
                <Text style={styles.lineTotal}>{formatMoney(l.price * l.quantity)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <PaymentMethodPicker value={draft.method} onChange={(m) => onChange({ method: m })} />

      <View style={formStyles.field}>
        <Text style={formStyles.label}>Vendeur</Text>
        {sellers.length > 0 && (
          <View style={[formStyles.chipsRow, styles.sellerChips]}>
            {sellers.map(s => {
              const active = draft.sellerId === s.id;
              return (
                <PressableScale
                  key={s.id}
                  onPress={() => onChange(active ? { sellerId: '', sellerName: '' } : { sellerId: s.id, sellerName: s.name })}
                  haptic="selection"
                  hoverLift={0}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[formStyles.chip, active && formStyles.chipActive]}
                >
                  <Text style={[formStyles.chipText, active && formStyles.chipTextActive]}>{s.name}</Text>
                </PressableScale>
              );
            })}
          </View>
        )}
        <TextInput
          style={formStyles.input}
          value={draft.sellerName}
          onChangeText={(v) => onChange({ sellerName: v, sellerId: '' })}
          placeholder="Nom du vendeur (Boss par défaut)"
          placeholderTextColor={colors.inputPlaceholder}
        />
      </View>

      <View style={formStyles.field}>
        <Text style={formStyles.label}>Client (facultatif)</Text>
        <View style={styles.clientRow}>
          <TextInput
            style={[formStyles.input, styles.clientInput]}
            value={draft.clientName}
            onChangeText={(v) => onChange({ clientName: v })}
            placeholder="Nom"
            placeholderTextColor={colors.inputPlaceholder}
          />
          <TextInput
            style={[formStyles.input, styles.clientInput]}
            value={draft.clientPhone}
            onChangeText={(v) => onChange({ clientPhone: v })}
            placeholder="Téléphone"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={formStyles.field}>
        <Text style={formStyles.label}>Note (facultatif)</Text>
        <TextInput
          style={[formStyles.input, formStyles.inputMultiline]}
          value={draft.note}
          onChangeText={(v) => onChange({ note: v })}
          placeholder="Ex. : ticket papier n° 124"
          placeholderTextColor={colors.inputPlaceholder}
          multiline
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: 8, marginBottom: 14 },
  line: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  lineHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineInfo: { flex: 1, minWidth: 0 },
  lineName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textPrimary },
  lineMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lineControls: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qty: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textPrimary, minWidth: 22, textAlign: 'center' },
  priceInput: { width: 110, minHeight: 40, paddingVertical: 6 },
  lineTotal: { flex: 1, textAlign: 'right', fontFamily: fonts.bold, fontSize: 15, color: colors.gold, fontVariant: ['tabular-nums'] },
  sellerChips: { marginBottom: 8 },
  clientRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  clientInput: { flex: 1, minWidth: 140 },
});
