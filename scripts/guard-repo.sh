#!/usr/bin/env bash
# Fails when tracked files look like the "init" payload / auto-run task attack:
# hidden code padded far to the right, install-free `node init` hooks, VS Code
# tasks that run on folder open, or fake font files that are really scripts.
# Uses git and grep only, so it can run before `pnpm install`.
set -u
fail=0
say() { echo "::error::$1"; fail=1; }

# 1. Files named `init` (no extension) or `.orc`, which have no business here
bad=$(git ls-files | grep -E '(^|/)init$|\.orc$' || true)
[ -n "$bad" ] && say "Suspicious files tracked: $(echo "$bad" | tr '\n' ' ')"

# 2. package.json scripts that run `node init`
bad=$(git grep -lE '"[a-zA-Z:]+": *"[^"]*node +\.?/?init([^a-zA-Z0-9_./-]|$)' -- '*package.json' || true)
[ -n "$bad" ] && say "package.json runs 'node init': $(echo "$bad" | tr '\n' ' ')"

# 3. VS Code auto-run tasks and automatic task permission
bad=$(git grep -lE '"runOn": *"folderOpen"|"task\.allowAutomaticTasks": *(true|"on")' -- '.vscode/*' '*/.vscode/*' || true)
[ -n "$bad" ] && say "VS Code auto-run task: $(echo "$bad" | tr '\n' ' ')"

# 4. Code hidden behind long runs of spaces, or absurdly long lines, in source files
src='\.(js|mjs|cjs|ts|tsx|jsx)$'
for f in $(git ls-files | grep -E "$src" | grep -vE '(^|/)(public|dist|build|\.next)/|\.min\.'); do
  if grep -qE ' {200,}' "$f" 2>/dev/null; then say "Long whitespace padding (hidden code?): $f"; continue; fi
  if awk 'length($0) > 2000 { found=1; exit } END { exit !found }' "$f" 2>/dev/null; then
    say "Line longer than 2000 characters: $f"
  fi
done

[ "$fail" -eq 0 ] && echo "guard-repo: clean"
exit "$fail"
