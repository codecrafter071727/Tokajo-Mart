// Shared helpers for the k6 load tests. Plain k6 JavaScript, no remote imports.
import http from "k6/http";
import { check, fail } from "k6";
import { Counter } from "k6/metrics";

export const BASE_URL = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

// Load is only ever pointed at a machine we own. Anything else needs a deliberate code change.
const host = BASE_URL.replace(/^https?:\/\//, "").split(/[/:]/)[0];
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  throw new Error(`Refusing to load test ${BASE_URL}: only localhost is allowed.`);
}

/** Requests the services answered with 429. Counted apart from real errors (see README). */
export const rateLimited = new Counter("rate_limited");

export const PROFILE = __ENV.PROFILE || "smoke";

/**
 * Staged ramps. smoke stays well under the per service limit of 300 requests a minute, so it should
 * pass cleanly on a laptop. load and stress are expected to meet that limit (see README).
 */
export function stages(shape) {
  const profiles = {
    smoke: [
      { duration: "10s", target: shape.smoke },
      { duration: "30s", target: shape.smoke },
      { duration: "10s", target: 0 },
    ],
    load: [
      { duration: "1m", target: shape.load },
      { duration: "3m", target: shape.load },
      { duration: "1m", target: 0 },
    ],
    stress: [
      { duration: "1m", target: shape.load },
      { duration: "2m", target: shape.stress },
      { duration: "2m", target: shape.stress },
      { duration: "1m", target: 0 },
    ],
  };
  const chosen = profiles[PROFILE];
  if (!chosen) fail(`Unknown PROFILE ${PROFILE}. Use smoke, load or stress.`);
  return chosen;
}

const JSON_HEADERS = { "content-type": "application/json", accept: "application/json" };

function track(res) {
  if (res.status === 429) rateLimited.add(1);
  return res;
}

export function get(path, token, tags = {}) {
  const headers = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return track(http.get(`${BASE_URL}${path}`, { headers, tags }));
}

export function post(path, body, token, extraHeaders = {}, tags = {}) {
  const headers = { ...JSON_HEADERS, ...extraHeaders };
  if (token) headers.authorization = `Bearer ${token}`;
  return track(http.post(`${BASE_URL}${path}`, JSON.stringify(body ?? {}), { headers, tags }));
}

export function json(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

/** A run specific stem so phone numbers and idempotency keys never collide with earlier runs. */
export function runStem() {
  return String(Date.now()).slice(-6);
}

/**
 * Signs a phone in with the demo code. Only works while the identity service runs with
 * OTP_MODE=demo (the default outside production). Each call uses one of the phone's five codes an
 * hour, so scripts sign in once in setup() and reuse the session.
 */
export function signInWithOtp(phone, role = "customer") {
  const code = role === "rider" ? "123456" : "1234";
  const req = post(
    "/v1/identity/auth/otp/request",
    { phone, role },
    null,
    {},
    { name: "otp_request" },
  );
  if (!check(req, { "otp requested": (r) => r.status === 200 })) {
    fail(`OTP request for ${phone} failed: ${req.status} ${req.body}`);
  }
  const res = post(
    "/v1/identity/auth/otp/verify",
    { phone, role, code, name: "Load Test" },
    null,
    {},
    { name: "otp_verify" },
  );
  if (!check(res, { "signed in": (r) => r.status === 200 })) {
    fail(`Sign in for ${phone} failed: ${res.status} ${res.body}`);
  }
  return json(res);
}

export function signInWithPassword(email, password) {
  const res = post("/v1/identity/auth/login", { email, password }, null, {}, { name: "login" });
  if (!check(res, { "staff signed in": (r) => r.status === 200 })) {
    fail(`Login for ${email} failed: ${res.status} ${res.body}`);
  }
  return json(res);
}

/**
 * The identity service allows 10 sign in requests a minute per client address, and behind the
 * gateway every request comes from the gateway's address. A sign in is two requests, so setup()
 * waits this long after each one.
 */
export const SIGN_IN_PAUSE_S = 13;

/** Common thresholds. Numbers are ours: ARCHITECTURE.md alerts on gateway p95 but sets no figure. */
export const baseThresholds = {
  http_req_failed: ["rate<0.01"],
  checks: ["rate>0.99"],
};
