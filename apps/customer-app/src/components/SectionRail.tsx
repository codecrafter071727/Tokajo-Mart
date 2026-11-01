import React from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, typography } from "../theme";
import { ProductCard } from "./ProductCard";
import type { Product } from "../lib/mockData";

interface SectionRailProps {
  title: string;
  products: Product[];
  onSeeAll?: () => void;
}

const Separator = () => <View style={{ width: Spacing[8] }} />;

export function SectionRail({ title, products, onSeeAll }: SectionRailProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <Pressable
            onPress={onSeeAll}
            style={styles.seeAllBtn}
            hitSlop={8}
            accessibilityLabel={`See all ${title}`}
          >
            <Text style={styles.seeAll}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.brandText} />
          </Pressable>
        )}
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ProductCard product={item} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing[20],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[16],
    marginBottom: Spacing[12],
  },
  title: {
    ...typography.title,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAll: {
    ...typography.caption,
    fontWeight: "700",
    color: Colors.brandText,
  },
  rail: {
    paddingHorizontal: Spacing[16],
    paddingBottom: 4,
  },
  cardWrapper: {
    width: 136,
  },
});
