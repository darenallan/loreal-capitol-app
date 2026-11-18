import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react-native';
import { fonts, formatMoney, radius } from '../../theme';
import {
  CASH_DIFF_THRESHOLD, CASH_METHODS, CashCounted, CashExpected, CashMethodAmounts, cashDiffTone, CashDiffTone,
} from '../../db/services/cashClosing';
import { formatSigned, toneColors, useCashStyles } from './styles';

type Props = {
  expected: CashExpected;
  counted: CashCounted;
  diff: CashMethodAmounts;
  diffTotal: number;
};

export function ToneIcon({ tone, size = 16 }: { tone: CashDiffTone; size?: number }) {
  const { c } = useCashStyles();
  const { fg } = toneColors(c, tone);
  if (tone === 'success') return <CheckCircle2 color={fg} size={size} />;
  if (tone === 'warning') return <AlertTriangle color={fg} size={size} />;
  return <XCircle color={fg} size={size} />;
}

export function toneLabel(tone: CashDiffTone): string {
  if (tone === 'success') return 'Caisse juste';
  if (tone === 'warning') return `Écart faible (≤ ${formatMoney(CASH_DIFF_THRESHOLD)} F)`;
  return `Écart important (> ${formatMoney(CASH_DIFF_THRESHOLD)} F)`;
}

/** Tableau attendu / compté / écart par moyen de paiement + total global coloré. */
export default function DiffTable({ expected, counted, diff, diffTotal }: Props) {
  const { s, c } = useCashStyles();
  const totalTone = cashDiffTone(diffTotal);
  const tc = toneColors(c, totalTone);

  return (
    <View style={{ gap: 10 }}>
      {CASH_METHODS.map(m => {
        const tone = cashDiffTone(diff[m.key]);
        const col = toneColors(c, tone);
        return (
          <View key={m.key} style={[local.row, { borderColor: c.border }]}>
            <View style={s.rowBetween}>
              <Text style={[s.body, s.strong]}>{m.label}</Text>
              <View style={s.row}>
                <ToneIcon tone={tone} size={14} />
                <Text style={[local.diff, { color: col.fg }]}>{formatSigned(diff[m.key], formatMoney)}</Text>
              </View>
            </View>
            <View style={local.cols}>
              <View style={local.col}>
                <Text style={s.caption}>Attendu</Text>
                <Text style={s.amount}>{formatMoney(expected[m.key])} F</Text>
              </View>
              <View style={local.col}>
                <Text style={s.caption}>Compté</Text>
                <Text style={s.amount}>{formatMoney(counted[m.key])} F</Text>
              </View>
            </View>
          </View>
        );
      })}

      <View
        style={[local.total, { backgroundColor: tc.bg, borderColor: tc.border }]}
        accessibilityLabel={`Écart total ${formatSigned(diffTotal, formatMoney)}. ${toneLabel(totalTone)}`}
      >
        <View style={s.rowBetween}>
          <View style={[s.row, { flexShrink: 1 }]}>
            <ToneIcon tone={totalTone} size={18} />
            <Text style={[local.totalLabel, { color: tc.fg }]} numberOfLines={2}>{toneLabel(totalTone)}</Text>
          </View>
          <Text style={[local.totalDiff, { color: tc.fg }]}>{formatSigned(diffTotal, formatMoney)}</Text>
        </View>
        <View style={local.cols}>
          <View style={local.col}>
            <Text style={s.caption}>Total attendu</Text>
            <Text style={s.amount}>{formatMoney(expected.total)} F</Text>
          </View>
          <View style={local.col}>
            <Text style={s.caption}>Total compté</Text>
            <Text style={s.amount}>{formatMoney(counted.total)} F</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  row: { gap: 6, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  cols: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, minWidth: 0 },
  diff: { fontFamily: fonts.extrabold, fontSize: 14, fontVariant: ['tabular-nums'] },
  total: { gap: 8, padding: 14, borderRadius: radius.md, borderWidth: 1 },
  totalLabel: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13 },
  totalDiff: { fontFamily: fonts.extrabold, fontSize: 20, fontVariant: ['tabular-nums'] },
});
