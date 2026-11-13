import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Radius, Spacing } from "../../src/theme";
import {
  validateDraft,
  type AddressDraft,
  type AddressKind,
  type DraftErrors,
} from "../../src/lib/addresses";
import { SERVICE_AREAS, servedLocally } from "../../src/lib/serviceAreas";
import { useAddressStore } from "../../src/store/addresses";
import { ScreenHeader } from "../../src/components/ScreenHeader";

const KINDS: {
  kind: AddressKind;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { kind: "home", label: "Home", icon: "home" },
  { kind: "work", label: "Work", icon: "business" },
  { kind: "other", label: "Other", icon: "location" },
];

function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.inputMulti, error ? styles.inputError : null]}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function EditAddressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useAddressStore((s) => s.addresses.find((a) => a.id === id));
  const add = useAddressStore((s) => s.add);
  const update = useAddressStore((s) => s.update);

  const [draft, setDraft] = useState<AddressDraft>(() => ({
    kind: existing?.kind ?? "home",
    label: existing?.label ?? "",
    line1: existing?.line1 ?? "",
    line2: existing?.line2 ?? "",
    instructions: existing?.instructions ?? "",
    areaId: existing?.areaId ?? "noida-62",
  }));
  const [errors, setErrors] = useState<DraftErrors>({});
  const set = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (existing) update(existing.id, draft);
    else add(draft);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title={existing ? "Edit address" : "Add address"} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>Save as</Text>
        <View style={styles.kindRow}>
          {KINDS.map((k) => {
            const active = draft.kind === k.kind;
            return (
              <Pressable
                key={k.kind}
                style={[styles.kind, active && styles.kindActive]}
                onPress={() => set("kind", k.kind)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={k.icon}
                  size={16}
                  color={active ? Colors.brandPressed : Colors.textSecondary}
                />
                <Text style={[styles.kindText, active && styles.kindTextActive]}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {draft.kind === "other" ? (
          <Field
            label="Name this address"
            value={draft.label}
            onChangeText={(v) => set("label", v)}
            error={errors.label}
            placeholder="For example Parents or Gym"
            maxLength={20}
          />
        ) : null}

        <Text style={styles.section}>Area</Text>
        <View style={styles.areas}>
          {SERVICE_AREAS.map((area) => {
            const active = draft.areaId === area.id;
            const served = servedLocally(area);
            return (
              <Pressable
                key={area.id}
                style={[styles.area, active && styles.areaActive]}
                onPress={() => set("areaId", area.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${area.name}, ${area.city}. ${served ? "We deliver here" : "Not served yet"}`}
              >
                <View style={styles.areaTop}>
                  <Text style={styles.areaName}>{area.name}</Text>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={18} color={Colors.brandText} />
                  ) : null}
                </View>
                <Text style={styles.areaCity}>
                  {area.city} - {area.pincode}
                </Text>
                <View style={[styles.pill, served ? styles.pillOk : styles.pillNo]}>
                  <Text style={[styles.pillText, served ? styles.pillTextOk : styles.pillTextNo]}>
                    {served ? "We deliver here" : "Coming soon"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {errors.areaId ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errors.areaId}
          </Text>
        ) : null}

        <Field
          label="Flat, house number and street"
          value={draft.line1}
          onChangeText={(v) => set("line1", v)}
          error={errors.line1}
          placeholder="B-12, Green Park Road"
          maxLength={200}
        />
        <Field
          label="Landmark (optional)"
          value={draft.line2}
          onChangeText={(v) => set("line2", v)}
          error={errors.line2}
          placeholder="Near the metro station"
          maxLength={150}
        />
        <Field
          label="Delivery instructions (optional)"
          value={draft.instructions}
          onChangeText={(v) => set("instructions", v)}
          error={errors.instructions}
          placeholder="Ring the bell twice"
          multiline
          maxLength={200}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing[12] }]}>
        <Pressable style={styles.save} onPress={save} accessibilityRole="button">
          <Text style={styles.saveText}>{existing ? "Save changes" : "Save address"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
  section: { fontSize: FontSize.body, fontWeight: "700", color: Colors.textPrimary },
  kindRow: { flexDirection: "row", gap: Spacing[8] },
  kind: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  kindActive: { borderColor: Colors.brandGreen, backgroundColor: Colors.greenTint },
  kindText: { fontSize: FontSize.caption, fontWeight: "700", color: Colors.textSecondary },
  kindTextActive: { color: Colors.brandPressed },
  areas: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[8] },
  area: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing[12],
    gap: 2,
  },
  areaActive: { borderColor: Colors.brandGreen, backgroundColor: Colors.greenTint },
  areaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  areaName: { fontSize: FontSize.body, fontWeight: "700", color: Colors.textPrimary },
  areaCity: { fontSize: FontSize.caption, color: Colors.textSecondary },
  pill: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  pillOk: { backgroundColor: Colors.brandTint },
  pillNo: { backgroundColor: Colors.canvas },
  pillText: { fontSize: FontSize.micro, fontWeight: "700" },
  pillTextOk: { color: Colors.brandPressed },
  pillTextNo: { color: Colors.textTertiary },
  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.caption, fontWeight: "700", color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[12],
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  inputError: { borderColor: Colors.danger },
  error: { fontSize: FontSize.caption, color: Colors.danger, fontWeight: "700" },
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
  save: {
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: FontSize.body, fontWeight: "700", color: Colors.onBrand },
});
