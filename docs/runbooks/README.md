# Runbooks

What to do when something goes wrong. Each one lists symptoms, checks with exact commands, fixes,
and when to escalate.

| Runbook                                          | Use it when                                               |
| ------------------------------------------------ | --------------------------------------------------------- |
| [incident-response.md](incident-response.md)     | anything customer facing is broken; start here            |
| [service-down.md](service-down.md)               | a service does not answer or is slow                      |
| [payments-stuck.md](payments-stuck.md)           | paid but not confirmed, webhooks missing, refunds failing |
| [sms-otp.md](sms-otp.md)                         | customers or riders do not get their sign in code         |
| [stock-mismatch.md](stock-mismatch.md)           | stock looks wrong, holds stuck, ledger does not add up    |
| [rider-dispatch.md](rider-dispatch.md)           | packed orders are not reaching riders                     |
| [database-migrations.md](database-migrations.md) | applying or undoing a schema change                       |
| [rotating-secrets.md](rotating-secrets.md)       | a key leaked or is due for rotation                       |

Conventions used below:

- `$DB` is the database URL. Locally `postgresql://localhost:5432/qc_dev`. Never run the write
  queries here against a production database without a second person reading them first.
- `$GW` is the gateway, locally `http://localhost:4000`. Service ports: identity 4001, catalog
  4002, inventory 4003, order 4004, payment 4005, delivery 4006, notification 4007.
- `$KEY` is the `INTERNAL_API_KEY`. `/internal/*` routes are never reachable through the gateway;
  call the service port directly with the header `x-internal-key: $KEY`. With no key set (local
  development only) the header is not needed.
- Money is integer paise: 9400 is ₹94.
