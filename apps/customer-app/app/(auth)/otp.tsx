import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight } from "../../src/theme";
import { DEMO_OTP, useAuthStore } from "../../src/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { noWebOutline } from "../../src/theme/web";
import { applyOtpInput } from "../../src/lib/otp";
import { requestOtp, verifyOtp } from "../../src/lib/auth";
import { backendEnabled } from "../../src/lib/session";

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string; length?: string; demo?: string }>();
  const { phone } = params;
  const OTP_LENGTH = Math.min(6, Math.max(4, Number(params.length) || 4));
  const showDemoHint = params.demo === "1";
  const [otp, setOtp] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputs = useRef<(React.ComponentRef<typeof TextInput> | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);

  const clearBoxes = () => {
    setOtp(Array(OTP_LENGTH).fill(""));
    inputs.current[0]?.focus();
  };

  const verify = async (code: string) => {
    if (busy) return;
    if (!backendEnabled) {
      if (code !== DEMO_OTP) {
        setError("That code is not right. Try again.");
        clearBoxes();
        return;
      }
      setError(null);
      login(phone ?? "98765 43210");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone ?? "", code);
      // The route guard in the root layout moves a signed in user to the app
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify the code. Try again.");
      clearBoxes();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      if (backendEnabled) await requestOtp(phone ?? "");
      setCountdown(30);
      clearBoxes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send a new code.");
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    setError(null);
    const next = applyOtpInput(otp, value, index);
    setOtp(next.digits);
    if (next.complete) verify(next.digits.join(""));
    else inputs.current[next.focusIndex]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  };

  const isComplete = otp.every((d) => d !== "");

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Yellow icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="phone-portrait-outline" size={36} color={Colors.brandText} />
        </View>

        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          We've sent a {OTP_LENGTH}-digit code to{"\n"}
          <Text style={styles.phoneText}>+91 {phone}</Text>
        </Text>

        {/* OTP inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                inputs.current[i] = ref;
              }}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null, noWebOutline]}
              value={digit}
              onChangeText={(v) => handleOtpChange(v.slice(-1), i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={i === 0 ? OTP_LENGTH : 1}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              textAlign="center"
              autoFocus={i === 0}
            />
          ))}
        </View>

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>
              Resend OTP in <Text style={styles.countdownValue}>{countdown}s</Text>
            </Text>
          ) : (
            <Pressable onPress={resend}>
              <Text style={styles.resendText}>Resend OTP</Text>
            </Pressable>
          )}
        </View>

        {error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {showDemoHint ? (
          <Text style={styles.demoHint}>Demo mode: the code is {DEMO_OTP}.</Text>
        ) : null}

        {/* Verify button */}
        <Pressable
          style={[styles.verifyBtn, !isComplete && styles.verifyBtnDisabled]}
          onPress={() => {
            if (isComplete) verify(otp.join(""));
          }}
        >
          <Text style={[styles.verifyBtnText, !isComplete && styles.verifyBtnTextDisabled]}>
            {busy ? "Verifying..." : "Verify & Continue"}
          </Text>
        </Pressable>

        <Text style={styles.helpText}>
          Didn't receive the OTP? Check your spam or <Text style={styles.helpLink}>call us</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  errorText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.danger,
    textAlign: "center",
    marginBottom: Spacing[8],
  },
  demoHint: {
    fontSize: FontSize.caption,
    color: Colors.textTertiary,
    textAlign: "center",
    marginBottom: Spacing[12],
  },
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing[4],
    alignSelf: "flex-start",
  },
  backBtnText: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing[24],
    paddingTop: Spacing[48] ?? 48,
    gap: Spacing[16],
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing[8],
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  phoneText: {
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  // OTP inputs
  otpRow: {
    flexDirection: "row",
    gap: Spacing[12],
    marginTop: Spacing[8],
  },
  otpInput: {
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
    backgroundColor: Colors.canvas,
  },
  otpInputFilled: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.greenTint,
  },

  // Resend
  resendRow: {
    alignItems: "center",
  },
  countdownText: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  countdownValue: {
    fontWeight: "700",
    color: Colors.brandText,
  },
  resendText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.brandText,
  },

  // Verify button
  verifyBtn: {
    width: "100%",
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyBtnDisabled: {
    backgroundColor: Colors.disabledBg,
  },
  verifyBtnText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },
  verifyBtnTextDisabled: {
    color: Colors.disabledText,
  },

  // Help text
  helpText: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  helpLink: {
    color: Colors.offerBlue,
    fontWeight: "600",
  },
});
