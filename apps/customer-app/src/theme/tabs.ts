import { Platform } from "react-native";

/** Visible tab-bar content height (Android / web JS bar). */
export const TAB_BAR_CONTENT = 56;

/**
 * Extra bottom reserve under scroll content.
 * iOS NativeTabs already folds the system bar into the safe area — reserve nothing.
 * Android / web absolute JS bar needs the content height reserved manually.
 */
export const TAB_RESERVE = Platform.OS === "ios" ? 0 : TAB_BAR_CONTENT;
