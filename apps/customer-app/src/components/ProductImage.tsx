import React, { useState } from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";

interface ProductImageProps {
  imageUrl?: string;
  fit?: "cover" | "contain";
  /** Emoji shown while there is no photo or it fails to load */
  emoji: string;
  emojiSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProductImage({
  imageUrl,
  fit = "contain",
  emoji,
  emojiSize = 40,
  style,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <View style={[styles.box, style]}>
      {imageUrl && !failed ? (
        <Image
          source={{ uri: imageUrl }}
          style={fit === "contain" ? styles.contained : StyleSheet.absoluteFill}
          contentFit={fit}
          transition={150}
          cachePolicy="disk"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.25 }}>{emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  contained: {
    width: "86%",
    height: "86%",
  },
});
