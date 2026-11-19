import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calculator, Lock, Plus, Trash2 } from 'lucide-react-native';
import { fonts, formatMoney, radius } from '../../theme';
import { GlassCard, GoldButton, PressableScale, HIT_SLOP } from '../../ui';
import {
  CASH_DENOMINATIONS, CASH_STORE_LABELS, CashBreakdownCount, CashClosing, CashClosingStore, CashSalesBreakdown,
  cashBreakdownTotal, cashDiffTone, computeCashClosingTotals, saveCashClosing,
} from '../../db/services/cashClosing';
import MoneyInput, { digitsOnly, parseAmount } from './MoneyInput';
import DiffTable, { ToneIcon, toneLabel } from './DiffTable';
import { formatDayLong } from './StoreDayBar';
import { formatSigned, toneColors, useCashStyles } from './styles';

type CashOutRow = { key: string; label: string; amount: string };
type DenomKey = 'b10000' | 'b5000' | 'b2000' | 'b1000' | 'b500';

type Props = {
  user: any;
  store: CashClosingStore;
  day: string;
  breakdown: CashSalesBreakdown;
  /** Clôture précédente (rouverte) servant à pré-remplir la saisie. */
  previous: CashClosing | null;
  onSaved: (c: CashClosing) => void;
};

const amountStr = (n: number | null | undefined) => (n ? String(Math.round(n)) : '');
let rowSeq = 0;
const newRow = (label = '', amount = ''): CashOutRow => ({ key: `co_${Date.now()}_${rowSeq++}`, label, amount });

