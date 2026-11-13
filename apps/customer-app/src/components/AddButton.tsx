import React, { useCallback, useState } from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors, Radius, Motion } from "../theme";
import { useCartStore, type CartState } from "../store/cart";
import { useStock } from "../lib/queries";

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
  /** sm for cards, md for lists, lg for the product page call to action */
  size?: "sm" | "md" | "lg";
  optionsCount?: number;
}

// The workspace has two copies of @types/react (18 for the web apps, 19 for mobile) and Reanimated's
// types resolve to the wrong one, so Pressable cannot be typed exactly. Remove this cast once the
// versions are unified.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedPressable = Animated.createAnimatedComponent(Pressable as any);

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function warn() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

export function AddButton({ productId, productData, size = "sm", optionsCount }: AddButtonProps) {
  const quantity = useCartStore((s: CartState) => s.getQuantity(productId));
  const addItem = useCartStore((s: CartState) => s.addItem);
  const incrementItem = useCartStore((s: CartState) => s.incrementItem);
  const decrementItem = useCartStore((s: CartState) => s.decrementItem);

  const stock = useStock(productId);
  const outOfStock = stock?.status === "out";
  const maxPerOrder = stock?.maxPerOrder ?? null;
  const atLimit = maxPerOrder !== null && quantity >= maxPerOrder;
  const [notified, setNotified] = useState(false);

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

  const btnH = size === "sm" ? 32 : size === "md" ? 42 : 48;
  const btnW = size === "sm" ? 64 : size === "md" ? 104 : 150;
  const hasOptions = (optionsCount ?? 0) > 1 && quantity === 0;
  const iconSize = size === "sm" ? 16 : 20;
  const big = size !== "sm";

  // Out of stock and not in the cart: no ADD, offer to be told when it is back
  if (outOfStock && quantity === 0) {
    return (
      <Pressable
        style={[styles.notifyBtn, { height: btnH, width: btnW }, notified && styles.notifyBtnDone]}
        onPress={() => {
          tap();
          setNotified(true);
        }}
        disabled={notified}
        accessibilityRole="button"
        accessibilityLabel={notified ? "You will be notified" : "Notify me when back in stock"}
      >
        <Text style={[styles.notifyText, big && styles.notifyTextMd]}>
          {notified ? "Noted" : size === "sm" ? "Notify" : "Notify me"}
        </Text>
      </Pressable>
    );
  }

  if (quantity === 0) {
    return (
      <AnimatedPressable
        style={[
          styles.addBtn,
          size === "lg" && styles.addBtnLg,
          { height: btnH, width: btnW },
          animatedStyle,
        ]}
        onPress={handlePress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Add to cart"
      >
        {size === "lg" ? (
          <Text style={styles.addTextLg}>Add to cart</Text>
        ) : (
          <>
            <Text style={[styles.addText, size === "md" && styles.addTextMd]}>ADD</Text>
            {hasOptions ? null : <Ionicons name="add" size={iconSize} color={Colors.brandText} />}
          </>
        )}
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
        style={[styles.stepCount, big && styles.stepCountMd]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${quantity} in cart`}
      >
        {quantity}
      </Text>
      <Pressable
        style={styles.stepBtn}
        onPress={() => {
          if (outOfStock || atLimit) {
            warn();
            return;
          }
          tap();
          incrementItem(productId);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={atLimit ? `Only ${maxPerOrder} per order` : "Increase quantity"}
        accessibilityState={{ disabled: outOfStock || atLimit }}
      >
        <Ionicons
          name="add"
          size={iconSize}
          color={Colors.surface}
          style={outOfStock || atLimit ? { opacity: 0.4 } : undefined}
        />
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
  addBtnLg: {
    backgroundColor: Colors.brandGreen,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.md,
  },
  addTextLg: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.surface,
  },
  notifyBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: Colors.textTertiary,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: 4,
  },
  notifyBtnDone: {
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  notifyText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textSecondary,
  },
  notifyTextMd: {
    fontSize: 13,
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
