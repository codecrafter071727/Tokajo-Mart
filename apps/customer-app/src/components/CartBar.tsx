import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAnimatedStyle, useSharedValue, withTiming, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedView } from "./AnimatedView";
import { Colors, Radius, Shadow, Spacing, typography, Motion } from "../theme";
import { colors } from "../theme/tokens";
import { useCartStore } from "../store/cart";
import { formatPaise } from "../lib/pricing";
import { ProductImage } from "./ProductImage";

interface CartBarProps {
  /** Extra bottom offset (e.g. tab bar content height) above the safe area */
  bottomOffset?: number;
}

const FREE_DELIVERY_MIN = 99;

export function CartBar({ bottomOffset = 0 }: CartBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.totalItems());
  const totalPrice = useCartStore((s) => s.totalPrice());

  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (items.length > 0) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: Motion.base });
    } else {
      translateY.value = withTiming(100, { duration: Motion.base });
      opacity.value = withTiming(0, { duration: Motion.fast });
    }
  }, [items.length, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (items.length === 0) return null;
  if (
    pathname?.includes("cart") ||
    pathname?.includes("checkout") ||
    pathname?.includes("orders")
  ) {
    return null;
  }

  const remaining = Math.max(0, FREE_DELIVERY_MIN - totalPrice);
  const progress = Math.min(1, totalPrice / FREE_DELIVERY_MIN);
  const bottomInset = insets.bottom + bottomOffset + Spacing[8];
  const previews = items.slice(-3).reverse();

  return (
    <AnimatedView
      style={[styles.container, { bottom: bottomInset }, animatedStyle]}
      pointerEvents="box-none"
    >
      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Ionicons
            name={remaining > 0 ? "bicycle" : "checkmark-circle"}
            size={14}
            color={Colors.brandPressed}
          />
          <Text style={styles.progressText}>
            {remaining > 0
              ? `Add ${formatPaise(remaining * 100)} more for free delivery`
              : "You've unlocked free delivery"}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <Pressable
        onPress={() => router.push("/(tabs)/cart")}
        accessibilityRole="button"
        accessibilityLabel={`${totalItems} items, ${totalPrice} rupees. View cart`}
      >
        <LinearGradient
          colors={[colors.brand[600], colors.brand[500]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bar}
        >
          <View style={styles.left}>
            <View style={styles.thumbs}>
              {previews.map((it, i) => (
                <View
                  key={it.id}
                  style={[styles.thumb, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}
                >
                  <ProductImage
                    imageUrl={it.imageUrl}
                    fit={it.imageFit}
                    emoji={it.image}
                    emojiSize={16}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              ))}
            </View>
            <View>
              <Text style={styles.summaryTop}>
                {totalItems} item{totalItems !== 1 ? "s" : ""}
              </Text>
              <Text style={styles.summaryBottom}>₹{totalPrice}</Text>
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.viewCart}>View cart</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.onBrand} />
          </View>
        </LinearGradient>
      </Pressable>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: Spacing[12],
    zIndex: 999,
    elevation: 999,
    gap: 6,
  },
  progressWrap: {
    backgroundColor: Colors.brandTint,
    borderRadius: Radius.lg,
    overflow: "hidden",
    paddingTop: 7,
    gap: 6,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.brand[200],
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.brandGreen,
  },
  progressText: {
    ...typography.caption,
    fontWeight: "700",
    color: Colors.brandPressed,
  },
  bar: {
    borderRadius: Radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: Spacing[8],
    paddingRight: Spacing[16],
    paddingVertical: Spacing[8],
    ...Shadow.sticky,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
  },
  thumbs: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.brandGreen,
    overflow: "hidden",
  },
  thumbEmoji: {
    fontSize: 18,
  },
  summaryTop: {
    ...typography.caption,
    color: Colors.onBrandMuted,
  },
  summaryBottom: {
    ...typography.subtitle,
    fontWeight: "800",
    color: Colors.onBrand,
    fontVariant: ["tabular-nums"],
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewCart: {
    ...typography.subtitle,
    fontWeight: "800",
    color: Colors.onBrand,
  },
});
