import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, typography } from "../../theme";
import { formatPaise } from "../../lib/pricing";
import {
  canPay,
  formatCountdown,
  paymentPhase,
  paymentSecondsLeft,
  type PaymentPhase,
} from "../../lib/payments";
import { usePayOrder, usePaymentStatus } from "../../lib/paymentQueries";
import type { Order } from "../../lib/orders";
import { RazorpaySheet } from "./RazorpaySheet";

type Props = {
  order: Order;
  now: Date;
  /** Open the Razorpay sheet straight away (right after placing the order) */
  autoStart?: boolean;
};

/** The payment part of an online order: pay now with a countdown, paid, failed, expired or refund. */
export function PaymentPanel({ order, now, autoStart }: Props) {
  const online = order.payment === "online";
  const serverStatus = order.server?.status;
  const open = serverStatus === "pending_payment";
  const paymentQuery = usePaymentStatus(order.id, online, open || serverStatus === "cancelled");
  const phase = paymentPhase({ ...order, serverStatus }, paymentQuery.data, now);
  const pay = usePayOrder(order.id);
  const started = useRef(false);

  // Right after checkout the sheet opens by itself, once
  useEffect(() => {
    if (!autoStart || started.current || !canPay(phase)) return;
    started.current = true;
    pay.pay();
  }, [autoStart, phase, pay]);

  if (!online) return null;

  const seconds = paymentSecondsLeft(order.placedAt, now);
  const busy = pay.state.step === "starting" || pay.state.step === "verifying";
  const errorText =
    pay.state.step === "error"
      ? pay.state.message
      : phase === "failed"
        ? (paymentQuery.data?.errorDescription ?? "The last attempt did not go through.")
        : null;

  return (
    <>
      <RazorpaySheet
        checkout={pay.state.step === "open" ? pay.state.checkout : null}
        onResult={(result) => void pay.finish(result)}
      />
      <View style={[styles.card, canPay(phase) && styles.cardDue]}>
        <View style={styles.row}>
          <View style={[styles.icon, ICON_BG[phase]]}>
            <Ionicons name={ICON[phase]} size={18} color={ICON_COLOR[phase]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title(phase, pay.state.step)}</Text>
            <Text style={styles.sub}>{subtitle(phase, order, paymentQuery.data, seconds)}</Text>
          </View>
          {canPay(phase) ? (
            <View
              style={styles.timer}
              accessibilityLabel={`${formatCountdown(seconds)} left to pay`}
            >
              <Ionicons name="time-outline" size={12} color={Colors.warning} />
              <Text style={styles.timerText}>{formatCountdown(seconds)}</Text>
            </View>
          ) : null}
        </View>

        {errorText && canPay(phase) ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorText}
          </Text>
        ) : null}

        {canPay(phase) ? (
          <Pressable
            style={({ pressed }) => [styles.payBtn, (pressed || busy) && styles.payBtnPressed]}
            onPress={pay.pay}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Pay ${formatPaise(order.totalPaise)} now`}
          >
            {busy ? (
              <ActivityIndicator color={Colors.onBrand} />
            ) : (
              <Text style={styles.payText}>
                {phase === "failed" || pay.state.step === "error" ? "Try again" : "Pay"}{" "}
                {formatPaise(order.totalPaise)}
              </Text>
            )}
          </Pressable>
        ) : null}
        {canPay(phase) ? (
          <Text style={styles.note}>
            UPI, cards and netbanking through Razorpay. The store starts packing once you pay.
          </Text>
        ) : null}
      </View>
    </>
  );
}

function title(phase: PaymentPhase, step: string): string {
  if (step === "verifying") return "Confirming your payment";
  switch (phase) {
    case "awaiting":
      return "Payment pending";
    case "failed":
      return "Payment failed, try again";
    case "expired":
      return "Payment time ran out";
    case "not_charged":
      return "Not charged";
    case "paid":
      return "Paid online";
    case "refund_started":
      return "Refund started";
    case "refunded":
      return "Refunded";
    default:
      return "Cash on delivery";
  }
}

function subtitle(
  phase: PaymentPhase,
  order: Order,
  payment: { refundedPaise: number; method: string | null } | null | undefined,
  seconds: number,
): string {
  switch (phase) {
    case "awaiting":
    case "failed":
      return `Pay within ${Math.ceil(seconds / 60)} min to confirm your order`;
    case "expired":
      return "This order was not paid in time, so nothing was charged. Please order again.";
    case "not_charged":
      return "The order was cancelled before payment, so nothing was charged.";
    case "paid":
      return payment?.method
        ? `${formatPaise(order.totalPaise)} paid by ${methodName(payment.method)}`
        : `${formatPaise(order.totalPaise)} paid`;
    case "refund_started":
      return `Refund of ${formatPaise(payment?.refundedPaise || order.totalPaise)} started. It reaches your account in 5 to 7 working days.`;
    case "refunded":
      return `${formatPaise(payment?.refundedPaise ?? order.totalPaise)} refunded to your original payment method.`;
    default:
      return "";
  }
}

const methodName = (method: string) =>
  ({ upi: "UPI", card: "card", netbanking: "netbanking", wallet: "wallet" })[method] ?? method;

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const ICON: Record<PaymentPhase, IconName> = {
  not_charged: "close-circle-outline",
  cash: "cash-outline",
  awaiting: "card-outline",
  failed: "alert-circle",
  expired: "time-outline",
  paid: "checkmark-circle",
  refund_started: "return-down-back",
  refunded: "return-down-back",
};
const ICON_COLOR: Record<PaymentPhase, string> = {
  not_charged: Colors.textSecondary,
  cash: Colors.textSecondary,
  awaiting: Colors.warning,
  failed: Colors.danger,
  expired: Colors.textSecondary,
  paid: Colors.brandText,
  refund_started: Colors.offerBlue,
  refunded: Colors.offerBlue,
};
const ICON_BG: Record<PaymentPhase, { backgroundColor: string }> = {
  not_charged: { backgroundColor: Colors.canvas },
  cash: { backgroundColor: Colors.canvas },
  awaiting: { backgroundColor: Colors.yellowTint },
  failed: { backgroundColor: "#FDECEC" },
  expired: { backgroundColor: Colors.canvas },
  paid: { backgroundColor: Colors.brandTint },
  refund_started: { backgroundColor: "#EEF4FF" },
  refunded: { backgroundColor: "#EEF4FF" },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing[16],
    gap: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardDue: { borderColor: Colors.accent, backgroundColor: "#FFFBEF" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing[12] },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.bodyStrong, color: Colors.textPrimary },
  sub: { ...typography.caption, color: Colors.textSecondary, marginTop: 2 },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  timerText: {
    ...typography.caption,
    fontWeight: "800",
    color: Colors.warning,
    fontVariant: ["tabular-nums"],
  },
  error: { ...typography.caption, color: Colors.danger, fontWeight: "600" },
  payBtn: {
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtnPressed: { backgroundColor: Colors.brandFillPressed },
  payText: { ...typography.subtitle, fontWeight: "800", color: Colors.onBrand },
  note: { ...typography.micro, color: Colors.textTertiary, textAlign: "center" },
});
