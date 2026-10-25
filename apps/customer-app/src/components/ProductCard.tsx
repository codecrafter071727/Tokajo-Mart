import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors, Radius, Shadow, FontSize, FontWeight, Spacing } from "../theme";
import { AddButton } from "./AddButton";
import type { Product } from "../lib/mockData";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/product/${product.id}`)}>
      {/* Discount badge */}
      {product.discount ? (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>
            {product.discount}%{"\n"}OFF
          </Text>
        </View>
      ) : null}

      {/* Delivery time pill */}
      <View style={styles.deliveryPill}>
        <Text style={styles.deliveryPillText}>🕐 {product.deliveryMins ?? 10} MINS</Text>
      </View>

      {/* Image area */}
      <View style={styles.imageContainer}>
        <Text style={styles.productEmoji}>{product.image}</Text>
      </View>

      {/* Product info */}
      <View style={styles.infoContainer}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unit} numberOfLines={1}>
          {product.unit}
        </Text>

        {/* Price row */}
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            <Text style={styles.price}>₹{product.price}</Text>
            {product.mrp > product.price ? <Text style={styles.mrp}>₹{product.mrp}</Text> : null}
          </View>
          <AddButton
            productId={product.id}
            productData={{
              id: product.id,
              name: product.name,
              unit: product.unit,
              price: product.price,
              mrp: product.mrp,
              image: product.image,
            }}
          />
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
    borderColor: Colors.border,
    ...Shadow.card,
    overflow: "visible",
    paddingBottom: Spacing[8],
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 3,
    zIndex: 10,
  },
  discountText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.surface,
    textAlign: "center",
    lineHeight: 11,
  },
  deliveryPill: {
    position: "absolute",
    top: 8,
    right: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: Colors.surface,
    zIndex: 10,
  },
  deliveryPillText: {
    fontSize: 8,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 100,
    paddingTop: Spacing[8],
  },
  productEmoji: {
    fontSize: 56,
  },
  infoContainer: {
    paddingHorizontal: Spacing[8],
    paddingTop: Spacing[4],
    gap: 2,
  },
  productName: {
    fontSize: FontSize.productName,
    fontWeight: FontWeight.productName,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  unit: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing[8],
  },
  priceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  price: {
    fontSize: FontSize.price,
    fontWeight: FontWeight.price,
    color: Colors.textPrimary,
  },
  mrp: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
});
