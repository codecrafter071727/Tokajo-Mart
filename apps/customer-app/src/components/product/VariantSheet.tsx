import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors, FontSize, Radius, Spacing } from "../../theme";
import { useCartStore, type CartState } from "../../store/cart";
import { useProduct } from "../../lib/queries";
import type { Product } from "../../lib/mockData";
import { AddButton } from "../AddButton";
import { ProductImage } from "../ProductImage";
import { Skeleton } from "../Skeleton";

const price = (rupees: number) =>
  Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;

/**
 * ADD on a card for an item that comes in several sizes, Blinkit style: it opens a sheet to pick
 * the size instead of adding one straight away. Shows how many of this size are already in the cart.
 */
export function VariantAddButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const quantity = useCartStore((s: CartState) => s.getQuantity(product.id));
  const options = product.optionsCount ?? 2;
  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setOpen(true);
        }}
        hitSlop={6}
        style={[styles.addBtn, quantity > 0 && styles.addBtnFilled]}
        accessibilityRole="button"
        accessibilityLabel={`Choose a size of ${product.name}, ${options} options`}
      >
        <Text style={[styles.addText, quantity > 0 && styles.addTextFilled]}>
          {quantity > 0 ? `${quantity} added` : "ADD"}
        </Text>
        <Text style={[styles.optionsText, quantity > 0 && styles.addTextFilled]}>
          {options} options
        </Text>
      </Pressable>
      {open ? <VariantSheet product={product} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VariantSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const detail = useProduct(product.id);
  const variants = detail.data?.variants ?? [];
  const title = detail.data?.groupName ?? product.name;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing[16] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}
          >
            <Ionicons name="close" size={18} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.list}>
          {detail.isPending
            ? Array.from({ length: 2 }, (_, i) => (
                <View key={i} style={styles.row}>
                  <Skeleton width={56} height={56} borderRadius={Radius.sm} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width={90} height={14} />
                    <Skeleton width={60} height={12} />
                  </View>
                </View>
              ))
            : null}
          {detail.isError ? (
            <Text style={styles.error}>Could not load the sizes. Close and try again.</Text>
          ) : null}
          {variants.map((v) => {
            const off = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
            return (
              <View key={v.id} style={styles.row}>
                <View style={styles.thumb}>
                  <ProductImage
                    imageUrl={v.imageUrl ?? product.imageUrl}
                    fit={product.imageFit}
                    emoji={product.image}
                    emojiSize={26}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{v.label}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{price(v.price)}</Text>
                    {v.mrp > v.price ? <Text style={styles.mrp}>{price(v.mrp)}</Text> : null}
                    {off >= 5 ? <Text style={styles.off}>{off}% OFF</Text> : null}
                  </View>
                </View>
                <AddButton
                  productId={v.id}
                  productData={{
                    id: v.id,
                    name: title,
                    unit: v.unit,
                    price: v.price,
                    mrp: v.mrp,
                    image: product.image,
                    imageUrl: v.imageUrl ?? product.imageUrl,
                    imageFit: product.imageFit,
                  }}
                  size="sm"
                />
              </View>
            );
          })}
        </ScrollView>
        <Pressable style={styles.done} onPress={onClose} accessibilityRole="button">
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  addBtnFilled: { backgroundColor: Colors.brandGreen },
  addText: { fontSize: 13, fontWeight: "800", color: Colors.brandText, letterSpacing: 0.5 },
  addTextFilled: { color: Colors.onBrand },
  optionsText: { fontSize: 9, fontWeight: "600", color: Colors.textSecondary, marginTop: -1 },
  scrim: { flex: 1, backgroundColor: "rgba(20,32,30,0.45)" },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing[16],
    paddingTop: Spacing[8],
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing[12],
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: Spacing[12] },
  title: { flex: 1, fontSize: FontSize.h2, fontWeight: "800", color: Colors.textPrimary },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingVertical: Spacing[12], gap: Spacing[12] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing[8],
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    overflow: "hidden",
    backgroundColor: "#F7F9F8",
  },
  label: { fontSize: FontSize.body, fontWeight: "700", color: Colors.textPrimary },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  price: { fontSize: FontSize.body, fontWeight: "800", color: Colors.textPrimary },
  mrp: { fontSize: 12, color: Colors.textTertiary, textDecorationLine: "line-through" },
  off: { fontSize: 11, fontWeight: "800", color: Colors.offerBlue },
  error: { fontSize: FontSize.caption, color: Colors.danger },
  done: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { fontSize: FontSize.body, fontWeight: "800", color: Colors.onBrand },
});
