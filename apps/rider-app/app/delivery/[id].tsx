import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { Card } from "../../src/components/Card";
import {
  DELIVERY_CODE_LENGTH,
  DeliveryError,
  earningsPaise,
  formatPaise,
  type Action,
  type Delivery,
  type DeliveryStatus,
} from "../../src/lib/delivery";
import { REAL_BACKEND } from "../../src/lib/api";
import { useDeliveryAction, useRiderState } from "../../src/lib/queries";
import { colors, radius, space, TOUCH, typography } from "../../src/theme";

const STEPS: { status: DeliveryStatus; label: string }[] = [
  { status: "assigned", label: "Accepted" },
  { status: "at_store", label: "At store" },
  { status: "picked_up", label: "Picked up" },
  { status: "at_customer", label: "At door" },
  { status: "delivered", label: "Delivered" },
];

const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function DeliveryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useRiderState();
  const act = useDeliveryAction();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");
  const [handover, setHandover] = useState("");
  const [error, setError] = useState<string | null>(null);

  const delivery: Delivery | null =
    state.data?.active?.id === id
      ? state.data.active
      : (state.data?.history.find((d) => d.id === id) ?? null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (!delivery) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.title}>
          {state.isPending ? "Loading" : "This delivery is no longer active"}
        </Text>
        {!state.isPending ? <BigButton label="Back to jobs" onPress={goBack} /> : null}
      </View>
    );
  }

  const run = (action: Action) => {
    setError(null);
    act.mutate(
      { deliveryId: delivery.id, action },
      {
        onError: (e) =>
          setError(e instanceof DeliveryError ? e.message : "Something went wrong. Try again."),
      },
    );
  };

  if (delivery.status === "delivered") {
    return (
      <View
        style={[
          styles.root,
          styles.center,
          { paddingTop: insets.top, paddingBottom: insets.bottom + space[4] },
        ]}
      >
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={56} color={colors.ink[900]} />
        </View>
        <Text style={styles.title}>Delivered</Text>
        <Text style={styles.earned}>You earned {formatPaise(earningsPaise(delivery))}</Text>
        {delivery.codPaise ? (
          <Text style={styles.cod}>
            Hand in {formatPaise(delivery.codPaise)} cash collected at the door.
          </Text>
        ) : null}
        <View style={styles.doneAction}>
          <BigButton label="Back to jobs" icon="arrow-back" onPress={goBack} />
        </View>
      </View>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.status === delivery.status);
  const itemsChecked = delivery.items.every((i) => checked.has(i.id));
  const toStore = delivery.status === "assigned" || delivery.status === "at_store";

  const toggle = (itemId: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={28} color={colors.ink[900]} />
        </Pressable>
        <Text style={styles.headerTitle}>Order {delivery.orderNumber}</Text>
        <Text style={styles.pay}>{formatPaise(earningsPaise(delivery))}</Text>
      </View>

      <View style={styles.steps} accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s.status} style={styles.step}>
            <View style={[styles.dot, i <= stepIndex && styles.dotOn]} />
            <Text style={[styles.stepLabel, i === stepIndex && styles.stepLabelOn]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card title={toStore ? "Go to the store" : "Deliver to"}>
          <Text style={styles.place}>{toStore ? delivery.store.name : delivery.customer.name}</Text>
          <Text style={styles.address}>
            {toStore ? delivery.store.address : delivery.customer.address}
          </Text>
          {!toStore && delivery.customer.instructions ? (
            <View style={styles.note}>
              <Ionicons name="information-circle" size={18} color={colors.warning} />
              <Text style={styles.noteText}>{delivery.customer.instructions}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <BigButton
                label="Navigate"
                variant="secondary"
                icon="navigate"
                onPress={() => {
                  const p = toStore ? delivery.store : delivery.customer;
                  void Linking.openURL(
                    p.lat !== null && p.lng !== null
                      ? mapsUrl(p.lat, p.lng)
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`,
                  );
                }}
              />
            </View>
            {!toStore ? (
              <View style={styles.flex}>
                <BigButton
                  label="Call"
                  variant="secondary"
                  icon="call"
                  onPress={() => void Linking.openURL(`tel:${delivery.customer.phone}`)}
                />
              </View>
            ) : null}
          </View>
        </Card>

        {delivery.codPaise && delivery.status !== "assigned" ? (
          <View style={styles.cashBanner}>
            <Ionicons name="cash" size={22} color={colors.ink[900]} />
            <Text style={styles.cashText}>
              Collect {formatPaise(delivery.codPaise)} cash from the customer
            </Text>
          </View>
        ) : null}

        <Card title={delivery.status === "at_store" ? "Check every item" : "Items"}>
          {delivery.items.map((item) => {
            const done =
              delivery.status === "at_store"
                ? checked.has(item.id)
                : delivery.status !== "assigned";
            const interactive = delivery.status === "at_store";
            return (
              <Pressable
                key={item.id}
                disabled={!interactive}
                onPress={() => toggle(item.id)}
                style={styles.item}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done, disabled: !interactive }}
                accessibilityLabel={`${item.quantity} times ${item.name}`}
              >
                <Ionicons
                  name={done ? "checkbox" : "square-outline"}
                  size={26}
                  color={done ? colors.brand[700] : colors.ink[500]}
                />
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
              </Pressable>
            );
          })}
        </Card>

        {delivery.status === "at_store" && REAL_BACKEND ? (
          <Card title="Handover code">
            <Text style={styles.address}>
              Enter the {DELIVERY_CODE_LENGTH} digit code shown on the warehouse screen.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={handover}
              onChangeText={(v) => {
                setError(null);
                setHandover(v.replace(/\D/g, "").slice(0, DELIVERY_CODE_LENGTH));
              }}
              keyboardType="number-pad"
              placeholder="----"
              placeholderTextColor={colors.line[300]}
              accessibilityLabel="Warehouse handover code"
            />
          </Card>
        ) : null}

        {delivery.status === "at_customer" ? (
          <Card title="Customer code">
            <Text style={styles.address}>
              Ask the customer for their {DELIVERY_CODE_LENGTH} digit code.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(v) => {
                setError(null);
                setCode(v.replace(/\D/g, "").slice(0, DELIVERY_CODE_LENGTH));
              }}
              keyboardType="number-pad"
              placeholder="----"
              placeholderTextColor={colors.line[300]}
              accessibilityLabel="Customer delivery code"
              autoFocus
            />
          </Card>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>
        {delivery.status === "assigned" ? (
          <BigButton
            label="I have reached the store"
            icon="storefront"
            onPress={() => run({ type: "arrive_store" })}
            loading={act.isPending}
          />
        ) : delivery.status === "at_store" ? (
          <BigButton
            label={
              itemsChecked ? "Picked up all items" : `Check all ${delivery.items.length} items`
            }
            icon="bag-check"
            onPress={() =>
              run({
                type: "pick_up",
                checkedItemIds: [...checked],
                handoverCode: REAL_BACKEND ? handover : undefined,
              })
            }
            disabled={!itemsChecked || (REAL_BACKEND && handover.length !== DELIVERY_CODE_LENGTH)}
            loading={act.isPending}
          />
        ) : delivery.status === "picked_up" ? (
          <BigButton
            label="I have reached the customer"
            icon="home"
            onPress={() => run({ type: "arrive_customer" })}
            loading={act.isPending}
          />
        ) : (
          <BigButton
            label="Complete delivery"
            icon="checkmark-circle"
            onPress={() => run({ type: "deliver", code })}
            disabled={code.length !== DELIVERY_CODE_LENGTH}
            loading={act.isPending}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[100] },
  center: { alignItems: "center", justifyContent: "center", gap: space[3], padding: space[5] },
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.surface[0],
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    gap: space[2],
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...typography.title, fontWeight: "800", color: colors.ink[900], flex: 1 },
  pay: {
    ...typography.title,
    fontWeight: "800",
    color: colors.brand[700],
    fontVariant: ["tabular-nums"],
  },
  steps: {
    flexDirection: "row",
    backgroundColor: colors.surface[0],
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.line[300],
  },
  step: { flex: 1, alignItems: "center", gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.line[300] },
  dotOn: { backgroundColor: colors.brand[600] },
  stepLabel: { ...typography.micro, color: colors.ink[500] },
  stepLabelOn: { color: colors.ink[900], fontWeight: "800" },
  body: { padding: space[4], gap: space[4] },
  place: { ...typography.title, fontWeight: "800", color: colors.ink[900] },
  address: { ...typography.body, color: colors.ink[700] },
  note: {
    flexDirection: "row",
    gap: space[2],
    backgroundColor: colors.accent[100],
    padding: space[3],
    borderRadius: radius.md,
  },
  noteText: { ...typography.bodyStrong, color: colors.accent[900], flex: 1 },
  row: { flexDirection: "row", gap: space[3] },
  cashBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.accent[500],
    padding: space[4],
    borderRadius: radius.md,
  },
  cashText: { ...typography.bodyStrong, fontWeight: "800", color: colors.ink[900], flex: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: TOUCH - 8 },
  itemEmoji: { fontSize: 24 },
  itemName: { ...typography.bodyStrong, color: colors.ink[900], flex: 1 },
  itemQty: {
    ...typography.subtitle,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.brand[600],
    borderRadius: radius.md,
    height: 72,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 16,
    textAlign: "center",
    color: colors.ink[900],
  },
  error: { ...typography.bodyStrong, color: colors.danger },
  footer: {
    backgroundColor: colors.surface[0],
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.line[300],
  },
  title: { ...typography.display, fontWeight: "800", color: colors.ink[900], textAlign: "center" },
  earned: { ...typography.titleLg, fontWeight: "800", color: colors.brand[700] },
  cod: { ...typography.body, color: colors.ink[700], textAlign: "center" },
  doneIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[2],
  },
  doneAction: { alignSelf: "stretch", marginTop: space[6] },
});
