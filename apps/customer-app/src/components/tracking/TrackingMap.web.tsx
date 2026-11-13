/** No map on the web preview: the route card shows the journey instead. */
export function TrackingMap(_props: {
  store: { lat: number; lng: number } | null;
  rider: { lat: number; lng: number } | null;
  home: { lat: number; lng: number } | null;
}) {
  return null;
}
