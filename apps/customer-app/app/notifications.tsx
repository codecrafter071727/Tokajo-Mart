import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Notification } from "@qc/contracts";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { EmptyState, ErrorState } from "../src/components/StateViews";
import { Colors, Radius, Spacing, typography } from "../src/theme";
import {
  groupByDay,
  notificationIcon,
  notificationTarget,
  timeLabel,
  useInboxAvailable,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from "../src/lib/notifications";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const available = useInboxAvailable();
  const query = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const sections = useMemo(
    () => groupByDay(items).map((g) => ({ title: g.label, data: g.items })),
    [items],
  );
  const hasUnread = items.some((n) => !n.readAt);

  const open = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const target = notificationTarget(n);
    if (target) router.push(target as never);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Notifications"
        right={
          hasUnread ? (
            <Pressable
              onPress={() => markAll.mutate()}
              disabled={markAll.isPending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Text style={styles.markAll}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />
      {!available ? (
        <EmptyState
          icon="notifications-off-outline"
          title="Sign in to see updates"
          message="Order updates and back in stock alerts show up here."
        />
      ) : query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brandText} />
        </View>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          title="Could not load notifications"
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="All caught up"
          message="We will tell you here when your order moves or an item you wanted is back."
          actionLabel="Start shopping"
          onAction={() => router.replace("/(tabs)")}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing[24] }}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => void query.refetch()}
              tintColor={Colors.brandText}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
          renderItem={({ item }) => {
            const unread = !item.readAt;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  unread && styles.rowUnread,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={`${unread ? "Unread. " : ""}${item.title}. ${item.body}`}
              >
                <View style={[styles.icon, unread && styles.iconUnread]}>
                  <Ionicons
                    name={notificationIcon(item.type) as never}
                    size={20}
                    color={unread ? Colors.brandText : Colors.textSecondary}
                  />
                </View>
                <View style={styles.text}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.time}>{timeLabel(item.createdAt)}</Text>
                  </View>
                  {item.body ? (
                    <Text style={styles.body} numberOfLines={2}>
                      {item.body}
                    </Text>
                  ) : null}
                </View>
                {unread ? <View style={styles.dot} accessibilityElementsHidden /> : null}
              </Pressable>
            );
          }}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator style={{ marginTop: Spacing[12] }} color={Colors.brandText} />
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  markAll: { ...typography.caption, fontWeight: "800", color: Colors.brandText },
  day: {
    ...typography.caption,
    fontWeight: "800",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: Spacing[16],
    paddingTop: Spacing[16],
    paddingBottom: Spacing[8],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[12],
    marginHorizontal: Spacing[12],
    marginBottom: Spacing[8],
    padding: Spacing[12],
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowUnread: { borderColor: Colors.brandTint, backgroundColor: Colors.greenTint },
  rowPressed: { opacity: 0.85 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  iconUnread: { backgroundColor: Colors.brandTint },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing[8] },
  title: { ...typography.bodyStrong, flex: 1, color: Colors.textPrimary },
  titleUnread: { fontWeight: "800" },
  time: { ...typography.caption, color: Colors.textTertiary },
  body: { ...typography.caption, color: Colors.textSecondary, lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brandGreen, marginTop: 6 },
});
