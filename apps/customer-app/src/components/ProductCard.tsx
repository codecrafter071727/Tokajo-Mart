import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, typography } from "../theme";
import { AddButton } from "./AddButton";
import { ProductImage } from "./ProductImage";
import type { Product } from "../lib/mockData";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const showDiscount = (product.discount ?? 0) >= 5;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/product/${product.id}`)}
      accessibilityLabel={`${product.name}, ${product.unit}, ${product.price} rupees${
        showDiscount ? `, ${product.discount} percent off` : ""
      }`}
    >
      <View style={styles.imageWrap}>
        <View style={styles.imageBlock}>
          <ProductImage
            imageUrl={product.imageUrl}
            fit={product.imageFit}
            emoji={product.image}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {showDiscount ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{product.discount}% OFF</Text>
          </View>
        ) : null}

        <Pressable
          style={styles.heartBtn}
          hitSlop={8}
          onPress={() => setSaved((v) => !v)}
          accessibilityLabel={saved ? "Remove from favourites" : "Save to favourites"}
        >
          <Ionicons
            name={saved ? "heart" : "heart-outline"}
            size={15}
            color={saved ? Colors.danger : Colors.textSecondary}
          />
        </Pressable>

        <View style={styles.addSlot}>
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
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.etaRow}>
          <Ionicons name="time-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.etaText}>{product.deliveryMins ?? 9} mins</Text>
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unit} numberOfLines={1}>
          {product.optionsCount && product.optionsCount > 1
            ? `${product.optionsCount} options`
            : product.unit}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          {product.mrp > product.price ? <Text style={styles.mrp}>₹{product.mrp}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: 18,
  },
  imageBlock: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  discountBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: Colors.brandGreen,
    borderTopLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountText: {
    ...typography.micro,
    fontSize: 9,
    fontWeight: "800",
    color: Colors.brandBlack,
  },
  heartBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  addSlot: {
    position: "absolute",
    right: 6,
    bottom: -16,
    zIndex: 3,
  },
  body: {
    paddingTop: Spacing[4],
    gap: 1,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 2,
  },
  etaText: {
    ...typography.micro,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  productName: {
    ...typography.bodyStrong,
    fontSize: 12.5,
    lineHeight: 16,
    color: Colors.textPrimary,
    minHeight: 32,
  },
  unit: {
    ...typography.caption,
    color: Colors.textTertiary,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: 3,
  },
  price: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  mrp: {
    ...typography.priceStrike,
    fontSize: 11,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
});
