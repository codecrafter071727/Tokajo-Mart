import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadow, Spacing, typography } from "../../src/theme";
import { colors } from "../../src/theme/tokens";
import { useCancelOrder, useNow, useOrder } from "../../src/lib/orderQueries";
import { etaMinutes, riderProgress, statusAt, type OrderStatus } from "../../src/lib/orders";
import { RouteProgress } from "../../src/components/RouteProgress";
import { ProductImage } from "../../src/components/ProductImage";
import { Skeleton } from "../../src/components/Skeleton";
import { formatPaise } from "../../src/lib/pricing";
import { PaymentPanel } from "../../src/components/payments/PaymentPanel";
import { DoorPhotoCard } from "../../src/components/tracking/DoorPhotoCard";
import { LiveTrackingCard } from "../../src/components/tracking/LiveTrackingCard";
import { ON_THE_WAY, useTracking } from "../../src/lib/tracking";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const STEPS: { key: OrderStatus; label: string; icon: IconName }[] = [
  { key: "confirmed", label: "Confirmed", icon: "checkmark" },
  { key: "picking", label: "Packing", icon: "bag-handle" },
  { key: "on_the_way", label: "On the way", icon: "bicycle" },
  { key: "delivered", label: "Delivered", icon: "home" },
];
const RANK: Record<OrderStatus, number> = {
  placed: 0,
  confirmed: 0,
  picking: 1,
  on_the_way: 2,
  delivered: 3,
  cancelled: -1,
};

/** Demo rider until the delivery service assigns a real one. Matches the rider app's demo login. */
const DEMO_RIDER = { name: "Ravi Kumar", rating: 4.8, phone: null as string | null };

