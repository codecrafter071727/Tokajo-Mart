import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/queryClient";
import { useAuthHydrated, useAuthStore } from "../src/store/auth";
import { colors } from "../src/theme/tokens";

/**
 * Sends people where they belong: onboarding on first launch, login when signed out, the app when
 * signed in. Waits for the saved session to load so a signed in user never sees a login flash.
 */
function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const { isAuthenticated, hasSeenOnboarding } = useAuthStore();
  const hasHydrated = useAuthHydrated();

  useEffect(() => {
    if (!navigationReady || !hasHydrated) return;
    const first = segments[0] as string | undefined;
    const inAuth = first === "(auth)";
    const inOnboarding = first === "onboarding";

    if (!hasSeenOnboarding) {
      if (!inOnboarding) router.replace("/onboarding");
    } else if (!isAuthenticated) {
      if (!inAuth) router.replace("/(auth)/login");
    } else if (inAuth || inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [navigationReady, hasHydrated, hasSeenOnboarding, isAuthenticated, segments, router]);

  return hasHydrated;
}

export default function RootLayout() {
  const ready = useAuthGuard();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen
            name="product/[id]"
            options={{ headerShown: false, presentation: "card" }}
          />
          <Stack.Screen
            name="checkout/index"
            options={{ headerShown: false, presentation: "card" }}
          />
          <Stack.Screen name="orders/[id]" options={{ headerShown: false, presentation: "card" }} />
          <Stack.Screen name="orders/list" options={{ headerShown: false, presentation: "card" }} />
          <Stack.Screen name="account" options={{ headerShown: false, presentation: "card" }} />
          <Stack.Screen
            name="addresses/index"
            options={{ headerShown: false, presentation: "card" }}
          />
          <Stack.Screen
            name="addresses/edit"
            options={{ headerShown: false, presentation: "card" }}
          />
          <Stack.Screen name="search" options={{ headerShown: false, presentation: "card" }} />
          <Stack.Screen
            name="notifications"
            options={{ headerShown: false, presentation: "card" }}
          />
        </Stack>
        {/* Cover the screens until the saved session is read, so nothing flashes */}
        {!ready ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface[0] }]} />
        ) : null}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
