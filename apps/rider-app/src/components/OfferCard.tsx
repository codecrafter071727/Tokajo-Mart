import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { earningsPaise, formatPaise, type Delivery } from "../lib/delivery";
import { colors, radius, space, typography } from "../theme";
import { BigButton } from "./BigButton";

/** Seconds the rider has to respond before the offer goes to someone else. */
/** Matches the delivery service: an unanswered offer moves on to another rider after 25 seconds. */
export const OFFER_SECONDS = 25;

type Props = {
  delivery: Delivery;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function OfferCard({ delivery, busy, onAccept, onDecline }: Props) {
  const [left, setLeft] = useState(OFFER_SECONDS);

  useEffect(() => {
    setLeft(OFFER_SECONDS);
    const timer = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [delivery.id]);

  // An unanswered offer is declined for the rider
  useEffect(() => {
    if (left <= 0) onDecline();
  }, [left, onDecline]);

  return (
    <View
      style={styles.card}
      accessibilityLabel={`New order offer, ${formatPaise(earningsPaise(delivery))}`}
    >
      <View style={styles.top}>
        <Text style={styles.badge}>NEW ORDER</Text>
        <View style={styles.timer}>
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <Text style={styles.timerText}>{Math.max(left, 0)}s</Text>
        </View>
      </View>

      <Text style={styles.pay}>{formatPaise(earningsPaise(delivery))}</Text>
      <Text style={styles.payNote}>
        {delivery.tipPaise > 0
          ? `includes ${formatPaise(delivery.tipPaise)} tip`
          : "delivery payout"}
      </Text>

      <View style={styles.route}>
        <Stop icon="storefront" label="Pick up" value={delivery.store.name} />
        <View style={styles.line} />
        <Stop icon="home" label="Drop" value={delivery.customer.address} />
      </View>

      <View style={styles.facts}>
        <Fact icon="navigate" text={`${delivery.distanceKm} km`} />
        <Fact icon="time" text={`${delivery.etaMins} mins`} />
        <Fact icon="bag" text={`${delivery.items.reduce((n, i) => n + i.quantity, 0)} items`} />
        {delivery.codPaise ? (
          <Fact icon="cash" text={`Collect ${formatPaise(delivery.codPaise)}`} />
        ) : null}
      </View>

      <BigButton label="Accept order" icon="checkmark-circle" onPress={onAccept} loading={busy} />
      <BigButton label="Decline" variant="secondary" onPress={onDecline} disabled={busy} />
    </View>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function Stop({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.stop}>
      <Ionicons name={icon} size={20} color={colors.brand[700]} />
      <View style={styles.stopText}>
        <Text style={styles.stopLabel}>{label}</Text>
        <Text style={styles.stopValue}>{value}</Text>
      </View>
    </View>
  );
}

function Fact({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={colors.ink[700]} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface[0],
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.brand[600],
    padding: space[5],
    gap: space[3],
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    ...typography.micro,
    fontWeight: "800",
    color: colors.brand[900],
    backgroundColor: colors.brand[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  timer: { flexDirection: "row", alignItems: "center", gap: 4 },
  timerText: {
    ...typography.bodyStrong,
    fontWeight: "800",
    color: colors.warning,
    fontVariant: ["tabular-nums"],
  },
  pay: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  payNote: { ...typography.caption, color: colors.ink[500], marginTop: -space[2] },
  route: { gap: 2, marginTop: space[2] },
  stop: { flexDirection: "row", gap: space[3], alignItems: "flex-start" },
  stopText: { flex: 1 },
  stopLabel: { ...typography.caption, color: colors.ink[500] },
  stopValue: { ...typography.bodyStrong, color: colors.ink[900] },
  line: { width: 2, height: 14, backgroundColor: colors.line[300], marginLeft: 9 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  factText: { ...typography.caption, fontWeight: "700", color: colors.ink[700] },
});
