// Riders on duty poll their state every 4 seconds, which is what the rider app does while online.
// The three seeded riders sign in once in setup() and go online; VUs share their sessions, so many
// VUs stand in for many phones. Riders go offline again in teardown().
import { check, sleep } from "k6";
import { SIGN_IN_PAUSE_S, baseThresholds, get, post, signInWithOtp, stages } from "./lib.js";

const RIDERS = (__ENV.RIDER_PHONES || "+919810000011,+919810000012,+919810000013").split(",");

export const options = {
  setupTimeout: `${Math.ceil(RIDERS.length * SIGN_IN_PAUSE_S + 60)}s`,
  scenarios: {
    riders: { executor: "ramping-vus", stages: stages({ smoke: 3, load: 15, stress: 45 }) },
  },
  thresholds: {
    ...baseThresholds,
    "http_req_duration{name:rider_state}": ["p(95)<300"],
  },
};

export function setup() {
  const tokens = [];
  for (const phone of RIDERS) {
    const token = signInWithOtp(phone.trim(), "rider").accessToken;
    const online = post(
      "/v1/delivery/me/online",
      { online: true },
      token,
      {},
      { name: "go_online" },
    );
    check(online, { "rider online": (r) => r.status === 200 });
    tokens.push(token);
    sleep(SIGN_IN_PAUSE_S);
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const state = get("/v1/delivery/me", token, { name: "rider_state" });
  check(state, { "state 200": (r) => r.status === 200 });
  sleep(4);
}

export function teardown(data) {
  for (const token of data.tokens) {
    // A rider holding a delivery cannot go offline; that is fine at the end of a test
    post("/v1/delivery/me/online", { online: false }, token, {}, { name: "go_offline" });
  }
}
