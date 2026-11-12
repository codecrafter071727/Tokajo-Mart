import type { RiderState as ServerState } from "@qc/contracts";
import { authed, toDeliveryError } from "./api";
import type { Action, Delivery } from "./delivery";
import type { DeliveryRepository, RiderState } from "./repository";

const toState = (s: ServerState): RiderState => ({
  online: s.online,
  active: s.active as Delivery | null,
  history: s.history as Delivery[],
});

async function call(path: string, method: string, body?: unknown): Promise<RiderState> {
  try {
    return toState(await authed<ServerState>(path, { method, body }));
  } catch (error) {
    throw toDeliveryError(error);
  }
}

/** The delivery service behind the gateway. The server decides every rule, including the codes. */
export function createHttpRepository(): DeliveryRepository {
  return {
    getState: () => call("/v1/delivery/me", "GET"),
    setOnline: (online) => call("/v1/delivery/me/online", "POST", { online }),
    decline: (id) => call(`/v1/delivery/${id}/actions`, "POST", { type: "decline" }),
    act: (id, action: Action) => call(`/v1/delivery/${id}/actions`, "POST", action),
  };
}
