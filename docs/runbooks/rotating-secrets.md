# Rotating secrets

Rotate on a schedule (every 90 days), when someone with access leaves, and immediately after any
suspected leak. Secrets live in the environment (root `.env` locally, the platform's secret store
in production), never in the repo. After rotating, restart the services that read the value.

| Secret                                      | Read by                            | Effect of rotating                                                 |
| ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `JWT_SECRET`                                | identity (signs), gateway (checks) | every access token stops working; apps refresh or sign in again    |
| `INTERNAL_API_KEY`                          | every service                      | service to service calls and signed identity headers must match    |
| `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` | payment                            | new checkouts use the new key; generate in the Razorpay dashboard  |
| `RAZORPAY_WEBHOOK_SECRET`                   | payment                            | must match the secret set on the webhook in the Razorpay dashboard |
| `MSG91_AUTH_KEY`                            | identity                           | SMS stops until the new key is in place                            |

## JWT_SECRET

1. Generate: `openssl rand -base64 48`.
2. Set it for identity and gateway together, then restart both. Mismatched values mean every
   signed in request fails with 401.
3. Access tokens are short lived (1 hour). Refresh tokens are stored hashed in
   `identity.refresh_tokens` and keep working, so most users will not notice. After a leak, also
   revoke them all so everyone signs in again:
   ```sql
   update identity.refresh_tokens set revoked_at = now() where revoked_at is null;
   ```

## INTERNAL_API_KEY

1. Generate: `openssl rand -hex 32`.
2. Set it on every service at once and restart them all in the order in
   [service-down.md](service-down.md). The gateway signs identity headers with it and every
   service checks them, so a partial rollout breaks signed in requests until all match.

## Razorpay

1. Razorpay dashboard, API keys, regenerate. Put the new id and secret in place, restart payment.
2. For the webhook secret, change it on the webhook in the dashboard and in
   `RAZORPAY_WEBHOOK_SECRET` within a few minutes of each other. Webhooks that fail meanwhile are
   retried by Razorpay; the app's own signature check keeps confirming payments in between.

## MSG91

Regenerate the auth key in the MSG91 dashboard, set `MSG91_AUTH_KEY`, restart identity, and
request a code to a test phone to confirm.

## After a leak

Also follow [../SECURITY-CLEANUP.md](../SECURITY-CLEANUP.md): check access logs, remove unknown
admin and staff accounts (admin, Team), and rotate the database password.
