import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight } from "../src/theme";
import { ProductCard } from "../src/components/ProductCard";
import { CartBar } from "../src/components/CartBar";
import { useProducts } from "../src/lib/queries";
import { useDebouncedValue } from "../src/lib/useDebouncedValue";
import { ErrorState, ProductGridSkeleton } from "../src/components/StateViews";
import { Ionicons } from "@expo/vector-icons";

const RECENT_SEARCHES = ["milk", "banana", "bread", "cola", "onion"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Search as you type, but only ask once typing pauses (DESIGN.md: 200ms)
  const term = useDebouncedValue(query.trim(), 200);
  const productsQuery = useProducts(
    { q: term, limit: 100 },
    { enabled: term.length > 0, keepPrevious: true },
  );
  const results = productsQuery.data ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Search bar header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.searchBarWrapper}>
          <Ionicons name="search" size={18} color={Colors.brandText} />
          <TextInput
            style={styles.searchInput}
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
        /* Recent searches / suggestions */
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent searches</Text>
          <View style={styles.recentChips}>
            {RECENT_SEARCHES.map((s) => (
              <Pressable key={s} style={styles.chip} onPress={() => setQuery(s)}>
                <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.recentTitle}>Popular right now</Text>
          <View style={styles.recentChips}>
            {["Atta", "Eggs", "Curd", "Chips", "Coffee"].map((s) => (
              <Pressable
                key={s}
                style={[styles.chip, styles.chipTrending]}
                onPress={() => setQuery(s)}
              >
                <Ionicons name="trending-up" size={14} color={Colors.brandText} />
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
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
        </View>
      ) : (
        /* Results grid - 3 columns */
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={3}
          key="3col"
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.resultsList, { paddingBottom: 140 + insets.bottom }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing[6] }} />}
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
  backBtn: {
    padding: Spacing[4],
  },
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
    padding: Spacing[16],
    gap: Spacing[12],
  },
  recentTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[4],
  },
  recentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing[8],
    marginBottom: Spacing[8],
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
    gap: Spacing[6],
  },
  gridCard: {
    flex: 1,
    maxWidth: "33.33%",
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
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
