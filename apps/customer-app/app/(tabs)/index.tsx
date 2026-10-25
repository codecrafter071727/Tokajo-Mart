import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { SectionRail } from "../../src/components/SectionRail";
import {
  categories,
  products,
  banners,
  getFeaturedProducts,
  getProductsByCategory,
} from "../../src/lib/mockData";

const { width: SCREEN_W } = Dimensions.get("window");
const BANNER_W = SCREEN_W - Spacing[16] * 2;

const SEARCH_PLACEHOLDERS = ['Search "milk"', 'Search "onion"', 'Search "bread"', 'Search "cola"'];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [bannerIdx, setBannerIdx] = useState(0);
  const scrollY = useSharedValue(0);

  // Cycle through search placeholders
  React.useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const headerAnimStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(scrollY.value, [0, 60], [0, 0.1]),
  }));

  const featuredProducts = getFeaturedProducts();
  const dairyProducts = getProductsByCategory("dairy");
  const snackProducts = getProductsByCategory("snacks");
  const beverageProducts = getProductsByCategory("beverages");

  return (
    <View style={styles.root}>
      {/* Yellow header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top }, headerAnimStyle]}>
        {/* Row 1: delivery + address + avatar */}
        <View style={styles.headerRow1}>
          <View style={styles.headerLeft}>
            <Text style={styles.deliveryHeadline}>Delivery in 10 minutes</Text>
            <Pressable style={styles.addressRow}>
              <Text style={styles.addressText} numberOfLines={1}>
                📍 Home — 123, MG Road, Bengaluru
              </Text>
              <Text style={styles.addressChevron}>›</Text>
            </Pressable>
          </View>
          <Pressable style={styles.avatarBtn} onPress={() => router.push("/(tabs)/account")}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </Pressable>
        </View>

        {/* Row 2: search bar */}
        <Pressable style={styles.searchBar} onPress={() => router.push("/search")}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{SEARCH_PLACEHOLDERS[placeholderIdx]}</Text>
          <Text style={styles.micIcon}>🎙️</Text>
        </Pressable>
      </Animated.View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + insets.bottom }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Banners carousel */}
        <View style={styles.bannerSection}>
          <FlatList
            data={banners}
            keyExtractor={(b) => b.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_W);
              setBannerIdx(idx);
            }}
            ItemSeparatorComponent={() => <View style={{ width: Spacing[12] }} />}
            contentContainerStyle={{ paddingHorizontal: Spacing[16] }}
            renderItem={({ item }) => (
              <Pressable style={[styles.banner, { backgroundColor: item.color }]}>
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>{item.title}</Text>
                  <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                  <View style={styles.bannerCta}>
                    <Text style={styles.bannerCtaText}>Order now</Text>
                  </View>
                </View>
                <Text style={styles.bannerEmoji}>{item.image}</Text>
              </Pressable>
            )}
          />
          {/* Dots */}
          <View style={styles.dotsRow}>
            {banners.map((_, i) => (
              <View key={i} style={[styles.dot, i === bannerIdx && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Categories grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by category</Text>
            <Pressable onPress={() => router.push("/(tabs)/categories")}>
              <Text style={styles.seeAll}>see all</Text>
            </Pressable>
          </View>
          <View style={styles.categoryGrid}>
            {categories.slice(0, 8).map((cat) => (
              <Pressable
                key={cat.id}
                style={styles.categoryTile}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/categories",
                    params: { categoryId: cat.id },
                  })
                }
              >
                <View style={[styles.catIconBg, { backgroundColor: cat.color }]}>
                  <Text style={styles.catEmoji}>{cat.image}</Text>
                </View>
                <Text style={styles.catLabel}>{cat.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Free delivery nudge */}
        <View style={styles.nudge}>
          <Text style={styles.nudgeText}>🚚 Free delivery on all orders above ₹99</Text>
        </View>

        {/* Product rails */}
        <SectionRail
          title="Best sellers"
          products={featuredProducts}
          onSeeAll={() => router.push("/(tabs)/categories")}
        />

        <SectionRail
          title="Dairy & Breakfast"
          products={dairyProducts}
          onSeeAll={() =>
            router.push({
              pathname: "/(tabs)/categories",
              params: { categoryId: "dairy" },
            })
          }
        />

        {/* Offer strip */}
        <View style={styles.offerStrip}>
          <Text style={styles.offerText}>🎉 Up to 30% off on snacks &amp; beverages</Text>
        </View>

        <SectionRail
          title="Snacks & Munchies"
          products={snackProducts}
          onSeeAll={() =>
            router.push({
              pathname: "/(tabs)/categories",
              params: { categoryId: "snacks" },
            })
          }
        />

        <SectionRail
          title="Cold Drinks & Juices"
          products={beverageProducts}
          onSeeAll={() =>
            router.push({
              pathname: "/(tabs)/categories",
              params: { categoryId: "beverages" },
            })
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },

  // Header
  header: {
    backgroundColor: Colors.brandYellow,
    paddingHorizontal: Spacing[16],
    paddingBottom: Spacing[12],
    zIndex: 10,
  },
  headerRow1: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing[12],
    marginTop: Spacing[8],
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing[12],
  },
  deliveryHeadline: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.brandBlack,
    lineHeight: 24,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  addressText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.caption,
    color: Colors.brandBlack,
    opacity: 0.75,
    flex: 1,
  },
  addressChevron: {
    fontSize: 16,
    color: Colors.brandBlack,
    marginLeft: 2,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 20,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    height: 46,
    paddingHorizontal: Spacing[12],
    gap: Spacing[8],
    ...Shadow.card,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.body,
    color: Colors.textTertiary,
  },
  micIcon: {
    fontSize: 18,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing[16],
    gap: 0,
  },

  // Banners
  bannerSection: {
    marginBottom: Spacing[20],
  },
  banner: {
    width: BANNER_W,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[20],
    paddingVertical: Spacing[20],
    minHeight: 130,
    overflow: "hidden",
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.brandBlack,
    lineHeight: 24,
    marginBottom: Spacing[4],
  },
  bannerSubtitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing[12],
  },
  bannerCta: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[8],
    alignSelf: "flex-start",
  },
  bannerCtaText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.surface,
  },
  bannerEmoji: {
    fontSize: 60,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: Spacing[10] ?? 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
  },
  dotActive: {
    backgroundColor: Colors.brandGreen,
    width: 18,
  },

  // Section
  section: {
    paddingHorizontal: Spacing[16],
    marginBottom: Spacing[20],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing[12],
  },
  sectionTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  seeAll: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.h2,
    color: Colors.brandGreen,
  },

  // Category grid
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing[8],
  },
  categoryTile: {
    width: "22%",
    alignItems: "center",
    gap: Spacing[4],
  },
  catIconBg: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  catEmoji: {
    fontSize: 32,
  },
  catLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
    lineHeight: 13,
  },

  // Nudge strip
  nudge: {
    marginHorizontal: Spacing[16],
    marginBottom: Spacing[20],
    backgroundColor: Colors.yellowTint,
    borderRadius: Radius.sm,
    padding: Spacing[12],
  },
  nudgeText: {
    fontSize: FontSize.caption,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // Offer strip
  offerStrip: {
    marginHorizontal: Spacing[16],
    marginBottom: Spacing[20],
    backgroundColor: Colors.greenTint,
    borderRadius: Radius.sm,
    padding: Spacing[12],
  },
  offerText: {
    fontSize: FontSize.caption,
    fontWeight: "600",
    color: Colors.brandGreen,
  },
});
