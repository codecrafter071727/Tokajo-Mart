import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors, Radius, FontSize, FontWeight, Spacing } from "../theme";
import { AddButton } from "./AddButton";
import type { Product } from "../lib/mockData";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/product/${product.id}`)}>
      {product.discount ? (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{product.discount}% OFF</Text>
        </View>
      ) : null}

      <View style={styles.imageContainer}>
        <Text style={styles.productEmoji}>{product.image}</Text>
      </View>

      <View style={styles.deliveryPill}>
        <Text style={styles.deliveryPillText}>{product.deliveryMins ?? 10} MINS</Text>
      </View>

      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>

      {product.optionsCount && product.optionsCount > 1 ? (
        <Text style={styles.unit} numberOfLines={1}>
          {product.optionsCount} options
        </Text>
      ) : (
        <Text style={styles.unit} numberOfLines={1}>
          {product.unit}
        </Text>
      )}

      <View style={styles.priceBlock}>
        <Text style={styles.price}>₹{product.price}</Text>
        {product.mrp > product.price ? <Text style={styles.mrp}>₹{product.mrp}</Text> : null}
      </View>

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
          }}
          size="sm"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[8],
    paddingBottom: 40,
    overflow: "hidden",
  },
  discountBadge: {
    position: "absolute",
    top: 0,
    left: 8,
    backgroundColor: Colors.brandGreen,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    zIndex: 2,
  },
  discountText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.surface,
    letterSpacing: 0.2,
  },
  imageContainer: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[4],
  },
  productEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  deliveryPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: Spacing[4],
    marginBottom: Spacing[4],
  },
  deliveryPillText: {
    fontSize: 9,
    fontWeight: FontWeight.micro,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  productName: {
    fontSize: FontSize.productName,
    fontWeight: FontWeight.productName,
    color: Colors.textPrimary,
    lineHeight: 16,
    height: 32,
  },
  unit: {
    fontSize: 11,
    fontWeight: FontWeight.caption,
    color: Colors.textSecondary,
    marginTop: 2,
    height: 14,
  },
  priceBlock: {
    marginTop: Spacing[6],
    paddingRight: 4,
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
    marginTop: 1,
  },
  addSlot: {
    position: "absolute",
    right: 6,
    bottom: 6,
  },
});
