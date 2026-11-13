import type { Order as ServerOrder } from "@qc/contracts";
import { HttpError } from "./httpError";
import { fromServer } from "./orderMapping";
import type { OrderRepository, PlaceOrderInput } from "./orders";
import { apiFetch } from "./session";

export function createHttpOrderRepository(): OrderRepository {
  return {
    async place(input: PlaceOrderInput) {
      const order = await apiFetch<ServerOrder>("POST", "/v1/orders", {
        headers: { "idempotency-key": input.idempotencyKey },
        body: {
          items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          tipPaise: input.tipPaise,
          address: {
            tag: input.address.tag,
            line1: input.address.line1,
            line2: input.address.line2,
            lat: input.location?.lat,
            lng: input.location?.lng,
            instructions: input.location?.instructions ?? null,
          },
          payment: input.payment,
          ...(input.couponCode ? { couponCode: input.couponCode } : {}),
        },
      });
      return fromServer(order);
    },

    async get(id) {
      try {
        return fromServer(
          await apiFetch<ServerOrder>("GET", `/v1/orders/${encodeURIComponent(id)}`),
        );
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      }
    },

    async list() {
      const { items } = await apiFetch<{ items: ServerOrder[] }>("GET", "/v1/orders?limit=50");
      return items.map(fromServer);
    },

    async cancel(id) {
      return fromServer(
        await apiFetch<ServerOrder>("POST", `/v1/orders/${encodeURIComponent(id)}/cancel`, {
          body: {},
        }),
      );
    },
  };
}
