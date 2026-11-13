import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, typography } from "../src/theme";
import { ScreenHeader } from "../src/components/ScreenHeader";
import {
  canConfirmDeletion,
  CONFIRM_WORD,
  deleteAccount,
  DELETION_REASONS,
} from "../src/lib/accountDeletion";
import { HttpError } from "../src/lib/session";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const REMOVED: { icon: IconName; text: string }[] = [
  { icon: "person-outline", text: "Your name and phone number" },
  { icon: "location-outline", text: "Your saved addresses" },
  { icon: "notifications-outline", text: "Your notifications and Notify me alerts" },
  { icon: "phone-portrait-outline", text: "Sign in on every device, straight away" },
];

const KEPT: { icon: IconName; text: string }[] = [
  {
    icon: "receipt-outline",
    text: "Past orders, invoices and payments, without your name and phone. Tax law requires us to keep these records.",
  },
];

/**
 * Account deletion, in two steps: first what goes and what stays, then typing DELETE to confirm.
 * App Store and Play Store both require deletion to be possible inside the app.
 */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = canConfirmDeletion(typed) && !busy;

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(reason ?? undefined);
      router.replace("/(auth)/login");
    } catch (e) {
      setError(
        e instanceof HttpError || e instanceof Error
          ? e.message
          : "Could not delete your account. Try again.",
      );
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Delete account" fallback="/account" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing[32] }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.steps} accessibilityLabel={`Step ${step} of 2`}>
            <View style={[styles.stepBar, styles.stepOn]} />
            <View style={[styles.stepBar, step === 2 && styles.stepOn]} />
          </View>

          {step === 1 ? (
            <>
              <View style={styles.hero}>
                <View style={styles.heroIcon}>
                  <Ionicons name="trash-outline" size={26} color={Colors.danger} />
                </View>
                <Text style={styles.title}>Before you go</Text>
                <Text style={styles.lead}>
                  Deleting your account cannot be undone. Here is exactly what happens.
                </Text>
              </View>

              <Text style={styles.groupTitle}>DELETED FOR GOOD</Text>
              <View style={styles.card}>
                {REMOVED.map((r, i) => (
                  <Line key={r.text} icon={r.icon} text={r.text} last={i === REMOVED.length - 1} />
                ))}
              </View>

              <Text style={styles.groupTitle}>KEPT FOR TAX RECORDS</Text>
              <View style={styles.card}>
                {KEPT.map((r) => (
                  <Line key={r.text} icon={r.icon} text={r.text} muted last />
                ))}
              </View>

              <View style={styles.note}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={Colors.textSecondary}
                />
                <Text style={styles.noteText}>
                  If an order is on its way, finish or cancel it first. You can sign up again later
                  with the same number, as a new account.
                </Text>
              </View>

              <Text style={styles.groupTitle}>WHY ARE YOU LEAVING? (OPTIONAL)</Text>
              <View style={styles.reasons}>
                {DELETION_REASONS.map((r) => {
                  const on = reason === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setReason(on ? null : r)}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                onPress={() => setStep(2)}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>Continue</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
                onPress={() => router.back()}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>Keep my account</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.hero}>
                <Text style={styles.title}>Confirm deletion</Text>
                <Text style={styles.lead}>
                  Type <Text style={styles.word}>{CONFIRM_WORD}</Text> below to delete your account
                  now.
                </Text>
              </View>

              <TextInput
                value={typed}
                onChangeText={(t) => {
                  setTyped(t);
                  setError(null);
                }}
                placeholder={CONFIRM_WORD}
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                editable={!busy}
                style={[styles.input, canConfirmDeletion(typed) && styles.inputReady]}
                accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
                onSubmitEditing={() => void confirm()}
                returnKeyType="done"
              />

              {error ? (
                <View style={styles.error} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.danger,
                  !ready && styles.dangerOff,
                  pressed && ready && styles.pressed,
                ]}
                onPress={() => void confirm()}
                disabled={!ready}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready, busy }}
              >
                {busy ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <Text style={styles.dangerText}>Delete my account</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
                onPress={() => setStep(1)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>Back</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Line({
  icon,
  text,
  muted,
  last,
}: {
  icon: IconName;
  text: string;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.line, !last && styles.lineBorder]}>
      <Ionicons name={icon} size={18} color={muted ? Colors.textTertiary : Colors.textSecondary} />
      <Text style={[styles.lineText, muted && { color: Colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { padding: Spacing[16], gap: Spacing[12] },
  pressed: { opacity: 0.75 },

  steps: { flexDirection: "row", gap: 6 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  stepOn: { backgroundColor: Colors.danger },

  hero: { alignItems: "center", gap: 6, paddingVertical: Spacing[8] },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { ...typography.title, fontWeight: "800", color: Colors.textPrimary },
  lead: { ...typography.body, color: Colors.textSecondary, textAlign: "center" },
  word: { fontWeight: "800", color: Colors.danger, letterSpacing: 1 },

  groupTitle: {
    ...typography.caption,
    fontWeight: "800",
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginTop: Spacing[4],
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[12],
  },
  line: { flexDirection: "row", alignItems: "flex-start", gap: Spacing[12], paddingVertical: 12 },
  lineBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  lineText: { ...typography.body, color: Colors.textPrimary, flex: 1 },

  note: {
    flexDirection: "row",
    gap: Spacing[8],
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[12],
  },
  noteText: { ...typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  reasons: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[8] },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipOn: { borderColor: Colors.textPrimary, backgroundColor: Colors.textPrimary },
  chipText: { ...typography.caption, fontWeight: "700", color: Colors.textSecondary },
  chipTextOn: { color: Colors.surface },

  secondary: {
    marginTop: Spacing[8],
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  secondaryText: { ...typography.subtitle, fontWeight: "800", color: Colors.danger },
  link: { alignItems: "center", paddingVertical: 12, minHeight: 44 },
  linkText: { ...typography.body, fontWeight: "700", color: Colors.textSecondary },

  input: {
    height: 54,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[16],
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    color: Colors.textPrimary,
  },
  inputReady: { borderColor: Colors.danger },
  error: {
    flexDirection: "row",
    gap: Spacing[8],
    backgroundColor: "#FDF1F1",
    borderRadius: Radius.md,
    padding: Spacing[12],
  },
  errorText: { ...typography.body, color: Colors.danger, flex: 1 },
  danger: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[4],
  },
  dangerOff: { opacity: 0.4 },
  dangerText: { ...typography.subtitle, fontWeight: "800", color: Colors.surface },
});
