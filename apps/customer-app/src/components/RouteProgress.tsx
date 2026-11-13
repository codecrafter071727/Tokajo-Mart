import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { AnimatedView } from "./AnimatedView";
import { Colors, Radius, Spacing, typography } from "../theme";

type Props = {
  /** 0 when the rider is at the store, 1 at the customer's door */
  progress: number;
  /** Headline under the route, for example "On the way" */
  title: string;
  subtitle: string;
  cancelled?: boolean;
};

const ICON = 40;
/** Gap between a stop and the rider when the rider is parked next to it */
const GAP = 6;

/** A simple store to home route with the rider moving along it. No map SDK needed. */
export function RouteProgress({ progress, title, subtitle, cancelled }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    // The rider travels between the two stops, never on top of them
    const range = Math.max(0, trackWidth - 3 * ICON - 2 * GAP);
    x.value = withTiming(ICON + GAP + progress * range, { duration: 900 });
  }, [progress, trackWidth, x]);

  const riderStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={styles.card}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100) }}
    >
      <View
        style={styles.routeRow}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View style={[styles.track, { left: ICON / 2, right: ICON / 2 }]} />
        <View
          style={[
            styles.trackFill,
            {
              left: ICON / 2,
              // From the store's centre to the rider's centre
              width: Math.max(
                0,
                ICON / 2 + GAP + fill * Math.max(0, trackWidth - 3 * ICON - 2 * GAP) + ICON / 2,
              ),
            },
          ]}
        />

        <View style={[styles.node, styles.nodeLeft]}>
          <Ionicons name="storefront" size={18} color={Colors.brandText} />
        </View>
        <View style={[styles.node, styles.nodeRight]}>
          <Ionicons
            name="home"
            size={18}
            color={cancelled ? Colors.textTertiary : Colors.brandText}
          />
        </View>

        {!cancelled ? (
          <AnimatedView style={[styles.rider, riderStyle]}>
            <Ionicons name="bicycle" size={22} color={Colors.surface} />
          </AnimatedView>
        ) : null}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brandTint,
    borderRadius: Radius.lg,
    padding: Spacing[16],
    gap: 2,
    alignItems: "center",
  },
  routeRow: {
    width: "100%",
    height: ICON + Spacing[8],
    justifyContent: "center",
    marginBottom: Spacing[12],
  },
  track: {
    position: "absolute",
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.brandPressed,
    opacity: 0.18,
  },
  trackFill: {
    position: "absolute",
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.brandGreen,
  },
  node: {
    position: "absolute",
    width: ICON,
    height: ICON,
    borderRadius: ICON / 2,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.brandGreen,
  },
  nodeLeft: { left: 0 },
  nodeRight: { right: 0 },
  rider: {
    position: "absolute",
    left: 0,
    width: ICON,
    height: ICON,
    borderRadius: ICON / 2,
    backgroundColor: Colors.brandPressed,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.brandBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    ...typography.subtitle,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.caption,
    fontWeight: "400",
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
