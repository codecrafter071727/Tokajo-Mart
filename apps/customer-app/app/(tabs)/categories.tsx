import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { ProductCard } from "../../src/components/ProductCard";
import { categories, getFeaturedProducts, getProductsByCategory } from "../../src/lib/mockData";

const SUBCAT_CHIPS = ["All", "Popular", "Value Packs", "Best Deals"];

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const [activeCategory, setActiveCategory] = useState<string>(
    params.categoryId ?? categories[0]?.id ?? "fruits",
  );
  const [activeSubcat, setActiveSubcat] = useState("All");

  useEffect(() => {
    if (params.categoryId) setActiveCategory(params.categoryId);
  }, [params.categoryId]);

  const matched = getProductsByCategory(activeCategory);
  const products = matched.length > 0 ? matched : getFeaturedProducts();
  const activeCat = categories.find((c) => c.id === activeCategory) ??
    categories[0] ?? { id: "fruits", name: "Fruits", image: "🥦", color: "#E8F5E9" };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Brand Header ───────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.deliveryInfo}>
            <View style={styles.deliveryBadge}>
              <Text style={styles.boltIcon}>⚡</Text>
              <Text style={styles.deliveryTitle}>Delivery in 10 minutes</Text>
            </View>
            <Pressable style={styles.addressRow}>
              <Text style={styles.addressText} numberOfLines={1}>
                Home — 123, MG Road, Bengaluru
              </Text>
              <Text style={styles.chevron}>⌄</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick search shortcut */}
        <Pressable style={styles.searchBar} onPress={() => router.push("/search")}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>
            Search in {activeCat.name.replace("\n", " ")}...
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {/* ── Left: Category sidebar ─────────────────── */}
        <ScrollView
          style={styles.sidebar}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarContent}
        >
          {categories.map((cat) => {
            const count = getProductsByCategory(cat.id).length;
            const isActive = activeCategory === cat.id;

            return (
              <Pressable
                key={cat.id}
                style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                onPress={() => {
                  setActiveCategory(cat.id);
                  setActiveSubcat("All");
                }}
              >
                <View
                  style={[
                    styles.sidebarIconBg,
                    { backgroundColor: cat.color },
                    isActive && styles.sidebarIconBgActive,
                  ]}
                >
                  <Text style={styles.sidebarEmoji}>{cat.image}</Text>
                </View>
                <Text
                  style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}
                  numberOfLines={2}
                >
                  {cat.name}
                </Text>
                <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                  <Text style={[styles.countText, isActive && styles.countTextActive]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Right: Subcategory chips & Product grid ── */}
        <View style={styles.grid}>
          {/* Subcategory chips bar */}
          <View style={styles.subcatBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subcatList}
            >
              {SUBCAT_CHIPS.map((chip) => {
                const isSelected = activeSubcat === chip;
                return (
                  <Pressable
                    key={chip}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setActiveSubcat(chip)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {chip}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Product grid — 3 columns */}
          <FlatList
            data={products}
            keyExtractor={(p) => p.id}
            numColumns={3}
            key="3col"
            columnWrapperStyle={styles.columnWrapper}
            ItemSeparatorComponent={() => <View style={{ height: Spacing[6] }} />}
            contentContainerStyle={[styles.gridContent, { paddingBottom: 160 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🛍️</Text>
                <Text style={styles.emptyText}>No products yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.gridCard}>
                <ProductCard product={item} />
              </View>
            )}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  // ── Header ──────────────────────────────────────────
  header: {
    backgroundColor: Colors.brandYellow,
    paddingHorizontal: Spacing[14],
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
    gap: Spacing[8],
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deliveryInfo: {
    gap: 2,
  },
  deliveryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  boltIcon: {
    fontSize: 14,
  },
  deliveryTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h1,
    color: Colors.brandBlack,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  addressText: {
    fontSize: FontSize.caption,
    color: Colors.brandBlack,
    opacity: 0.85,
    maxWidth: 240,
  },
  chevron: {
    fontSize: 12,
    color: Colors.brandBlack,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    height: 40,
    paddingHorizontal: Spacing[10],
    gap: Spacing[8],
    ...Shadow.card,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchPlaceholder: {
    fontSize: FontSize.caption,
    color: Colors.textTertiary,
    flex: 1,
  },

  body: {
    flex: 1,
    flexDirection: "row",
  },

  // ── Sidebar ─────────────────────────────────────────
  sidebar: {
    width: 78,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarContent: {
    paddingVertical: Spacing[4],
  },
  sidebarItem: {
    alignItems: "center",
    paddingVertical: Spacing[10],
    paddingHorizontal: 4,
    gap: Spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  sidebarItemActive: {
    backgroundColor: Colors.canvas,
    borderLeftColor: Colors.brandGreen,
  },
  sidebarIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarIconBgActive: {
    borderWidth: 1.5,
    borderColor: Colors.brandGreen,
  },
  sidebarEmoji: {
    fontSize: 22,
  },
  sidebarLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 12,
  },
  sidebarLabelActive: {
    color: Colors.brandGreen,
    fontWeight: "700",
  },
  countBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    backgroundColor: "#F0F0F0",
  },
  countBadgeActive: {
    backgroundColor: Colors.greenTint,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  countText: {
    fontSize: 8,
    fontWeight: "700",
    color: Colors.textTertiary,
  },
  countTextActive: {
    color: Colors.brandGreen,
  },

  // ── Grid & Subcategories ────────────────────────────
  grid: {
    flex: 1,
  },
  subcatBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing[8],
  },
  subcatList: {
    paddingHorizontal: Spacing[8],
    gap: Spacing[6],
  },
  chip: {
    paddingHorizontal: Spacing[10],
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.greenTint,
    borderColor: Colors.brandGreen,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.brandGreen,
    fontWeight: "700",
  },

  gridContent: {
    padding: Spacing[6],
  },
  columnWrapper: {
    gap: Spacing[6],
  },
  gridCard: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: Spacing[12],
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
});
