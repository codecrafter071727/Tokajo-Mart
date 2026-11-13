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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadow, Spacing, typography } from "../../src/theme";
import { noWebOutline } from "../../src/theme/web";
import { requestOtp } from "../../src/lib/auth";
import { backendEnabled } from "../../src/lib/session";
import { products } from "../../src/lib/mockData";
import { ProductImage } from "../../src/components/ProductImage";

/** Product photos for the collage behind the sign in card, in three staggered columns */
const COLLAGE = [
  ["p1", "p9", "p4", "p13"],
  ["p5", "p2", "p17", "p7"],
  ["p3", "p20", "p11", "p6"],
].map((col) => col.map((id) => products.find((p) => p.id === id)).filter(Boolean));

const OFFSETS = [24, -18, 36];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const isValid = /^[6-9]\d{9}$/.test(digits);
  const looksWrong = digits.length === 10 && !isValid;

  const submit = async () => {
    if (!isValid || sending) return;
    setError(null);
    if (!backendEnabled) {
      router.push({ pathname: "/(auth)/otp", params: { phone: digits, length: "4", demo: "1" } });
      return;
    }
    setSending(true);
    try {
      const sent = await requestOtp(digits);
      router.push({
        pathname: "/(auth)/otp",
        params: { phone: digits, length: String(sent.codeLength), demo: sent.demoMode ? "1" : "0" },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Collage of what we sell, fading into the card */}
        <View style={styles.hero}>
          <View style={styles.collage} pointerEvents="none">
            {COLLAGE.map((col, c) => (
              <View key={c} style={[styles.column, { marginTop: OFFSETS[c] }]}>
                {col.map((p) => (
                  <View key={p!.id} style={styles.tile}>
                    <ProductImage
                      imageUrl={p!.imageUrl}
                      fit={p!.imageFit ?? "contain"}
                      emoji={p!.image}
                      emojiSize={36}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.85)", Colors.surface]}
            locations={[0.35, 0.8, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[styles.etaPill, { top: insets.top + Spacing[12] }]}>
            <Ionicons name="flash" size={12} color={Colors.brandBlack} />
            <Text style={styles.etaText}>Delivery in 10 minutes</Text>
          </View>
        </View>

        <View style={[styles.card, { paddingBottom: insets.bottom + Spacing[24] }]}>
          <View style={styles.logo}>
            <Ionicons name="flash" size={26} color={Colors.surface} />
          </View>
          <Text style={styles.title}>India's last minute app</Text>
          <Text style={styles.subtitle}>Log in or sign up</Text>

          <View
            style={[
              styles.phoneField,
              focused && styles.phoneFieldFocused,
              (looksWrong || error) && styles.phoneFieldError,
            ]}
          >
            <Text style={styles.prefix}>+91</Text>
            <View style={styles.prefixDivider} />
            <TextInput
              style={[styles.phoneInput, noWebOutline]}
              value={phone}
              onChangeText={(v) => {
                setError(null);
                setPhone(v.replace(/\D/g, "").slice(0, 10));
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={submit}
              placeholder="Enter mobile number"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              maxLength={10}
              autoFocus
              accessibilityLabel="Mobile number"
            />
            {digits.length > 0 ? (
              <Pressable
                onPress={() => setPhone("")}
                hitSlop={10}
                accessibilityLabel="Clear number"
                style={styles.clear}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </Pressable>
            ) : null}
          </View>

          {looksWrong || error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error ?? "Enter a valid 10 digit Indian mobile number."}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              !isValid && styles.ctaDisabled,
              pressed && isValid && styles.ctaPressed,
            ]}
            onPress={submit}
            disabled={!isValid || sending}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isValid || sending, busy: sending }}
          >
            {sending ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={[styles.ctaText, !isValid && styles.ctaTextDisabled]}>Continue</Text>
            )}
          </Pressable>

          <Text style={styles.terms}>
            By continuing, you agree to our <Text style={styles.termsLink}>Terms of service</Text>{" "}
            and <Text style={styles.termsLink}>Privacy policy</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const TILE = 92;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  hero: {
    height: 330,
    overflow: "hidden",
    backgroundColor: Colors.brandTint,
  },
  collage: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    transform: [{ rotate: "-8deg" }],
    marginTop: -28,
  },
  column: { gap: 12 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    overflow: "hidden",
    ...Shadow.card,
  },
  etaPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    ...Shadow.card,
  },
  etaText: { ...typography.caption, fontWeight: "800", color: Colors.brandBlack },

  card: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing[24],
    marginTop: -56,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing[16],
    ...Shadow.header,
  },
  title: {
    ...typography.titleLg,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing[4],
    marginBottom: Spacing[20],
  },

  phoneField: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[14],
  },
  phoneFieldFocused: { borderColor: Colors.textPrimary },
  phoneFieldError: { borderColor: Colors.danger },
  prefix: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary },
  prefixDivider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing[12],
  },
  phoneInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: Colors.textPrimary,
  },
  clear: { padding: 4 },
  error: {
    alignSelf: "flex-start",
    ...typography.caption,
    color: Colors.danger,
    marginTop: Spacing[8],
  },

  cta: {
    width: "100%",
    height: 52,
    marginTop: Spacing[16],
    borderRadius: Radius.md,
    backgroundColor: Colors.brandGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { backgroundColor: Colors.brandPressed },
  ctaDisabled: { backgroundColor: "#C9D3D1" },
  ctaText: { fontSize: 16, fontWeight: "800", color: Colors.surface },
  ctaTextDisabled: { color: Colors.surface },
  terms: {
    ...typography.caption,
    fontWeight: "400",
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: Spacing[24],
    lineHeight: 18,
  },
  termsLink: { textDecorationLine: "underline", color: Colors.textSecondary },
});