function headline(
  status: OrderStatus,
  eta: number,
  riderName: string | undefined,
  serverStatus: string | undefined,
  online: boolean,
) {
  if (serverStatus === "pending_payment") {
    return { title: "Complete your payment", sub: "We start packing as soon as you pay" };
  }
  if (serverStatus === "expired" || serverStatus === "payment_failed") {
    return {
      title: "Payment time ran out",
      sub: "Nothing was charged. Please place the order again.",
    };
  }
  switch (status) {
    case "cancelled":
      return {
        title: "Order cancelled",
        sub: online
          ? "Any amount paid online is refunded in full"
          : "You have not been charged for this order",
      };
    case "delivered":
      return { title: "Order delivered", sub: "Thanks for shopping with us. Enjoy!" };
    case "on_the_way":
      return {
        title: `Arriving in ${eta} min`,
        sub: `${riderName ?? "Your delivery partner"} is on the way`,
      };
    case "picking":
      return { title: `Arriving in ${eta} min`, sub: "Your order is being packed" };
    default:
      return {
        title: `Arriving in ${eta} min`,
        sub: "Order confirmed, the store is getting it ready",
      };
  }
}

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const orderQuery = useOrder(id);
  const cancel = useCancelOrder();
  const now = useNow(1000);
  const order = orderQuery.data;
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Live rider position while the order is on its way; its ETA replaces the clock based guess
  const liveTracking = useTracking(
    order?.id,
    Boolean(order?.server && ON_THE_WAY.has(order.server.status)),
  );
  const live = liveTracking.data?.active ? liveTracking.data : null;

  useFocusEffect(
    React.useCallback(() => {
      // The hero is light (green or grey) with dark text, so the status bar stays dark
      setStatusBarStyle("dark");
    }, []),
  );

  // The confirm step quietly resets if it is not used
  useEffect(() => {
    if (!confirmCancel) return;
    const t = setTimeout(() => setConfirmCancel(false), 4000);
    return () => clearTimeout(t);
  }, [confirmCancel]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (!order) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={[colors.brand[600], colors.brand[500]]}
          style={[styles.hero, { paddingTop: insets.top + Spacing[4] }]}
        >
          <View style={styles.topRow}>
            <Pressable style={styles.iconBtn} onPress={back} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={Colors.onBrand} />
            </Pressable>
          </View>
          {orderQuery.isPending ? (
            <View style={{ gap: 8 }}>
              <Skeleton width={200} height={30} borderRadius={8} />
              <Skeleton width={240} height={16} borderRadius={6} />
            </View>
          ) : (
            <Text style={styles.heroTitle}>Order not found</Text>
          )}
        </LinearGradient>
      </View>
    );
  }

  const status = statusAt(order, now);
  const cancelled = status === "cancelled";
  const delivered = status === "delivered";
  const inFlight = !cancelled && !delivered;
  const eta = live?.etaMins ?? etaMinutes(order, now);
  const rider = order.server ? order.server.rider : DEMO_RIDER;
  const hasRider = (status === "on_the_way" || delivered) && rider;
  const serverStatus = order.server?.status;
  const online = order.payment === "online";
  const awaitingPayment = serverStatus === "pending_payment";
  const canCancel = order.server
    ? serverStatus === "confirmed" || serverStatus === "pending_payment"
    : status === "confirmed";
  const rank = RANK[status];
  const head = headline(status, eta, rider?.name, serverStatus, online);
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  const heroColors: [string, string] = cancelled
    ? [colors.line[300], colors.surface[100]]
    : [colors.brand[600], colors.brand[500]];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={heroColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing[4] }]}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.iconBtn} onPress={back} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={Colors.onBrand} />
          </Pressable>
          <Text style={styles.orderNo} numberOfLines={1}>
            Order #{order.server?.number ?? order.id.slice(0, 8).toUpperCase()}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <Text style={styles.heroTitle} accessibilityRole="header">
          {head.title}
        </Text>
        <Text style={styles.heroSub}>{head.sub}</Text>

        {!cancelled && !awaitingPayment ? (
          <View style={styles.steps} accessibilityLabel={`Step ${rank + 1} of ${STEPS.length}`}>
            {STEPS.map((step, i) => {
              const done = i <= rank;
              return (
                <View key={step.key} style={styles.step}>
                  <View style={[styles.stepBar, done && styles.stepBarDone]} />
                  <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing[32] }]}
        showsVerticalScrollIndicator={false}
      >
        <PaymentPanel order={order} now={now} autoStart={pay === "1"} />

        {inFlight && order.deliveryCode ? (
          <View style={styles.codeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeLabel}>Delivery code</Text>
              <Text style={styles.codeHint}>Share it with your delivery partner at the door</Text>
            </View>
            <View
              style={styles.codeDigits}
              accessible
              accessibilityLabel={`Delivery code ${order.deliveryCode.split("").join(" ")}`}
            >
              {order.deliveryCode.split("").map((d, i) => (
                <View key={i} style={styles.codeDigit}>
                  <Text style={styles.codeDigitText}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!cancelled && !awaitingPayment && !live ? (
          <RouteProgress
            progress={riderProgress(order, now)}
            title={
              delivered
                ? "Delivered to your door"
                : status === "on_the_way"
                  ? `About ${eta} min away`
                  : "Your rider will be assigned once it is packed"
            }
            subtitle={`${itemCount} item${itemCount !== 1 ? "s" : ""} from the store near you`}
          />
        ) : null}

        {order.server && serverStatus && ON_THE_WAY.has(serverStatus) ? (
          <LiveTrackingCard orderId={order.id} />
        ) : null}

        {order.server && delivered ? <DoorPhotoCard orderId={order.id} /> : null}

        {hasRider && rider ? (
          <View style={styles.card}>
            <View style={styles.riderRow}>
              <View style={styles.riderAvatar}>
                <Ionicons name="person" size={22} color={Colors.brandText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riderName}>{rider.name}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color={Colors.accent} />
                  <Text style={styles.riderMeta}>
                    {rider.rating} · {delivered ? "Delivered your order" : "Your delivery partner"}
                  </Text>
                </View>
              </View>
              {rider.phone && inFlight ? (
                <Pressable
                  style={styles.callBtn}
                  onPress={() => void Linking.openURL(`tel:${rider.phone}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${rider.name}`}
                >
                  <Ionicons name="call" size={18} color={Colors.brandText} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>
              {itemCount} item{itemCount !== 1 ? "s" : ""} in this order
            </Text>
          </View>
          {order.items.map((item) => (
            <View key={item.productId} style={styles.item}>
              <View style={styles.itemThumb}>
                <ProductImage
                  imageUrl={item.imageUrl}
                  emoji={item.emoji}
                  emojiSize={22}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.unit} · Qty {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                {formatPaise(item.unitPricePaise * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {cancelled
                ? "Order total"
                : online
                  ? awaitingPayment
                    ? "To pay online"
                    : "Paid online"
                  : delivered
                    ? "Paid on delivery"
                    : "To pay on delivery"}
            </Text>
            <Text style={styles.totalValue}>{formatPaise(order.totalPaise)}</Text>
          </View>
          {order.appliedCoupon && order.couponSavingsPaise > 0 && !cancelled ? (
            <Text style={styles.saved}>
              Coupon {order.appliedCoupon.code}: -{formatPaise(order.couponSavingsPaise)}
            </Text>
          ) : null}
          {order.savingsPaise + order.couponSavingsPaise > 0 && !cancelled ? (
            <Text style={styles.saved}>
              You saved {formatPaise(order.savingsPaise + order.couponSavingsPaise)}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.addrRow}>
            <View style={styles.addrIcon}>
              <Ionicons name="location" size={16} color={Colors.brandText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {cancelled ? "Address" : delivered ? "Delivered to" : "Delivering to"}{" "}
                {order.address.tag}
              </Text>
              <Text style={styles.addrText}>
                {[order.address.line1, order.address.line2].filter(Boolean).join(", ")}
              </Text>
            </View>
          </View>
        </View>

        {canCancel ? (
          <View style={styles.cancelWrap}>
            <Pressable
              style={[styles.cancelBtn, confirmCancel && styles.cancelBtnConfirm]}
              onPress={() => {
                if (!confirmCancel) return setConfirmCancel(true);
                setConfirmCancel(false);
                cancel.mutate(order.id);
              }}
              disabled={cancel.isPending}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelText, confirmCancel && styles.cancelTextConfirm]}>
                {cancel.isPending
                  ? "Cancelling"
                  : confirmCancel
                    ? "Tap again to cancel this order"
                    : "Cancel order"}
              </Text>
            </Pressable>
            <Text style={styles.cancelHint}>
              {online && !awaitingPayment
                ? "You can cancel until the store starts packing. Your payment is refunded in full."
                : "You can cancel until the store starts packing."}
            </Text>
            {cancel.isError ? (
              <Text style={styles.cancelError} accessibilityRole="alert">
                {cancel.error instanceof Error ? cancel.error.message : "Could not cancel."}
              </Text>
            ) : null}
          </View>
        ) : null}

        {delivered || cancelled ? (
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
            onPress={() => router.replace("/(tabs)")}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Continue shopping</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  hero: {
    paddingHorizontal: Spacing[16],
    paddingBottom: Spacing[20],
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing[8] },
  iconBtn: {
    width: 40,
    height: 40,
    marginLeft: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  orderNo: {
    flex: 1,
    textAlign: "center",
    ...typography.caption,
    fontWeight: "700",
    color: Colors.onBrandMuted,
  },
  heroTitle: { ...typography.display, fontWeight: "900", color: Colors.onBrand },
  heroSub: { ...typography.body, color: Colors.onBrandMuted, marginTop: 2 },
  steps: { flexDirection: "row", gap: 6, marginTop: Spacing[16] },
  step: { flex: 1, gap: 6 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: "rgba(20,32,30,0.15)" },
  stepBarDone: { backgroundColor: Colors.onBrand },
  stepLabel: { fontSize: 10, lineHeight: 12, fontWeight: "700", color: Colors.onBrandMuted },
  stepLabelDone: { color: Colors.onBrand },

  scroll: { flex: 1 },
  content: { padding: Spacing[12], gap: Spacing[12] },

  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[14],
    ...Shadow.card,
  },
  codeLabel: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  codeHint: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary, marginTop: 2 },
  codeDigits: { flexDirection: "row", gap: 4 },
  codeDigit: {
    width: 30,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.greenTint,
    borderWidth: 1,
    borderColor: colors.brand[200],
    alignItems: "center",
    justifyContent: "center",
  },
  codeDigitText: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.brandText,
    fontVariant: ["tabular-nums"],
  },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing[14] },
  cardHead: { marginBottom: Spacing[4] },
  cardTitle: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },

  riderRow: { flexDirection: "row", alignItems: "center", gap: Spacing[12] },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  riderName: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  riderMeta: { ...typography.caption, color: Colors.textSecondary },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.brand[200],
    backgroundColor: Colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingVertical: Spacing[8],
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#EDF1F0",
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  itemName: { ...typography.bodyStrong, fontSize: 13, color: Colors.textPrimary },
  itemMeta: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary, marginTop: 1 },
  itemPrice: {
    ...typography.bodyStrong,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing[8] },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { ...typography.bodyStrong, color: Colors.textSecondary },
  totalValue: {
    ...typography.subtitle,
    fontWeight: "900",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  saved: { ...typography.caption, fontWeight: "700", color: Colors.offerBlue, marginTop: 6 },

  addrRow: { flexDirection: "row", gap: Spacing[12] },
  addrIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  addrText: { ...typography.caption, fontWeight: "400", color: Colors.textSecondary, marginTop: 2 },

  cancelWrap: { alignItems: "center", gap: 6, marginTop: Spacing[4] },
  cancelBtn: {
    alignSelf: "stretch",
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnConfirm: { borderColor: Colors.danger, backgroundColor: "#FDF1F1" },
  cancelText: { ...typography.bodyStrong, fontWeight: "800", color: Colors.textSecondary },
  cancelTextConfirm: { color: Colors.danger },
  cancelHint: { ...typography.caption, fontWeight: "400", color: Colors.textTertiary },
  cancelError: { ...typography.caption, fontWeight: "700", color: Colors.danger },

  primary: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 16, fontWeight: "800", color: Colors.onBrand },
});
