import React, { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight } from "../src/theme";
import { ProductCard } from "../src/components/ProductCard";
import { CartBar } from "../src/components/CartBar";
import { useProducts } from "../src/lib/queries";
import { useDebouncedValue } from "../src/lib/useDebouncedValue";
import { ErrorState, ProductGridSkeleton } from "../src/components/StateViews";
import { Ionicons } from "@expo/vector-icons";
import { noWebOutline } from "../src/theme/web";
import { useSearchStore } from "../src/store/searches";
import { SectionRail } from "../src/components/SectionRail";

const POPULAR = ["Milk", "Bread", "Eggs", "Banana", "Chips", "Atta", "Curd", "Coffee"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // A brand link on a product page opens search already filled in
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "");

  // Search as you type, but only ask once typing pauses (DESIGN.md: 200ms)
  const term = useDebouncedValue(query.trim(), 200);
  const productsQuery = useProducts(
    { q: term, limit: 100 },
    { enabled: term.length > 0, keepPrevious: true },
  );
  const results = productsQuery.data ?? [];
  const recent = useSearchStore((st) => st.recent);
  const remember = useSearchStore((st) => st.remember);
  const clearRecent = useSearchStore((st) => st.clear);
  // Trending is just the catalog's first page for now; a popularity signal replaces it later
  const trending = useProducts({ limit: 100 }).data?.slice(0, 10) ?? [];

  // A search counts once it settled and found something
  React.useEffect(() => {
    if (term && productsQuery.isSuccess && results.length > 0) remember(term);
  }, [term, productsQuery.isSuccess, results.length, remember]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Search bar header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.searchBarWrapper}>
          <Ionicons name="search" size={18} color={Colors.brandText} />
          <TextInput
            style={[styles.searchInput, noWebOutline]}
            value={query}
            onChangeText={setQuery}
            placeholder='Search "milk", "bread"...'
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
            </Pressable>
          ) : (
            <Ionicons name="mic-outline" size={20} color={Colors.textSecondary} />
          )}
        </View>
      </View>

      {query.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          {recent.length > 0 ? (
            <View style={styles.recentSection}>
              <View style={styles.sectionHead}>
                <Text style={styles.recentTitle}>Recent searches</Text>
                <Pressable onPress={clearRecent} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.recentChips}>
                {recent.map((r) => (
                  <Pressable key={r} style={styles.chip} onPress={() => setQuery(r)}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.chipText}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Popular searches</Text>
            <View style={styles.recentChips}>
              {POPULAR.map((p) => (
                <Pressable key={p} style={styles.chip} onPress={() => setQuery(p)}>
                  <Ionicons name="trending-up" size={14} color={Colors.brandText} />
                  <Text style={styles.chipText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginTop: Spacing[20] }}>
            <SectionRail title="Trending near you" products={trending} />
          </View>
        </ScrollView>
      ) : productsQuery.isPending ? (
        <View style={styles.skeletonWrap}>
          <ProductGridSkeleton columns={3} rows={3} />
        </View>
      ) : productsQuery.isError ? (
        <ErrorState
          error={productsQuery.error}
          title="Search is not working"
          onRetry={() => void productsQuery.refetch()}
        />
      ) : results.length === 0 ? (
        /* Empty state */
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyTitle}>No results for "{query}"</Text>
          <Text style={styles.emptySubtitle}>Try a shorter word, or browse the categories.</Text>
          <Pressable
            style={styles.emptyCta}
            onPress={() => router.replace("/(tabs)/categories")}
            accessibilityRole="button"
          >
            <Text style={styles.emptyCtaText}>Browse categories</Text>
          </Pressable>
        </View>
      ) : (
        /* Results grid - 3 columns */
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={2}
          key="2col"
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.resultsList, { paddingBottom: 140 + insets.bottom }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing[8] }} />}
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.gridCard}>
              <ProductCard product={item} />
            </View>
          )}
        />
      )}

      <CartBar bottomOffset={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[12],
    paddingBottom: Spacing[12],
    paddingTop: Spacing[8],
    gap: Spacing[8],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  backBtnText: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.canvas,
    borderRadius: Radius.pill,
    height: 46,
    paddingHorizontal: Spacing[12],
    gap: Spacing[8],
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.body,
    color: Colors.textPrimary,
    height: "100%",
  },
  clearBtn: {
    padding: Spacing[4],
  },
  clearBtnText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: "700",
  },

  // Recent
  recentSection: {
    paddingHorizontal: Spacing[16],
    paddingTop: Spacing[16],
    gap: Spacing[10],
  },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearText: { fontSize: FontSize.caption, fontWeight: "800", color: Colors.brandText },
  recentTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  recentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing[8],
    marginBottom: Spacing[4],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[8],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipTrending: {
    backgroundColor: Colors.brandTint,
    borderColor: Colors.brandGreen,
  },
  chipText: {
    fontSize: FontSize.caption,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  micIcon: {
    fontSize: 16,
  },

  skeletonWrap: {
    paddingHorizontal: Spacing[8],
    paddingTop: Spacing[12],
  },

  // Results
  resultsList: {
    padding: Spacing[8],
  },
  columnWrapper: {
    gap: Spacing[8],
  },
  gridCard: {
    flex: 1,
    maxWidth: "50%",
  },
  resultsCount: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing[8],
    paddingHorizontal: Spacing[4],
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[12],
    padding: Spacing[24],
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  emptyCta: {
    marginTop: Spacing[8],
    borderWidth: 1,
    borderColor: Colors.brandGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[20],
    height: 44,
    justifyContent: "center",
  },
  emptyCtaText: { fontSize: FontSize.body, fontWeight: "800", color: Colors.brandText },
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
