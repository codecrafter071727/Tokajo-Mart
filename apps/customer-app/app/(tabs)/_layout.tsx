import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Radius, FontSize } from "../../src/theme";
import { useCartStore } from "../../src/store/cart";
import { CartBar } from "../../src/components/CartBar";

const TAB_BAR_HEIGHT = 64;

function TabIcon({
  emoji,
  label,
  focused,
  badgeCount,
}: {
  emoji: string;
  label: string;
  focused: boolean;
  badgeCount?: number;
}) {
  return (
    <View style={styles.tabItem}>
      <View style={styles.iconWrapper}>
        <Text style={[styles.emoji, focused && styles.emojiActive]}>{emoji}</Text>
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
  const totalItems = useCartStore((s) => s.totalItems());

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="☰" label="Categories" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="🛒" label="Cart" focused={focused} badgeCount={totalItems} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Account" focused={focused} />,
          }}
        />
      </Tabs>

      {/* Single CartBar overlay above tab bar — never re-mounts across tabs */}
      <CartBar bottomOffset={TAB_BAR_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: TAB_BAR_HEIGHT,
    paddingBottom: 0,
    paddingTop: 4,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: "center",
    gap: 2,
    paddingTop: 4,
  },
  iconWrapper: {
    position: "relative",
  },
  emoji: {
    fontSize: 22,
    opacity: 0.5,
  },
  emojiActive: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textTertiary,
  },
  labelActive: {
    color: Colors.brandGreen,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
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
