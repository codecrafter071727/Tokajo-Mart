import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { OfferActions, OfferCard } from "../../src/components/OfferCard";
import { OnlineSwitch } from "../../src/components/OnlineSwitch";
import { Pulse } from "../../src/components/Pulse";
import { StatTile } from "../../src/components/StatTile";
import { earningsPaise, formatPaise, type DeliveryStatus } from "../../src/lib/delivery";
import { useDecline, useDeliveryAction, useRiderState, useSetOnline } from "../../src/lib/queries";
import { useSession } from "../../src/store/session";
import { colors, radius, space, typography } from "../../src/theme";

/** What the rider does next, for the "current delivery" card on the home screen. */
const NEXT: Record<
  DeliveryStatus,
  { title: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  offered: { title: "Accept the order", icon: "checkmark-circle" },
  assigned: { title: "Head to the store", icon: "storefront" },
  at_store: { title: "Collect the items", icon: "bag-check" },
  picked_up: { title: "Head to the customer", icon: "navigate" },
  at_customer: { title: "Hand over and confirm", icon: "home" },
  delivered: { title: "Done", icon: "checkmark-done" },
};
const STEP_NUMBER: Partial<Record<DeliveryStatus, number>> = {
  assigned: 1,
  at_store: 2,
  picked_up: 3,
  at_customer: 4,
};

