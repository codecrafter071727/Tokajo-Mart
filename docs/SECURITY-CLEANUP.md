# Security cleanup checklist

What happened: a worm-style payload (an obfuscated `init` file, hooked into `package.json` scripts and a hidden `.vscode/tasks.json` that runs on folder open) got into this repo and other repos on Vishu's Mac. It was force-pushed to `main` as commit `91ffad0` on 2026-11-10 by the `codecrafter071727` account. Both accounts and both machines should be treated as exposed until proven otherwise.

## Already done (2026-11-10)

- `main` on GitHub is clean: content restored to the last good tree (`6b08ef4`), no `init`, no `.vscode`, no postcss injection. No force-push was needed.
- All 15 dependabot branches deleted (7 of them carried the payload). Their PRs are closed. Dependabot will recreate the routine ones on its next run; review them before merging.
- Checked CI: the deploy jobs were skipped and the migrate step skipped (`SUPABASE_DB_URL` not set), so no cloud deploy or database was touched. The CI job failed at Format before any build, and the poisoned hooks were only on `build`, `dev` and `start`, not on install.
- `scripts/guard-repo.sh` and `.github/workflows/security-guard.yml` are written and tested but **not committed yet** (see step 4).

## Do these in order, from a CLEAN device (phone or another computer), not the infected Macs

### 1. Both of you: stop using the infected Macs for logins

Do not open these repos in VS Code or Cursor and do not run `pnpm dev`, `start` or `build` on them until the machine is cleaned. Evidence on Vishu's Mac: `~/.node_modules` (created 2026-09-23, holds `axios`, `socket.io-client`, `form-data`), plus the same payload inside `~/Movies/tool/frontend`, `~/Movies/cheesyheaven/backend`, `~/Movies/cheesyheaven/kiosk-app` and `~/Inside_the_Boathouse/.../backend-draft`. Anshul, check your machine for the same: `find ~ -type f -name init -size +20k -not -path "*/node_modules/*"` and `ls -d ~/.node_modules`.

### 2. Rotate credentials (from the clean device)

GitHub (revoke all sessions, personal access tokens, SSH keys, authorized OAuth apps; check Settings, Security log), Google, npm, Supabase, GCP, Razorpay, Expo and EAS, Sentry, Firebase, Apple developer, Cloudflare or any DNS host, password manager master password, and any password saved in a browser. Also anything in `.env` files and `~/.gsc-credentials.json`. If any crypto wallet was on the Mac, move the funds from a clean device.

### 3. Repo owner (`codecrafter071727`): lock down `main`

Vishu cannot do this because the account is not an admin. Run from a clean device after `gh auth login`:

```bash
gh api -X PUT repos/codecrafter071727/Tokajo-Mart/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

With two people this means every change needs the other person's approval, so one stolen account cannot push to `main` alone. Also in the repo settings: re-create every Actions secret and the `staging` environment secrets with the new values, and review Settings, Webhooks and Deploy keys.

### 4. Commit the guard (from a clean device)

Copy `scripts/guard-repo.sh` and `.github/workflows/security-guard.yml` into a branch, open a PR, and have the other person review it. After it has run once, add "Security guard / guard" as a required check in the branch protection rule.

### 5. Clean the Macs

Best: back up documents only (not code, not `node_modules`), wipe, and reinstall macOS. Minimum: remove `~/.node_modules`, remove every `init` payload and every `.vscode/tasks.json` that references it, run a malware scanner, then re-clone repos fresh. In VS Code and Cursor set `task.allowAutomaticTasks` to `off` and keep Workspace Trust on.

### 6. Tell the people affected

`Luxsun-Startech/cheesyheaven` (a client or partner repo) and `vishuRizz/blog-writing-tool` have the payload committed. Clean them on `main` and tell the owners. Anyone who cloned these and ran `pnpm`/`npm start` or opened them in VS Code is exposed.
