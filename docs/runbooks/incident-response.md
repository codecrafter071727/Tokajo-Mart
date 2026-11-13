# Incident response basics

## Severity

| Level | Meaning                                                             | Response                    |
| ----- | ------------------------------------------------------------------- | --------------------------- |
| SEV1  | customers cannot order or pay, or money or data is at risk          | drop everything, both of us |
| SEV2  | one area broken with a workaround (one warehouse, one payment mode) | owner within 30 minutes     |
| SEV3  | cosmetic or internal only                                           | next working day            |

## First ten minutes

1. Say it out loud in the team chat: what is broken, since when, who is on it. One person leads.
2. Check health and recent changes:
   ```bash
   for p in 4000 4001 4002 4003 4004 4005 4006 4007; do printf "$p "; curl -s -m3 localhost:$p/health/ready; echo; done
   git log --oneline -10
   ```
3. Look at the logs of the failing service (see [service-down.md](service-down.md)). Every
   request has an `x-request-id`; the same id appears in every service it touched, so grep for it.
4. Stop the bleeding before finding the cause:
   - a bad deploy: roll back to the previous image or commit
   - online payments failing: COD keeps working; tell customers in the app banner (admin, Banners)
   - one warehouse in trouble: close it in admin (Warehouses, Close) so new orders go elsewhere
5. Write down times and actions as you go; it becomes the postmortem.

## Rules

- Never fix data by hand without a written query and a second reader. Prefer the admin screens
  and the service endpoints, which keep the ledgers and history right.
- Never share customer phone numbers, delivery codes or payment ids outside the incident channel.
- Never force push or rewrite `main`, even to remove a bad commit. Revert it.
- If anything looks like a security breach (unknown admin, leaked key, strange code in the repo),
  rotate secrets first ([rotating-secrets.md](rotating-secrets.md)) and read
  [../SECURITY-CLEANUP.md](../SECURITY-CLEANUP.md).

## After

A short postmortem within two days: what happened, impact, timeline, root cause, what we change
so it cannot happen the same way again. No blame.
