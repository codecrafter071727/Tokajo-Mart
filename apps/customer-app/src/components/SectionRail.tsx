import React from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { Colors, Radius, Shadow, FontSize, FontWeight, Spacing } from "../theme";
import { ProductCard } from "./ProductCard";
import type { Product } from "../lib/mockData";

interface SectionRailProps {
  title: string;
  products: Product[];
  onSeeAll?: () => void;
}

export function SectionRail({ title, products, onSeeAll }: SectionRailProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>see all</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        ItemSeparatorComponent={() => <View style={{ width: Spacing[8] }} />}
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
    marginBottom: Spacing[12],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[16],
    marginBottom: Spacing[12],
  },
  title: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  seeAll: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.h2,
    color: Colors.brandGreen,
  },
  rail: {
    paddingHorizontal: Spacing[16],
    paddingBottom: 4,
  },
  cardWrapper: {
    width: 144,
  },
});
