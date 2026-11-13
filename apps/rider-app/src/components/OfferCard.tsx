import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { earningsPaise, formatPaise, type Delivery } from "../lib/delivery";
import { colors, radius, space, typography, USE_NATIVE_DRIVER } from "../theme";
import { BigButton } from "./BigButton";
import { TextLink } from "./TextLink";

/** Matches the delivery service: an unanswered offer moves on to another rider after 25 seconds. */
export const OFFER_SECONDS = 25;
/** Below this the timer turns red */
const URGENT_SECONDS = 8;

type Props = {
  delivery: Delivery;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /**
   * False when the screen pins OfferActions in its footer instead, so Accept is always on screen
   * however small the phone.
   */
  showActions?: boolean;
};

/** Accept and skip, for a screen that pins them below the offer. */
export function OfferActions({
  busy,
  onAccept,
  onDecline,
}: Pick<Props, "busy" | "onAccept" | "onDecline">) {
  return (
    <View style={styles.actions}>
      <BigButton label="Accept order" icon="checkmark-circle" onPress={onAccept} loading={busy} />
      <TextLink label="Skip this order" tone="muted" onPress={onDecline} disabled={busy} />
    </View>
  );
}

export function OfferCard({ delivery, busy, onAccept, onDecline, showActions = true }: Props) {
  const [left, setLeft] = useState(OFFER_SECONDS);
  const progress = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setLeft(OFFER_SECONDS);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 14,
      bounciness: 8,
    }).start();
    progress.setValue(1);
    // The bar drains smoothly, so the time left reads at a glance
    const drain = Animated.timing(progress, {
      toValue: 0,
      duration: OFFER_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    drain.start();
    const timer = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => {
      clearInterval(timer);
      drain.stop();
    };
  }, [delivery.id, enter, progress]);

  // An unanswered offer is declined for the rider, exactly once
  const expired = useRef<string | null>(null);
  const declineRef = useRef(onDecline);
  declineRef.current = onDecline;
  useEffect(() => {
    if (left > 0 || expired.current === delivery.id) return;
    expired.current = delivery.id;
    declineRef.current();
  }, [left, delivery.id]);

  const urgent = left <= URGENT_SECONDS;
  const items = delivery.items.reduce((n, i) => n + i.quantity, 0);
  const pay = earningsPaise(delivery);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: enter,
          transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        },
      ]}
      accessibilityLabel={`New order. You earn ${formatPaise(pay)}. ${Math.max(left, 0)} seconds to accept.`}
    >
      <View style={styles.top}>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>NEW ORDER</Text>
        </View>
        <Text
          style={[styles.timerText, urgent && styles.timerUrgent]}
          accessibilityLiveRegion="polite"
        >
          {Math.max(left, 0)}s
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            urgent && styles.barUrgent,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
          ]}
        />
      </View>

      <View style={styles.payBlock}>
        <Text style={styles.payLabel}>You earn</Text>
        <Text style={styles.pay}>{formatPaise(pay)}</Text>
        {delivery.tipPaise > 0 ? (
          <View style={styles.tip}>
            <Ionicons name="heart" size={12} color={colors.brand[800]} />
            <Text style={styles.tipText}>includes {formatPaise(delivery.tipPaise)} tip</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.route}>
        <Stop kind="pickup" label="Pick up" value={delivery.store.name} />
        <View style={styles.leg}>
          <View style={styles.legLine} />
          <Text style={styles.legText}>
            {delivery.distanceKm} km · about {delivery.etaMins} min
          </Text>
        </View>
        <Stop kind="drop" label="Drop" value={delivery.customer.address} />
      </View>

      <View style={styles.facts}>
        <Fact icon="bag-handle" text={`${items} item${items === 1 ? "" : "s"}`} />
        {delivery.codPaise ? (
          <Fact icon="cash" text={`Collect ${formatPaise(delivery.codPaise)} cash`} strong />
        ) : (
          <Fact icon="card" text="Paid online" />
        )}
      </View>

      {showActions ? <OfferActions busy={busy} onAccept={onAccept} onDecline={onDecline} /> : null}
    </Animated.View>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function Stop({ kind, label, value }: { kind: "pickup" | "drop"; label: string; value: string }) {
  return (
    <View style={styles.stop}>
      <View style={[styles.pin, kind === "pickup" ? styles.pinPickup : styles.pinDrop]}>
        <Ionicons
          name={kind === "pickup" ? "storefront" : "location"}
          size={14}
          color={kind === "pickup" ? colors.ink[900] : colors.surface[0]}
        />
      </View>
      <View style={styles.stopText}>
        <Text style={styles.stopLabel}>{label}</Text>
        <Text style={styles.stopValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Fact({ icon, text, strong }: { icon: IconName; text: string; strong?: boolean }) {
  return (
    <View style={[styles.fact, strong && styles.factStrong]}>
      <Ionicons name={icon} size={16} color={strong ? colors.accent[900] : colors.ink[700]} />
      <Text style={[styles.factText, strong && styles.factTextStrong]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space[1] },
  card: {
    backgroundColor: colors.surface[0],
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[3],
    borderWidth: 2,
    borderColor: colors.brand[600],
    shadowColor: colors.brand[800],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[600] },
  badgeText: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.brand[900],
    letterSpacing: 0.6,
  },
  timerText: {
    ...typography.title,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  timerUrgent: { color: colors.danger },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface[100],
    overflow: "hidden",
  },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.brand[600] },
  barUrgent: { backgroundColor: colors.danger },
  payBlock: { alignItems: "center", paddingVertical: space[2] },
  payLabel: { ...typography.bodyStrong, color: colors.ink[500] },
  pay: {
    ...typography.hero,
    fontSize: 52,
    lineHeight: 60,
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  tipText: { ...typography.caption, fontWeight: "700", color: colors.brand[800] },
  route: {
    backgroundColor: colors.surface[100],
    borderRadius: radius.lg,
    padding: space[3],
  },
  stop: { flexDirection: "row", gap: space[3], alignItems: "center" },
  pin: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pinPickup: { backgroundColor: colors.brand[600] },
  pinDrop: { backgroundColor: colors.night[900] },
  stopText: { flex: 1 },
  stopLabel: { ...typography.caption, color: colors.ink[500] },
  stopValue: { ...typography.bodyStrong, fontSize: 15, color: colors.ink[900] },
  leg: { flexDirection: "row", alignItems: "center", gap: space[3], marginVertical: 2 },
  legLine: {
    width: 2,
    height: 22,
    marginLeft: 13,
    borderRadius: 1,
    backgroundColor: colors.ink[300],
  },
  legText: { ...typography.caption, fontWeight: "700", color: colors.ink[700] },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  factStrong: { backgroundColor: colors.accent[100] },
  factText: { ...typography.bodyStrong, fontWeight: "700", color: colors.ink[700] },
  factTextStrong: { color: colors.accent[900], fontWeight: "800" },
});
