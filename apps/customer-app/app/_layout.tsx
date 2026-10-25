import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="product/[id]"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="checkout/index"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="orders/[id]"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <Stack.Screen name="orders/list" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="search" options={{ headerShown: false, presentation: "card" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
