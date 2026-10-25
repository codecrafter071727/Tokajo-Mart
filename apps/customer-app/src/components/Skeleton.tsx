import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
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

  const AnimatedView = Animated.View as any;

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

export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.image}>
        <Skeleton width={80} height={80} borderRadius={8} />
      </View>
      <View style={styles.info}>
        <Skeleton width="90%" height={12} />
        <View style={{ height: 4 }} />
        <Skeleton width="60%" height={12} />
        <View style={{ height: 8 }} />
        <Skeleton width="40%" height={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 144,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
  },
  image: {
    alignItems: "center",
    marginBottom: 8,
  },
  info: {
    paddingHorizontal: 4,
  },
});
