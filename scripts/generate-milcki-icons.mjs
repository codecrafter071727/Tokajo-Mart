// Regenerates favicons from apps/warehouse-web/public/logo.png (full Milcki lockup).
// Run: node scripts/generate-milcki-icons.mjs

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const py = join(root, "scripts/generate-milcki-icons.py");
const venv = "/tmp/milcki-icons";

try {
  execSync(`${venv}/bin/python3 -c "import PIL"`, { stdio: "pipe" });
} catch {
  execSync(`python3 -m venv ${venv} && ${venv}/bin/pip install -q pillow`, {
    stdio: "inherit",
    shell: true,
  });
}
execSync(`${venv}/bin/python3 ${JSON.stringify(py)}`, { stdio: "inherit" });

for (const f of [
  join(root, "apps/warehouse-web/public/favicon.ico"),
  join(root, "apps/admin-web/public/favicon.ico"),
]) {
  const head = readFileSync(f).subarray(0, 4);
  if (head[0] !== 0 || head[1] !== 0) throw new Error(`Invalid ICO: ${f}`);
}
