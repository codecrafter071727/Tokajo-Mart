import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDoorPhoto, useTracking } from "../../lib/tracking";
import { Colors, Radius, Spacing, typography } from "../../theme";

/** The photo the rider took at the door, shown on a delivered order when there is one. */
export function DoorPhotoCard({ orderId }: { orderId: string }) {
  const tracking = useTracking(orderId, true);
  const source = useDoorPhoto(orderId, Boolean(tracking.data?.podAvailable));
  if (!source) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Photo at your door</Text>
      <Image
        source={source}
        style={styles.photo}
        contentFit="cover"
        accessibilityLabel="Photo the rider took when delivering"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing[16],
    gap: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    backgroundColor: Colors.canvas,
  },
});
