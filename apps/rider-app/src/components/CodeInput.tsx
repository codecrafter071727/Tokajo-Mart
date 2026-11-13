import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, space, typography, USE_NATIVE_DRIVER } from "../theme";
import { noWebOutline } from "../theme/web";

type Props = {
  value: string;
  onChange: (value: string) => void;
  length: number;
  /** Shown under the boxes in red; the boxes shake once when it appears */
  error?: string | null;
  accessibilityLabel: string;
  autoFocus?: boolean;
  /** Called once the last digit is typed */
  onComplete?: (value: string) => void;
  size?: "md" | "lg";
};

/**
 * One box per digit, like an OTP field. A single invisible input sits on top, so paste, the
 * number pad and screen readers all work as for a plain text field.
 */
export function CodeInput({
  value,
  onChange,
  length,
  error,
  accessibilityLabel,
  autoFocus,
  onComplete,
  size = "lg",
}: Props) {
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      ),
    ).start();
  }, [error, shake]);

  const boxH = size === "lg" ? 68 : 56;
  const active = Math.min(value.length, length - 1);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <Animated.View style={[styles.row, { transform: [{ translateX: shake }] }]}>
          {Array.from({ length }, (_, i) => {
            const digit = value[i] ?? "";
            const focused = i === active && value.length < length;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  { height: boxH },
                  digit ? styles.boxFilled : null,
                  focused ? styles.boxFocused : null,
                  error ? styles.boxError : null,
                ]}
              >
                <Text style={[styles.digit, size === "md" && styles.digitMd]}>{digit}</Text>
              </View>
            );
          })}
        </Animated.View>
        <TextInput
          ref={input}
          value={value}
          onChangeText={(v) => {
            const next = v.replace(/\D/g, "").slice(0, length);
            onChange(next);
            if (next.length === length && value.length !== length) onComplete?.(next);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          autoFocus={autoFocus}
          caretHidden
          accessibilityLabel={accessibilityLabel}
          style={[styles.hidden, noWebOutline]}
        />
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: { flexDirection: "row", gap: space[2], justifyContent: "center" },
  box: {
    flex: 1,
    maxWidth: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line[300],
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: { backgroundColor: colors.surface[0], borderColor: colors.ink[700] },
  boxFocused: { borderColor: colors.brand[600], backgroundColor: colors.surface[0] },
  boxError: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  digit: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.ink[900],
    fontVariant: ["tabular-nums"],
  },
  digitMd: { fontSize: 24, lineHeight: 30 },
  hidden: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
    color: "transparent",
    fontSize: 1,
  },
  error: { ...typography.bodyStrong, color: colors.danger },
});
