import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { DEMO_OTP, SignInError, useSession } from "../../src/store/session";
import { colors, radius, space, typography } from "../../src/theme";
import { noWebOutline } from "../../src/theme/web";

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

  const next = async () => {
    setError(null);
    setBusy(true);
    try {
      if (step === "phone") {
        if (!/^\d{10}$/.test(phone)) return setError("Enter a 10 digit mobile number.");
        const res = await requestCode(phone);
        setDemoMode(res.demoMode);
        return setStep("otp");
      }
      await signIn(phone, otp);
      router.replace("/(tabs)");
    } catch (e) {
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
      <View style={[styles.hero, { paddingTop: insets.top + space[8] }]}>
        <View style={styles.logo}>
          <Ionicons name="bicycle" size={36} color={colors.brand[700]} />
        </View>
        <Text style={styles.brand}>Tokajo Rider</Text>
        <Text style={styles.tagline}>Deliver fast. Earn every ride.</Text>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          {step === "phone"
            ? "Enter your mobile number to get a code."
            : `Enter the code sent to +91 ${phone}.`}
        </Text>

        {step === "phone" ? (
          <TextInput
            key="phone"
            style={[styles.input, noWebOutline]}
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
            placeholder="10 digit mobile number"
            placeholderTextColor={colors.ink[500]}
            keyboardType="number-pad"
            autoFocus
            accessibilityLabel="Mobile number"
          />
        ) : (
          <TextInput
            key="otp"
            style={[styles.input, styles.otp, noWebOutline]}
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="------"
            placeholderTextColor={colors.line[300]}
            keyboardType="number-pad"
            autoFocus
            accessibilityLabel="Six digit code"
          />
        )}

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {step === "otp" && demoMode ? (
          <Text style={styles.hint}>Demo mode: the code is {DEMO_OTP}.</Text>
        ) : null}

        <View style={styles.spacer} />
        <BigButton
          label={step === "phone" ? "Send code" : "Sign in"}
          onPress={() => void next()}
          loading={busy}
          disabled={step === "phone" ? phone.length !== 10 : otp.length !== 6}
        />
        {step === "otp" ? (
          <View style={styles.back}>
            <BigButton
              label="Change number"
              variant="secondary"
              onPress={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
            />
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand[600] },
  hero: { alignItems: "center", paddingBottom: space[8], gap: space[1] },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[3],
  },
  brand: { ...typography.titleLg, fontWeight: "800", color: colors.ink[900] },
  tagline: { ...typography.body, color: colors.ink[900], opacity: 0.8 },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space[5],
  },
  title: { ...typography.display, fontWeight: "800", color: colors.ink[900] },
  subtitle: {
    ...typography.body,
    color: colors.ink[700],
    marginTop: space[2],
    marginBottom: space[6],
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line[300],
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    height: 60,
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink[900],
  },
  otp: { letterSpacing: 10, textAlign: "center" },
  error: { ...typography.bodyStrong, color: colors.danger, marginTop: space[3] },
  hint: { ...typography.caption, color: colors.ink[500], marginTop: space[3] },
  spacer: { flex: 1 },
  back: { marginTop: space[3] },
});
