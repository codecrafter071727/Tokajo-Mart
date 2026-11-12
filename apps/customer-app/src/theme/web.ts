import { Platform } from "react-native";

/**
 * Browsers draw their own focus ring around text inputs, which doubles up with our own border.
 * Spread this into a TextInput style on the web; it does nothing on a phone.
 */
export const noWebOutline = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as object;
