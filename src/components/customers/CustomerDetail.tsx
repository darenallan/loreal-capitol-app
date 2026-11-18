import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Phone, Mail, Store } from 'lucide-react-native';
import { colors, fonts, formatMoney, radius, space, type } from '../../theme';
import { GlassCard, GoldButton, Pill } from '../../ui';
import type { Customer, CustomerPurchase } from '../../db/services/customers';
import { formatCustomerPhone } from '../../db/services/customers';
import AdvanceReminderCard from './AdvanceReminderCard';
import { callCustomer, dayLabel, NO_PHONE_HINT, storeName } from './customerActions';

type Props = {
  customer: Customer;
  /** Afficher la boutique sur chaque ligne (Boss, toutes boutiques). */
  showStore: boolean;
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} : ${value}${sub ? ` ${sub}` : ''}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function PurchaseRow({ p, showStore }: { p: CustomerPurchase; showStore: boolean }) {
  return (
    <View style={styles.purchase}>
      <View style={styles.purchaseBody}>
        <Text style={styles.purchaseDate}>
          {dayLabel(p.day)}{showStore ? ` · ${storeName(p.store)}` : ''}
        </Text>
        <Text numberOfLines={3} style={styles.purchaseItems}>{p.itemsLabel}</Text>
        <View style={styles.pills}>
          {p.paymentMethod ? <Pill label={p.isInstallment ? `Versement · ${p.paymentMethod}` : p.paymentMethod} tone="neutral" /> : null}
          {p.backdated ? <Pill label="Saisie antérieure" tone="violet" /> : null}
          {p.isAdvance && !p.isInstallment ? <Pill label="Acompte" tone="warning" /> : null}
        </View>
      </View>
      <View style={styles.purchaseRight}>
        <Text style={styles.purchaseAmount}>{formatMoney(p.amount)}</Text>
        <Text style={styles.currency}>FCFA</Text>
        {p.isAdvance && p.articleTotal > p.amount ? (
          <Text style={styles.purchaseSub}>sur {formatMoney(p.articleTotal)}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Fiche client : identité, indicateurs, acomptes en cours, historique des achats. */
const PAGE = 30;

export default function CustomerDetail({ customer: c, showStore }: Props) {
  const [limit, setLimit] = useState(PAGE);
  const shown = c.purchases.slice(0, limit);
  const hidden = c.purchases.length - shown.length;
  return (
    <View style={styles.wrap}>
      <GlassCard variant="gold">
        <Text style={type.eyebrow}>Fiche client</Text>
        <Text style={styles.name} accessibilityRole="header">{c.name}</Text>
        <View style={styles.idRow}>
          <Phone color={c.hasPhone ? colors.gold : colors.textTertiary} size={16} />
          <Text style={[styles.idText, !c.hasPhone && styles.muted]}>
            {c.hasPhone ? formatCustomerPhone(c.phone) : (c.rawInvalidPhone ? `Numéro invalide : ${c.rawInvalidPhone}` : 'Sans téléphone')}
          </Text>
        </View>
        {c.email ? (
          <View style={styles.idRow}>
            <Mail color={colors.textTertiary} size={16} />
            <Text style={styles.idText}>{c.email}</Text>
          </View>
        ) : null}
        <View style={styles.idRow}>
          <Store color={colors.textTertiary} size={16} />
          <Text style={styles.idText}>{c.stores.length ? c.stores.map(storeName).join(' · ') : '—'}</Text>
        </View>
        <View style={styles.pills}>
          {!c.hasPhone ? <Pill label="Sans téléphone" tone="neutral" /> : null}
          {c.hasOverdue ? <Pill label="En retard" tone="danger" /> : null}
          {c.hasOpenAdvance ? <Pill label={`${c.openAdvances.length} acompte${c.openAdvances.length > 1 ? 's' : ''} en cours`} tone="warning" /> : null}
          {c.settledAdvancesCount > 0 ? <Pill label={`${c.settledAdvancesCount} soldé${c.settledAdvancesCount > 1 ? 's' : ''}`} tone="success" /> : null}
        </View>
        <GoldButton
          label="Appeler"
          variant="outline"
          disabled={!c.hasPhone}
          icon={<Phone color={c.hasPhone ? colors.gold : colors.textTertiary} size={18} />}
          onPress={() => callCustomer(c.phone)}
          style={styles.callBtn}
        />
        {!c.hasPhone ? <Text style={styles.hint}>{NO_PHONE_HINT}</Text> : null}
      </GlassCard>

      <View style={styles.stats}>
        <Stat label="Achats" value={String(c.purchaseCount)} />
        <Stat label="Total dépensé" value={formatMoney(c.totalSpent)} sub="FCFA" />
        <Stat label="Panier moyen" value={formatMoney(c.avgBasket)} sub="FCFA" />
        <Stat label="Première visite" value={dayLabel(c.firstVisit)} />
        <Stat label="Dernière visite" value={dayLabel(c.lastVisit)} />
        <Stat label="Reste dû" value={formatMoney(c.remainingDue)} sub="FCFA" />
      </View>

      {c.openAdvances.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Acomptes en cours</Text>
          {c.openAdvances.map(a => (
            <AdvanceReminderCard key={a.id} advance={a} customerName={c.name} phone={c.phone} showStore={showStore} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Historique des achats ({c.purchases.length})
        </Text>
        {c.purchases.length === 0 ? (
          <Text style={styles.muted}>Aucun achat enregistré en caisse pour ce client.</Text>
        ) : (
          <View style={styles.purchaseList}>
            {shown.map(p => <PurchaseRow key={p.id} p={p} showStore={showStore} />)}
          </View>
        )}
        {hidden > 0 ? (
          <GoldButton
            label={`Afficher ${Math.min(PAGE, hidden)} achats de plus (${hidden} restants)`}
            variant="ghost"
            onPress={() => setLimit(l => l + PAGE)}
            style={styles.moreBtn}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  name: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.textPrimary, marginTop: 6, marginBottom: 8 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  idText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.textTertiary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  callBtn: { marginTop: space.md, alignSelf: 'flex-start', minWidth: 160 },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.warning, marginTop: 8, lineHeight: 17 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    padding: space.sm,
  },
  statLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textTertiary },
  statValue: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] },
  statSub: { fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary },
  section: { gap: space.sm },
  moreBtn: { alignSelf: 'center' },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.textPrimary },
  purchaseList: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  purchase: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  purchaseBody: { flex: 1, minWidth: 0, gap: 3 },
  purchaseDate: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold, letterSpacing: 0.3 },
  purchaseItems: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  purchaseRight: { alignItems: 'flex-end' },
  purchaseAmount: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  purchaseSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary },
  currency: { fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary },
});
