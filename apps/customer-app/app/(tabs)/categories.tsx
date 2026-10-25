import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { ProductCard } from "../../src/components/ProductCard";
import { categories, getProductsByCategory } from "../../src/lib/mockData";

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const [activeCategory, setActiveCategory] = useState<string>(
    params.categoryId ?? categories[0]?.id ?? "fruits",
  );

  const products = getProductsByCategory(activeCategory);
  const activeCat = categories.find((c) => c.id === activeCategory) ??
    categories[0] ?? { id: "fruits", name: "Fruits", image: "🥦", color: "#E8F5E9" };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
      </View>

      <View style={styles.body}>
        {/* Left: Category sidebar */}
        <ScrollView
          style={styles.sidebar}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarContent}
        >
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.sidebarItem, activeCategory === cat.id && styles.sidebarItemActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <View
                style={[
                  styles.sidebarIconBg,
                  { backgroundColor: cat.color },
                  activeCategory === cat.id && styles.sidebarIconBgActive,
                ]}
              >
                <Text style={styles.sidebarEmoji}>{cat.image}</Text>
              </View>
              <Text
                style={[
                  styles.sidebarLabel,
                  activeCategory === cat.id && styles.sidebarLabelActive,
                ]}
                numberOfLines={2}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Right: Product grid */}
        <View style={styles.grid}>
          {/* Category header */}
          <View style={styles.gridHeader}>
            <Text style={styles.catHeaderEmoji}>{activeCat.image}</Text>
            <Text style={styles.catHeaderName}>{activeCat.name.replace("\n", " ")}</Text>
          </View>

          <FlatList
            data={products}
            keyExtractor={(p) => p.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            ItemSeparatorComponent={() => <View style={{ height: Spacing[8] }} />}
            contentContainerStyle={[styles.gridContent, { paddingBottom: 140 + insets.bottom }]}
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
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  // Sidebar
  sidebar: {
    width: 84,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarContent: {
    paddingVertical: Spacing[8],
  },
  sidebarItem: {
    alignItems: "center",
    paddingVertical: Spacing[12],
    paddingHorizontal: Spacing[8],
    gap: Spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  sidebarItemActive: {
    backgroundColor: Colors.canvas,
    borderLeftColor: Colors.brandGreen,
  },
  sidebarIconBg: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarIconBgActive: {
    borderWidth: 1.5,
    borderColor: Colors.brandGreen,
  },
  sidebarEmoji: {
    fontSize: 24,
  },
  sidebarLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 12,
  },
  sidebarLabelActive: {
    color: Colors.brandGreen,
  },
  // Grid
  grid: {
    flex: 1,
  },
  gridHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
    paddingHorizontal: Spacing[12],
    paddingVertical: Spacing[12],
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catHeaderEmoji: {
    fontSize: 20,
  },
  catHeaderName: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  gridContent: {
    padding: Spacing[8],
  },
  columnWrapper: {
    gap: Spacing[8],
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
