import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AnimatedView } from "./AnimatedView";
import { Colors, Radius } from "../theme";

export type CodeInputHandle = { focus: () => void; clear: () => void };

type Props = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are in */
  onComplete?: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
};

/**
 * One real input behind a row of boxes. Typing, pasting and SMS autofill all land in the same
 * field, so fast typing never drops a digit and backspace always works.
 */
export const CodeInput = forwardRef<CodeInputHandle, Props>(function CodeInput(
  { length, value, onChange, onComplete, error, disabled },
  ref,
) {
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(true);

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    clear: () => {
      onChange("");
      input.current?.focus();
    },
  }));

  const caret = useSharedValue(1);
  useEffect(() => {
    caret.value = withRepeat(
      withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })),
      -1,
    );
  }, [caret]);
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  const shake = useSharedValue(0);
  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [error, shake]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const handle = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  const active = Math.min(value.length, length - 1);

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessibilityLabel={`Enter the ${length} digit code`}
    >
      <AnimatedView style={[styles.row, rowStyle]}>
        {Array.from({ length }, (_, i) => {
          const digit = value[i] ?? "";
          const isActive = focused && !disabled && i === active && value.length < length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                length > 4 && styles.boxSmall,
                digit ? styles.boxFilled : null,
                isActive ? styles.boxActive : null,
                error ? styles.boxError : null,
              ]}
            >
              {digit ? (
                <Text style={[styles.digit, length > 4 && styles.digitSmall]}>{digit}</Text>
              ) : isActive ? (
                <AnimatedView style={[styles.caret, caretStyle]} />
              ) : null}
            </View>
          );
        })}
      </AnimatedView>
      <TextInput
        ref={input}
        value={value}
        onChangeText={handle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
        maxLength={length}
        autoFocus
        caretHidden
        style={styles.hidden}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, justifyContent: "center" },
  box: {
    width: 56,
    height: 60,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  boxSmall: { width: 46, height: 54 },
  boxFilled: { backgroundColor: Colors.surface, borderColor: Colors.textTertiary },
  boxActive: { borderColor: Colors.brandGreen, backgroundColor: Colors.surface, borderWidth: 2 },
  boxError: { borderColor: Colors.danger, backgroundColor: "#FDF1F1" },
  digit: { fontSize: 24, fontWeight: "800", color: Colors.textPrimary },
  digitSmall: { fontSize: 22 },
  caret: { width: 2, height: 24, borderRadius: 1, backgroundColor: Colors.brandGreen },
  // Covers the boxes so a tap or a long press to paste reaches the real field
  hidden: {
    ...StyleSheet.absoluteFill,
    opacity: 0.011,
    color: "transparent",
    fontSize: 1,
  },
});
