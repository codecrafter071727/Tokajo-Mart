import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, typography } from "../theme";
import { AddButton } from "./AddButton";
import { ProductImage } from "./ProductImage";
import { VariantAddButton } from "./product/VariantSheet";
import { useStock } from "../lib/queries";
import type { Product } from "../lib/mockData";

interface ProductCardProps {
  product: Product;
}

/**
 * The one product tile used in rails, grids and search. Every part has a fixed slot, so prices
 * and ADD buttons line up across a row no matter how long a name is.
 */
export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const showDiscount = (product.discount ?? 0) >= 5;
  const stock = useStock(product.id);
  const outOfStock = stock?.status === "out";
  // Only shown when it is true: the service reports "low" with the real remaining count
  const lowStock = stock?.status === "low" && stock.remaining !== null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/product/${product.id}`)}
      accessibilityLabel={`${product.name}, ${product.unit}, ${product.price} rupees${
        showDiscount ? `, ${product.discount} percent off` : ""
      }${outOfStock ? ", out of stock" : ""}`}
    >
      <View style={styles.imageWrap}>
        <View style={[styles.imageBlock, outOfStock && styles.dimmed]}>
          <ProductImage
            imageUrl={product.imageUrl}
            fit={product.imageFit}
            emoji={product.image}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {showDiscount && !outOfStock ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{product.discount}%</Text>
            <Text style={styles.discountOff}>OFF</Text>
          </View>
        ) : null}

        {outOfStock ? (
          <View style={styles.stockBanner}>
            <Text style={styles.stockBannerText}>Out of stock</Text>
          </View>
        ) : lowStock ? (
          <View style={[styles.stockBanner, styles.lowBanner]}>
            <Text style={[styles.stockBannerText, styles.lowText]}>
              Only {stock?.remaining} left
            </Text>
          </View>
        ) : null}

        <Pressable
          style={styles.heartBtn}
          hitSlop={10}
          onPress={() => setSaved((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from favourites" : "Save to favourites"}
        >
          <Ionicons
            name={saved ? "heart" : "heart-outline"}
            size={14}
            color={saved ? Colors.danger : Colors.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.etaPill}>
          <Ionicons name="timer-outline" size={10} color={Colors.textSecondary} />
          <Text style={styles.etaText}>{product.deliveryMins ?? 9} MINS</Text>
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unit} numberOfLines={1}>
          {product.unit}
        </Text>
        <View style={styles.footer}>
          <View style={styles.priceCol}>
            <Text style={styles.price}>₹{product.price}</Text>
            {product.mrp > product.price ? <Text style={styles.mrp}>₹{product.mrp}</Text> : null}
          </View>
          {product.groupId && (product.optionsCount ?? 0) > 1 && !outOfStock ? (
            <VariantAddButton product={product} />
          ) : (
            <AddButton
              productId={product.id}
              productData={{
                id: product.id,
                name: product.name,
                unit: product.unit,
                price: product.price,
                mrp: product.mrp,
                image: product.image,
                imageUrl: product.imageUrl,
                imageFit: product.imageFit,
              }}
              size="sm"
              optionsCount={product.optionsCount}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#EDF1F0",
    padding: Spacing[8],
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radius.sm,
    overflow: "hidden",
    backgroundColor: "#F7F9F8",
  },
  imageBlock: { ...StyleSheet.absoluteFill },
  dimmed: { opacity: 0.4 },
  // Blinkit style ribbon in the top left corner
  discountBadge: {
    position: "absolute",
    top: 0,
    left: 6,
    width: 30,
    paddingTop: 3,
    paddingBottom: 5,
    backgroundColor: "#2F6FE4",
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: "center",
  },
  discountText: { fontSize: 10, lineHeight: 11, fontWeight: "900", color: Colors.surface },
  discountOff: { fontSize: 8, lineHeight: 9, fontWeight: "800", color: Colors.surface },
  stockBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 3,
    backgroundColor: "rgba(20,32,30,0.72)",
    alignItems: "center",
  },
  stockBannerText: { fontSize: 10, lineHeight: 12, fontWeight: "800", color: Colors.surface },
  lowBanner: { backgroundColor: "#FFF1E0" },
  lowText: { color: Colors.warning },
  heartBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingTop: Spacing[8] },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    backgroundColor: Colors.canvas,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 4,
  },
  etaText: { fontSize: 9, lineHeight: 11, fontWeight: "800", color: Colors.textSecondary },
  productName: {
    ...typography.bodyStrong,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.textPrimary,
    height: 34,
  },
  unit: {
    ...typography.caption,
    fontWeight: "400",
    color: Colors.textTertiary,
    marginTop: 2,
    height: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: Spacing[8],
    gap: 4,
    minHeight: 34,
  },
  priceCol: { flexShrink: 1 },
  price: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  mrp: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
});
