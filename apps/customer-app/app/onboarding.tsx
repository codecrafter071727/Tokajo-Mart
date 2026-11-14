import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, FontSize, FontWeight } from "../src/theme";
import { AnimatedView } from "../src/components/AnimatedView";
import { useAuthStore } from "../src/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { products } from "../src/lib/mockData";
import { BrandLogo } from "../src/components/BrandLogo";
import { ProductImage } from "../src/components/ProductImage";

const { width: SCREEN_W } = Dimensions.get("window");

/** Positions of the three overlapping product photos in the hero */
const CLUSTER = [
  { left: 0, top: 38 },
  { left: 78, top: 0 },
  { left: 156, top: 38 },
] as const;

const photo = (id: string) => products.find((p) => p.id === id)?.imageUrl;

const SLIDES = [
  {
    id: "1",
    emoji: "⚡",
    photos: [photo("p5"), photo("p1"), photo("p9")],
    title: "Delivery in\n10 minutes",
    subtitle:
      'Get groceries, snacks, and daily essentials at your doorstep faster than you can say "hunger".',
    bg: Colors.brandTint,
    accent: Colors.brandText,
  },
  {
    id: "2",
    emoji: "🥦",
    photos: [photo("p2"), photo("p4"), photo("p3")],
    title: "Fresh products,\nevery time",
    subtitle: "Sourced from the best farms and brands. Quality guaranteed or your money back.",
    bg: Colors.greenTint,
    accent: Colors.brandText,
  },
  {
    id: "3",
    emoji: "💰",
    photos: [photo("p17"), photo("p13"), photo("p20")],
    title: "Best prices\nin the market",
    subtitle: "Save more with daily deals, coupons, and up to 40% off on 500+ products.",
    bg: Colors.yellowTint,
    accent: Colors.accentText,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const flatListRef = useRef<FlatList>(null);
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
      completeOnboarding();
      router.replace("/(auth)/login");
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    router.replace("/(auth)/login");
  };

  const activeSlide = (SLIDES[activeIdx] ?? SLIDES[0])!;
  const ctaOnGreen = activeSlide.accent === Colors.brandText;

  return (
    <View style={[styles.root, { backgroundColor: activeSlide.bg }]}>
      {/* Skip button */}
      <AnimatedView
        style={[styles.skipWrapper, { paddingTop: insets.top + Spacing[8] }, contentStyle]}
      >
        <Pressable style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </AnimatedView>

      {/* Logo */}
      <AnimatedView style={[styles.logoSection, logoStyle]}>
        <BrandLogo size={72} />
        <Text style={styles.appName}>Milcki</Text>
      </AnimatedView>

      {/* Slide carousel */}
      <AnimatedView style={[styles.slidesContainer, contentStyle]}>
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
              <View style={styles.photoCluster}>
                {item.photos.map((uri: string | undefined, i: number) => (
                  <View key={i} style={[styles.clusterPhoto, CLUSTER[i]]}>
                    <ProductImage
                      imageUrl={uri}
                      fit="cover"
                      emoji={item.emoji}
                      emojiSize={40}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                ))}
              </View>
              <Text style={[styles.slideTitle, { color: item.accent }]}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          )}
        />
      </AnimatedView>

      {/* Dots */}
      <AnimatedView style={[styles.dotsRow, contentStyle]}>
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
      </AnimatedView>

      {/* CTA: green slides get the brand green with dark text (white on green fails contrast) */}
      <AnimatedView
        style={[styles.ctaWrapper, { paddingBottom: insets.bottom + Spacing[24] }, contentStyle]}
      >
        <Pressable
          style={[
            styles.ctaBtn,
            { backgroundColor: ctaOnGreen ? Colors.brandGreen : activeSlide.accent },
          ]}
          onPress={handleNext}
        >
          <Text style={[styles.ctaBtnText, ctaOnGreen && { color: Colors.onBrand }]}>
            {activeIdx < SLIDES.length - 1 ? "Next" : "Get started"}
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
      </AnimatedView>
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
    backgroundColor: Colors.surface,
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
  photoCluster: { width: 252, height: 150, marginBottom: Spacing[8] },
  clusterPhoto: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: Colors.surface,
    backgroundColor: Colors.surface,
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
