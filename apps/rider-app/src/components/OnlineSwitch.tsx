import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, typography, USE_NATIVE_DRIVER } from "../theme";

type Props = {
  online: boolean;
  onToggle: () => void;
  busy?: boolean;
  disabled?: boolean;
};

const WIDTH = 132;
const KNOB = 36;
const PAD = 4;

/** The duty switch in the header: big, labelled, and impossible to misread in sunlight. */
export function OnlineSwitch({ online, onToggle, busy, disabled }: Props) {
  const x = useRef(new Animated.Value(online ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(x, {
      toValue: online ? 1 : 0,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [online, x]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [0, WIDTH - KNOB - PAD * 2],
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        onToggle();
      }}
      disabled={disabled || busy}
      accessibilityRole="switch"
      accessibilityState={{ checked: online, disabled: !!(disabled || busy), busy: !!busy }}
      accessibilityLabel={
        online ? "On duty. Double tap to go offline" : "Off duty. Double tap to go online"
      }
      hitSlop={8}
      style={({ pressed }) => [
        styles.track,
        online ? styles.trackOn : styles.trackOff,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, online ? styles.labelOn : styles.labelOff]}>
        {online ? "ON DUTY" : "OFF DUTY"}
      </Text>
      <Animated.View style={[styles.knob, { transform: [{ translateX }] }]}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.ink[700]} />
        ) : (
          <View style={[styles.knobDot, online ? styles.knobDotOn : styles.knobDotOff]} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: KNOB + PAD * 2,
    borderRadius: radius.full,
    justifyContent: "center",
    padding: PAD,
  },
  trackOn: { backgroundColor: colors.brand[600] },
  trackOff: { backgroundColor: colors.night[700] },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.75 },
  label: {
    ...typography.caption,
    fontWeight: "800",
    letterSpacing: 0.8,
    position: "absolute",
  },
  labelOn: { left: 16, color: colors.ink[900] },
  labelOff: { right: 14, color: colors.surface[0] },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  knobDot: { width: 12, height: 12, borderRadius: 6 },
  knobDotOn: { backgroundColor: colors.brand[600] },
  knobDotOff: { backgroundColor: colors.ink[300] },
});
