import { describe, expect, it } from "vitest";
import type { DeliveryError } from "../src/lib/delivery";
import { createFixtureRepository } from "../src/lib/repository";

function setup() {
  let t = Date.parse("2026-11-12T10:00:00.000Z");
  const repo = createFixtureRepository({ now: () => new Date(t), offerDelayMs: 1000 });
  return { repo, advance: (ms: number) => (t += ms) };
}

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as DeliveryError;
  }
  throw new Error("expected a rejection");
};

describe("fixture repository", () => {
  it("starts offline with no job and some deliveries earned today", async () => {
    const { repo } = setup();
    const state = await repo.getState();
    expect(state.online).toBe(false);
    expect(state.active).toBeNull();
    expect(state.history).toHaveLength(3);
  });

  it("offers an order only after a short delay once online", async () => {
    const { repo, advance } = setup();
    expect((await repo.setOnline(true)).active).toBeNull();
    advance(1000);
    const state = await repo.getState();
    expect(state.active?.status).toBe("offered");
  });

  it("runs a full delivery and moves it into today's history", async () => {
    const { repo, advance } = setup();
    await repo.setOnline(true);
    advance(1000);
    const offer = (await repo.getState()).active!;

    await repo.act(offer.id, { type: "accept" });
    await repo.act(offer.id, { type: "arrive_store" });
    await repo.act(offer.id, { type: "pick_up", checkedItemIds: offer.items.map((i) => i.id) });
    await repo.act(offer.id, { type: "arrive_customer" });
    const after = await repo.act(offer.id, { type: "deliver", code: offer.deliveryCode ?? "" });

    expect(after.active).toBeNull();
    expect(after.history).toHaveLength(4);
    expect(after.history[0]).toMatchObject({ id: offer.id, status: "delivered" });
  });

  it("keeps a delivery active after a wrong code", async () => {
    const { repo, advance } = setup();
    await repo.setOnline(true);
    advance(1000);
    const offer = (await repo.getState()).active!;
    await repo.act(offer.id, { type: "accept" });
    await repo.act(offer.id, { type: "arrive_store" });
    await repo.act(offer.id, { type: "pick_up", checkedItemIds: offer.items.map((i) => i.id) });
    await repo.act(offer.id, { type: "arrive_customer" });

    expect((await failure(repo.act(offer.id, { type: "deliver", code: "0000" }))).reason).toBe(
      "WRONG_CODE",
    );
    expect((await repo.getState()).active?.status).toBe("at_customer");
  });

  it("lets the rider decline an offer, then offers another one later", async () => {
    const { repo, advance } = setup();
    await repo.setOnline(true);
    advance(1000);
    const first = (await repo.getState()).active!;
    expect((await repo.decline(first.id)).active).toBeNull();
    advance(1000);
    const second = (await repo.getState()).active!;
    expect(second.id).not.toBe(first.id);
  });

  it("will not go offline mid delivery, but drops an unaccepted offer", async () => {
    const { repo, advance } = setup();
    await repo.setOnline(true);
    advance(1000);
    const offer = (await repo.getState()).active!;
    expect((await repo.setOnline(false)).active).toBeNull(); // offer dropped

    await repo.setOnline(true);
    advance(1000);
    const next = (await repo.getState()).active!;
    await repo.act(next.id, { type: "accept" });
    expect((await failure(repo.setOnline(false))).reason).toBe("INVALID_TRANSITION");
    expect(offer.id).not.toBe(next.id);
  });

  it("rejects actions on a delivery that is not the active one", async () => {
    const { repo } = setup();
    expect((await failure(repo.act("nope", { type: "accept" }))).reason).toBe("INVALID_TRANSITION");
  });
});
