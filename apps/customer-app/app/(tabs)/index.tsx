import React, { useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import { Colors, Spacing, Radius, typography } from "../../src/theme";
import { colors } from "../../src/theme/tokens";
import { TAB_RESERVE } from "../../src/theme/tabs";
import { SectionRail } from "../../src/components/SectionRail";
import { useCategories, useProducts, useServiceability } from "../../src/lib/queries";
import { addressChip } from "../../src/lib/addresses";
import { useSelectedAddress } from "../../src/store/addresses";
import { ErrorState, RailSkeleton } from "../../src/components/StateViews";
import { Skeleton } from "../../src/components/Skeleton";
import { ProductImage } from "../../src/components/ProductImage";
import { HomeBanners } from "../../src/components/HomeBanners";

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
  // The header shrinks to the search bar once the page is scrolled (hysteresis avoids flicker)
  const [compact, setCompact] = useState(false);
  const isReturningUser = true;

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, []),
  );

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

  // One catalog read feeds every rail. A gateway "home" endpoint replaces this later.
  const selectedAddress = useSelectedAddress();
  const serviceability = useServiceability();
  const eta = serviceability.data;
  const categoriesQuery = useCategories();
  const productsQuery = useProducts({ limit: 100 });
  const categories = categoriesQuery.data ?? [];
  const all = productsQuery.data ?? [];

  const inCategory = (categoryId: string) => all.filter((p) => p.categoryId === categoryId);
  // Personalisation stub until order history exists: a fixed handful of items
  const buyAgain = [4, 0, 8, 12, 1].flatMap((i) => (all[i] ? [all[i]] : []));
  const featured = all.slice(0, 8);
  const dairy = inCategory("dairy");
  const snacks = inCategory("snacks");
  const beverages = inCategory("beverages");
  const timeRail = getTimeOfDayRail();
  const timeProducts = inCategory(timeRail.categoryId);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.brand[700], colors.brand[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + Spacing[8] }]}
      >
        {compact ? (
          <View style={styles.compactRow}>
            <View
              style={styles.etaChip}
              accessibilityLabel={`Delivery in ${eta?.etaMins ?? "--"} minutes`}
            >
              <Ionicons name="flash" size={13} color={colors.accent[500]} />
              <Text style={styles.etaChipText}>
                {eta?.serviceable ? `${eta.etaMins} min` : "--"}
              </Text>
            </View>
            <Pressable
              style={[styles.searchBar, styles.searchBarCompact]}
              onPress={() => router.push("/search")}
              accessibilityLabel="Search products"
            >
              <Ionicons name="search" size={18} color={Colors.brandText} />
              <Text style={styles.searchPlaceholder} numberOfLines={1}>
                {SEARCH_PLACEHOLDERS[placeholderIdx]}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.avatarBtn, styles.avatarBtnSmall]}
              onPress={() => router.push("/account")}
              accessibilityLabel="Account"
            >
              <Ionicons name="person" size={18} color={Colors.brandText} />
            </Pressable>
          </View>
        ) : null}
        {!compact ? (
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.etaLabelRow}>
                  <Ionicons name="flash" size={12} color={colors.accent[500]} />
                  <Text style={styles.etaLabel}>Delivery in</Text>
                </View>
                {serviceability.isPending ? (
                  <Skeleton width={150} height={34} borderRadius={Radius.sm} />
                ) : serviceability.isError ? (
                  <Text style={styles.etaValue}>-- mins</Text>
                ) : eta?.serviceable ? (
                  <Text style={styles.etaValue}>{eta.etaMins} minutes</Text>
                ) : (
                  <Text style={styles.etaValue}>Not available</Text>
                )}
                <Pressable
                  style={styles.addressRow}
                  hitSlop={6}
                  accessibilityLabel="Change delivery address"
                  onPress={() => router.push("/addresses")}
                >
                  <Text style={styles.addressText} numberOfLines={1}>
                    {eta && !eta.serviceable
                      ? "We do not deliver to this area yet"
                      : addressChip(selectedAddress)}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.brandTint} />
                </Pressable>
              </View>
              <Pressable
                style={styles.avatarBtn}
                onPress={() => router.push("/account")}
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
          </>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_RESERVE + 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setCompact((was) => (was ? y > 20 : y > 90));
        }}
      >
        {isReturningUser ? (
          <SectionRail
            title="Buy again"
            products={buyAgain}
            loading={productsQuery.isPending}
            onSeeAll={() => router.push("/(tabs)/categories")}
          />
        ) : null}

        <HomeBanners etaMins={eta?.serviceable ? eta.etaMins : null} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by category</Text>
            <Pressable onPress={() => router.push("/(tabs)/categories")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {categoriesQuery.isError ? (
            <ErrorState
              compact
              error={categoriesQuery.error}
              title="Could not load categories"
              onRetry={() => void categoriesQuery.refetch()}
            />
          ) : null}
          <View style={styles.categoryGrid}>
            {categoriesQuery.isPending
              ? Array.from({ length: catCols * 2 }, (_, i) => (
                  <View key={i} style={[styles.categoryTile, { width: catTileW }]}>
                    <Skeleton
                      style={{ width: "100%", aspectRatio: 1, height: undefined }}
                      borderRadius={Radius.lg}
                    />
                  </View>
                ))
              : null}
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

        {productsQuery.isPending ? (
          <>
            <RailSkeleton />
            <RailSkeleton />
            <RailSkeleton />
          </>
        ) : productsQuery.isError ? (
          <ErrorState
            error={productsQuery.error}
            title="Could not load products"
            onRetry={() => void productsQuery.refetch()}
          />
        ) : (
          <>
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
          </>
        )}

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
  compactRow: { flexDirection: "row", alignItems: "center", gap: Spacing[8] },
  etaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[10],
    height: 40,
  },
  etaChipText: { ...typography.bodyStrong, fontWeight: "800", color: Colors.surface },
  searchBarCompact: { flex: 1, height: 40 },
  avatarBtnSmall: { width: 36, height: 36, borderRadius: 18 },
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
