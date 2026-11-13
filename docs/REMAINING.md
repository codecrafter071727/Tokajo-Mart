# What is left to build

Status after wave 3 (nothing here blocks a first order; this is what comes next).

## Code that needs no outside account

1. **Server cart and price preview** with a GST breakup (per product tax rates), and delivery,
   handling and surge fees as admin settings (`platform_settings`) instead of constants. Needs a
   decision on whether prices include tax.
2. **Admin manual rider assignment** and offer expiry cascade; a **rider earnings ledger** and
   payout rules (today a formula in code).
3. **Returns and refund requests**, **ratings and reviews**, **support tickets**, **wallet** and
   **referrals**.
4. **Delivery photo is optional** and stored on local disk; add S3 compatible storage for production.
5. **Merged OpenAPI document** at the gateway, BFF endpoints for the home screen, and a shared
   (Redis backed) rate limit instead of one per instance.
6. **Collections** (curated shelves on the home screen) and product badges.
7. **Playwright** (web) and **Maestro** (mobile) end to end suites; k6 load tests are written but
   have not been run.
8. **Custom metrics and alerts** (order rate, payment failures, dispatch time).
9. **Admin settings screen** and audit log view.

## Needs an account, keys or a decision from you

| Item                          | What you need to do                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SMS sign in codes             | MSG91 account, DLT registration (sender id and OTP template), then set `OTP_MODE=sms`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`. See [SMS-MSG91.md](SMS-MSG91.md).                     |
| Online payments               | Razorpay test keys in `.env` to try the real sheet; KYC for live keys. Create the webhook for `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.               |
| Push notifications            | Firebase project (FCM and APNs key). Devices already register; sending is the missing part.                                                                                         |
| Maps                          | Google Maps keys (server and client) for address lookup, autocomplete and the live tracking map on Android.                                                                         |
| Email                         | Resend (or similar) for receipts and staff invites.                                                                                                                                 |
| Sign in with Apple            | Apple developer account; required by Apple if you offer other social sign in.                                                                                                       |
| Staging and production deploy | The deploy workflows target AWS (ECS, ECR, OIDC); needs the AWS account, GitHub variables, a production database and a domain. Backups and a read only database user for analytics. |
| Monitoring                    | Sentry DSN, uptime checks.                                                                                                                                                          |
| Store submission              | Apple and Google developer accounts, privacy policy, terms and refund policy URLs, store listings, EAS builds.                                                                      |
| Photo storage in production   | A bucket and `POD_STORAGE_DIR` or an S3 setting for delivery photos.                                                                                                                |

## Checks only a person can do

- Run the customer, rider and warehouse apps on a **real phone and tablet** (GPS, camera upload,
  keyboard behaviour, the installable warehouse app and its service worker).
- Try the **real Razorpay sheet** with test keys, including a refund.
- Click through the admin dialogs that were verified through the API only (deletion, invoices,
  service areas, catalog image manager and CSV import).

## Your security tasks (still open)

Revoke old GitHub tokens and sessions, rotate every credential in `.env` (including the Supabase
keys), ask the repo owner to turn on branch protection, clean the other infected repos, and keep
`booking-hub/` out of this repo (it is gitignored because it has its own secrets).
