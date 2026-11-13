import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, typography } from "../theme";
import { openInvoice } from "../lib/invoice";

/** "Download invoice" on a delivered order. */
export function InvoiceButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      await openInvoice(orderId, orderNumber);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not open the invoice.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
        onPress={() => void open()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Download invoice"
        accessibilityState={{ busy }}
      >
        <View style={styles.icon}>
          <Ionicons name="document-text-outline" size={20} color={Colors.brandText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Download invoice</Text>
          <Text style={styles.sub}>PDF with every item, fee and payment</Text>
        </View>
        {busy ? (
          <ActivityIndicator color={Colors.brandText} />
        ) : (
          <Ionicons name="download-outline" size={20} color={Colors.textSecondary} />
        )}
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 64,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  sub: { ...typography.caption, color: Colors.textTertiary, marginTop: 1 },
  error: { ...typography.caption, color: Colors.danger, paddingHorizontal: Spacing[4] },
});
