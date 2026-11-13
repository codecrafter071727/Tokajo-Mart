import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "../../theme";
import { ProductImage } from "../ProductImage";

interface ImageGalleryProps {
  images: { url: string; alt: string }[];
  /** Shown when there are no photos, and while one fails to load */
  emoji: string;
  fit?: "cover" | "contain";
  size: number;
}

/**
 * The product photos, one at a time. Swipe on a phone; on the web there are arrows as well.
 * Dots show where you are. A product with no photos shows its emoji.
 */
export function ImageGallery({ images, emoji, fit = "contain", size }: ImageGalleryProps) {
  const list = useRef<FlatList<{ url: string; alt: string }>>(null);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / size);
      if (next !== index) setIndex(next);
    },
    [index, size],
  );

  const go = (to: number) => {
    const clamped = Math.max(0, Math.min(images.length - 1, to));
    list.current?.scrollToIndex({ index: clamped, animated: true });
    setIndex(clamped);
  };

  if (images.length <= 1) {
    return (
      <View style={[styles.frame, { width: size, height: size }]}>
        <ProductImage
          imageUrl={images[0]?.url}
          fit={fit}
          emoji={emoji}
          emojiSize={120}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <View style={[styles.frame, { width: size, height: size }]}>
        <FlatList
          ref={list}
          data={images}
          keyExtractor={(item, i) => `${i}-${item.url}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          getItemLayout={(_, i) => ({ length: size, offset: size * i, index: i })}
          renderItem={({ item }) => (
            <View
              style={{ width: size, height: size }}
              accessible
              accessibilityRole="image"
              accessibilityLabel={item.alt || "Product photo"}
            >
              <ProductImage
                imageUrl={item.url}
                fit={fit}
                emoji={emoji}
                emojiSize={120}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}
        />
        {Platform.OS === "web" ? (
          <>
            {index > 0 ? (
              <Pressable
                style={[styles.arrow, styles.arrowLeft]}
                onPress={() => go(index - 1)}
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
              >
                <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
              </Pressable>
            ) : null}
            {index < images.length - 1 ? (
              <Pressable
                style={[styles.arrow, styles.arrowRight]}
                onPress={() => go(index + 1)}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
              >
                <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
      <View style={styles.dots} accessibilityLabel={`Photo ${index + 1} of ${images.length}`}>
        {images.map((image, i) => (
          <Pressable
            key={`${i}-${image.url}`}
            onPress={() => go(i)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Show photo ${i + 1}`}
          >
            <View style={[styles.dot, i === index && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLeft: { left: Spacing[8] },
  arrowRight: { right: Spacing[8] },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: Spacing[12],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.brandText,
  },
});
