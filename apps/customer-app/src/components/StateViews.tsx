import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiClientError } from "@qc/api-client";
import { Colors, Radius, Spacing, typography } from "../theme";
import { Skeleton, ProductCardSkeleton } from "./Skeleton";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Friendly wording for a failed request. Says what happened and what to do, with no blame. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "NETWORK_ERROR")
      return "We could not reach the server. Check your connection and try again.";
    if (error.code === "TIMEOUT") return "That took too long. Try again.";
    if (error.status !== undefined && error.status >= 500)
      return "Something went wrong on our side. Try again in a moment.";
  }
  return "Something went wrong. Try again.";
}

type ErrorStateProps = {
  error?: unknown;
  title?: string;
  onRetry: () => void;
  /** Smaller layout for use inside a rail or a section */
  compact?: boolean;
};

export function ErrorState({
  error,
  title = "Could not load this",
  onRetry,
  compact,
}: ErrorStateProps) {
  return (
    <View style={[styles.box, compact && styles.boxCompact]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={compact ? 28 : 44} color={Colors.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{errorMessage(error)}</Text>
      <Pressable
        style={styles.retry}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Ionicons name="refresh" size={16} color={Colors.onBrand} />
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon = "search-outline",
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.box}>
      <Ionicons name={icon} size={44} color={Colors.border} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.retry} onPress={onAction} accessibilityRole="button">
          <Text style={styles.retryText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A horizontal rail placeholder: section title bar plus a row of card skeletons. */
export function RailSkeleton() {
  return (
    <View style={styles.rail}>
      <Skeleton width={140} height={18} style={styles.railTitle} />
      <View style={styles.railRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.railCard}>
            <ProductCardSkeleton />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A grid placeholder with `columns` skeleton cards per row. */
export function ProductGridSkeleton({
  columns = 2,
  rows = 3,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.gridRow}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={styles.gridCell}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[8],
    paddingVertical: Spacing[32],
    paddingHorizontal: Spacing[24],
  },
  boxCompact: {
    paddingVertical: Spacing[16],
  },
  title: {
    ...typography.title,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing[8],
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[20],
    paddingVertical: Spacing[10],
  },
  retryText: {
    ...typography.bodyStrong,
    fontWeight: "800",
    color: Colors.onBrand,
  },
  rail: {
    marginBottom: Spacing[20],
  },
  railTitle: {
    marginLeft: Spacing[16],
    marginBottom: Spacing[12],
  },
  railRow: {
    flexDirection: "row",
    gap: Spacing[8],
    paddingHorizontal: Spacing[16],
  },
  railCard: {
    width: 136,
  },
  grid: {
    gap: Spacing[16],
  },
  gridRow: {
    flexDirection: "row",
    gap: Spacing[12],
  },
  gridCell: {
    flex: 1,
  },
});
