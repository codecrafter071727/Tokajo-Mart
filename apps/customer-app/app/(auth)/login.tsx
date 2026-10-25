import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState("");

  const isValid = phone.replace(/\s/g, "").length === 10;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Yellow header section */}
      <View style={[styles.heroSection, { paddingTop: insets.top + Spacing[24] }]}>
        <Text style={styles.logoText}>🛒</Text>
        <Text style={styles.appName}>Tokajo Mart</Text>
        <Text style={styles.tagline}>Delivery in 10 minutes</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.formContainer,
          { paddingBottom: insets.bottom + Spacing[24] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.formTitle}>India's last minute app</Text>
        <Text style={styles.formSubtitle}>Log in or sign up with your phone number</Text>

        {/* Phone input */}
        <View style={styles.phoneInputWrapper}>
          <View style={styles.countryCode}>
            <Text style={styles.countryFlag}>🇮🇳</Text>
            <Text style={styles.countryCodeText}>+91</Text>
            <Text style={styles.countryChevron}>›</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter mobile number"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
            maxLength={10}
            autoFocus
          />
        </View>

        {/* OTP note */}
        <Text style={styles.otpNote}>A 4-digit OTP will be sent to this number</Text>

        {/* Continue button */}
        <Pressable
          style={[styles.continueBtn, !isValid && styles.continueBtnDisabled]}
          onPress={() => {
            if (isValid) {
              router.push({ pathname: "/(auth)/otp", params: { phone } });
            }
          }}
        >
          <Text style={[styles.continueBtnText, !isValid && styles.continueBtnTextDisabled]}>
            Continue
          </Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google sign in */}
        <Pressable style={styles.googleBtn}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>

        {/* Terms */}
        <Text style={styles.termsText}>
          By continuing, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  heroSection: {
    backgroundColor: Colors.brandYellow,
    alignItems: "center",
    paddingBottom: Spacing[32] ?? 32,
    paddingHorizontal: Spacing[24],
  },
  logoText: {
    fontSize: 64,
    marginBottom: Spacing[8],
  },
  appName: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.display,
    color: Colors.brandBlack,
  },
  tagline: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.body,
    color: Colors.brandBlack,
    opacity: 0.7,
    marginTop: Spacing[4],
  },
  formContainer: {
    padding: Spacing[24],
    gap: Spacing[16],
  },
  formTitle: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing[4],
  },
  formSubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: Spacing[8],
  },

  // Phone input
  phoneInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.md,
    height: 54,
    overflow: "hidden",
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[12],
    gap: Spacing[4],
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    height: "100%",
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  countryChevron: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing[12],
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    height: "100%",
  },

  otpNote: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: -Spacing[8],
  },

  // Buttons
  continueBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[8],
  },
  continueBtnDisabled: {
    backgroundColor: Colors.disabledBg,
  },
  continueBtnText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },
  continueBtnTextDisabled: {
    color: Colors.disabledText,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.caption,
    color: Colors.textTertiary,
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    height: 52,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4285F4",
  },
  googleText: {
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  termsText: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.offerBlue,
    fontWeight: "600",
  },
});