const today = () =>
  new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rider = useSession((s) => s.rider);
  const state = useRiderState();
  const setOnline = useSetOnline();
  const decline = useDecline();
  const act = useDeliveryAction();

  const online = state.data?.online ?? false;
  const history = state.data?.history ?? [];
  const todayPaise = history.reduce((sum, d) => sum + earningsPaise(d), 0);
  const tipsPaise = history.reduce((sum, d) => sum + d.tipPaise, 0);
  const active = state.data?.active ?? null;
  const onJob = active !== null && active.status !== "offered";

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

  const error = setOnline.error ?? act.error ?? decline.error;

  return (
    <View style={styles.root}>
      <StatusBar style={online ? "dark" : "light"} />
      <View
        style={[
          styles.header,
          online ? styles.headerOn : styles.headerOff,
          { paddingTop: insets.top + space[3] },
        ]}
      >
        <View style={styles.headerText}>
          <Text style={[styles.date, !online && styles.onNight]}>{today()}</Text>
          <Text style={[styles.hello, !online && styles.onNightStrong]} numberOfLines={1}>
            Hi {rider?.name.split(" ")[0] ?? "there"}
          </Text>
        </View>
        <OnlineSwitch
          online={online}
          busy={setOnline.isPending}
          // Going off duty mid delivery or with an offer on screen is not allowed
          disabled={state.isPending || onJob || active?.status === "offered"}
          onToggle={() => setOnline.mutate(!online)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* While an offer is ringing, it gets the whole screen */}
        {active?.status === "offered" ? null : (
          <Pressable
            onPress={() => router.push("/(tabs)/earnings")}
            accessibilityRole="button"
            accessibilityLabel={`Today: ${formatPaise(todayPaise)} earned from ${history.length} deliveries. Open earnings`}
            style={({ pressed }) => [styles.today, pressed && styles.pressed]}
          >
            <View style={styles.todayHead}>
              <Text style={styles.todayTitle}>Today</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.ink[500]} />
            </View>
            <View style={styles.todayRow}>
              <StatTile value={formatPaise(todayPaise)} label="Earned" grow={1.6} />
              <View style={styles.divider} />
              <StatTile value={String(history.length)} label="Deliveries" />
              <View style={styles.divider} />
              <StatTile value={formatPaise(tipsPaise)} label="Tips" grow={1.2} />
            </View>
          </Pressable>
        )}

        {error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}

        {state.isPending ? (
          <ActivityIndicator style={styles.loader} size="large" color={colors.brand[600]} />
        ) : !online ? (
          <View style={styles.state}>
            <View style={styles.offIcon}>
              <Ionicons name="moon" size={44} color={colors.surface[0]} />
            </View>
            <Text style={styles.stateTitle}>You are off duty</Text>
            <Text style={styles.stateText}>
              Go on duty to start getting orders near your store.
            </Text>
          </View>
        ) : active?.status === "offered" ? (
          <OfferCard
            delivery={active}
            busy={act.isPending}
            onAccept={accept}
            onDecline={declineActive}
            showActions={false}
          />
        ) : active ? (
          <View
            style={styles.current}
            accessibilityLabel={`Current delivery, ${NEXT[active.status].title}`}
          >
            <View style={styles.currentTop}>
              <Text style={styles.currentKicker}>
                CURRENT DELIVERY · STEP {STEP_NUMBER[active.status] ?? 1} OF 4
              </Text>
              <Text style={styles.currentPay}>{formatPaise(earningsPaise(active))}</Text>
            </View>
            <View style={styles.currentMain}>
              <View style={styles.currentIcon}>
                <Ionicons name={NEXT[active.status].icon} size={26} color={colors.ink[900]} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.currentTitle}>{NEXT[active.status].title}</Text>
                <Text style={styles.currentWhere} numberOfLines={2}>
                  {active.status === "assigned" || active.status === "at_store"
                    ? active.store.name
                    : active.customer.address}
                </Text>
              </View>
            </View>
            <View style={styles.segments}>
              {[1, 2, 3, 4].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.segment,
                    n <= (STEP_NUMBER[active.status] ?? 1) && styles.segmentOn,
                  ]}
                />
              ))}
            </View>
            <BigButton
              label="Continue delivery"
              trailingIcon="arrow-forward"
              onPress={() => open(active.id)}
            />
          </View>
        ) : (
          <View style={styles.state}>
            <Pulse />
            <Text style={styles.stateTitle}>Finding orders for you</Text>
            <Text style={styles.stateText}>Stay close to the store. A new order rings here.</Text>
          </View>
        )}
      </ScrollView>

      {/* One big, thumb reachable action when there is nothing else to do */}
      {online && active?.status === "offered" ? (
        <View style={styles.footer}>
          <OfferActions busy={act.isPending} onAccept={accept} onDecline={declineActive} />
        </View>
      ) : null}
      {!state.isPending && !online ? (
        <View style={styles.footer}>
          <BigButton
            label="Go on duty"
            icon="power"
            onPress={() => setOnline.mutate(true)}
            loading={setOnline.isPending}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[100] },
  flex: { flex: 1 },
  pressed: { opacity: 0.92 },
  header: {
    paddingHorizontal: space[5],
    paddingBottom: space[5],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space[3],
  },
  headerOn: { backgroundColor: colors.surface[0] },
  headerOff: { backgroundColor: colors.night[900] },
  headerText: { flex: 1 },
  date: { ...typography.caption, fontWeight: "700", color: colors.ink[500] },
  hello: { ...typography.titleLg, fontWeight: "800", color: colors.ink[900] },
  onNight: { color: colors.ink[300] },
  onNightStrong: { color: colors.surface[0] },
  body: { padding: space[4], gap: space[4], flexGrow: 1 },
  today: {
    backgroundColor: colors.surface[0],
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  todayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayTitle: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.ink[500],
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  todayRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.line[300] },
  loader: { marginTop: space[10] },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.dangerTint,
    padding: space[3],
    borderRadius: radius.md,
  },
  errorText: { ...typography.bodyStrong, color: colors.danger, flex: 1 },
  state: { alignItems: "center", gap: space[3], paddingTop: space[8], paddingHorizontal: space[4] },
  offIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.night[700],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[2],
  },
  stateTitle: {
    ...typography.titleLg,
    fontWeight: "800",
    color: colors.ink[900],
    textAlign: "center",
  },
  stateText: { ...typography.body, fontSize: 15, color: colors.ink[700], textAlign: "center" },
  current: {
    backgroundColor: colors.surface[0],
    borderRadius: radius.xl,
    padding: space[4],
    gap: space[4],
    borderWidth: 2,
    borderColor: colors.brand[600],
  },
  currentTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  currentKicker: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.brand[800],
    letterSpacing: 0.4,
  },
  currentPay: {
    ...typography.title,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  currentMain: { flexDirection: "row", alignItems: "center", gap: space[3] },
  currentIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand[100],
    alignItems: "center",
    justifyContent: "center",
  },
  currentTitle: { ...typography.titleLg, fontWeight: "800", color: colors.ink[900] },
  currentWhere: { ...typography.body, color: colors.ink[700] },
  segments: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface[100] },
  segmentOn: { backgroundColor: colors.brand[600] },
  footer: {
    padding: space[4],
    backgroundColor: colors.surface[0],
    borderTopWidth: 1,
    borderTopColor: colors.line[300],
  },
});
