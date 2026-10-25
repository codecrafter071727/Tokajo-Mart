import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight } from "../src/theme";
import { ProductCard } from "../src/components/ProductCard";
import { CartBar } from "../src/components/CartBar";
import { products } from "../src/lib/mockData";

const RECENT_SEARCHES = ["milk", "banana", "bread", "cola", "onion"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.unit.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Search bar header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <View style={styles.searchBarWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder='Search "milk", "bread"...'
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
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
                <Text style={styles.chipText}>🕐 {s}</Text>
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
                <Text style={styles.chipText}>🔥 {s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : results.length === 0 ? (
        /* Empty state */
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No results for "{query}"</Text>
          <Text style={styles.emptySubtitle}>Try searching with different keywords</Text>
        </View>
      ) : (
        /* Results grid */
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.resultsList, { paddingBottom: 120 + insets.bottom }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing[8] }} />}
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
            </Text>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
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
    backgroundColor: Colors.brandYellow,
    paddingHorizontal: Spacing[12],
    paddingBottom: Spacing[12],
    paddingTop: Spacing[8],
    gap: Spacing[8],
  },
  backBtn: {
    padding: Spacing[4],
  },
  backBtnText: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.brandBlack,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
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
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[8],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipTrending: {
    backgroundColor: Colors.yellowTint,
    borderColor: Colors.brandYellow,
  },
  chipText: {
    fontSize: FontSize.caption,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // Results
  resultsList: {
    padding: Spacing[12],
  },
  columnWrapper: {
    gap: Spacing[8],
  },
  resultsCount: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing[12],
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
