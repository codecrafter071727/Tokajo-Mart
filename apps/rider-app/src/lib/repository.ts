import { applyAction, DeliveryError, NEXT_ACTION, type Action, type Delivery } from "./delivery";
import { makeOffer, makeTodayHistory } from "./fixtures";

export type RiderState = {
  online: boolean;
  /** The offer being shown or the delivery in progress, or null */
  active: Delivery | null;
  /** Deliveries completed today, newest first */
  history: Delivery[];
};

/**
 * Everything the rider app needs from the backend. The in-memory implementation below runs the
 * whole flow with demo data; an HTTP implementation backed by the delivery service replaces it.
 */
export interface DeliveryRepository {
  getState(): Promise<RiderState>;
  setOnline(online: boolean): Promise<RiderState>;
  /** Turn down the current offer */
  decline(deliveryId: string): Promise<RiderState>;
  /** Move the delivery to its next status. Throws DeliveryError for illegal actions. */
  act(deliveryId: string, action: Action): Promise<RiderState>;
}

export type FixtureOptions = {
  /** Injected so tests and demos do not depend on the real clock */
  now?: () => Date;
  /** How long after going online or declining the next offer shows up */
  offerDelayMs?: number;
};

export function createFixtureRepository(options: FixtureOptions = {}): DeliveryRepository {
  const now = options.now ?? (() => new Date());
  const offerDelayMs = options.offerDelayMs ?? 4000;

  let online = false;
  let active: Delivery | null = null;
  let history: Delivery[] = makeTodayHistory(now()).reverse();
  let offersMade = 0;
  let nextOfferAt = 0;

  const snapshot = (): RiderState => {
    // An offer appears a moment after the rider goes online, like a real dispatch would
    if (online && active === null && now().getTime() >= nextOfferAt) {
      active = makeOffer(offersMade++);
    }
    return { online, active, history };
  };

  const requireActive = (deliveryId: string): Delivery => {
    if (active === null || active.id !== deliveryId) {
      throw new DeliveryError("INVALID_TRANSITION", "That delivery is no longer active.");
    }
    return active;
  };

  return {
    async getState() {
      return snapshot();
    },

    async setOnline(value) {
      if (!value && active !== null && active.status !== "offered") {
        throw new DeliveryError(
          "INVALID_TRANSITION",
          "Finish your current delivery before going offline.",
        );
      }
      online = value;
      if (value) {
        nextOfferAt = now().getTime() + offerDelayMs;
      } else {
        active = null; // an unaccepted offer disappears
      }
      return snapshot();
    },

    async decline(deliveryId) {
      const current = requireActive(deliveryId);
      if (current.status !== "offered") {
        throw new DeliveryError("INVALID_TRANSITION", "Only an offer can be declined.");
      }
      active = null;
      nextOfferAt = now().getTime() + offerDelayMs;
      return snapshot();
    },

    async act(deliveryId, action) {
      const current = requireActive(deliveryId);
      const updated = applyAction(current, action, now());
      if (NEXT_ACTION[updated.status] === null) {
        history = [updated, ...history];
        active = null;
        nextOfferAt = now().getTime() + offerDelayMs;
      } else {
        active = updated;
      }
      return snapshot();
    },
  };
}
