import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { Card } from "../../src/components/Card";
import { OfferCard } from "../../src/components/OfferCard";
import type { DeliveryStatus } from "../../src/lib/delivery";
import { useDecline, useDeliveryAction, useRiderState, useSetOnline } from "../../src/lib/queries";
import { useSession } from "../../src/store/session";
import { colors, space, typography } from "../../src/theme";

const NEXT_LABEL: Record<DeliveryStatus, string> = {
  offered: "Accept the order",
  assigned: "Head to the store",
  at_store: "Collect the items",
  picked_up: "Head to the customer",
  at_customer: "Hand over and confirm",
  delivered: "Done",
};

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rider = useSession((s) => s.rider);
  const state = useRiderState();
  const setOnline = useSetOnline();
  const decline = useDecline();
  const act = useDeliveryAction();

  const online = state.data?.online ?? false;
  const active = state.data?.active ?? null;

  const open = useCallback(
    (id: string) => router.push({ pathname: "/delivery/[id]", params: { id } }),
    [router],
  );

  const accept = () => {
    if (!active) return;
    act.mutate(
      { deliveryId: active.id, action: { type: "accept" } },
      { onSuccess: () => open(active.id) },
    );
  };

  const declineActive = useCallback(() => {
    if (active?.status === "offered") decline.mutate(active.id);
  }, [active, decline]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <View>
          <Text style={styles.hello}>Hi {rider?.name.split(" ")[0]}</Text>
          <Text style={styles.status}>{online ? "You are online" : "You are offline"}</Text>
        </View>
        <View style={styles.toggle}>
          <Switch
            value={online}
            onValueChange={(v) => setOnline.mutate(v)}
            disabled={setOnline.isPending}
            trackColor={{ true: colors.brand[600], false: colors.line[300] }}
            accessibilityLabel="Go online"
            style={styles.switch}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {setOnline.error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {setOnline.error.message}
          </Text>
        ) : null}

        {state.isPending ? (
          <ActivityIndicator style={styles.loader} color={colors.brand[600]} />
        ) : !online ? (
          <Empty
            icon="moon-outline"
            title="You are offline"
            text="Go online to start getting orders."
          />
        ) : active?.status === "offered" ? (
          <OfferCard
            delivery={active}
            busy={act.isPending}
            onAccept={accept}
            onDecline={declineActive}
          />
        ) : active ? (
          <Card title="Current delivery">
            <Text style={styles.order}>Order {active.orderNumber}</Text>
            <Text style={styles.step}>{NEXT_LABEL[active.status]}</Text>
            <Text style={styles.where}>
              {active.status === "assigned" || active.status === "at_store"
                ? active.store.address
                : active.customer.address}
            </Text>
            <BigButton label="Continue" icon="arrow-forward" onPress={() => open(active.id)} />
          </Card>
        ) : (
          <View style={styles.searching}>
            <ActivityIndicator size="large" color={colors.brand[600]} />
            <Text style={styles.searchTitle}>Looking for orders</Text>
            <Text style={styles.searchText}>Stay near the store. New orders appear here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  text: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={56} color={colors.line[300]} />
      <Text style={styles.searchTitle}>{title}</Text>
      <Text style={styles.searchText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[100] },
  header: {
    backgroundColor: colors.surface[0],
    paddingHorizontal: space[5],
    paddingBottom: space[4],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line[300],
  },
  hello: { ...typography.titleLg, fontWeight: "800", color: colors.ink[900] },
  status: { ...typography.body, color: colors.ink[700] },
  toggle: { padding: space[1] },
  switch: { transform: [{ scale: 1.25 }] },
  body: { padding: space[4], gap: space[4], flexGrow: 1 },
  loader: { marginTop: space[10] },
  error: { ...typography.bodyStrong, color: colors.danger },
  empty: { alignItems: "center", gap: space[2], paddingTop: space[10] },
  searching: { alignItems: "center", gap: space[3], paddingTop: space[10] },
  searchTitle: { ...typography.title, fontWeight: "800", color: colors.ink[900] },
  searchText: { ...typography.body, color: colors.ink[700], textAlign: "center" },
  order: { ...typography.title, fontWeight: "800", color: colors.ink[900] },
  step: { ...typography.subtitle, color: colors.brand[700], fontWeight: "800" },
  where: { ...typography.body, color: colors.ink[700] },
});
