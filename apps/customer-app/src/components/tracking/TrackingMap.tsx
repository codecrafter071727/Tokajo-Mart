import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Colors, Radius } from "../../theme";

type Point = { lat: number; lng: number };

/**
 * A real map, on iPhone only: Expo Go ships Apple Maps there with no key. Android needs a Google
 * Maps key, so it returns null and the route card is shown instead.
 */
export function TrackingMap({
  store,
  rider,
  home,
}: {
  store: Point | null;
  rider: Point | null;
  home: Point | null;
}) {
  const map = useRef<MapView>(null);
  const points = [store, rider, home].filter((p): p is Point => p !== null);

  useEffect(() => {
    if (points.length === 0) return;
    map.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true },
    );
    // Refit when the rider moves
  }, [rider?.lat, rider?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS !== "ios" || points.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <MapView ref={map} style={StyleSheet.absoluteFill} pitchEnabled={false} rotateEnabled={false}>
        {store ? (
          <Marker
            coordinate={{ latitude: store.lat, longitude: store.lng }}
            title="Store"
            pinColor="#238A47"
          />
        ) : null}
        {home ? (
          <Marker
            coordinate={{ latitude: home.lat, longitude: home.lng }}
            title="Home"
            pinColor="#14201E"
          />
        ) : null}
        {rider ? (
          <Marker
            coordinate={{ latitude: rider.lat, longitude: rider.lng }}
            title="Your rider"
            pinColor="#42C86E"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 220,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.canvas,
  },
});
