import { useLocationSharing } from "../lib/locationSharing";
import { useRiderState } from "../lib/queries";
import { useSession } from "../store/session";

const IN_PROGRESS = new Set(["assigned", "at_store", "picked_up", "at_customer"]);

/** Mounted once for the whole app: shares location while a delivery is in progress. */
export function LocationSharer() {
  const signedIn = useSession((s) => Boolean(s.rider));
  // Nothing to share, and nothing to ask the server, until someone has signed in
  return signedIn ? <Sharer /> : null;
}

function Sharer() {
  const state = useRiderState();
  const active = state.data?.active;
  useLocationSharing(Boolean(state.data?.online && active && IN_PROGRESS.has(active.status)));
  return null;
}
