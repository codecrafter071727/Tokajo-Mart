import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, FontSize, FontWeight } from "../src/theme";

const { width: SCREEN_W } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    emoji: "⚡",
    title: "Delivery in\n10 minutes",
    subtitle:
      'Get groceries, snacks, and daily essentials at your doorstep faster than you can say "hunger".',
    bg: Colors.brandYellow,
    accent: Colors.brandBlack,
  },
  {
    id: "2",
    emoji: "🥦",
    title: "Fresh products,\nevery time",
    subtitle: "Sourced from the best farms and brands. Quality guaranteed or your money back.",
    bg: Colors.greenTint,
    accent: Colors.brandGreen,
  },
  {
    id: "3",
    emoji: "💰",
    title: "Best prices\nin the market",
    subtitle: "Save more with daily deals, coupons, and up to 40% off on 500+ products.",
    bg: "#EEF4FF",
    accent: Colors.offerBlue,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const currentIdx = useRef(0);
  const [activeIdx, setActiveIdx] = React.useState(0);

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    logoOpacity.value = withTiming(1, { duration: 500 });
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handleNext = () => {
    if (activeIdx < SLIDES.length - 1) {
      const next = activeIdx + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIdx(next);
    } else {
      router.replace("/(auth)/login");
    }
  };

  const handleSkip = () => {
    router.replace("/(auth)/login");
  };

  const activeSlide = SLIDES[activeIdx] ?? SLIDES[0];

  return (
    <View style={[styles.root, { backgroundColor: activeSlide.bg }]}>
      {/* Skip button */}
      <Animated.View
        style={[styles.skipWrapper, { paddingTop: insets.top + Spacing[8] }, contentStyle]}
      >
        <Pressable style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </Animated.View>

      {/* Logo */}
      <Animated.View style={[styles.logoSection, logoStyle]}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🛒</Text>
        </View>
        <Text style={styles.appName}>Tokajo Mart</Text>
      </Animated.View>

      {/* Slide carousel */}
      <Animated.View style={[styles.slidesContainer, contentStyle]}>
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Text style={styles.slideEmoji}>{item.emoji}</Text>
              <Text style={[styles.slideTitle, { color: item.accent }]}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          )}
        />
      </Animated.View>

      {/* Dots */}
      <Animated.View style={[styles.dotsRow, contentStyle]}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIdx
                ? [styles.dotActive, { backgroundColor: activeSlide.accent }]
                : styles.dotInactive,
            ]}
          />
        ))}
      </Animated.View>

      {/* CTA */}
      <Animated.View
        style={[styles.ctaWrapper, { paddingBottom: insets.bottom + Spacing[24] }, contentStyle]}
      >
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: activeSlide.accent }]}
          onPress={handleNext}
        >
          <Text style={styles.ctaBtnText}>
            {activeIdx < SLIDES.length - 1 ? "Next  →" : "Get Started"}
          </Text>
        </Pressable>

        {activeIdx === SLIDES.length - 1 && (
          <Pressable style={styles.loginLink} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.loginLinkText}>
              Already have an account?{" "}
              <Text style={[styles.loginLinkAction, { color: activeSlide.accent }]}>Log in</Text>
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
  },
  skipWrapper: {
    position: "absolute",
    top: 0,
    right: Spacing[16],
    zIndex: 10,
  },
  skipBtn: {
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[8],
  },
  skipText: {
    fontSize: FontSize.body,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  // Logo
  logoSection: {
    alignItems: "center",
    marginTop: 100,
    gap: Spacing[12],
    marginBottom: Spacing[32],
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: {
    fontSize: 48,
  },
  appName: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.display,
    color: Colors.brandBlack,
  },

  // Slides
  slidesContainer: {
    flex: 1,
    width: SCREEN_W,
  },
  slide: {
    width: SCREEN_W,
    paddingHorizontal: Spacing[32],
    alignItems: "center",
    gap: Spacing[16],
    paddingTop: Spacing[24],
  },
  slideEmoji: {
    fontSize: 80,
    marginBottom: Spacing[8],
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 32,
  },
  slideSubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing[32],
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
  },
  dotInactive: {
    width: 6,
    backgroundColor: Colors.textTertiary,
    opacity: 0.4,
  },

  // CTA
  ctaWrapper: {
    width: SCREEN_W,
    paddingHorizontal: Spacing[24],
    gap: Spacing[16],
    alignItems: "center",
  },
  ctaBtn: {
    width: "100%",
    height: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnText: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.surface,
  },
  loginLink: {
    paddingVertical: Spacing[4],
  },
  loginLinkText: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  loginLinkAction: {
    fontWeight: "700",
  },
});
