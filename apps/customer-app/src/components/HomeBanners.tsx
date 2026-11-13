import React, { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Colors, Radius, Spacing, typography } from "../theme";
import { colors } from "../theme/tokens";
import { useBanners, type HomeBanner } from "../lib/banners";
import { useProducts } from "../lib/queries";
import { ProductImage } from "./ProductImage";

const GAP = Spacing[12];
const PAD = Spacing[16];

/** The promotions strip on the home screen. Renders nothing when there is nothing to show. */
export function HomeBanners({ etaMins }: { etaMins: number | null }) {
  const raw = useBanners();
  // Same query the home rails use, so this costs no extra request
  const products = useProducts({ limit: 100 }).data ?? [];
  // A banner without its own picture borrows photos of what it links to
  const banners = raw.map((b): HomeBanner => {
    if (b.photos.length > 0 || !b.link) return b;
    const linked =
      b.link.type === "product"
        ? products.filter((p) => p.id === b.link?.target)
        : products.filter((p) => p.categoryId === b.link?.target);
    const photos = linked.flatMap((p) => (p.imageUrl ? [p.imageUrl] : [])).slice(0, 3);
    return photos.length > 0 ? { ...b, photos } : b;
  });
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const listRef = useRef<FlatList<HomeBanner>>(null);
  const width = screenW - PAD * 2;
  const count = banners.length;

  // Keep the dot in range if the list shrinks
  useEffect(() => {
    if (indexRef.current >= count) {
      indexRef.current = 0;
      setIndex(0);
    }
  }, [count]);

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => {
      // The scroll is a side effect, so it lives here and not inside a state updater
      const next = (indexRef.current + 1) % count;
      indexRef.current = next;
      setIndex(next);
      try {
        listRef.current?.scrollToIndex({ index: next, animated: true });
      } catch {
        // Not laid out yet: the next tick tries again
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [count]);

  if (count === 0) return null;

  const open = (banner: HomeBanner) => {
    if (!banner.link) return;
    if (banner.link.type === "product") {
      router.push(`/product/${banner.link.target}`);
    } else {
      router.push({ pathname: "/(tabs)/categories", params: { categoryId: banner.link.target } });
    }
  };

  return (
    <View style={styles.section}>
      <FlatList
        ref={listRef}
        data={banners}
        // The auto-advance can fire before the banners are laid out; skipping a slide is fine
        onScrollToIndexFailed={() => undefined}
        keyExtractor={(b) => b.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width + GAP}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (width + GAP));
          indexRef.current = Math.max(0, Math.min(i, count - 1));
          setIndex(indexRef.current);
        }}
        contentContainerStyle={{ paddingHorizontal: PAD }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        renderItem={({ item }) => {
          const fg = item.darkText ? colors.ink[900] : Colors.surface;
          const single = item.photos.length === 1;
          return (
            <Pressable
              style={{ width }}
              onPress={() => open(item)}
              disabled={!item.link}
              accessibilityRole={item.link ? "button" : undefined}
              accessibilityLabel={item.title}
            >
              <LinearGradient
                colors={item.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.banner}
              >
                {item.darkText ? null : (
                  <>
                    <View style={styles.circleLg} />
                    <View style={styles.circleSm} />
                  </>
                )}
                <View style={styles.content}>
                  <Text style={[styles.title, { color: fg }]}>
                    {item.title.replace("{eta}", etaMins ? String(etaMins) : "a few")}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      style={[
                        styles.subtitle,
                        { color: item.darkText ? colors.ink[700] : "rgba(255,255,255,0.88)" },
                      ]}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                  {item.cta ? (
                    <View style={styles.cta}>
                      <Text style={styles.ctaText}>{item.cta}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.ink[900]} />
                    </View>
                  ) : null}
                </View>
                {single ? (
                  <View style={styles.single}>
                    <ProductImage
                      imageUrl={item.photos[0]}
                      fit="cover"
                      emoji={item.emoji}
                      emojiSize={40}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                ) : item.photos.length > 1 ? (
                  <View style={styles.photos}>
                    {item.photos.slice(0, 3).map((uri, i) => (
                      <View
                        key={uri || i}
                        style={[
                          styles.photo,
                          {
                            top: [2, 34, 18][i],
                            right: [36, 0, 66][i],
                            zIndex: [2, 3, 1][i],
                            transform: [{ rotate: ["-6deg", "5deg", "-10deg"][i] as string }],
                          },
                        ]}
                      >
                        <ProductImage
                          imageUrl={uri || undefined}
                          fit="cover"
                          emoji={item.emoji}
                          emojiSize={28}
                          style={StyleSheet.absoluteFill}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </LinearGradient>
            </Pressable>
          );
        }}
      />
      {count > 1 ? (
        <View style={styles.dotsRow}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing[20] },
  banner: {
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: Spacing[20],
    paddingRight: Spacing[12],
    paddingVertical: Spacing[20],
    minHeight: 132,
    overflow: "hidden",
  },
  circleLg: {
    position: "absolute",
    right: -30,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  circleSm: {
    position: "absolute",
    right: 60,
    bottom: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  content: { flex: 1, alignItems: "flex-start" },
  title: { ...typography.titleLg, fontWeight: "800" },
  subtitle: { ...typography.caption, marginTop: Spacing[4] },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[12],
    paddingVertical: 6,
    marginTop: Spacing[12],
  },
  ctaText: { ...typography.caption, fontWeight: "800", color: Colors.accentText },
  photos: { width: 132, height: 104, marginLeft: Spacing[8] },
  photo: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: Colors.surface,
    backgroundColor: Colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  single: {
    width: 104,
    height: 104,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: Spacing[10],
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.brandGreen, width: 16 },
});
