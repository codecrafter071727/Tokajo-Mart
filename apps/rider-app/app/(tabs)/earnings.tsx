import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

  return (
    <View style={styles.root}>
      <FlatList
        data={history}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + space[4] }]}
        ListHeaderComponent={
          <View style={styles.summary}>
            <Text style={styles.label}>Today</Text>
            <Text style={styles.total}>{formatPaise(total)}</Text>
            <View style={styles.facts}>
              <Text style={styles.fact}>{history.length} deliveries</Text>
              <Text style={styles.fact}>{formatPaise(tips)} in tips</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={48} color={colors.line[300]} />
            <Text style={styles.emptyText}>No deliveries yet today.</Text>
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
        <Ionicons name="checkmark" size={18} color={colors.ink[900]} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>Order {delivery.orderNumber}</Text>
        <Text style={styles.rowSub}>
          {time(delivery.deliveredAt)} · {delivery.distanceKm} km
        </Text>
      </View>
      <Text style={styles.rowPay}>{formatPaise(earningsPaise(delivery))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[100] },
  list: { padding: space[4], gap: space[3] },
  summary: {
    backgroundColor: colors.brand[600],
    borderRadius: radius.xl,
    padding: space[5],
    marginBottom: space[2],
  },
  label: { ...typography.bodyStrong, color: colors.ink[900] },
  total: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  facts: { flexDirection: "row", gap: space[4] },
  fact: { ...typography.bodyStrong, color: colors.ink[900] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.surface[0],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line[300],
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
    ...typography.subtitle,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  empty: { alignItems: "center", gap: space[2], paddingTop: space[10] },
  emptyText: { ...typography.body, color: colors.ink[700] },
});
