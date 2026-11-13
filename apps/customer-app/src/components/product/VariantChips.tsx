import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors, FontSize, Radius, Spacing } from "../../theme";
import type { ProductVariant } from "../../lib/mockData";

/** Rupees for a chip: whole numbers stay whole, otherwise two decimals. */
const price = (rupees: number) =>
  Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;

/**
 * Sizes of the same item, Blinkit style: one chip per size with its price, the current one
 * highlighted. Choosing one switches the page to that product (its own price, stock and photos).
 */
export function VariantChips({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (variants.length < 2) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Select unit</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        {variants.map((v) => {
          const active = v.id === selectedId;
          const off = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
          return (
            <Pressable
              key={v.id}
              onPress={() => !active && onSelect(v.id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${v.label}, ${price(v.price)}`}
            >
              {off >= 5 ? (
                <View style={styles.offTag}>
                  <Text style={styles.offTagText}>{off}% OFF</Text>
                </View>
              ) : null}
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {v.label}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{price(v.price)}</Text>
                {v.mrp > v.price ? <Text style={styles.mrp}>{price(v.mrp)}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing[4], marginBottom: Spacing[12] },
  heading: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: Spacing[8],
  },
  row: { gap: Spacing[8], paddingRight: Spacing[8] },
  chip: {
    minWidth: 88,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[12],
    paddingTop: Spacing[12],
    paddingBottom: Spacing[8],
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  chipActive: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.greenTint,
  },
  offTag: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.offerBlue,
    paddingVertical: 1,
    alignItems: "center",
  },
  offTagText: { fontSize: 9, fontWeight: "800", color: Colors.surface, letterSpacing: 0.3 },
  label: {
    marginTop: 4,
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  labelActive: { color: Colors.textPrimary },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 },
  price: { fontSize: FontSize.caption, fontWeight: "800", color: Colors.textPrimary },
  mrp: {
    fontSize: 11,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
});
