import { Platform } from "react-native";

/** Browsers draw their own focus ring on inputs; spread this into a TextInput style on the web. */
export const noWebOutline = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as object;

export const USE_NATIVE_DRIVER = Platform.OS !== "web";