/** Formulaire de comptage de fin de journée, avec écarts calculés en direct. */
export default function CashCountForm({ user, store, day, breakdown, previous, onSaved }: Props) {
  const { s, c } = useCashStyles();

  const [opening, setOpening] = useState('');
  const [useDenoms, setUseDenoms] = useState(false);
  const [cashTotal, setCashTotal] = useState('');
  const [denoms, setDenoms] = useState<Record<DenomKey, string>>({ b10000: '', b5000: '', b2000: '', b1000: '', b500: '' });
  const [coins, setCoins] = useState('');
  const [momo, setMomo] = useState('');
  const [om, setOm] = useState('');
  const [card, setCard] = useState('');
  const [cashOut, setCashOut] = useState<CashOutRow[]>([]);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplissage depuis la version rouverte (ou remise à zéro au changement de boutique / jour)
  useEffect(() => {
    const p = previous;
    setOpening(amountStr(p?.opening_float));
    const b = p?.cash_breakdown || null;
    setUseDenoms(!!b);
    setDenoms({
      b10000: amountStr(b?.b10000), b5000: amountStr(b?.b5000), b2000: amountStr(b?.b2000),
      b1000: amountStr(b?.b1000), b500: amountStr(b?.b500),
    });
    setCoins(amountStr(b?.coins));
    setCashTotal(amountStr(p?.counted.cash));
    setMomo(amountStr(p?.counted.momo));
    setOm(amountStr(p?.counted.om));
    setCard(amountStr(p?.counted.card));
    setCashOut((p?.cash_out || []).map(e => newRow(e.label, String(e.amount))));
    setNote(p?.note || '');
    setError(null);
  }, [store, day, previous?.version, previous?.status]);

  const breakdownCount: CashBreakdownCount = {
    b10000: parseAmount(denoms.b10000), b5000: parseAmount(denoms.b5000), b2000: parseAmount(denoms.b2000),
    b1000: parseAmount(denoms.b1000), b500: parseAmount(denoms.b500), coins: parseAmount(coins),
  };
  const countedCash = useDenoms ? cashBreakdownTotal(breakdownCount) : parseAmount(cashTotal);
  const cashFilled = useDenoms
    ? Object.values(denoms).some(v => v !== '') || coins !== ''
    : cashTotal !== '';

  const cashOutEntries = cashOut.map(r => ({ label: r.label, amount: parseAmount(r.amount) }));

  const totals = useMemo(
    () => computeCashClosingTotals(
      {
        opening_float: parseAmount(opening),
        counted: { cash: countedCash, momo: parseAmount(momo), om: parseAmount(om), card: parseAmount(card) },
        cash_out: cashOutEntries,
      },
      breakdown
    ),
    [opening, countedCash, momo, om, card, JSON.stringify(cashOutEntries), breakdown]
  );

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveCashClosing(
        {
          store,
          day,
          opening_float: parseAmount(opening),
          counted: { cash: countedCash, momo: parseAmount(momo), om: parseAmount(om), card: parseAmount(card) },
          cash_breakdown: useDenoms ? breakdownCount : null,
          cash_out: cashOutEntries,
          note,
        },
        user
      );
      setConfirmOpen(false);
      onSaved(saved);
    } catch (e: any) {
      setError(e?.message || "Échec de l'enregistrement.");
    }
    setSaving(false);
  };

  const askConfirm = () => {
    if (!cashFilled) {
      setError('Saisissez les espèces comptées (0 si le tiroir est vide).');
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  const tone = cashDiffTone(totals.diffTotal);
  const tc = toneColors(c, tone);

  return (
    <View style={{ gap: 16 }}>
      {/* Fond de caisse & espèces */}
      <GlassCard style={s.card}>
        <Text style={s.eyebrow}>1 · Espèces</Text>
        <MoneyInput
          label="Fond de caisse d'ouverture"
          value={opening}
          onChange={setOpening}
          showFormatted
          hint="Monnaie présente dans le tiroir à l'ouverture."
          testID="cash-opening"
        />

        <View style={s.wrapRow}>
          <PressableScale
            onPress={() => setUseDenoms(false)}
            style={[s.chip, !useDenoms && s.chipActive]}
            hoverLift={0}
            accessibilityRole="button"
            accessibilityState={{ selected: !useDenoms }}
            accessibilityLabel="Saisir le total des espèces"
          >
            <Text style={[s.chipText, !useDenoms && s.chipTextActive]}>Total</Text>
          </PressableScale>
          <PressableScale
            onPress={() => setUseDenoms(true)}
            style={[s.chip, useDenoms && s.chipActive]}
            hoverLift={0}
            accessibilityRole="button"
            accessibilityState={{ selected: useDenoms }}
            accessibilityLabel="Compter par coupures"
          >
            <Calculator color={useDenoms ? c.gold : c.textSecondary} size={14} />
            <Text style={[s.chipText, useDenoms && s.chipTextActive]}>Par coupures</Text>
          </PressableScale>
        </View>

        {useDenoms ? (
          <View style={{ gap: 8 }}>
            {CASH_DENOMINATIONS.map(d => {
              const k = `b${d}` as DenomKey;
              const sub = parseAmount(denoms[k]) * d;
              return (
                <View key={d} style={local.denomRow}>
                  <Text style={[s.body, s.strong, local.denomLabel]}>{formatMoney(d)} F ×</Text>
                  <TextInput
                    style={[s.input, local.denomInput]}
                    value={denoms[k]}
                    onChangeText={t => setDenoms(prev => ({ ...prev, [k]: digitsOnly(t).slice(0, 5) }))}
                    placeholder="0"
                    placeholderTextColor={c.inputPlaceholder}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    accessibilityLabel={`Nombre de billets de ${formatMoney(d)} francs`}
                  />
                  <Text style={[s.amount, local.denomSub]} numberOfLines={1}>{formatMoney(sub)} F</Text>
                </View>
              );
            })}
            <MoneyInput label="Pièces (montant total)" value={coins} onChange={setCoins} />
            <View style={s.rowBetween}>
              <Text style={s.label}>Espèces comptées</Text>
              <Text style={s.amountLg}>{formatMoney(countedCash)} F</Text>
            </View>
          </View>
        ) : (
          <MoneyInput
            label="Espèces comptées en fin de journée"
            value={cashTotal}
            onChange={setCashTotal}
            showFormatted
            hint="Tout le tiroir, fond de caisse compris."
            testID="cash-counted"
          />
        )}
      </GlassCard>

      {/* Sorties de caisse */}
      <GlassCard style={s.card}>
        <Text style={s.eyebrow}>2 · Sorties de caisse</Text>
        {cashOut.length === 0 ? <Text style={s.caption}>Aucune sortie (achat, transport, dépense…).</Text> : null}
        {cashOut.map((r, idx) => (
          <View key={r.key} style={local.outRow}>
            <TextInput
              style={[s.input, local.outLabel]}
              value={r.label}
              onChangeText={t => setCashOut(list => list.map(x => (x.key === r.key ? { ...x, label: t.slice(0, 80) } : x)))}
              placeholder="Libellé"
              placeholderTextColor={c.inputPlaceholder}
              accessibilityLabel={`Libellé de la sortie ${idx + 1}`}
            />
            <TextInput
              style={[s.input, local.outAmount]}
              value={r.amount}
              onChangeText={t => setCashOut(list => list.map(x => (x.key === r.key ? { ...x, amount: digitsOnly(t) } : x)))}
              placeholder="Montant"
              placeholderTextColor={c.inputPlaceholder}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel={`Montant de la sortie ${idx + 1}`}
            />
            <PressableScale
              onPress={() => setCashOut(list => list.filter(x => x.key !== r.key))}
              style={s.iconBtn}
              hitSlop={HIT_SLOP}
              hoverLift={0}
              accessibilityRole="button"
              accessibilityLabel={`Supprimer la sortie ${idx + 1}`}
            >
              <Trash2 color={c.danger} size={18} />
            </PressableScale>
          </View>
        ))}
        <GoldButton
          label="Ajouter une sortie"
          variant="outline"
          size="sm"
          icon={<Plus color={c.gold} size={16} />}
          onPress={() => setCashOut(list => [...list, newRow()])}
          style={{ alignSelf: 'flex-start' }}
        />
        {totals.cashOutTotal > 0 ? (
          <View style={s.rowBetween}>
            <Text style={s.body}>Total des sorties</Text>
            <Text style={s.amount}>{formatMoney(totals.cashOutTotal)} F</Text>
          </View>
        ) : null}
      </GlassCard>

      {/* Mobile money & carte */}
      <GlassCard style={s.card}>
        <Text style={s.eyebrow}>3 · Mobile Money & Carte</Text>
        <Text style={s.caption}>Montants constatés sur les relevés du jour (vide = 0).</Text>
        <MoneyInput label="MTN MoMo constaté" value={momo} onChange={setMomo} showFormatted testID="cash-momo" />
        <MoneyInput label="Orange Money constaté" value={om} onChange={setOm} showFormatted testID="cash-om" />
        <MoneyInput label="Carte bancaire constatée" value={card} onChange={setCard} showFormatted testID="cash-card" />
      </GlassCard>

      {/* Écarts en direct */}
      <GlassCard style={s.card}>
        <Text style={s.eyebrow}>4 · Écarts</Text>
        <Text style={s.caption}>
          Espèces attendues = fond {formatMoney(totals.opening)} + ventes {formatMoney(totals.expected.cash_sales)} − sorties {formatMoney(totals.cashOutTotal)} = {formatMoney(totals.expected.cash)} F
        </Text>
        <DiffTable expected={totals.expected} counted={totals.counted} diff={totals.diff} diffTotal={totals.diffTotal} />
      </GlassCard>

      <GlassCard style={s.card}>
        <Text style={s.label}>Note (facultatif)</Text>
        <TextInput
          style={[s.input, s.inputMultiline]}
          value={note}
          onChangeText={t => setNote(t.slice(0, 500))}
          placeholder="Ex. : billet abîmé, client à rembourser demain…"
          placeholderTextColor={c.inputPlaceholder}
          multiline
          accessibilityLabel="Note de clôture"
        />
      </GlassCard>

      {error && !confirmOpen ? <Text style={s.error}>{error}</Text> : null}

      <GoldButton
        label={previous ? 'Re-clôturer la caisse' : 'Clôturer la caisse'}
        icon={<Lock color={c.onGold} size={18} />}
        size="lg"
        full
        onPress={askConfirm}
        testID="cash-close-submit"
      />

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={saving ? undefined : () => setConfirmOpen(false)}>
        <View style={s.backdrop}>
          <GlassCard variant="solid" style={s.modalCard}>
            <Text style={s.title}>Clôturer la caisse ?</Text>
            <Text style={s.body}>
              {CASH_STORE_LABELS[store]} · <Text style={{ textTransform: 'capitalize' }}>{formatDayLong(day)}</Text>
            </Text>
            <View style={[local.confirmBox, { backgroundColor: tc.bg, borderColor: tc.border }]}>
              <View style={s.row}>
                <ToneIcon tone={tone} />
                <Text style={[local.confirmTone, { color: tc.fg }]}>{toneLabel(tone)}</Text>
              </View>
              <Text style={[local.confirmDiff, { color: tc.fg }]}>{formatSigned(totals.diffTotal, formatMoney)}</Text>
            </View>
            <Text style={s.caption}>
              Après clôture, la saisie passe en lecture seule. Seul le Boss pourra la rouvrir.
            </Text>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={s.modalActions}>
              <GoldButton label="Annuler" variant="ghost" onPress={() => setConfirmOpen(false)} disabled={saving} style={s.modalBtn} />
              <GoldButton label="Confirmer" onPress={submit} loading={saving} style={s.modalBtn} testID="cash-close-confirm" />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const local = StyleSheet.create({
  denomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  denomLabel: { width: 92 },
  denomInput: { width: 76, textAlign: 'center' },
  denomSub: { flex: 1, minWidth: 0, textAlign: 'right' },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outLabel: { flex: 1, minWidth: 0 },
  outAmount: { width: 104 },
  confirmBox: { padding: 14, borderRadius: radius.md, borderWidth: 1, gap: 6 },
  confirmTone: { fontFamily: fonts.bold, fontSize: 13, flexShrink: 1 },
  confirmDiff: { fontFamily: fonts.mono, fontSize: 26, fontVariant: ['tabular-nums'] },
});
