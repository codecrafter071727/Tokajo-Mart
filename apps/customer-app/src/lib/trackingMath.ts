/** "just now", "40 s ago", "3 min ago": how fresh the rider's position is. */
export function freshness(ageSeconds: number): string {
  if (ageSeconds < 10) return "just now";
  if (ageSeconds < 60) return `${ageSeconds} s ago`;
  return `${Math.round(ageSeconds / 60)} min ago`;
}

/**
 * Where to place three points (store, rider, home) on a small route drawing: 0 to 1 in both
 * directions with some padding, north up. Pure, so it is tested without a screen.
 */
export function layoutPoints(
  points: { lat: number; lng: number }[],
  padding = 0.12,
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const span = Math.max(maxLat - minLat, maxLng - minLng, 1e-6);
  const scale = (1 - 2 * padding) / span;
  const offsetX = (1 - (maxLng - minLng) * scale) / 2;
  const offsetY = (1 - (maxLat - minLat) * scale) / 2;
  return points.map((p) => ({
    x: offsetX + (p.lng - minLng) * scale,
    y: offsetY + (maxLat - p.lat) * scale,
  }));
}
