// Packing screens: every open warehouse tablet polls the queue and the handover list every 4
// seconds, which is what the warehouse web app does. One manager session is shared.
import { check, sleep } from "k6";
import { baseThresholds, get, signInWithPassword, stages } from "./lib.js";

export const options = {
  scenarios: {
    tablets: { executor: "ramping-vus", stages: stages({ smoke: 2, load: 10, stress: 30 }) },
  },
  thresholds: {
    ...baseThresholds,
    "http_req_duration{name:queue}": ["p(95)<300"],
    "http_req_duration{name:handovers}": ["p(95)<300"],
  },
};

export function setup() {
  const email = __ENV.MANAGER_EMAIL || "manager@milcki.dev";
  const password = __ENV.MANAGER_PASSWORD || "milcki-dev";
  return { token: signInWithPassword(email, password).accessToken };
}

export default function (data) {
  const queue = get("/v1/orders/queue", data.token, { name: "queue" });
  check(queue, { "queue 200": (r) => r.status === 200 });
  const handovers = get("/v1/delivery/handovers", data.token, { name: "handovers" });
  check(handovers, { "handovers 200": (r) => r.status === 200 });
  sleep(4);
}
