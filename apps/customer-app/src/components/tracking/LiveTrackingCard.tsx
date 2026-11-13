import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { freshness, layoutPoints, useTracking } from "../../lib/tracking";
import { Colors, Radius, Spacing, typography } from "../../theme";
import { colors } from "../../theme/tokens";
import { TrackingMap } from "./TrackingMap";

/** Where the rider is right now: a map on iPhone, a route drawing elsewhere, plus distance and ETA. */
export function LiveTrackingCard({ orderId }: { orderId: string }) {
  const tracking = useTracking(orderId, true);
  const t = tracking.data;
  if (!t || !t.active) return null;

  const showMap = Platform.OS === "ios";
  const stale = t.rider ? t.rider.ageSeconds > 120 : false;

  return (
    <View style={styles.card} accessibilityLabel="Live tracking">
      <View style={styles.head}>
        <View style={styles.livePill}>
          <View style={[styles.liveDot, stale && styles.liveDotStale]} />
          <Text style={styles.liveText}>{stale ? "Last known" : "Live"}</Text>
        </View>
        <Text style={styles.updated}>
          {t.rider
            ? `Updated ${freshness(t.rider.ageSeconds)}`
            : "Waiting for the rider's location"}
        </Text>
      </View>

      {showMap ? (
        <TrackingMap store={t.store} rider={t.rider} home={t.destination} />
      ) : (
        <RouteDrawing store={t.store} rider={t.rider} home={t.destination} />
      )}

      <View style={styles.stats}>
        <Stat
          icon="time"
          value={t.etaMins !== null ? `${t.etaMins} min` : "Soon"}
          label="to your door"
        />
        <View style={styles.divider} />
        <Stat
          icon="navigate"
          value={t.distanceKm !== null ? `${t.distanceKm.toFixed(1)} km` : "Nearby"}
          label="away"
        />
      </View>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={Colors.brandText} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

type Point = { lat: number; lng: number };

/** Store, rider and home placed by their real positions, joined by a dashed line. */
function RouteDrawing({
  store,
  rider,
  home,
}: {
  store: Point | null;
  rider: Point | null;
  home: Point | null;
}) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const points = [store, rider, home];
  const present = points.filter((p): p is Point => p !== null);
  const placed = layoutPoints(present);
  const at = (p: Point | null) => {
    if (!p) return null;
    const i = present.indexOf(p);
    const q = placed[i];
    return q ? { left: q.x * size.w, top: q.y * size.h } : null;
  };
  const s = at(store);
  const r = at(rider);
  const h = at(home);

  const segment = (
    a: { left: number; top: number } | null,
    b: { left: number; top: number } | null,
    done: boolean,
  ) => {
    if (!a || !b) return null;
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    const length = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return (
      <View
        style={[
          styles.segment,
          done ? styles.segmentDone : styles.segmentAhead,
          {
            width: length,
            left: a.left + dx / 2 - length / 2,
            top: a.top + dy / 2 - 1.5,
            transform: [{ rotate: `${angle}deg` }],
          },
        ]}
      />
    );
  };

  return (
    <View
      style={styles.drawing}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessible
      accessibilityLabel="Route from the store to your home"
    >
      {size.w > 0 ? (
        <>
          {r ? segment(s, r, true) : null}
          {segment(r ?? s, h, false)}
          {s ? <Pin at={s} icon="storefront" tone="store" /> : null}
          {h ? <Pin at={h} icon="home" tone="home" /> : null}
          {r ? <Pin at={r} icon="bicycle" tone="rider" /> : null}
        </>
      ) : null}
    </View>
  );
}

function Pin({
  at,
  icon,
  tone,
}: {
  at: { left: number; top: number };
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tone: "store" | "home" | "rider";
}) {
  const big = tone === "rider";
  const size = big ? 36 : 28;
  return (
    <View
      style={[
        styles.pin,
        tone === "store" && styles.pinStore,
        tone === "home" && styles.pinHome,
        tone === "rider" && styles.pinRider,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: at.left - size / 2,
          top: at.top - size / 2,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={big ? 18 : 14}
        color={tone === "home" ? colors.surface[0] : Colors.onBrand}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing[16],
    gap: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing[8],
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand[50],
    paddingHorizontal: Spacing[8],
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[600] },
  liveDotStale: { backgroundColor: Colors.warning },
  liveText: { ...typography.caption, fontWeight: "800", color: Colors.brandText },
  updated: {
    ...typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
    textAlign: "right",
  },
  drawing: {
    height: 150,
    borderRadius: Radius.md,
    backgroundColor: colors.brand[50],
    overflow: "hidden",
  },
  segment: { position: "absolute", height: 3, borderRadius: 2 },
  segmentDone: { backgroundColor: colors.brand[600] },
  segmentAhead: { backgroundColor: colors.line[300] },
  pin: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface[0],
  },
  pinStore: { backgroundColor: colors.brand[200] },
  pinHome: { backgroundColor: colors.ink[900] },
  pinRider: { backgroundColor: colors.brand[600], zIndex: 2 },
  stats: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing[8] },
  statValue: { ...typography.subtitle, fontWeight: "800", color: Colors.textPrimary },
  statLabel: { ...typography.caption, color: Colors.textSecondary },
  divider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: Colors.border,
    marginHorizontal: Spacing[12],
  },
});
