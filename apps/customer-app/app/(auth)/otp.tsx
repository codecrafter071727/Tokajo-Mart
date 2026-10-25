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

const OTP_LENGTH = 4;

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [countdown, setCountdown] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
    // Auto-verify when all filled
    if (newOtp.every((d) => d !== "") && newOtp.join("").length === OTP_LENGTH) {
      setTimeout(() => router.replace("/(tabs)"), 500);
    }
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
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Yellow icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>📱</Text>
        </View>

        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          We've sent a 4-digit OTP to{"\n"}
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
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              value={digit}
              onChangeText={(v) => handleOtpChange(v.slice(-1), i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
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
            <Pressable onPress={() => setCountdown(30)}>
              <Text style={styles.resendText}>Resend OTP</Text>
            </Pressable>
          )}
        </View>

        {/* Verify button */}
        <Pressable
          style={[styles.verifyBtn, !isComplete && styles.verifyBtnDisabled]}
          onPress={() => {
            if (isComplete) router.replace("/(tabs)");
          }}
        >
          <Text style={[styles.verifyBtnText, !isComplete && styles.verifyBtnTextDisabled]}>
            Verify &amp; Continue
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
    backgroundColor: Colors.brandYellow,
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
    color: Colors.brandGreen,
  },
  resendText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.brandGreen,
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
