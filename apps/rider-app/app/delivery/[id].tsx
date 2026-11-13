import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { Card } from "../../src/components/Card";
import { CodeInput } from "../../src/components/CodeInput";
import {
  DELIVERY_CODE_LENGTH,
  DeliveryError,
  earningsPaise,
  formatPaise,
  type Action,
  type Delivery,
  type DeliveryStatus,
} from "../../src/lib/delivery";
import { REAL_BACKEND } from "../../src/lib/api";
import { useDeliveryAction, useRiderState } from "../../src/lib/queries";
import { useSession } from "../../src/store/session";
import { useSessionReady } from "../../src/store/useSessionReady";
import { colors, radius, space, TOUCH, typography, USE_NATIVE_DRIVER } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** The four things a rider does after accepting, in order. */
const STEPS: { status: DeliveryStatus; title: string; short: string }[] = [
  { status: "assigned", title: "Go to the store", short: "Store" },
  { status: "at_store", title: "Collect the order", short: "Collect" },
  { status: "picked_up", title: "Go to the customer", short: "Drop" },
  { status: "at_customer", title: "Hand over the order", short: "Hand over" },
];

const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** A deep link may open this before the saved session is read: wait, then send strangers to login. */
export default function DeliveryRoute() {
  const rider = useSession((s) => s.rider);
  const ready = useSessionReady();
  if (!ready) return null;
  if (!rider) return <Redirect href="/(auth)/login" />;
  return <DeliveryScreen />;
}

function DeliveryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useRiderState();
  const act = useDeliveryAction();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");
  const [handover, setHandover] = useState("");
  const [error, setError] = useState<{ message: string; field: "code" | "handover" | null } | null>(
    null,
  );

  const delivery: Delivery | null =
    state.data?.active?.id === id
      ? state.data.active
      : (state.data?.history.find((d) => d.id === id) ?? null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (!delivery) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        {state.isPending ? null : (
          <>
            <Ionicons name="file-tray-outline" size={56} color={colors.ink[300]} />
            <Text style={styles.centerTitle}>This delivery is no longer active</Text>
            <Text style={styles.centerText}>
              It may have been cancelled or given to another rider.
            </Text>
            <View style={styles.centerAction}>
              <BigButton label="Back to jobs" icon="arrow-back" onPress={goBack} />
            </View>
          </>
        )}
      </View>
    );
  }

  if (delivery.status === "delivered") {
    return <Delivered delivery={delivery} onDone={goBack} />;
  }

  const run = (action: Action, field: "code" | "handover" | null = null) => {
    setError(null);
    act.mutate(
      { deliveryId: delivery.id, action },
      {
        onSuccess: () =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
        onError: (e) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          const reason = e instanceof DeliveryError ? e.reason : null;
          const onField =
            reason === "WRONG_CODE" || reason === "CODE_LOCKED" || reason === "CODE_FORMAT";
          setError({
            message: e instanceof DeliveryError ? e.message : "Something went wrong. Try again.",
            field: onField ? field : null,
          });
          if (onField && field === "code") setCode("");
          if (onField && field === "handover") setHandover("");
        },
      },
    );
  };

  const stepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.status === delivery.status),
  );
  const step = STEPS[stepIndex] ?? STEPS[0]!;
  const toStore = delivery.status === "assigned" || delivery.status === "at_store";
  const place = toStore ? delivery.store : delivery.customer;
  const itemCount = delivery.items.length;
  const checkedCount = delivery.items.filter((i) => checked.has(i.id)).length;
  const itemsChecked = checkedCount === itemCount;
  const handoverReady = !REAL_BACKEND || handover.length === DELIVERY_CODE_LENGTH;

  const toggle = (itemId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const navigate = () =>
    void Linking.openURL(
      place.lat !== null && place.lng !== null
        ? mapsUrl(place.lat, place.lng)
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`,
    );

  const pickUp = () =>
    run(
      {
        type: "pick_up",
        checkedItemIds: [...checked],
        handoverCode: REAL_BACKEND ? handover : undefined,
      },
      "handover",
    );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityLabel="Back to jobs"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={26} color={colors.surface[0]} />
          </Pressable>
          <Text style={styles.orderNo} numberOfLines={1}>
            Order {delivery.orderNumber}
          </Text>
          <View style={styles.payChip}>
            <Text style={styles.payChipText}>{formatPaise(earningsPaise(delivery))}</Text>
          </View>
        </View>
        <Text style={styles.stepKicker}>
          STEP {stepIndex + 1} OF {STEPS.length}
        </Text>
        <Text style={styles.stepTitle} accessibilityRole="header">
          {step.title}
        </Text>
        <View
          style={styles.segments}
          accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}
        >
          {STEPS.map((s, i) => (
            <View key={s.status} style={styles.segmentWrap}>
              <View style={[styles.segment, i <= stepIndex && styles.segmentOn]} />
              <Text style={[styles.segmentLabel, i === stepIndex && styles.segmentLabelOn]}>
                {s.short}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* At the door the code is the only thing that matters, so it comes first */}
        {delivery.status === "at_customer" ? (
          <Card title="Customer's delivery code">
            <Text style={styles.help}>
              Ask the customer for the {DELIVERY_CODE_LENGTH} digit code in their app. Hand over the
              order only after it is accepted.
            </Text>
            <CodeInput
              value={code}
              onChange={(v) => {
                setError(null);
                setCode(v);
              }}
              length={DELIVERY_CODE_LENGTH}
              error={error?.field === "code" ? error.message : null}
              accessibilityLabel="Customer delivery code"
              autoFocus
              onComplete={(v) => run({ type: "deliver", code: v }, "code")}
            />
          </Card>
        ) : null}
        <Card>
          <View style={styles.placeRow}>
            <View
              style={[styles.placeIcon, toStore ? styles.placeIconStore : styles.placeIconHome]}
            >
              <Ionicons
                name={toStore ? "storefront" : "home"}
                size={22}
                color={toStore ? colors.ink[900] : colors.surface[0]}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.placeLabel}>{toStore ? "Pick up from" : "Deliver to"}</Text>
              <Text style={styles.placeName}>{place.name}</Text>
            </View>
          </View>
          {place.address !== place.name ? (
            <Text style={styles.address}>{place.address}</Text>
          ) : null}
          {!toStore && delivery.customer.instructions ? (
            <View style={styles.note}>
              <Ionicons name="chatbox-ellipses" size={18} color={colors.accent[900]} />
              <Text style={styles.noteText}>{delivery.customer.instructions}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <ActionChip icon="navigate" label="Navigate" onPress={navigate} />
            {!toStore ? (
              <ActionChip
                icon="call"
                label="Call customer"
                onPress={() => void Linking.openURL(`tel:${delivery.customer.phone}`)}
              />
            ) : null}
          </View>
        </Card>

        {delivery.codPaise &&
        (delivery.status === "picked_up" || delivery.status === "at_customer") ? (
          <View style={styles.cash} accessibilityRole="summary">
            <View style={styles.cashIcon}>
              <Ionicons name="cash" size={24} color={colors.ink[900]} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cashLabel}>Cash to collect at the door</Text>
              <Text style={styles.cashAmount}>{formatPaise(delivery.codPaise)}</Text>
            </View>
          </View>
        ) : null}

        <Card
          title={delivery.status === "at_store" ? "Check every item" : `Items (${itemCount})`}
          right={
            delivery.status === "at_store" ? (
              <Text style={[styles.counter, itemsChecked && styles.counterDone]}>
                {checkedCount} of {itemCount}
              </Text>
            ) : null
          }
        >
          {delivery.items.map((item) => {
            const interactive = delivery.status === "at_store";
            const done = interactive ? checked.has(item.id) : delivery.status !== "assigned";
            return (
              <Pressable
                key={item.id}
                disabled={!interactive}
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [
                  styles.item,
                  interactive && styles.itemInteractive,
                  interactive && done && styles.itemDone,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done, disabled: !interactive }}
                accessibilityLabel={`${item.quantity} times ${item.name}`}
              >
                {interactive ? (
                  <View style={[styles.check, done && styles.checkOn]}>
                    {done ? <Ionicons name="checkmark" size={20} color={colors.ink[900]} /> : null}
                  </View>
                ) : null}
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={styles.qty}>
                  <Text style={styles.qtyText}>×{item.quantity}</Text>
                </View>
              </Pressable>
            );
          })}
        </Card>

        {delivery.status === "at_store" && REAL_BACKEND ? (
          <Card title="Handover code">
            <Text style={styles.help}>
              Type the {DELIVERY_CODE_LENGTH} digit code shown on the store screen for this order.
            </Text>
            <CodeInput
              value={handover}
              onChange={(v) => {
                setError(null);
                setHandover(v);
              }}
              length={DELIVERY_CODE_LENGTH}
              error={error?.field === "handover" ? error.message : null}
              accessibilityLabel="Store handover code"
            />
          </Card>
        ) : null}

        {error && error.field === null ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>
        {delivery.status === "assigned" ? (
          <BigButton
            label="I have reached the store"
            icon="storefront"
            onPress={() => run({ type: "arrive_store" })}
            loading={act.isPending}
          />
        ) : delivery.status === "at_store" ? (
          <BigButton
            label="Picked up, start delivery"
            icon="bag-check"
            onPress={pickUp}
            disabled={!itemsChecked || !handoverReady}
            hint={
              !itemsChecked
                ? `Tick ${itemCount - checkedCount} more item${itemCount - checkedCount === 1 ? "" : "s"}`
                : !handoverReady
                  ? "Enter the handover code"
                  : undefined
            }
            loading={act.isPending}
          />
        ) : delivery.status === "picked_up" ? (
          <BigButton
            label="I have reached the customer"
            icon="home"
            onPress={() => run({ type: "arrive_customer" })}
            loading={act.isPending}
          />
        ) : (
          <BigButton
            label="Complete delivery"
            icon="checkmark-circle"
            onPress={() => run({ type: "deliver", code }, "code")}
            disabled={code.length !== DELIVERY_CODE_LENGTH}
            hint={code.length !== DELIVERY_CODE_LENGTH ? "Enter the customer's code" : undefined}
            loading={act.isPending}
          />
        )}
      </View>
    </View>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.brand[800]} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

/** The moment the rider finishes: a clear success, what they earned, and any cash to hand in. */
function Delivered({ delivery, onDone }: { delivery: Delivery; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.sequence([
      Animated.spring(pop, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        speed: 10,
        bounciness: 14,
      }),
      Animated.timing(rise, { toValue: 1, duration: 260, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [pop, rise]);

  const fadeUp = {
    opacity: rise,
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <View
      style={[
        styles.doneRoot,
        { paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[4] },
      ]}
    >
      <StatusBar style="dark" />
      <View style={styles.doneTop}>
        <Animated.View style={[styles.doneIcon, { transform: [{ scale: pop }] }]}>
          <Ionicons name="checkmark" size={64} color={colors.brand[700]} />
        </Animated.View>
        <Text style={styles.doneTitle}>Delivered!</Text>
        <Text style={styles.doneSub}>Order {delivery.orderNumber}</Text>
      </View>

      <Animated.View style={[styles.doneCard, fadeUp]}>
        <Text style={styles.doneEarnLabel}>You earned</Text>
        <Text style={styles.doneEarn}>{formatPaise(earningsPaise(delivery))}</Text>
        <View style={styles.breakdown}>
          <Line label="Delivery pay" value={formatPaise(delivery.payoutPaise)} />
          {delivery.tipPaise > 0 ? (
            <Line label="Customer tip" value={formatPaise(delivery.tipPaise)} />
          ) : null}
          <Line label="Distance" value={`${delivery.distanceKm} km`} />
        </View>
        {delivery.codPaise ? (
          <View style={styles.deposit}>
            <Ionicons name="cash" size={20} color={colors.accent[900]} />
            <Text style={styles.depositText}>
              Hand in {formatPaise(delivery.codPaise)} cash at the store.
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.flex} />
      <Animated.View style={fadeUp}>
        <BigButton
          label="Back to jobs"
          variant="dark"
          trailingIcon="arrow-forward"
          onPress={onDone}
        />
      </Animated.View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[100] },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  center: { alignItems: "center", justifyContent: "center", gap: space[3], padding: space[6] },
  centerTitle: {
    ...typography.titleLg,
    fontWeight: "800",
    color: colors.ink[900],
    textAlign: "center",
  },
  centerText: { ...typography.body, color: colors.ink[700], textAlign: "center" },
  centerAction: { alignSelf: "stretch", marginTop: space[4] },
  header: {
    backgroundColor: colors.night[900],
    paddingHorizontal: space[4],
    paddingBottom: space[4],
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[3] },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -space[2],
  },
  orderNo: { ...typography.bodyStrong, color: colors.ink[300], flex: 1 },
  payChip: {
    backgroundColor: colors.brand[600],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  payChipText: {
    ...typography.bodyStrong,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  stepKicker: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.brand[500],
    letterSpacing: 1,
  },
  stepTitle: {
    ...typography.display,
    color: colors.surface[0],
    marginTop: 2,
    marginBottom: space[4],
  },
  segments: { flexDirection: "row", gap: 6 },
  segmentWrap: { flex: 1, gap: 6 },
  segment: { height: 6, borderRadius: 3, backgroundColor: colors.night[700] },
  segmentOn: { backgroundColor: colors.brand[600] },
  segmentLabel: { ...typography.micro, fontSize: 11, color: colors.ink[300] },
  segmentLabelOn: { color: colors.surface[0], fontWeight: "800" },
  body: { padding: space[4], paddingBottom: space[8], gap: space[4] },
  placeRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  placeIconStore: { backgroundColor: colors.brand[600] },
  placeIconHome: { backgroundColor: colors.night[900] },
  placeLabel: { ...typography.caption, fontWeight: "700", color: colors.ink[500] },
  placeName: { ...typography.title, fontWeight: "800", color: colors.ink[900] },
  address: { ...typography.body, fontSize: 15, lineHeight: 22, color: colors.ink[700] },
  note: {
    flexDirection: "row",
    gap: space[2],
    backgroundColor: colors.accent[100],
    padding: space[3],
    borderRadius: radius.md,
  },
  noteText: { ...typography.bodyStrong, color: colors.accent[900], flex: 1 },
  row: { flexDirection: "row", gap: space[2] },
  chip: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    borderWidth: 1.5,
    borderColor: colors.brand[200],
  },
  chipText: { ...typography.bodyStrong, fontWeight: "800", color: colors.brand[800] },
  cash: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.accent[500],
    padding: space[4],
    borderRadius: radius.lg,
  },
  cashIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent[100],
    alignItems: "center",
    justifyContent: "center",
  },
  cashLabel: { ...typography.bodyStrong, fontWeight: "800", color: colors.ink[900] },
  cashAmount: { ...typography.display, color: colors.ink[900], fontVariant: ["tabular-nums"] },
  counter: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.ink[700],
    backgroundColor: colors.surface[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  counterDone: { backgroundColor: colors.brand[100], color: colors.brand[900] },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    minHeight: TOUCH,
    paddingHorizontal: space[2],
    borderRadius: radius.md,
  },
  itemInteractive: { borderWidth: 1.5, borderColor: colors.line[300], paddingHorizontal: space[3] },
  itemDone: { borderColor: colors.brand[600], backgroundColor: colors.brand[50] },
  check: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink[300],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface[0],
  },
  checkOn: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  itemEmoji: { fontSize: 26 },
  itemName: { ...typography.bodyStrong, fontSize: 15, color: colors.ink[900], flex: 1 },
  qty: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.night[900],
    alignItems: "center",
  },
  qtyText: {
    ...typography.subtitle,
    fontWeight: "800",
    color: colors.surface[0],
    fontVariant: ["tabular-nums"],
  },
  help: { ...typography.body, color: colors.ink[700] },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.dangerTint,
    padding: space[3],
    borderRadius: radius.md,
  },
  errorText: { ...typography.bodyStrong, color: colors.danger, flex: 1 },
  footer: {
    backgroundColor: colors.surface[0],
    paddingHorizontal: space[4],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.line[300],
  },
  doneRoot: { flex: 1, backgroundColor: colors.brand[600], paddingHorizontal: space[5] },
  doneTop: { alignItems: "center", gap: space[1] },
  doneIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[3],
  },
  doneTitle: { ...typography.hero, color: colors.ink[900] },
  doneSub: { ...typography.bodyStrong, color: colors.brand[900] },
  doneCard: {
    marginTop: space[6],
    backgroundColor: colors.surface[0],
    borderRadius: radius.xl,
    padding: space[5],
    alignItems: "center",
    gap: space[1],
  },
  doneEarnLabel: { ...typography.bodyStrong, color: colors.ink[500] },
  doneEarn: { ...typography.hero, color: colors.brand[700], fontVariant: ["tabular-nums"] },
  breakdown: {
    alignSelf: "stretch",
    gap: space[2],
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.line[300],
  },
  line: { flexDirection: "row", justifyContent: "space-between" },
  lineLabel: { ...typography.body, color: colors.ink[700] },
  lineValue: { ...typography.bodyStrong, color: colors.ink[900], fontVariant: ["tabular-nums"] },
  deposit: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.accent[100],
    padding: space[3],
    borderRadius: radius.md,
    marginTop: space[3],
  },
  depositText: { ...typography.bodyStrong, color: colors.accent[900], flex: 1 },
});
