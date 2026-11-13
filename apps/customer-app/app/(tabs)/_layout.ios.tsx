import { View, StyleSheet } from "react-native";
import { NativeTabs } from "expo-router/native-tabs";
import { colors } from "../../src/theme/tokens";
import { TAB_RESERVE } from "../../src/theme/tabs";
import { useCartStore } from "../../src/store/cart";
import { CartBar } from "../../src/components/CartBar";

export default function TabsLayout() {
  const totalItems = useCartStore((s) => s.totalItems());
  const cartBadge = totalItems > 0 ? (totalItems > 9 ? "9+" : String(totalItems)) : null;

  return (
    <View style={styles.root}>
      <NativeTabs
        tintColor={colors.brand[700]}
        minimizeBehavior="onScrollDown"
        labelStyle={{
          fontSize: 10,
          fontWeight: "600",
        }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon
            sf={{ default: "house" as never, selected: "house.fill" as never }}
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="categories">
          <NativeTabs.Trigger.Icon
            sf={{
              default: "square.grid.2x2" as never,
              selected: "square.grid.2x2.fill" as never,
            }}
          />
          <NativeTabs.Trigger.Label>Categories</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="cart">
          <NativeTabs.Trigger.Icon
            sf={{ default: "cart" as never, selected: "cart.fill" as never }}
          />
          <NativeTabs.Trigger.Label>Cart</NativeTabs.Trigger.Label>
          {cartBadge ? <NativeTabs.Trigger.Badge>{cartBadge}</NativeTabs.Trigger.Badge> : null}
        </NativeTabs.Trigger>
      </NativeTabs>

      <CartBar bottomOffset={TAB_RESERVE} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
