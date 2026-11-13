import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, USE_NATIVE_DRIVER } from "../theme";

/** A calm radar pulse: tells the rider the app is actively looking, without a spinner. */
export function Pulse({
  icon = "bicycle",
  size = 120,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
}) {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const loops = rings.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 900),
          Animated.timing(v, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const core = size * 0.5;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {rings.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            },
          ]}
        />
      ))}
      <View style={[styles.core, { width: core, height: core, borderRadius: core / 2 }]}>
        <Ionicons name={icon} size={core * 0.5} color={colors.ink[900]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: "absolute", backgroundColor: colors.brand[500] },
  core: {
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
  },
});
