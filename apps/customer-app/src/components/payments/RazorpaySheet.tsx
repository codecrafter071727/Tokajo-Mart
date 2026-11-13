import React, { useRef } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { CheckoutResponse } from "@qc/contracts";
import { Colors, Spacing, typography } from "../../theme";
import { checkoutHtml, parseWebViewMessage, type CheckoutResult } from "../../lib/payments";

type Props = {
  /** The sheet shows while this is set */
  checkout: CheckoutResponse | null;
  onResult: (result: CheckoutResult) => void;
};

/**
 * Razorpay Checkout on the phone: a full screen WebView that loads checkout.js from Razorpay and
 * reports the outcome back. Works in Expo Go. Only the public key id is in the page.
 */
export function RazorpaySheet({ checkout, onResult }: Props) {
  const insets = useSafeAreaInsets();
  // A result is reported once, even if the page also fires dismiss after success
  const done = useRef(false);
  if (!checkout) done.current = false;

  const report = (result: CheckoutResult) => {
    if (done.current) return;
    done.current = true;
    onResult(result);
  };

  return (
    <Modal
      visible={checkout !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => report({ kind: "dismissed" })}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => report({ kind: "dismissed" })}
            hitSlop={10}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close payment"
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </Pressable>
          <View style={styles.titleRow}>
            <Ionicons name="lock-closed" size={14} color={Colors.brandText} />
            <Text style={styles.title}>Secure payment</Text>
          </View>
          <View style={styles.close} />
        </View>
        {checkout ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html: checkoutHtml(checkout), baseUrl: "https://checkout.razorpay.com" }}
            onMessage={(event) => {
              const result = parseWebViewMessage(event.nativeEvent.data);
              if (result) report(result);
            }}
            onError={() =>
              report({
                kind: "failed",
                description: "Could not load the payment page. Check your connection.",
              })
            }
            javaScriptEnabled
            domStorageEnabled
            // UPI apps open through intent links; let the system handle them
            setSupportMultipleWindows={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={Colors.brandText} />
              </View>
            )}
            style={styles.web}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[8],
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { ...typography.bodyStrong, color: Colors.textPrimary },
  web: { flex: 1 },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
