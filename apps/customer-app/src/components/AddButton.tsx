import React, { useCallback } from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
    imageUrl?: string;
    imageFit?: "cover" | "contain";
  };
  size?: "sm" | "md";
  optionsCount?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable as any);

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function AddButton({ productId, productData, size = "sm", optionsCount }: AddButtonProps) {
  const quantity = useCartStore((s: CartState) => s.getQuantity(productId));
  const addItem = useCartStore((s: CartState) => s.addItem);
  const incrementItem = useCartStore((s: CartState) => s.incrementItem);
  const decrementItem = useCartStore((s: CartState) => s.decrementItem);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withTiming(0.94, { duration: Motion.fast }, () => {
      scale.value = withTiming(1, { duration: Motion.fast });
    });
    tap();
    if (quantity === 0) {
      addItem(productData);
    }
  }, [quantity, addItem, productData, scale]);

  const btnH = size === "sm" ? 32 : 42;
  const btnW = size === "sm" ? 64 : 104;
  const hasOptions = (optionsCount ?? 0) > 1 && quantity === 0;
  const iconSize = size === "sm" ? 16 : 20;

  if (quantity === 0) {
    return (
      <AnimatedPressable
        style={[styles.addBtn, { height: btnH, width: btnW }, animatedStyle]}
        onPress={handlePress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Add to cart"
      >
        <Text style={[styles.addText, size === "md" && styles.addTextMd]}>ADD</Text>
        {hasOptions ? null : <Ionicons name="add" size={iconSize} color={Colors.brandText} />}
      </AnimatedPressable>
    );
  }

  return (
    <View style={[styles.stepper, { height: btnH, width: btnW }]}>
      <Pressable
        style={styles.stepBtn}
        onPress={() => {
          tap();
          decrementItem(productId);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
      >
        <Ionicons name="remove" size={iconSize} color={Colors.surface} />
      </Pressable>
      <Text
        style={[styles.stepCount, size === "md" && styles.stepCountMd]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${quantity} in cart`}
      >
        {quantity}
      </Text>
      <Pressable
        style={styles.stepBtn}
        onPress={() => {
          tap();
          incrementItem(productId);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
      >
        <Ionicons name="add" size={iconSize} color={Colors.surface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    gap: 2,
    shadowColor: Colors.brandBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  addText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.brandText,
    letterSpacing: 0.5,
  },
  addTextMd: {
    fontSize: 15,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.sm,
    paddingHorizontal: 2,
    shadowColor: Colors.brandBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  stepBtn: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    height: "100%",
  },
  stepCount: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.surface,
    minWidth: 18,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  stepCountMd: {
    fontSize: 16,
  },
});
