import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../../src/components/BigButton";
import { DEMO_OTP, SignInError, useSession } from "../../src/store/session";
import { colors, radius, space, typography } from "../../src/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    setError(null);
    if (step === "phone") {
      if (!/^\d{10}$/.test(phone)) return setError("Enter a 10 digit mobile number.");
      return setStep("otp");
    }
    try {
      signIn(phone, otp);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof SignInError ? e.message : "Something went wrong. Try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[4] },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.logo}>
        <Ionicons name="bicycle" size={36} color={colors.ink[900]} />
      </View>
      <Text style={styles.title}>Rider login</Text>
      <Text style={styles.subtitle}>
        {step === "phone"
          ? "Enter your mobile number to get a code."
          : `Enter the code sent to +91 ${phone}.`}
      </Text>

      {step === "phone" ? (
        <TextInput
          key="phone"
          style={styles.input}
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
          style={[styles.input, styles.otp]}
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
      {step === "otp" ? <Text style={styles.hint}>Demo mode: the code is {DEMO_OTP}.</Text> : null}

      <View style={styles.spacer} />
      <BigButton
        label={step === "phone" ? "Send code" : "Sign in"}
        onPress={next}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface[0], paddingHorizontal: space[5] },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[5],
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
