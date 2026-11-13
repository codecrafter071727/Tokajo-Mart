import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, typography } from "../../src/theme";
import { TAB_RESERVE } from "../../src/theme/tabs";
import { ProductCard } from "../../src/components/ProductCard";
import { useCategories, useProducts, useServiceability } from "../../src/lib/queries";
import { EmptyState, ErrorState, ProductGridSkeleton } from "../../src/components/StateViews";
import { Skeleton } from "../../src/components/Skeleton";
import { ProductImage } from "../../src/components/ProductImage";

const SIDEBAR_W = 84;
const GRID_PAD = Spacing[12];
const GRID_GAP = Spacing[12];
const ROW_GAP = Spacing[16];
const SORTS = [
  { id: "relevance", label: "Sort" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "discount", label: "Biggest discount" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

function labelFor(name: string) {
  return name.replace(/\n/g, " ");
}

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const eta = useServiceability().data;
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];
  const [selected, setSelected] = useState<string | undefined>(params.categoryId);
  // Until the user picks one, show the first category once the list has loaded
  const activeCategory = selected ?? categories[0]?.id;
  const [sort, setSort] = useState<SortId>("relevance");
  const [under99, setUnder99] = useState(false);
  const [onOffer, setOnOffer] = useState(false);
  const [gridW, setGridW] = useState(0);

  useEffect(() => {
    if (params.categoryId) setSelected(params.categoryId);
  }, [params.categoryId]);

  const productsQuery = useProducts(
    { categoryId: activeCategory, limit: 100 },
    { enabled: activeCategory !== undefined },
  );
  const products = useMemo(() => {
    let list = productsQuery.data ?? [];
    if (under99) list = list.filter((p) => p.price < 99);
    if (onOffer) list = list.filter((p) => (p.discount ?? 0) >= 5);
    if (sort === "price_asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price_desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "discount") list = [...list].sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
    return list;
  }, [productsQuery.data, under99, onOffer, sort]);
  const sortLabel = SORTS.find((x) => x.id === sort)?.label ?? "Sort";
  const cycleSort = () => {
    const i = SORTS.findIndex((x) => x.id === sort);
    setSort(SORTS[(i + 1) % SORTS.length]!.id);
  };
  const activeCat = categories.find((c) => c.id === activeCategory);

  // With the sidebar the grid pane is ~300px on phones; 3 columns would make ~90px cards
  const numColumns = gridW >= 420 ? 3 : 2;
  const cardW = useMemo(() => {
    if (gridW <= 0) return 0;
    const inner = gridW - GRID_PAD * 2;
    return Math.floor((inner - GRID_GAP * (numColumns - 1)) / numColumns);
  }, [gridW, numColumns]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Categories</Text>
          <View style={styles.etaPill}>
            <Ionicons name="flash" size={12} color={Colors.brandText} />
            <Text style={styles.etaPillText}>
              {eta?.serviceable ? `${eta.etaMins} mins` : eta ? "Unavailable" : "-- mins"}
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.searchBar}
          onPress={() => router.push("/search")}
          accessibilityLabel="Search in category"
        >
          <Ionicons name="search" size={18} color={Colors.brandText} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            {activeCat ? `Search in ${labelFor(activeCat.name)}` : "Search products"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.sidebarRail}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.sidebarContent,
              { paddingBottom: TAB_RESERVE + 80 + insets.bottom },
            ]}
          >
            {categoriesQuery.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <View key={i} style={styles.sidebarItem}>
                    <Skeleton width={56} height={56} borderRadius={Radius.md} />
                    <Skeleton width={48} height={10} style={{ marginTop: Spacing[4] }} />
                  </View>
                ))
              : null}
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                  onPress={() => {
                    setSelected(cat.id);
                    setUnder99(false);
                    setOnOffer(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <View
                    style={[
                      styles.sidebarIconBg,
                      { backgroundColor: cat.color },
                      isActive && styles.sidebarIconBgActive,
                    ]}
                  >
                    <ProductImage
                      imageUrl={cat.imageUrl}
                      fit={cat.imageFit}
                      emoji={cat.image}
                      emojiSize={24}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  <Text
                    style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}
                    numberOfLines={2}
                  >
                    {labelFor(cat.name)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.gridPane} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBar}
            contentContainerStyle={styles.chipList}
          >
            <Chip
              label={sortLabel}
              icon="swap-vertical"
              selected={sort !== "relevance"}
              onPress={cycleSort}
            />
            <Chip label="Under ₹99" selected={under99} onPress={() => setUnder99((v) => !v)} />
            <Chip
              label="On offer"
              icon="pricetag-outline"
              selected={onOffer}
              onPress={() => setOnOffer((v) => !v)}
            />
            {sort !== "relevance" || under99 || onOffer ? (
              <Chip
                label="Clear"
                icon="close"
                onPress={() => {
                  setSort("relevance");
                  setUnder99(false);
                  setOnOffer(false);
                }}
              />
            ) : null}
          </ScrollView>

          {categoriesQuery.isError ? (
            <ErrorState
              error={categoriesQuery.error}
              title="Could not load categories"
              onRetry={() => void categoriesQuery.refetch()}
            />
          ) : cardW === 0 || productsQuery.isPending ? (
            <View style={styles.skeletonWrap}>
              <ProductGridSkeleton columns={numColumns} rows={3} />
            </View>
          ) : productsQuery.isError ? (
            <ErrorState
              error={productsQuery.error}
              title="Could not load products"
              onRetry={() => void productsQuery.refetch()}
            />
          ) : (
            <FlatList
              data={products}
              keyExtractor={(p) => p.id}
              numColumns={numColumns}
              key={`cols-${numColumns}-${cardW}`}
              columnWrapperStyle={{ gap: GRID_GAP }}
              ItemSeparatorComponent={() => <View style={{ height: ROW_GAP }} />}
              ListHeaderComponent={
                <View style={styles.gridHeader}>
                  <Text style={styles.gridTitle} numberOfLines={1}>
                    {activeCat ? labelFor(activeCat.name) : ""}
                  </Text>
                  <Text style={styles.gridCount}>{products.length} items</Text>
                </View>
              }
              contentContainerStyle={{
                paddingHorizontal: GRID_PAD,
                paddingTop: Spacing[4],
                paddingBottom: TAB_RESERVE + 120 + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                under99 || onOffer ? (
                  <EmptyState
                    icon="funnel-outline"
                    title="No matches"
                    message="Nothing here fits these filters. Clear them to see everything."
                  />
                ) : (
                  <EmptyState
                    icon="bag-outline"
                    title="Nothing here yet"
                    message="New items are added every day. Try another category."
                  />
                )
              }
              renderItem={({ item }) => (
                <View style={{ width: cardW }}>
                  <ProductCard product={item} />
                </View>
              )}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={selected ? Colors.brandText : Colors.textSecondary}
        />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[16],
    paddingTop: Spacing[8],
    paddingBottom: Spacing[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing[12],
  },
  title: {
    ...typography.titleLg,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.brandTint,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[10],
    paddingVertical: 4,
  },
  etaPillText: {
    ...typography.caption,
    fontWeight: "800",
    color: Colors.brandPressed,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.canvas,
    borderRadius: Radius.pill,
    height: 44,
    paddingHorizontal: Spacing[14],
    gap: Spacing[8],
  },
  searchPlaceholder: {
    ...typography.body,
    color: Colors.textTertiary,
    flex: 1,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  sidebarRail: {
    width: SIDEBAR_W,
    maxWidth: SIDEBAR_W,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  sidebarContent: {
    width: SIDEBAR_W,
    paddingTop: Spacing[4],
  },
  sidebarItem: {
    width: SIDEBAR_W,
    alignItems: "center",
    paddingVertical: Spacing[10],
    paddingHorizontal: 2,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  sidebarItemActive: {
    backgroundColor: Colors.greenTint,
    borderLeftColor: Colors.brandGreen,
  },
  sidebarIconBg: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarIconBgActive: {
    borderWidth: 2,
    borderColor: Colors.brandGreen,
  },
  sidebarEmoji: {
    fontSize: 24,
  },
  sidebarLabel: {
    ...typography.micro,
    fontSize: 11,
    lineHeight: 14,
    width: SIDEBAR_W - 10,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing[4],
    fontWeight: "600",
  },
  sidebarLabelActive: {
    color: Colors.brandText,
    fontWeight: "700",
  },
  gridPane: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  chipBar: {
    maxHeight: 52,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  chipList: {
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[8],
    gap: Spacing[6],
    alignItems: "center",
  },
  chip: {
    height: 32,
    paddingHorizontal: Spacing[12],
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: Colors.brandTint,
    borderColor: Colors.brandGreen,
  },
  chipText: {
    ...typography.caption,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.brandText,
    fontWeight: "700",
  },
  gridHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingVertical: Spacing[8],
  },
  gridTitle: {
    ...typography.title,
    fontWeight: "800",
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  gridCount: {
    ...typography.caption,
    color: Colors.textTertiary,
  },
  skeletonWrap: {
    paddingHorizontal: GRID_PAD,
    paddingTop: Spacing[12],
  },
  gridPlaceholder: {
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
    ...typography.body,
    color: Colors.textSecondary,
  },
});
