import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CouponOffer, PriceBreakdown, PriceLine } from "@qc/contracts";
import { Colors, Radius, Spacing, typography } from "../theme";
import { couponsApi, offerLine, savingOn, toApplied, useCouponOffers } from "../lib/coupons";
import { formatPaise } from "../lib/pricing";
import { backendEnabled, HttpError } from "../lib/session";
import { useCouponStore } from "../store/coupon";

type Props = {
  /** The cart, priced without the coupon, for showing what each offer would save */
  lines: PriceLine[];
  /** Product ids and quantities, sent when checking a typed code */
  items: { productId: string; quantity: number }[];
  tipPaise: number;
  /** The bill with the applied coupon, to show its saving or what is still missing */
  bill: PriceBreakdown;
};

/**
 * Apply a code or pick an offer. Offers show what they would save on this cart, and the ones that
 * cannot be used say why. The server checks the code again when the order is placed.
 */
export function CouponSection({ lines, items, tipPaise, bill }: Props) {
  const applied = useCouponStore((s) => s.applied);
  const apply = useCouponStore((s) => s.apply);
  const remove = useCouponStore((s) => s.remove);
  const offers = useCouponOffers(backendEnabled).data ?? [];
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!backendEnabled) return null;

  const tryCode = async (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    setChecking(true);
    setError(null);
    try {
      const res = await couponsApi.validate(value, items, tipPaise);
      if (res.valid && res.coupon) {
        apply(toApplied(res.coupon));
        setCode("");
        setOpen(false);
      } else {
        setError(res.reason ?? "This code cannot be used.");
      }
    } catch (e) {
      setError(e instanceof HttpError ? e.message : "Could not check the code. Try again.");
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    const short = bill.couponShortfallPaise > 0;
    return (
      <View style={[styles.card, short ? styles.cardWarn : styles.cardOk]}>
        <View style={[styles.iconTile, short ? styles.iconWarn : styles.iconOk]}>
          <Ionicons
            name={short ? "alert-circle-outline" : "pricetag"}
            size={18}
            color={short ? Colors.warning : Colors.brandText}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.appliedTitle}>
            {short ? `${applied.code} not applied yet` : `${applied.code} applied`}
          </Text>
          <Text style={[styles.appliedSub, short && styles.warnText]}>
            {short
              ? `Add ${formatPaise(bill.couponShortfallPaise)} more to use it`
              : bill.couponSavingsPaise > 0
                ? `You save ${formatPaise(bill.couponSavingsPaise)} with this code`
                : applied.title}
          </Text>
        </View>
        <Pressable
          onPress={remove}
          hitSlop={8}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel={`Remove coupon ${applied.code}`}
        >
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
    );
  }

  const best = offers
    .filter((o) => o.eligible)
    .map((o) => ({ offer: o, saving: savingOn(lines, tipPaise, o) }))
    .sort((a, b) => b.saving - a.saving)[0];

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.headerRow}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={[styles.iconTile, styles.iconOk]}>
          <Ionicons name="pricetags-outline" size={18} color={Colors.brandText} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>Apply coupon</Text>
          {best && best.saving > 0 ? (
            <Text style={styles.headerHint}>
              Save {formatPaise(best.saving)} with {best.offer.code}
            </Text>
          ) : (
            <Text style={styles.headerSub}>
              {offers.length > 0 ? `${offers.length} offers for you` : "Have a code? Enter it here"}
            </Text>
          )}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-forward"}
          size={18}
          color={Colors.textTertiary}
        />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                setError(null);
              }}
              placeholder="Enter coupon code"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => void tryCode(code)}
              accessibilityLabel="Coupon code"
            />
            <Pressable
              onPress={() => void tryCode(code)}
              disabled={!code || checking}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Apply code"
            >
              {checking ? (
                <ActivityIndicator size="small" color={Colors.brandText} />
              ) : (
                <Text style={[styles.applyText, !code && styles.applyDisabled]}>APPLY</Text>
              )}
            </Pressable>
          </View>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          {offers.map((offer) => (
            <OfferRow
              key={offer.code}
              offer={offer}
              saving={savingOn(lines, tipPaise, offer)}
              busy={checking}
              onApply={() => void tryCode(offer.code)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OfferRow({
  offer,
  saving,
  busy,
  onApply,
}: {
  offer: CouponOffer;
  saving: number;
  busy: boolean;
  onApply: () => void;
}) {
  const usable = offer.eligible;
  return (
    <View style={[styles.offer, !usable && styles.offerOff]}>
      <View style={styles.flex}>
        <View style={styles.codeChip}>
          <Text style={styles.codeText}>{offer.code}</Text>
        </View>
        <Text style={styles.offerTitle}>{offer.title}</Text>
        <Text style={styles.offerLine}>{offerLine(offer)}</Text>
        {usable ? (
          saving > 0 ? (
            <Text style={styles.offerSave}>Save {formatPaise(saving)} on this order</Text>
          ) : null
        ) : (
          <Text style={styles.offerReason}>{offer.reason}</Text>
        )}
      </View>
      {usable ? (
        <Pressable
          onPress={onApply}
          disabled={busy}
          style={styles.offerBtn}
          accessibilityRole="button"
          accessibilityLabel={`Apply ${offer.code}`}
        >
          <Text style={styles.offerBtnText}>APPLY</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing[12],
    marginBottom: Spacing[12],
    padding: Spacing[12],
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    flexWrap: "wrap",
  },
  cardOk: { borderWidth: 1, borderColor: Colors.brandTint, backgroundColor: Colors.greenTint },
  cardWarn: { borderWidth: 1, borderColor: Colors.yellowTint, backgroundColor: "#FFFBEB" },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing[12], width: "100%" },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOk: { backgroundColor: Colors.brandTint },
  iconWarn: { backgroundColor: Colors.yellowTint },
  headerTitle: { ...typography.bodyStrong, color: Colors.textPrimary },
  headerSub: { ...typography.caption, color: Colors.textTertiary, marginTop: 1 },
  headerHint: { ...typography.caption, color: Colors.brandText, fontWeight: "700", marginTop: 1 },
  appliedTitle: { ...typography.bodyStrong, color: Colors.textPrimary },
  appliedSub: { ...typography.caption, color: Colors.brandText, fontWeight: "700", marginTop: 1 },
  warnText: { color: Colors.warning },
  removeBtn: { paddingVertical: 6, paddingHorizontal: 4, minHeight: 32, justifyContent: "center" },
  removeText: { ...typography.caption, color: Colors.danger, fontWeight: "800" },
  body: { width: "100%", gap: Spacing[8] },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[12],
    minHeight: 46,
    gap: Spacing[8],
  },
  inputRowError: { borderColor: Colors.danger },
  input: {
    flex: 1,
    ...typography.bodyStrong,
    color: Colors.textPrimary,
    letterSpacing: 1,
    paddingVertical: 10,
  },
  applyText: { ...typography.bodyStrong, color: Colors.brandText, fontWeight: "800" },
  applyDisabled: { color: Colors.textTertiary },
  error: { ...typography.caption, color: Colors.danger },
  offer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    borderRadius: Radius.md,
    padding: Spacing[12],
  },
  offerOff: { opacity: 0.6 },
  codeChip: {
    alignSelf: "flex-start",
    backgroundColor: Colors.canvas,
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  codeText: { ...typography.micro, fontWeight: "800", color: Colors.textPrimary, letterSpacing: 1 },
  offerTitle: { ...typography.bodyStrong, color: Colors.textPrimary },
  offerLine: { ...typography.caption, color: Colors.textSecondary, marginTop: 1 },
  offerSave: { ...typography.caption, color: Colors.brandText, fontWeight: "700", marginTop: 2 },
  offerReason: { ...typography.caption, color: Colors.textTertiary, marginTop: 2 },
  offerBtn: {
    borderWidth: 1.25,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: "center",
  },
  offerBtnText: { ...typography.caption, color: Colors.brandText, fontWeight: "800" },
});
