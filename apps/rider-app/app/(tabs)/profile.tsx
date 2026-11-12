import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { Card } from "../../src/components/Card";
import { useSession } from "../../src/store/session";
import { colors, space, typography } from "../../src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const client = useQueryClient();
  const rider = useSession((s) => s.rider);
  const signOut = useSession((s) => s.signOut);

  if (!rider) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space[4] }]}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={40} color={colors.ink[900]} />
      </View>
      <Text style={styles.name}>{rider.name}</Text>
      <Text style={styles.phone}>{rider.phone}</Text>

      <Card style={styles.card}>
        <Line icon="bicycle" label="Vehicle" value={rider.vehicle} />
        <Line icon="star" label="Rating" value={rider.rating.toFixed(1)} />
      </Card>

      <View style={styles.spacer} />
      <BigButton
        label="Log out"
        variant="danger"
        icon="log-out-outline"
        onPress={() => {
          client.clear();
          signOut();
          router.replace("/(auth)/login");
        }}
      />
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
      <Ionicons name={icon} size={22} color={colors.brand[700]} />
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[100], padding: space[5], alignItems: "center" },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...typography.titleLg, fontWeight: "800", color: colors.ink[900], marginTop: space[3] },
  phone: { ...typography.body, color: colors.ink[700], marginBottom: space[5] },
  card: { alignSelf: "stretch" },
  line: { flexDirection: "row", alignItems: "center", gap: space[3] },
  lineLabel: { ...typography.body, color: colors.ink[700], flex: 1 },
  lineValue: { ...typography.bodyStrong, color: colors.ink[900] },
  spacer: { flex: 1 },
});
