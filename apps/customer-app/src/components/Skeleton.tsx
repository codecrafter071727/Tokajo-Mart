import React from "react";
import { View, StyleSheet } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AnimatedView } from "./AnimatedView";
import { Colors, Radius } from "../theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0.4, { duration: 600 })),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <AnimatedView
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: Colors.disabledBg,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Same footprint as ProductCard so the layout does not jump when data arrives. */
export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton style={{ ...styles.image, height: undefined }} borderRadius={Radius.md} />
      <View style={styles.info}>
        <Skeleton width="45%" height={10} />
        <Skeleton width="95%" height={12} />
        <Skeleton width="70%" height={12} />
        <Skeleton width="40%" height={10} />
        <Skeleton width="35%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: 18,
  },
  info: {
    gap: 6,
  },
});
