import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { homeSections, homeShortcuts, type HomeTile } from "../../src/lib/mockData";

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_PAD = 12;
const GRID_GAP = 12;
const COLS = 4;
const TILE_W = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS);

const SEARCH_PLACEHOLDERS = [
  'Search "atta"',
  'Search "dal"',
  'Search "coke"',
  'Search "milk"',
  'Search "bread"',
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [activeShortcut, setActiveShortcut] = useState("all");

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const openTile = (tile: HomeTile) => {
    router.push({
      pathname: "/(tabs)/categories",
      params: { categoryId: tile.categoryId },
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow1}>
          <View style={styles.headerLeft}>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryEmoji}>⚡</Text>
              <Text style={styles.deliveryHeadline}>Delivery in 10 minutes</Text>
            </View>
            <Pressable style={styles.addressRow}>
              <Text style={styles.addressLabel}>Home</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {" "}
                — 123, MG Road, Bengaluru
              </Text>
              <Text style={styles.addressChevron}>⌄</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.profileBtn}
            onPress={() => router.push("/(tabs)/account")}
            accessibilityLabel="Profile"
          >
            <View style={styles.profileHead} />
            <View style={styles.profileBody} />
          </Pressable>
        </View>

        <Pressable style={styles.searchBar} onPress={() => router.push("/search")}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{SEARCH_PLACEHOLDERS[placeholderIdx]}</Text>
          <Text style={styles.micIcon}>🎙️</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 88 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shortcutRow}
        >
          {homeShortcuts.map((item) => {
            const active = item.id === activeShortcut;
            return (
              <Pressable
                key={item.id}
                style={styles.shortcut}
                onPress={() => setActiveShortcut(item.id)}
              >
                {item.badge ? (
                  <Text style={styles.shortcutBadge}>{item.badge}</Text>
                ) : (
                  <View style={styles.badgeSpacer} />
                )}
                <View style={[styles.shortcutIcon, active && styles.shortcutIconActive]}>
                  <Text style={styles.shortcutEmoji}>{item.emoji}</Text>
                </View>
                <Text style={[styles.shortcutLabel, active && styles.shortcutLabelActive]}>
                  {item.label}
                </Text>
                {active ? (
                  <View style={styles.shortcutUnderline} />
                ) : (
                  <View style={styles.underlineSpacer} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {homeSections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.grid}>
              {section.tiles.map((item) => (
                <Pressable key={item.id} style={styles.tile} onPress={() => openTile(item)}>
                  <View style={styles.tileArt}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.tileImage}
                      contentFit="cover"
                      transition={200}
                    />
                  </View>
                  <Text style={styles.tileLabel}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    backgroundColor: Colors.brandYellow,
    paddingHorizontal: Spacing[16],
    paddingBottom: Spacing[12],
    zIndex: 10,
  },
  headerRow1: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing[10],
    marginTop: Spacing[8],
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing[12],
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deliveryEmoji: {
    fontSize: 16,
  },
  deliveryHeadline: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.brandBlack,
    lineHeight: 24,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  addressLabel: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandBlack,
  },
  addressText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.caption,
    color: Colors.brandBlack,
    opacity: 0.75,
    flex: 1,
  },
  addressChevron: {
    fontSize: 14,
    color: Colors.brandBlack,
    marginLeft: 2,
    fontWeight: "700",
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    overflow: "hidden",
    ...Shadow.card,
  },
  profileHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.brandBlack,
    marginTop: 7,
  },
  profileBody: {
    width: 22,
    height: 12,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    backgroundColor: Colors.brandBlack,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    height: 46,
    paddingHorizontal: Spacing[12],
    gap: Spacing[8],
    ...Shadow.card,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.body,
    color: Colors.textTertiary,
  },
  micIcon: { fontSize: 18 },
  scroll: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    paddingTop: Spacing[8],
  },
  shortcutRow: {
    paddingHorizontal: Spacing[8],
    paddingBottom: Spacing[8],
    gap: 4,
  },
  shortcut: {
    width: 72,
    alignItems: "center",
  },
  badgeSpacer: {
    height: 14,
  },
  shortcutBadge: {
    height: 14,
    fontSize: 10,
    fontWeight: "800",
    color: Colors.danger,
    lineHeight: 14,
  },
  shortcutIcon: {
    width: 44,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutIconActive: {
    backgroundColor: Colors.brandYellow,
    borderRadius: Radius.md,
  },
  shortcutEmoji: {
    fontSize: 22,
  },
  shortcutLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  shortcutLabelActive: {
    fontWeight: "800",
  },
  shortcutUnderline: {
    marginTop: 4,
    height: 3,
    width: 28,
    borderRadius: 2,
    backgroundColor: Colors.brandYellow,
  },
  underlineSpacer: {
    marginTop: 4,
    height: 3,
  },
  section: {
    paddingHorizontal: GRID_PAD,
    paddingTop: Spacing[16],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing[12],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: GRID_GAP,
    rowGap: 14,
  },
  tile: {
    width: TILE_W,
    alignItems: "center",
  },
  tileArt: {
    width: TILE_W,
    height: TILE_W,
    borderRadius: 16,
    backgroundColor: "#E7F1F8",
    overflow: "hidden",
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  tileLabel: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
  },
});
