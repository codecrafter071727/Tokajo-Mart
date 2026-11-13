import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatTile } from "../../src/components/StatTile";
import { earningsPaise, formatPaise, type Delivery } from "../../src/lib/delivery";
import { useRiderState } from "../../src/lib/queries";
import { colors, radius, space, typography } from "../../src/theme";

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const history = useRiderState().data?.history ?? [];
  const total = history.reduce((sum, d) => sum + earningsPaise(d), 0);
  const tips = history.reduce((sum, d) => sum + d.tipPaise, 0);
  const km = history.reduce((sum, d) => sum + d.distanceKm, 0);
  const average = history.length > 0 ? Math.round(total / history.length) : 0;

  return (
    <View style={styles.root}>
      <FlatList
        data={history}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + space[4] }]}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.pageTitle}>Earnings</Text>
            <View
              style={styles.hero}
              accessible
              accessibilityLabel={`Earned today ${formatPaise(total)}`}
            >
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>Earned today</Text>
                <View style={styles.heroIcon}>
                  <Ionicons name="wallet" size={20} color={colors.ink[900]} />
                </View>
              </View>
              <Text style={styles.heroTotal}>{formatPaise(total)}</Text>
              <Text style={styles.heroNote}>
                {history.length > 0
                  ? `${formatPaise(average)} on average per delivery`
                  : "Your first delivery of the day shows up here"}
              </Text>
            </View>
            <View style={styles.stats}>
              <StatTile value={String(history.length)} label="Deliveries" />
              <View style={styles.divider} />
              <StatTile value={formatPaise(tips)} label="Tips" grow={1.3} />
              <View style={styles.divider} />
              <StatTile value={`${Math.round(km * 10) / 10} km`} label="Ridden" grow={1.3} />
            </View>
            {history.length > 0 ? <Text style={styles.section}>Today's deliveries</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bicycle" size={36} color={colors.brand[700]} />
            </View>
            <Text style={styles.emptyTitle}>No deliveries yet today</Text>
            <Text style={styles.emptyText}>Go on duty from the Jobs tab to start earning.</Text>
          </View>
        }
        renderItem={({ item }) => <Row delivery={item} />}
      />
    </View>
  );
}

function Row({ delivery }: { delivery: Delivery }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name="checkmark" size={18} color={colors.brand[800]} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{delivery.orderNumber}</Text>
        <Text style={styles.rowSub}>
          {time(delivery.deliveredAt)} · {delivery.distanceKm} km
          {delivery.tipPaise > 0 ? ` · ${formatPaise(delivery.tipPaise)} tip` : ""}
        </Text>
      </View>
      <Text style={styles.rowPay}>{formatPaise(earningsPaise(delivery))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[100] },
  list: { padding: space[4], gap: space[2], flexGrow: 1 },
  headerWrap: { gap: space[3], marginBottom: space[1] },
  pageTitle: { ...typography.titleLg, fontWeight: "800", color: colors.ink[900] },
  hero: {
    backgroundColor: colors.brand[600],
    borderRadius: radius.xl,
    padding: space[5],
    gap: 2,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { ...typography.bodyStrong, fontWeight: "800", color: colors.brand[900] },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand[200],
    alignItems: "center",
    justifyContent: "center",
  },
  heroTotal: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  heroNote: { ...typography.bodyStrong, color: colors.brand[900] },
  stats: {
    flexDirection: "row",
    gap: space[3],
    backgroundColor: colors.surface[0],
    borderRadius: radius.lg,
    padding: space[4],
  },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.line[300] },
  section: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.ink[500],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: space[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.surface[0],
    padding: space[4],
    borderRadius: radius.lg,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand[100],
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.ink[900] },
  rowSub: { ...typography.caption, color: colors.ink[500] },
  rowPay: {
    ...typography.title,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  empty: { alignItems: "center", gap: space[2], paddingTop: space[8] },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[2],
  },
  emptyTitle: { ...typography.title, fontWeight: "800", color: colors.ink[900] },
  emptyText: { ...typography.body, color: colors.ink[700], textAlign: "center" },
});
