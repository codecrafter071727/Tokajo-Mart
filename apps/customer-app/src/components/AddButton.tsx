import React, { useCallback } from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Colors, Radius, Motion } from "../theme";
import { useCartStore, type CartState } from "../store/cart";

interface AddButtonProps {
  productId: string;
  productData: {
    id: string;
    name: string;
    unit: string;
    price: number;
    mrp: number;
    image: string;
  };
  size?: "sm" | "md";
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable as any);

export function AddButton({ productId, productData, size = "sm" }: AddButtonProps) {
  const quantity = useCartStore((s: CartState) => s.getQuantity(productId));
  const addItem = useCartStore((s: CartState) => s.addItem);
  const incrementItem = useCartStore((s: CartState) => s.incrementItem);
  const decrementItem = useCartStore((s: CartState) => s.decrementItem);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withTiming(0.92, { duration: Motion.fast }, () => {
      scale.value = withTiming(1, { duration: Motion.fast });
    });
    if (quantity === 0) {
      addItem(productData);
    }
  }, [quantity, addItem, productData, scale]);

  const btnH = size === "sm" ? 30 : 36;
  const btnW = size === "sm" ? 64 : 80;

  if (quantity === 0) {
    return (
      <AnimatedPressable
        style={[styles.addBtn, { height: btnH, width: btnW }, animatedStyle]}
        onPress={handlePress}
      >
        <Text style={styles.addText}>ADD</Text>
        <Text style={styles.plusText}>+</Text>
      </AnimatedPressable>
    );
  }

  return (
    <View style={[styles.stepper, { height: btnH, width: btnW }]}>
      <Pressable style={styles.stepBtn} onPress={() => decrementItem(productId)} hitSlop={8}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepCount}>{quantity}</Text>
      <Pressable style={styles.stepBtn} onPress={() => incrementItem(productId)} hitSlop={8}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  addText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.brandGreen,
    letterSpacing: 0.5,
  },
  plusText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.brandGreen,
    marginTop: -1,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
  },
  stepBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    minHeight: 28,
  },
  stepText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.surface,
    lineHeight: 22,
  },
  stepCount: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.surface,
    minWidth: 20,
    textAlign: "center",
  },
});
