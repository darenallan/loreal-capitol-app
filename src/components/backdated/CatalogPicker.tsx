import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Search } from 'lucide-react-native';
import { colors, fonts, formatMoney, radius } from '../../theme';
import { GoldButton, PressableScale, Segmented } from '../../ui';
import { getProducts, BackdatedItemInput } from '../../db/database';
import type { EntryStore } from '../../utils/backdatedHelpers';
import { formStyles } from './formStyles';

type Props = {
  store: EntryStore;
  onAdd: (item: BackdatedItemInput) => void;
};

type Source = 'catalog' | 'free';

/** Ajout d'article : recherche dans le catalogue de la boutique ou article libre. */
export default function CatalogPicker({ store, onAdd }: Props) {
  const [source, setSource] = useState<Source>('catalog');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [freeName, setFreeName] = useState('');
  const [freePrice, setFreePrice] = useState('');
  const [freeQty, setFreeQty] = useState('1');
  const [freeError, setFreeError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getProducts(store)
      .then(list => { if (alive) setProducts(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setProducts([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [store]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.reference || '').toLowerCase().includes(q) ||
        String(p.barcode || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  const addProduct = (p: any) => {
    onAdd({
      productId: p.id,
      name: p.name || 'Article',
      price: Number(p.price) || 0,
      quantity: 1,
      size: p.size || null,
      color: p.color || null,
      reference: p.reference || null,
    });
    setQuery('');
  };

  const addFree = () => {
    const name = freeName.trim();
    const price = parseInt(freePrice.replace(/\D/g, ''), 10);
    const qty = parseInt(freeQty.replace(/\D/g, ''), 10);
    if (!name) { setFreeError("Nom de l'article requis."); return; }
    if (!isFinite(price) || price <= 0) { setFreeError('Prix invalide.'); return; }
    if (!isFinite(qty) || qty <= 0) { setFreeError('Quantité invalide.'); return; }
    onAdd({ productId: null, name, price, quantity: qty });
    setFreeName(''); setFreePrice(''); setFreeQty('1'); setFreeError(null);
  };

  return (
    <View style={styles.wrap}>
      <Segmented<Source>
        options={[{ id: 'catalog', label: 'Catalogue' }, { id: 'free', label: 'Article libre' }]}
        value={source}
        onChange={setSource}
        compact
      />

      {source === 'catalog' ? (
        <View style={styles.block}>
          <View style={styles.searchBox}>
            <Search color={colors.gold} size={16} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un article, une référence…"
              placeholderTextColor={colors.inputPlaceholder}
              autoCorrect={false}
            />
            {loading ? <ActivityIndicator color={colors.gold} size="small" /> : null}
          </View>
          {query.trim() && !loading && matches.length === 0 ? (
            <Text style={formStyles.hint}>Aucun article trouvé. Utilisez « Article libre ».</Text>
          ) : null}
          {matches.map(p => (
            <PressableScale
              key={p.id}
              style={styles.result}
              onPress={() => addProduct(p)}
              haptic="selection"
              hoverLift={0}
              hoverStyle={styles.resultHover}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter ${p.name}`}
            >
              <View style={styles.resultBody}>
                <Text numberOfLines={1} style={styles.resultName}>{p.name}</Text>
                <Text numberOfLines={1} style={styles.resultMeta}>
                  {[p.reference, p.size, p.color].filter(Boolean).join(' · ') || p.category || '—'} · stock {p.stock ?? 0}
                </Text>
              </View>
              <Text style={styles.resultPrice}>{formatMoney(p.price)}</Text>
              <Plus color={colors.gold} size={18} />
            </PressableScale>
          ))}
        </View>
      ) : (
        <View style={styles.block}>
          <TextInput
            style={formStyles.input}
            value={freeName}
            onChangeText={setFreeName}
            placeholder="Nom de l'article"
            placeholderTextColor={colors.inputPlaceholder}
          />
          <View style={styles.freeRow}>
            <TextInput
              style={[formStyles.input, styles.freePrice]}
              value={freePrice}
              onChangeText={setFreePrice}
              placeholder="Prix unitaire (FCFA)"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
            />
            <TextInput
              style={[formStyles.input, styles.freeQty]}
              value={freeQty}
              onChangeText={setFreeQty}
              placeholder="Qté"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
            />
          </View>
          {freeError ? <Text style={formStyles.error}>{freeError}</Text> : null}
          <Text style={formStyles.hint}>Un article libre n'impacte jamais le stock.</Text>
          <GoldButton label="Ajouter l'article" variant="outline" size="sm" icon={<Plus color={colors.gold} size={16} />} onPress={addFree} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  block: { gap: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
  },
  searchInput: {
    flex: 1, minWidth: 0, color: colors.inputText, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  resultHover: { borderColor: colors.borderGold, backgroundColor: colors.goldSofter },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textPrimary },
  resultMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  resultPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.gold, fontVariant: ['tabular-nums'] },
  freeRow: { flexDirection: 'row', gap: 8 },
  freePrice: { flex: 1, minWidth: 0 },
  freeQty: { width: 80 },
});
