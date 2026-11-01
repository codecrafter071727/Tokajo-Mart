import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radius, typography } from "../../src/theme";
import { colors } from "../../src/theme/tokens";
import { TAB_BAR_CONTENT, TAB_RESERVE } from "../../src/theme/tabs";
import { useCartStore } from "../../src/store/cart";
import { CartBar } from "../../src/components/CartBar";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  icon,
  iconActive,
  label,
  focused,
  badgeCount,
}: {
  icon: IconName;
  iconActive: IconName;
  label: string;
  focused: boolean;
  badgeCount?: number;
}) {
  return (
    <View style={styles.tabItem}>
      <View style={styles.iconWrapper}>
        <Ionicons
          name={focused ? iconActive : icon}
          size={24}
          color={focused ? colors.brand[700] : colors.ink[500]}
        />
        {badgeCount ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const totalItems = useCartStore((s) => s.totalItems());

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand[600],
          tabBarStyle: {
            position: "absolute",
            height: TAB_BAR_CONTENT + insets.bottom,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: "rgba(0,0,0,0.06)",
            backgroundColor: "transparent",
            elevation: 0,
            paddingTop: 4,
            paddingBottom: insets.bottom,
          },
          tabBarBackground: () => (
            <View style={StyleSheet.absoluteFill}>
              <BlurView
                intensity={Platform.OS === "android" ? 80 : 40}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.72)" }]}
              />
            </View>
          ),
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="home-outline" iconActive="home" label="Home" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: "Categories",
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="grid-outline" iconActive="grid" label="Categories" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Cart",
            tabBarIcon: ({ focused }) => (
              <TabIcon
                icon="cart-outline"
                iconActive="cart"
                label="Cart"
                focused={focused}
                badgeCount={totalItems}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            href: null,
          }}
        />
      </Tabs>

      <CartBar bottomOffset={TAB_RESERVE} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabItem: {
    alignItems: "center",
    gap: 2,
    paddingTop: 2,
    minWidth: 64,
  },
  iconWrapper: {
    position: "relative",
  },
  label: {
    ...typography.micro,
    color: Colors.textTertiary,
  },
  labelActive: {
    color: Colors.brandText,
    fontWeight: "800",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
  },
});
