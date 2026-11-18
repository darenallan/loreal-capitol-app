import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { History, RefreshCw } from 'lucide-react-native';
import { fonts, formatMoney, radius } from '../../theme';
import { EmptyState, GlassCard, GoldButton, LoadingState, PressableScale } from '../../ui';
import {
  CASH_STORE_LABELS, CashClosing, CashClosingStore, cashDiffTone, listCashClosings,
} from '../../db/services/cashClosing';
import { todayKey } from '../../utils/saleMath';
import { formatSigned, toneColors, useCashStyles } from './styles';
import { shiftDay } from './StoreDayBar';

const DAYS = 30;
const STORES: CashClosingStore[] = ['falaise', 'tougou'];

type Props = {
  refreshKey: number;
  onOpen: (store: CashClosingStore, day: string) => void;
};

const dayShort = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? day : dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Boss : clôtures des 30 derniers jours, écart total coloré par boutique. */
export default function HistoryTab({ refreshKey, onOpen }: Props) {
  const { s, c } = useCashStyles();
  const [items, setItems] = useState<CashClosing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    listCashClosings(DAYS)
      .then(list => { if (alive) setItems(list); })
      .catch(e => { if (alive) { setError(e?.message || 'Erreur de chargement.'); setItems([]); } });
    return () => { alive = false; };
  }, [refreshKey, reload]);

  if (!items) return <LoadingState label="Chargement de l'historique…" />;

  const byKey: Record<string, CashClosing> = {};
  items.forEach(it => { byKey[`${it.store}_${it.day}`] = it; });
  const today = todayKey();
  const days = Array.from({ length: DAYS }, (_, i) => shiftDay(today, -i));

  const summary = STORES.map(st => {
    const list = items.filter(i => i.store === st && i.status === 'closed');
    return { store: st, count: list.length, diff: list.reduce((sum, i) => sum + i.diff_total, 0) };
  });

  return (
    <View style={{ gap: 16 }}>
      {error ? (
        <GlassCard style={s.card}>
          <Text style={s.error}>{error}</Text>
          <GoldButton label="Réessayer" variant="outline" size="sm" icon={<RefreshCw color={c.gold} size={16} />} onPress={() => setReload(r => r + 1)} />
        </GlassCard>
      ) : null}

      <View style={local.summaryRow}>
        {summary.map(sm => {
          const tc = toneColors(c, cashDiffTone(sm.diff));
          return (
            <GlassCard key={sm.store} style={[s.card, local.summaryCard]}>
              <Text style={s.eyebrow} numberOfLines={1}>{CASH_STORE_LABELS[sm.store]}</Text>
              <Text style={[local.summaryDiff, { color: tc.fg }]} numberOfLines={1}>{formatSigned(sm.diff, formatMoney)}</Text>
              <Text style={s.caption}>{sm.count} clôture{sm.count > 1 ? 's' : ''} · {DAYS} j</Text>
            </GlassCard>
          );
        })}
      </View>

      {items.length === 0 && !error ? (
        <EmptyState icon={<History color={c.gold} size={22} />} title="Aucune clôture" subtitle={`Aucune caisse clôturée sur les ${DAYS} derniers jours.`} />
      ) : null}

      <GlassCard style={s.card} padded={false}>
        <View style={local.list}>
          {days.map(day => (
            <View key={day} style={[local.dayRow, { borderColor: c.border }]}>
              <Text style={[s.body, s.strong, local.dayLabel]} numberOfLines={1}>{dayShort(day)}</Text>
              <View style={local.cells}>
                {STORES.map(st => {
                  const it = byKey[`${st}_${day}`];
                  const tone = it ? cashDiffTone(it.diff_total) : null;
                  const tc = tone ? toneColors(c, tone) : null;
                  return (
                    <PressableScale
                      key={st}
                      onPress={() => onOpen(st, day)}
                      hoverLift={0}
                      style={[
                        local.cell,
                        { borderColor: tc ? tc.border : c.border, backgroundColor: tc ? tc.bg : c.surface },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${CASH_STORE_LABELS[st]}, ${dayShort(day)} : ${it ? `écart ${formatSigned(it.diff_total, formatMoney)}${it.status === 'reopened' ? ', rouverte' : ''}` : 'non clôturée'}`}
                    >
                      <Text style={s.caption} numberOfLines={1}>{CASH_STORE_LABELS[st]}</Text>
                      <Text style={[local.cellValue, { color: tc ? tc.fg : c.textMuted }]} numberOfLines={1}>
                        {it ? formatSigned(it.diff_total, formatMoney) : '—'}
                      </Text>
                      {it?.status === 'reopened' ? <Text style={[s.caption, { color: c.warning }]}>Rouverte</Text> : null}
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </View>
  );
}

const local = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  summaryCard: { flex: 1, minWidth: 140, gap: 4 },
  summaryDiff: { fontFamily: fonts.extrabold, fontSize: 20, fontVariant: ['tabular-nums'] },
  list: { paddingHorizontal: 12, paddingVertical: 4 },
  dayRow: { paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dayLabel: { textTransform: 'capitalize' },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minWidth: 0, minHeight: 56, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
  cellValue: { fontFamily: fonts.extrabold, fontSize: 15, fontVariant: ['tabular-nums'] },
});
