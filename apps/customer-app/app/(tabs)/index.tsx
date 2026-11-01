import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import { Colors, Spacing, Radius, typography } from "../../src/theme";
import { colors } from "../../src/theme/tokens";
import { TAB_RESERVE } from "../../src/theme/tabs";
import { SectionRail } from "../../src/components/SectionRail";
import {
  categories,
  banners,
  getFeaturedProducts,
  getProductsByCategory,
  getRecentlyViewedProducts,
} from "../../src/lib/mockData";
import { ProductImage } from "../../src/components/ProductImage";

const BANNER_GAP = Spacing[12];
const CAT_GAP = Spacing[12];
const SECTION_PAD = Spacing[16];

const SEARCH_PLACEHOLDERS = [
  'Search "milk"',
  'Search "bread"',
  'Search "eggs"',
  'Search "atta"',
  'Search "onion"',
];

function getTimeOfDayRail(): { title: string; categoryId: string } {
  const hour = new Date().getHours();
  if (hour < 11) return { title: "Breakfast essentials", categoryId: "dairy" };
  if (hour < 17) return { title: "Afternoon snacks", categoryId: "snacks" };
  return { title: "Late night picks", categoryId: "beverages" };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerRef = useRef<FlatList>(null);
  const isReturningUser = true;

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, []),
  );

  const bannerW = screenW - SECTION_PAD * 2;
  const catCols = screenW < 340 ? 3 : screenW >= 700 ? 5 : 4;
  const catTileW = useMemo(() => {
    const inner = screenW - SECTION_PAD * 2;
    return Math.floor((inner - CAT_GAP * (catCols - 1)) / catCols);
  }, [screenW, catCols]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIdx((prev) => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const buyAgain = getRecentlyViewedProducts();
  const featured = getFeaturedProducts();
  const dairy = getProductsByCategory("dairy");
  const snacks = getProductsByCategory("snacks");
  const beverages = getProductsByCategory("beverages");
  const timeRail = getTimeOfDayRail();
  const timeProducts = getProductsByCategory(timeRail.categoryId);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.brand[700], colors.brand[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + Spacing[8] }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.etaLabelRow}>
              <Ionicons name="flash" size={12} color={colors.accent[500]} />
              <Text style={styles.etaLabel}>Delivery in</Text>
            </View>
            <Text style={styles.etaValue}>9 minutes</Text>
            <Pressable
              style={styles.addressRow}
              hitSlop={6}
              accessibilityLabel="Change delivery address"
            >
              <Text style={styles.addressText} numberOfLines={1}>
                Sector 62, Noida
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.brandTint} />
            </Pressable>
          </View>
          <Pressable
            style={styles.avatarBtn}
            onPress={() => router.push("/(tabs)/account")}
            accessibilityLabel="Account"
          >
            <Ionicons name="person" size={20} color={Colors.brandText} />
          </Pressable>
        </View>

        <Pressable
          style={styles.searchBar}
          onPress={() => router.push("/search")}
          accessibilityLabel="Search products"
        >
          <Ionicons name="search" size={20} color={Colors.brandText} />
          <Text style={styles.searchPlaceholder}>{SEARCH_PLACEHOLDERS[placeholderIdx]}</Text>
          <View style={styles.micWrap}>
            <Ionicons name="mic-outline" size={18} color={Colors.textSecondary} />
          </View>
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_RESERVE + 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isReturningUser ? (
          <SectionRail
            title="Buy again"
            products={buyAgain}
            onSeeAll={() => router.push("/(tabs)/categories")}
          />
        ) : null}

        <View style={styles.bannerSection}>
          <FlatList
            ref={bannerRef}
            data={banners}
            keyExtractor={(b) => b.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={bannerW + BANNER_GAP}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (bannerW + BANNER_GAP));
              setBannerIdx(Math.min(idx, banners.length - 1));
            }}
            contentContainerStyle={{ paddingHorizontal: SECTION_PAD }}
            ItemSeparatorComponent={() => <View style={{ width: BANNER_GAP }} />}
            renderItem={({ item }) => (
              <Pressable style={{ width: bannerW }} accessibilityLabel={item.title}>
                <LinearGradient
                  colors={item.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.banner}
                >
                  <View style={styles.bannerCircleLg} />
                  <View style={styles.bannerCircleSm} />
                  <View style={styles.bannerContent}>
                    <Text style={styles.bannerTitle}>{item.title}</Text>
                    <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                    <View style={styles.bannerCta}>
                      <Text style={styles.bannerCtaText}>{item.cta}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.ink[900]} />
                    </View>
                  </View>
                  <Text style={styles.bannerEmoji}>{item.image}</Text>
                </LinearGradient>
              </Pressable>
            )}
          />
          <View style={styles.dotsRow}>
            {banners.map((_, i) => (
              <View key={i} style={[styles.dot, i === bannerIdx && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by category</Text>
            <Pressable onPress={() => router.push("/(tabs)/categories")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.categoryGrid}>
            {categories.slice(0, catCols * 2).map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.categoryTile, { width: catTileW }]}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/categories",
                    params: { categoryId: cat.id },
                  })
                }
              >
                <View style={[styles.catIconBg, { backgroundColor: cat.color }]}>
                  <ProductImage
                    imageUrl={cat.imageUrl}
                    fit={cat.imageFit}
                    emoji={cat.image}
                    emojiSize={34}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <Text style={styles.catLabel} numberOfLines={2}>
                  {cat.name.replace(/\n/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <SectionRail
          title={timeRail.title}
          products={timeProducts}
          onSeeAll={() =>
            router.push({
              pathname: "/(tabs)/categories",
              params: { categoryId: timeRail.categoryId },
            })
          }
        />

        <SectionRail
          title="Bestsellers"
          products={featured}
          onSeeAll={() => router.push("/(tabs)/categories")}
        />

        <SectionRail
          title="Dairy & breakfast"
          products={dairy}
          onSeeAll={() =>
            router.push({
              pathname: "/(tabs)/categories",
              params: { categoryId: "dairy" },
            })
          }
        />

        <SectionRail
          title="Snacks & munchies"
          products={snacks}
          onSeeAll={() =>
            router.push({
              pathname: "/(tabs)/categories",
              params: { categoryId: "snacks" },
            })
          }
        />

        <SectionRail
          title="Cold drinks & juices"
          products={beverages}
          onSeeAll={() =>
            router.push({
              pathname: "/(tabs)/categories",
              params: { categoryId: "beverages" },
            })
          }
        />

        <View style={styles.footer}>
          <Ionicons name="flash" size={20} color={Colors.border} />
          <Text style={styles.footerBrand}>Delivered in minutes</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    paddingHorizontal: Spacing[16],
    paddingBottom: Spacing[16],
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing[12],
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing[12],
  },
  etaLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  etaLabel: {
    ...typography.caption,
    color: Colors.brandTint,
  },
  etaValue: {
    ...typography.display,
    fontWeight: "800",
    color: Colors.surface,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  addressText: {
    ...typography.bodyStrong,
    color: Colors.brandTint,
    flexShrink: 1,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    height: 48,
    paddingLeft: Spacing[16],
    paddingRight: Spacing[8],
    gap: Spacing[8],
    shadowColor: Colors.brandBlack,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  searchPlaceholder: {
    flex: 1,
    ...typography.body,
    color: Colors.textTertiary,
  },
  micWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: Spacing[20],
  },
  bannerSection: {
    marginBottom: Spacing[20],
  },
  banner: {
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: Spacing[20],
    paddingRight: Spacing[12],
    paddingVertical: Spacing[20],
    minHeight: 132,
    overflow: "hidden",
  },
  bannerCircleLg: {
    position: "absolute",
    right: -30,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  bannerCircleSm: {
    position: "absolute",
    right: 60,
    bottom: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  bannerContent: { flex: 1, alignItems: "flex-start" },
  bannerTitle: {
    ...typography.titleLg,
    fontWeight: "800",
    color: Colors.surface,
  },
  bannerSubtitle: {
    ...typography.caption,
    color: "rgba(255,255,255,0.88)",
    marginTop: Spacing[4],
    marginBottom: Spacing[12],
  },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[12],
    paddingVertical: 6,
  },
  bannerCtaText: {
    ...typography.caption,
    fontWeight: "800",
    color: Colors.accentText,
  },
  bannerEmoji: { fontSize: 64 },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: Spacing[10],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.brandGreen,
    width: 16,
  },
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
    ...typography.title,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  seeAll: {
    ...typography.caption,
    fontWeight: "700",
    color: Colors.brandText,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: CAT_GAP,
    rowGap: Spacing[12],
  },
  categoryTile: {
    alignItems: "center",
  },
  catIconBg: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  catEmoji: { fontSize: 34 },
  catLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing[4],
    width: "100%",
  },
  footer: {
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing[24],
  },
  footerBrand: {
    ...typography.title,
    fontWeight: "800",
    color: Colors.border,
  },
});
