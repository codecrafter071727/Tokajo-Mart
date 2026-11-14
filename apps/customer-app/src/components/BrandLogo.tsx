import { Image } from "expo-image";
import { StyleSheet, type ViewStyle } from "react-native";

const source = require("../../assets/milcki-logo.png");

export function BrandLogo({ size = 56, style }: { size?: number; style?: ViewStyle }) {
  return (
    <Image
      source={source}
      style={[styles.img, { width: size, height: size, borderRadius: size * 0.22 }, style]}
      contentFit="cover"
      accessibilityLabel="Milcki"
    />
  );
}

const styles = StyleSheet.create({
  img: { overflow: "hidden" },
});
