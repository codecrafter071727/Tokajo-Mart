import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { AddressKind } from "./addresses";

export const KIND_ICON: Record<AddressKind, ComponentProps<typeof Ionicons>["name"]> = {
  home: "home",
  work: "business",
  other: "location",
};
