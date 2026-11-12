import { createHmac, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { tokenClaimsSchema, type Role, type TokenClaims } from "@qc/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

// ---------------------------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------------------------

export const DEV_JWT_SECRET = "dev-only-jwt-secret-do-not-use-in-production-0123456789";

export type AccessTokenInput = { userId: string; role: Role; warehouseId?: string | null };

export async function signAccessToken(
  input: AccessTokenInput,
  options: { secret: string; ttlSeconds: number; issuer?: string; now?: Date },
): Promise<string> {
  const iat = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const jwt = new SignJWT({
    app_role: input.role,
    ...(input.warehouseId ? { warehouse_id: input.warehouseId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + options.ttlSeconds);
  if (options.issuer) jwt.setIssuer(options.issuer);
  return jwt.sign(new TextEncoder().encode(options.secret));
}

export class TokenError extends Error {
  readonly statusCode = 401;
  constructor(message = "Invalid or expired token.") {
    super(message);
    this.name = "TokenError";
  }
}

export type TokenVerifier = (token: string) => Promise<TokenClaims>;

/**
 * Verifies an access token and returns its claims. Uses a shared secret (the local identity
 * service signs with it) or a remote JWKS (Supabase Auth in production). Only the claims are
 * trusted, and only after the signature, expiry and shape all check out.
 */
export function createTokenVerifier(options: {
  secret?: string;
  jwksUrl?: string;
  issuer?: string;
}): TokenVerifier {
  const jwks = options.jwksUrl ? createRemoteJWKSet(new URL(options.jwksUrl)) : undefined;
  const key = options.secret ? new TextEncoder().encode(options.secret) : undefined;
  if (!jwks && !key) throw new Error("A token verifier needs a secret or a JWKS url.");

  return async (token) => {
    try {
      const verifyOptions = {
        algorithms: jwks ? ["RS256", "ES256"] : ["HS256"],
        issuer: options.issuer,
      };
      const { payload } = jwks
        ? await jwtVerify(token, jwks, verifyOptions)
        : await jwtVerify(token, key as Uint8Array, verifyOptions);
      const claims = tokenClaimsSchema.safeParse(payload);
      if (!claims.success) throw new TokenError();
      return claims.data;
    } catch (error) {
      if (error instanceof TokenError) throw error;
      throw new TokenError();
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Identity forwarded by the gateway
// ---------------------------------------------------------------------------------------------

export type Identity = { userId: string; role: Role; warehouseId: string | null };

const H = {
  userId: "x-user-id",
  role: "x-user-role",
  warehouseId: "x-warehouse-id",
  signature: "x-gateway-signature",
} as const;

const sign = (identity: Identity, key: string) =>
  createHmac("sha256", key)
    .update(`${identity.userId}|${identity.role}|${identity.warehouseId ?? ""}`)
    .digest("hex");

/** Headers the gateway adds to a proxied request, signed so a service can tell they are genuine. */
export function signIdentityHeaders(identity: Identity, key: string): Record<string, string> {
  return {
    [H.userId]: identity.userId,
    [H.role]: identity.role,
    [H.warehouseId]: identity.warehouseId ?? "",
    [H.signature]: sign(identity, key),
  };
}

export function readIdentityHeaders(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): Identity | null {
  const get = (name: string) =>
    typeof headers[name] === "string" ? (headers[name] as string) : undefined;
  const userId = get(H.userId);
  const role = get(H.role);
  const signature = get(H.signature);
  if (!userId || !role || !signature) return null;

  const identity: Identity = {
    userId,
    role: role as Role,
    warehouseId: get(H.warehouseId) || null,
  };
  const expected = Buffer.from(sign(identity, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return identity;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Who is calling, from the gateway's signed headers. Null for public or unauthenticated calls. */
    identity: Identity | null;
  }
}

export const DEV_INTERNAL_KEY = "dev-only-internal-key";

/** Reads and verifies the gateway's identity headers on every request. */
export function registerGatewayIdentity(
  app: FastifyInstance,
  options: { key: string | undefined },
): void {
  const key = options.key ?? DEV_INTERNAL_KEY;
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    request.identity = readIdentityHeaders(request.headers, key);
  });
}

// ---------------------------------------------------------------------------------------------
// Guards used inside route handlers (fine grained rules stay in each service)
// ---------------------------------------------------------------------------------------------

export class AuthError extends Error {
  readonly statusCode: 401 | 403;
  constructor(statusCode: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

/** The caller must be signed in. Returns who they are. */
export function requireIdentity(request: FastifyRequest): Identity {
  if (!request.identity) throw new AuthError(401, "Sign in to continue.");
  return request.identity;
}

/** The caller must be signed in with one of these roles. */
export function requireRole(request: FastifyRequest, ...roles: Role[]): Identity {
  const identity = requireIdentity(request);
  if (!roles.includes(identity.role)) throw new AuthError(403, "You are not allowed to do this.");
  return identity;
}

/** Warehouse staff may only touch their own warehouse. Admins may touch any. */
export function assertWarehouseScope(identity: Identity, warehouseId: string): void {
  if (identity.role === "admin") return;
  if (identity.warehouseId !== warehouseId)
    throw new AuthError(403, "That belongs to another warehouse.");
}
