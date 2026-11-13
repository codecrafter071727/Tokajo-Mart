import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, typography } from "../../src/theme";
import { DEMO_OTP, useAuthStore } from "../../src/store/auth";
import { requestOtp, verifyOtp } from "../../src/lib/auth";
import { backendEnabled } from "../../src/lib/session";
import { CodeInput, type CodeInputHandle } from "../../src/components/CodeInput";

const RESEND_AFTER = 30;

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string; length?: string; demo?: string }>();
  const phone = params.phone ?? "";
  const length = Math.min(6, Math.max(4, Number(params.length) || 4));
  const showDemoHint = params.demo === "1";
  const login = useAuthStore((s) => s.login);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_AFTER);
  const input = useRef<CodeInputHandle>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const fail = (message: string) => {
    setError(message);
    setCode("");
    input.current?.focus();
  };

  const verify = async (value: string) => {
    if (busy) return;
    setNotice(null);
    if (!backendEnabled) {
      if (value !== DEMO_OTP) return fail("That code is not right. Try again.");
      setError(null);
      login(phone || "98765 43210");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone, value);
      // The route guard in the root layout moves a signed in user into the app
    } catch (e) {
      fail(e instanceof Error ? e.message : "Could not verify the code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      if (backendEnabled) await requestOtp(phone);
      setCountdown(RESEND_AFTER);
      setCode("");
      setNotice("A new code is on its way.");
      input.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send a new code.");
    }
  };

  const pretty = phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>OTP verification</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.lead}>We have sent a verification code to</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.phone}>+91 {pretty}</Text>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Change number">
            <Text style={styles.change}>Change</Text>
          </Pressable>
        </View>

        <View style={styles.codeWrap}>
          <CodeInput
            ref={input}
            length={length}
            value={code}
            onChange={(v) => {
              setError(null);
              setCode(v);
            }}
            onComplete={verify}
            error={!!error}
            disabled={busy}
          />
        </View>

        <View style={styles.statusRow}>
          {busy ? (
            <View style={styles.inline}>
              <ActivityIndicator size="small" color={Colors.brandText} />
              <Text style={styles.statusText}>Verifying</Text>
            </View>
          ) : error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : notice ? (
            <Text style={styles.notice}>{notice}</Text>
          ) : null}
        </View>

        <View style={styles.resendRow}>
          <Text style={styles.resendLead}>Didn't get the code?</Text>
          {countdown > 0 ? (
            <Text style={styles.countdown}>Resend in 0:{String(countdown).padStart(2, "0")}</Text>
          ) : (
            <Pressable onPress={resend} hitSlop={8} accessibilityRole="button">
              <Text style={styles.resend}>Resend SMS</Text>
            </Pressable>
          )}
        </View>

        {showDemoHint ? (
          <View style={styles.demo}>
            <Ionicons name="information-circle" size={16} color={Colors.brandText} />
            <Text style={styles.demoText}>
              Demo mode: use <Text style={styles.demoCode}>{DEMO_OTP}</Text>
            </Text>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
    paddingHorizontal: Spacing[8],
    height: 56,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...typography.title, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing[24], paddingTop: Spacing[24], alignItems: "center" },
  lead: { ...typography.body, color: Colors.textSecondary, textAlign: "center" },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: Spacing[8], marginTop: 4 },
  phone: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  change: { ...typography.bodyStrong, color: Colors.brandText },
  codeWrap: { marginTop: Spacing[32] },
  statusRow: { minHeight: 36, justifyContent: "center", marginTop: Spacing[12] },
  inline: { flexDirection: "row", alignItems: "center", gap: Spacing[8] },
  statusText: { ...typography.bodyStrong, color: Colors.brandText },
  error: { ...typography.bodyStrong, color: Colors.danger, textAlign: "center" },
  notice: { ...typography.bodyStrong, color: Colors.brandText, textAlign: "center" },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing[4] },
  resendLead: { ...typography.body, color: Colors.textSecondary },
  countdown: {
    ...typography.bodyStrong,
    color: Colors.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  resend: { ...typography.bodyStrong, fontWeight: "800", color: Colors.brandText },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing[32],
    backgroundColor: Colors.greenTint,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[12],
    paddingVertical: 6,
  },
  demoText: { ...typography.caption, color: Colors.brandText },
  demoCode: { fontWeight: "800", letterSpacing: 1 },
});
