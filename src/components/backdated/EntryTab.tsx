import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react-native';
import { colors, fonts, formatMoney, radius } from '../../theme';
import { GlassCard, GoldButton, Segmented } from '../../ui';
import { recordBackdatedSale, newBackdatedSaleKey } from '../../db/database';
import {
  EntryStore, StoreChoice, formatYMDLong, isStrictlyPast, isSundayYMD, storeLabel,
} from '../../utils/backdatedHelpers';
import StoreDateBar from './StoreDateBar';
import GlobalReceiptForm from './GlobalReceiptForm';
import DetailedSaleForm, { DetailedDraft, EMPTY_DETAILED_DRAFT } from './DetailedSaleForm';

type Props = {
  user: any;
  store: EntryStore;
  onStoreChange: (s: EntryStore) => void;
  date: string;
  onDateChange: (ymd: string) => void;
  minDate: string;
  maxDate: string;
  onSaved: () => void;
};

type Mode = 'daily_total' | 'detailed';

/** Onglet « Saisir » : recette globale ou vente détaillée pour un jour passé. */
export default function EntryTab({ user, store, onStoreChange, date, onDateChange, minDate, maxDate, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('daily_total');
  const [amount, setAmount] = useState('');
  const [globalMethod, setGlobalMethod] = useState('Espèces');
  const [globalNote, setGlobalNote] = useState('');
  const [draft, setDraft] = useState<DetailedDraft>(EMPTY_DETAILED_DRAFT);
  const [impactStock, setImpactStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ text: string; warnings: string[] } | null>(null);
  const savingRef = useRef(false);
  // Clé d'idempotence : conservée après un échec réseau pour qu'un nouvel essai ne crée pas de doublon,
  // oubliée dès que la saisie change ou réussit.
  const pendingKeyRef = useRef<string | null>(null);
  useEffect(() => { pendingKeyRef.current = null; }, [mode, amount, globalMethod, draft, impactStock, date, store]);

  // Les articles du catalogue appartiennent à une boutique : on repart de zéro si elle change.
  useEffect(() => {
    setDraft(d => ({ ...d, lines: [], sellerId: '', sellerName: '' }));
  }, [store]);

  const dateOk = isStrictlyPast(date);
  const globalAmount = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  const detailedTotal = draft.lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0);
  const total = mode === 'daily_total' ? globalAmount : detailedTotal;
  const method = mode === 'daily_total' ? globalMethod : draft.method;
  const articleCount = draft.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const hasCatalogLines = draft.lines.some(l => !!l.productId);
  const canSave = dateOk && total > 0 && !!method && !saving;

  const handleSave = async () => {
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!pendingKeyRef.current) pendingKeyRef.current = newBackdatedSaleKey();
      const res = await recordBackdatedSale({
        saleKey: pendingKeyRef.current,
        actor: user,
        date,
        store,
        mode,
        paymentMethod: method,
        totalAmount: mode === 'daily_total' ? globalAmount : undefined,
        items: mode === 'detailed'
          ? draft.lines.map(({ key, ...it }) => it)
          : undefined,
        sellerName: mode === 'detailed' ? draft.sellerName : undefined,
        sellerId: mode === 'detailed' ? (draft.sellerId || undefined) : undefined,
        client: mode === 'detailed' ? { name: draft.clientName, phone: draft.clientPhone } : undefined,
        note: mode === 'daily_total' ? globalNote : draft.note,
        impactStock: mode === 'detailed' ? impactStock : false,
      });
      pendingKeyRef.current = null;
      setSuccess({
        text: `${formatMoney(res.total)} FCFA enregistrés pour le ${formatYMDLong(date)} (${storeLabel(store)}).${res.stockApplied.length > 0 ? ' Stock mis à jour.' : ''}`,
        warnings: res.warnings,
      });
      if (mode === 'daily_total') {
        setAmount('');
        setGlobalNote('');
      } else {
        setDraft(d => ({ ...EMPTY_DETAILED_DRAFT, method: d.method }));
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Échec de l'enregistrement.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <StoreDateBar
        store={store}
        onStoreChange={(s: StoreChoice) => { if (s !== 'all') onStoreChange(s); }}
        allowAll={false}
        date={date}
        onDateChange={onDateChange}
        minDate={minDate}
        maxDate={maxDate}
      />

      {!dateOk ? (
        <View style={[styles.banner, styles.bannerDanger]}>
          <AlertTriangle color={colors.danger} size={16} />
          <Text style={[styles.bannerText, { color: colors.danger }]}>
            Choisissez un jour passé (avant aujourd'hui, 2 ans maximum).
          </Text>
        </View>
      ) : isSundayYMD(date) ? (
        <View style={[styles.banner, styles.bannerWarning]}>
          <AlertTriangle color={colors.warning} size={16} />
          <Text style={[styles.bannerText, { color: colors.warning }]}>
            Dimanche : cette recette ne sera pas comptée dans la vue Semaine du Dashboard.
          </Text>
        </View>
      ) : null}

      <Segmented<Mode>
        options={[{ id: 'daily_total', label: 'Recette globale' }, { id: 'detailed', label: 'Vente détaillée' }]}
        value={mode}
        onChange={(m) => { setMode(m); setError(null); setSuccess(null); }}
        compact
      />

      <GlassCard>
        {mode === 'daily_total' ? (
          <GlobalReceiptForm
            amount={amount}
            onAmountChange={setAmount}
            method={globalMethod}
            onMethodChange={setGlobalMethod}
            note={globalNote}
            onNoteChange={setGlobalNote}
          />
        ) : (
          <>
            <DetailedSaleForm store={store} draft={draft} onChange={(p) => setDraft(d => ({ ...d, ...p }))} />
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>Impacter le stock</Text>
                <Text style={styles.switchHint}>
                  {hasCatalogLines
                    ? 'Décrémente le stock actuel des articles du catalogue (restitué si la saisie est supprimée).'
                    : 'Sans effet : aucun article du catalogue.'}
                </Text>
              </View>
              <Switch
                value={impactStock}
                onValueChange={setImpactStock}
                trackColor={{ false: colors.surfaceStrong, true: colors.goldDeep }}
                thumbColor={impactStock ? colors.gold : colors.textSecondary}
                accessibilityLabel="Impacter le stock"
              />
            </View>
          </>
        )}
      </GlassCard>

      <GlassCard variant="gold" style={styles.recap}>
        <Text style={styles.recapEyebrow}>RÉCAPITULATIF</Text>
        <View style={styles.recapRow}>
          <Text style={styles.recapKey}>Jour</Text>
          <Text style={styles.recapValue} numberOfLines={1}>{formatYMDLong(date)}</Text>
        </View>
        <View style={styles.recapRow}>
          <Text style={styles.recapKey}>Boutique</Text>
          <Text style={styles.recapValue}>{storeLabel(store)}</Text>
        </View>
        <View style={styles.recapRow}>
          <Text style={styles.recapKey}>Paiement</Text>
          <Text style={styles.recapValue}>{method}</Text>
        </View>
        {mode === 'detailed' && (
          <View style={styles.recapRow}>
            <Text style={styles.recapKey}>Articles</Text>
            <Text style={styles.recapValue}>{articleCount}{impactStock && hasCatalogLines ? ' · stock impacté' : ''}</Text>
          </View>
        )}
        <View style={[styles.recapRow, styles.recapTotalRow]}>
          <Text style={styles.recapKey}>Total</Text>
          <Text style={styles.recapTotal}>{formatMoney(total)} FCFA</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? (
          <View style={styles.success}>
            <View style={styles.successHead}>
              <CheckCircle2 color={colors.success} size={16} />
              <Text style={styles.successText}>{success.text}</Text>
            </View>
            {success.warnings.map((w, i) => <Text key={i} style={styles.warningText}>• {w}</Text>)}
          </View>
        ) : null}

        <GoldButton
          label="Enregistrer"
          icon={<Save color={colors.onGold} size={18} />}
          onPress={handleSave}
          loading={saving}
          disabled={!canSave}
          full
          style={styles.saveBtn}
        />
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  bannerDanger: { backgroundColor: colors.dangerSoft, borderColor: 'rgba(235,111,94,0.35)' },
  bannerWarning: { backgroundColor: colors.warningSoft, borderColor: 'rgba(245,180,80,0.35)' },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchText: { flex: 1, minWidth: 0 },
  switchLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  switchHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  recap: { gap: 8 },
  recapEyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 2, color: colors.gold, marginBottom: 2 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  recapKey: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  recapValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, textAlign: 'right', textTransform: 'capitalize' },
  recapTotalRow: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderGold },
  recapTotal: { fontFamily: fonts.mono, fontSize: 22, color: colors.goldLight, fontVariant: ['tabular-nums'] },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.danger, marginTop: 4 },
  success: { gap: 4, marginTop: 4 },
  successHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  successText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
  warningText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.warning, marginLeft: 24 },
  saveBtn: { marginTop: 8 },
});
