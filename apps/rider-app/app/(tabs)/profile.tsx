import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { Card } from "../../src/components/Card";
import { TextLink } from "../../src/components/TextLink";
import { earningsPaise, formatPaise } from "../../src/lib/delivery";
import { useRiderState } from "../../src/lib/queries";
import { useSession } from "../../src/store/session";
import { colors, radius, space, typography } from "../../src/theme";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/** "+919810000011" as "+91 98100 00011", which is easier to read back */
const prettyPhone = (phone: string) =>
  /^\+91\d{10}$/.test(phone) ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}` : phone;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const client = useQueryClient();
  const rider = useSession((s) => s.rider);
  const signOut = useSession((s) => s.signOut);
  const state = useRiderState();
  const [confirming, setConfirming] = useState(false);
  const [askedToDelete, setAskedToDelete] = useState(false);

  if (!rider) return null;

  const history = state.data?.history ?? [];
  const online = state.data?.online ?? false;
  const busy = state.data?.active != null && state.data.active.status !== "offered";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[6] },
      ]}
    >
      <Text style={styles.pageTitle}>Profile</Text>

      <View style={styles.idCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(rider.name) || "R"}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{rider.name}</Text>
          <Text style={styles.phone}>{prettyPhone(rider.phone)}</Text>
          <View style={styles.badges}>
            {rider.rating !== null ? (
              <View style={styles.badge}>
                <Ionicons name="star" size={12} color={colors.accent[900]} />
                <Text style={styles.badgeText}>{rider.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            <View style={[styles.badge, online ? styles.badgeOn : styles.badgeOff]}>
              <View style={[styles.dot, online ? styles.dotOn : styles.dotOff]} />
              <Text style={[styles.badgeText, online ? styles.badgeTextOn : styles.badgeTextOff]}>
                {online ? "On duty" : "Off duty"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Card title="Today">
        <View style={styles.statsRow}>
          <Stat value={String(history.length)} label="Deliveries" />
          <Stat
            value={formatPaise(history.reduce((sum, d) => sum + earningsPaise(d), 0))}
            label="Earned"
          />
        </View>
      </Card>

      <Card title="Your details">
        {rider.vehicle ? (
          <>
            <Line icon="bicycle" label="Vehicle" value={rider.vehicle} />
            <View style={styles.sep} />
          </>
        ) : null}
        <Line icon="call" label="Phone" value={prettyPhone(rider.phone)} />
        {rider.rating !== null ? (
          <>
            <View style={styles.sep} />
            <Line icon="star" label="Rating" value={`${rider.rating.toFixed(1)} of 5`} />
          </>
        ) : null}
      </Card>

      <View style={styles.signOut}>
        {confirming ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>
              {busy
                ? "Finish your current delivery before you log out."
                : "Log out of Tokajo Rider on this phone?"}
            </Text>
            {!busy ? (
              <BigButton
                label="Yes, log out"
                variant="danger"
                icon="log-out-outline"
                onPress={() => {
                  client.clear();
                  signOut();
                  router.replace("/(auth)/login");
                }}
              />
            ) : null}
            <TextLink label="Cancel" tone="muted" onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <TextLink label="Log out" tone="danger" onPress={() => setConfirming(true)} />
        )}
        {askedToDelete ? (
          <Text style={styles.deleteNote} accessibilityRole="alert">
            Rider accounts are closed by your warehouse. Ask your warehouse manager to close your
            account and remove your details.
          </Text>
        ) : (
          <TextLink label="Close my account" tone="muted" onPress={() => setAskedToDelete(true)} />
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Line({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.line}>
      <View style={styles.lineIcon}>
        <Ionicons name={icon} size={18} color={colors.brand[800]} />
      </View>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  deleteNote: {
    ...typography.body,
    color: colors.ink[700],
    textAlign: "center",
    paddingHorizontal: space[4],
  },
  root: { flex: 1, backgroundColor: colors.surface[100] },
  content: { padding: space[4], gap: space[4] },
  flex: { flex: 1 },
  pageTitle: { ...typography.titleLg, fontWeight: "800", color: colors.ink[900] },
  idCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[4],
    backgroundColor: colors.night[900],
    borderRadius: radius.xl,
    padding: space[5],
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: colors.ink[900] },
  name: { ...typography.titleLg, fontWeight: "800", color: colors.surface[0] },
  phone: { ...typography.body, color: colors.ink[300], marginTop: 2 },
  badges: { flexDirection: "row", gap: space[2], marginTop: space[2] },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeOn: { backgroundColor: colors.brand[100] },
  badgeOff: { backgroundColor: colors.night[700] },
  badgeText: { ...typography.caption, fontWeight: "800", color: colors.accent[900] },
  badgeTextOn: { color: colors.brand[900] },
  badgeTextOff: { color: colors.ink[300] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: colors.brand[600] },
  dotOff: { backgroundColor: colors.ink[500] },
  statsRow: { flexDirection: "row" },
  stat: { flex: 1, gap: 2 },
  statValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  statLabel: { ...typography.caption, fontWeight: "700", color: colors.ink[500] },
  line: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 40 },
  lineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
  },
  lineLabel: { ...typography.body, fontSize: 15, color: colors.ink[700], flex: 1 },
  lineValue: { ...typography.bodyStrong, fontSize: 15, color: colors.ink[900] },
  sep: { height: 1, backgroundColor: colors.line[300] },
  signOut: { marginTop: space[2] },
  confirm: {
    backgroundColor: colors.surface[0],
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
  },
  confirmText: { ...typography.subtitle, color: colors.ink[900], textAlign: "center" },
});
