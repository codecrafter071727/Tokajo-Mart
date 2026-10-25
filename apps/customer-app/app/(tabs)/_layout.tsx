import { Tabs, useRouter } from "expo-router";
import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadow } from "../../src/theme";
import { useCartStore } from "../../src/store/cart";
import { CartBar } from "../../src/components/CartBar";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const hasItems = useCartStore((s) => s.items.length > 0);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="categories" options={{ href: null }} />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen name="account" options={{ href: null }} />
      </Tabs>

      <Pressable
        style={[styles.homeBtn, { bottom: insets.bottom + (hasItems ? 84 : 14) }]}
        onPress={() => router.push("/(tabs)")}
        accessibilityLabel="Home"
      >
        <View style={styles.roof} />
        <View style={styles.house}>
          <View style={styles.door} />
        </View>
      </Pressable>

      <CartBar bottomOffset={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  homeBtn: {
    position: "absolute",
    left: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandYellow,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    ...Shadow.sticky,
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: Colors.surface,
  },
  house: {
    width: 16,
    height: 11,
    backgroundColor: Colors.surface,
    alignItems: "center",
    marginTop: -1,
  },
  door: {
    width: 5,
    height: 6,
    marginTop: 5,
    backgroundColor: Colors.brandYellow,
  },
});
