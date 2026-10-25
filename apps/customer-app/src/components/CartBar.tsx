import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { Colors, Radius, Shadow, Spacing, FontSize, FontWeight, Motion } from "../theme";
import { useCartStore } from "../store/cart";

interface CartBarProps {
  /** Extra bottom offset (e.g. tab bar height) added on top of safe area inset */
  bottomOffset?: number;
}

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
  if (pathname?.includes("cart") || pathname?.includes("checkout")) return null;

  const bottomInset = insets.bottom + bottomOffset + Spacing[8];
  const AnimatedView = Animated.View as any;

  return (
    <AnimatedView
      style={[styles.container, { bottom: bottomInset }, animatedStyle]}
      pointerEvents="box-none"
    >
      <Pressable style={styles.bar} onPress={() => router.push("/(tabs)/cart")}>
        <View style={styles.left}>
          {/* Mini thumbnails */}
          <View style={styles.thumbnails}>
            {items.slice(0, 3).map((item, i) => (
              <View key={item.id} style={[styles.thumbnail, { left: i * 18 }]}>
                <Text style={styles.thumbnailEmoji}>{item.image}</Text>
              </View>
            ))}
          </View>
          <View style={styles.leftText}>
            <Text style={styles.itemCount}>
              {totalItems} item{totalItems !== 1 ? "s" : ""}
            </Text>
            <Text style={styles.totalPrice}>₹{totalPrice}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.viewCart}>View Cart</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
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
  },
  bar: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    ...Shadow.sticky,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
  },
  thumbnails: {
    width: 52,
    height: 32,
    position: "relative",
  },
  thumbnail: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: Radius.xs,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailEmoji: {
    fontSize: 16,
  },
  leftText: {
    marginLeft: 4,
  },
  itemCount: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.body,
    color: "rgba(255,255,255,0.85)",
  },
  totalPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.surface,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[4],
  },
  viewCart: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },
  chevron: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.surface,
  },
});
