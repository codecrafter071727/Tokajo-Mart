import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Radius, Spacing } from "../../src/theme";
import { addressSummary, addressTag } from "../../src/lib/addresses";
import { KIND_ICON } from "../../src/lib/addressIcons";
import { servedLocally } from "../../src/lib/serviceAreas";
import { useAddressStore } from "../../src/store/addresses";

function confirmDelete(name: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`Delete ${name}?`)) onConfirm();
    return;
  }
  Alert.alert(`Delete ${name}?`, "This address will be removed from your account.", [
    { text: "Keep it", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addresses = useAddressStore((s) => s.addresses);
  const selectedId = useAddressStore((s) => s.selectedId);
  const select = useAddressStore((s) => s.select);
  const remove = useAddressStore((s) => s.remove);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Saved addresses</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {addresses.map((a) => {
          const active = a.id === selectedId;
          const { line1, line2 } = addressSummary(a);
          const served = servedLocally(a);
          return (
            <View key={a.id} style={[styles.card, active && styles.cardActive]}>
              <Pressable
                style={styles.cardMain}
                onPress={() => select(a.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${addressTag(a)}, ${line1}`}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <Ionicons name={KIND_ICON[a.kind]} size={20} color={Colors.brandText} />
                <View style={styles.text}>
                  <Text style={styles.tag}>{addressTag(a)}</Text>
                  <Text style={styles.line}>{line1}</Text>
                  <Text style={styles.line}>{line2}</Text>
                  {!served ? <Text style={styles.unserved}>We do not deliver here yet</Text> : null}
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => router.push({ pathname: "/addresses/edit", params: { id: a.id } })}
                  hitSlop={6}
                  accessibilityLabel={`Edit ${addressTag(a)}`}
                >
                  <Text style={styles.action}>Edit</Text>
                </Pressable>
                {addresses.length > 1 ? (
                  <Pressable
                    onPress={() => confirmDelete(addressTag(a), () => remove(a.id))}
                    hitSlop={6}
                    accessibilityLabel={`Delete ${addressTag(a)}`}
                  >
                    <Text style={[styles.action, styles.delete]}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing[12] }]}>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/addresses/edit")}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={Colors.surface} />
          <Text style={styles.addText}>Add a new address</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    backgroundColor: Colors.surface,
    gap: Spacing[8],
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: FontSize.h2, fontWeight: "700", color: Colors.textPrimary },
  content: { padding: Spacing[16], gap: Spacing[12] },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing[14],
    gap: Spacing[8],
  },
  cardActive: { borderColor: Colors.brandGreen, backgroundColor: Colors.greenTint },
  cardMain: { flexDirection: "row", alignItems: "flex-start", gap: Spacing[10] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioActive: { borderColor: Colors.brandGreen },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brandGreen },
  text: { flex: 1, gap: 2 },
  tag: { fontSize: FontSize.body, fontWeight: "700", color: Colors.textPrimary },
  line: { fontSize: FontSize.caption, color: Colors.textSecondary },
  unserved: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.danger,
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: Spacing[20], paddingLeft: 30 },
  action: { fontSize: FontSize.caption, fontWeight: "700", color: Colors.brandText },
  delete: { color: Colors.danger },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing[16],
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[8],
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: Colors.brandPressed,
  },
  addText: { fontSize: FontSize.body, fontWeight: "700", color: Colors.surface },
});
