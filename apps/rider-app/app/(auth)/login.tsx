import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { CodeInput } from "../../src/components/CodeInput";
import { TextLink } from "../../src/components/TextLink";
import { DEMO_OTP, SignInError, useSession } from "../../src/store/session";
import { colors, radius, space, typography } from "../../src/theme";
import { noWebOutline } from "../../src/theme/web";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const requestCode = useSession((s) => s.requestCode);
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async () => {
    setError(null);
    if (!/^\d{10}$/.test(phone)) return setError("Enter your 10 digit mobile number.");
    setBusy(true);
    try {
      const res = await requestCode(phone);
      setDemoMode(res.demoMode);
      setStep("otp");
      setOtp("");
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof SignInError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code = otp) => {
    setError(null);
    setBusy(true);
    try {
      await signIn(phone, code);
      router.replace("/(tabs)");
    } catch (e) {
      setOtp("");
      setError(e instanceof SignInError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + space[8] }]}>
          <View style={styles.logo}>
            <Ionicons name="bicycle" size={40} color={colors.ink[900]} />
          </View>
          <Text style={styles.brand}>Tokajo Rider</Text>
          <Text style={styles.tagline}>Deliver fast. Earn every ride.</Text>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
          {step === "phone" ? (
            <>
              <Text style={styles.title}>Log in to start riding</Text>
              <Text style={styles.subtitle}>Use the mobile number registered with your store.</Text>
              <View
                style={[
                  styles.phoneField,
                  focused && styles.phoneFieldFocused,
                  error && styles.phoneFieldError,
                ]}
              >
                <View style={styles.prefix}>
                  <Text style={styles.prefixText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, noWebOutline]}
                  value={phone}
                  onChangeText={(v) => {
                    setError(null);
                    setPhone(v.replace(/\D/g, "").slice(0, 10));
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onSubmitEditing={() => phone.length === 10 && void sendCode()}
                  placeholder="Mobile number"
                  placeholderTextColor={colors.ink[300]}
                  keyboardType="number-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  maxLength={10}
                  autoFocus
                  accessibilityLabel="Mobile number"
                />
                {phone.length === 10 ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.brand[600]} />
                ) : null}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter the code</Text>
              <View style={styles.sentRow}>
                <Text style={styles.subtitleInline}>Sent to +91 {phone}</Text>
                <TextLink
                  label="Change"
                  onPress={() => {
                    setStep("phone");
                    setOtp("");
                    setError(null);
                  }}
                />
              </View>
              <CodeInput
                value={otp}
                onChange={(v) => {
                  setError(null);
                  setOtp(v);
                }}
                length={OTP_LENGTH}
                size="md"
                autoFocus
                error={error}
                accessibilityLabel="Six digit code"
                onComplete={(v) => void verify(v)}
              />
              <View style={styles.resendRow}>
                {resendIn > 0 ? (
                  <Text style={styles.resendWait}>Resend code in {resendIn}s</Text>
                ) : (
                  <TextLink label="Resend code" onPress={() => void sendCode()} disabled={busy} />
                )}
              </View>
              {demoMode ? (
                <View style={styles.demo}>
                  <Ionicons name="information-circle" size={18} color={colors.info} />
                  <Text style={styles.demoText}>Demo mode: the code is {DEMO_OTP}.</Text>
                </View>
              ) : null}
            </>
          )}

          {step === "phone" && error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.spacer} />
          {step === "phone" ? (
            <BigButton
              label="Get code"
              trailingIcon="arrow-forward"
              onPress={() => void sendCode()}
              loading={busy}
              disabled={phone.length !== 10}
            />
          ) : (
            <BigButton
              label="Log in"
              onPress={() => void verify()}
              loading={busy}
              disabled={otp.length !== OTP_LENGTH}
            />
          )}
          <Text style={styles.legal}>Only riders registered by a Tokajo store can log in.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night[900] },
  scroll: { flexGrow: 1 },
  hero: { alignItems: "center", paddingBottom: space[8], gap: space[1] },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[3],
    transform: [{ rotate: "-6deg" }],
  },
  brand: { ...typography.display, color: colors.surface[0] },
  tagline: { ...typography.body, fontSize: 15, color: colors.ink[300] },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space[5],
    paddingTop: space[6],
  },
  title: {
    ...typography.titleLg,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.ink[900],
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    color: colors.ink[700],
    marginTop: space[1],
    marginBottom: space[5],
  },
  sentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space[4],
  },
  subtitleInline: { ...typography.body, fontSize: 15, color: colors.ink[700] },
  phoneField: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    borderWidth: 2,
    borderColor: colors.line[300],
    borderRadius: radius.md,
    paddingRight: space[4],
    backgroundColor: colors.surface[0],
  },
  phoneFieldFocused: { borderColor: colors.brand[600] },
  phoneFieldError: { borderColor: colors.danger },
  prefix: {
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: space[4],
    borderRightWidth: 1.5,
    borderRightColor: colors.line[300],
    marginRight: space[3],
  },
  prefixText: { fontSize: 20, fontWeight: "800", color: colors.ink[900] },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.ink[900],
  },
  resendRow: { alignItems: "flex-start", marginTop: space[2] },
  resendWait: { ...typography.bodyStrong, color: colors.ink[500], paddingVertical: 12 },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.surface[100],
    padding: space[3],
    borderRadius: radius.md,
    marginTop: space[2],
  },
  demoText: { ...typography.bodyStrong, color: colors.ink[700] },
  error: { ...typography.bodyStrong, color: colors.danger, marginTop: space[3] },
  spacer: { flex: 1, minHeight: space[6] },
  legal: {
    ...typography.caption,
    color: colors.ink[500],
    textAlign: "center",
    marginTop: space[3],
  },
});
