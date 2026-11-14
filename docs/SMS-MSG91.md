# Sign in codes by SMS (MSG91)

The identity service creates and checks every code itself. MSG91 only delivers it, through its
OTP API (`POST https://control.msg91.com/api/v5/otp`). The code is never stored, only a keyed
hash of it.

## What you need from MSG91

1. An MSG91 account with SMS credits.
2. **DLT registration** (required by TRAI for any SMS in India). Register the business as a
   Principal Entity on a DLT portal (Jio, Vodafone Idea, Airtel or BSNL), register a 6 letter
   sender id (header), and get an OTP **content template** approved, for example:

   `##OTP## is your Milcki code. It is valid for 5 minutes. Do not share it with anyone.`

   Approval usually takes a few working days. Add the DLT entity id, header and template id in
   MSG91 so its template is linked to the approved one.

3. In MSG91, create the OTP template (OTP section) using that DLT template. Its id is the
   `MSG91_TEMPLATE_ID`. Customers get 4 digits and riders 6, so the template must use `##OTP##`
   and not a fixed length.
4. Your auth key from the MSG91 dashboard is `MSG91_AUTH_KEY`.

## Turn it on

Add to the root `.env` (never commit it):

```
OTP_MODE=sms
MSG91_AUTH_KEY=...
MSG91_TEMPLATE_ID=...
# Optional: numbers that accept the demo code (1234, riders 123456) without an SMS,
# for app store reviewers and QA. Keep this short and remove numbers you no longer need.
OTP_TEST_NUMBERS=+919810000099
```

Restart the identity service. With `OTP_MODE=sms`:

- the fixed demo code stops working for everyone except `OTP_TEST_NUMBERS`
- the app shows the real code length and no demo hint
- if MSG91 fails (bad key, unapproved template, no credit, timeout) the app gets a 503 with
  "We could not send the code right now", the failed try does not count against the hourly
  limit, and the reason is logged without the code or the key

Production refuses to start in sms mode without both MSG91 values, and never falls back to demo
mode on its own.

## Limits that stay on

5 codes per number per hour, 5 wrong tries per code, 5 minute expiry, and a stricter rate limit
on the sign in routes at the gateway.
