# 0002. Our own identity service and JWTs instead of Supabase Auth

Status: accepted, November 2026

## Context

The plan was Supabase Auth with a custom access token hook for roles. We could not use the hosted
Supabase project during development (see 0008), riders and staff need roles and a warehouse claim,
and Indian SMS needs MSG91 with DLT templates under our control.

## Decision

The identity service owns users, roles, OTP challenges (only a keyed hash of each code is stored)
and refresh tokens (rotated on use, with reuse treated as theft). It signs short lived HS256 access
tokens with `JWT_SECRET` carrying `sub`, `app_role` and `warehouse_id`. The gateway verifies them
and forwards an HMAC signed identity to the services. Staff sign in with email and password
(scrypt). SMS delivery goes through MSG91 in `OTP_MODE=sms`.

## Consequences

- No dependency on a hosted auth provider; full control of limits and messages.
- We own the security of sign in: rate limits, attempt limits, token rotation and secret rotation
  (see the rotating secrets runbook).
- Sign in with Apple, Google and email magic links are not available until built.
- The gateway can still verify a JWKS in production if a hosted provider is adopted later.
