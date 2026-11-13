# Sign in codes not delivered

Codes are created and checked by the identity service. In `OTP_MODE=sms` it sends them through
the MSG91 OTP API; in `demo` mode it accepts `1234` (customers) and `123456` (riders) and sends
nothing. Setup is in [../SMS-MSG91.md](../SMS-MSG91.md).

## Symptoms

- The app shows "We could not send the code right now" (HTTP 503 from
  `POST /v1/identity/auth/otp/request`).
- The app says the code was sent but nothing arrives.
- "Too many codes requested" (429): 5 codes per phone per hour is the limit, on purpose.

## Checks

```bash
grep -h "sms delivery failed" .dev-stack/identity.log | tail -20   # reason, never the code or key
```

```sql
-- Codes asked for in the last hour by one number (only a hash of the code is stored)
select created_at, expires_at, attempts, consumed_at
from identity.otp_challenges where phone = '+91XXXXXXXXXX' order by created_at desc limit 10;
```

Read the reason in the log:

| Reason contains                    | Meaning and fix                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `401` or `Invalid authkey`         | wrong `MSG91_AUTH_KEY`; rotate it ([rotating-secrets.md](rotating-secrets.md)) |
| template not approved or not found | `MSG91_TEMPLATE_ID` wrong, or the DLT template is not linked or approved yet   |
| balance or credit                  | top up MSG91                                                                   |
| `timed out` or `not reachable`     | MSG91 or the network is down; retry later, check their status page             |

Sent but not received usually means DLT: the sender id or template is not approved on the
operator's DLT portal, or the message text differs from the approved template. Check the delivery
report in the MSG91 dashboard for that number.

## Fixes

- For app store reviewers or QA, add numbers to `OTP_TEST_NUMBERS` (they accept the demo code and
  get no SMS). Remove them afterwards.
- A customer locked out by the hourly limit can try again after an hour. Do not delete their
  `otp_challenges` rows to get around it unless it was our fault (for example a delivery outage);
  a failed send already does not count against them.
- Never switch production to `OTP_MODE=demo`; anyone could then sign in as anyone.

## Escalate

No customer can sign in for more than 10 minutes is SEV1.
