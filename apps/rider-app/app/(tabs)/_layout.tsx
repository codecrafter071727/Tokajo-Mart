import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { useSession } from "../../src/store/session";
import { colors } from "../../src/theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

const tab = (title: string, icon: Icon, iconActive: Icon) => ({
  title,
  tabBarIcon: ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons
      name={focused ? iconActive : icon}
      size={26}
      color={typeof color === "string" ? color : undefined}
    />
  ),
});

export default function TabsLayout() {
  const rider = useSession((s) => s.rider);
  if (!rider) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[700],
        tabBarInactiveTintColor: colors.ink[500],
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        tabBarStyle: { height: 64, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={tab("Jobs", "bicycle-outline", "bicycle")} />
      <Tabs.Screen name="earnings" options={tab("Earnings", "wallet-outline", "wallet")} />
      <Tabs.Screen name="profile" options={tab("Profile", "person-outline", "person")} />
    </Tabs>
  );
}
