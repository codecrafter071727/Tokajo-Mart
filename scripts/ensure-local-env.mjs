import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const example = path.join(root, ".env.example");
const envPath = path.join(root, ".env");

if (!fs.existsSync(example)) {
  throw new Error("Missing .env.example at repo root");
}

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(example, envPath);
  console.log("created .env");
} else if (!fs.readFileSync(envPath, "utf8").includes("GATEWAY_PORT=")) {
  const backup = path.join(root, ".env.bak");
  fs.copyFileSync(envPath, backup);
  fs.copyFileSync(example, envPath);
  console.log("updated .env from .env.example (previous file saved as .env.bak)");
}

for (const name of fs.readdirSync(path.join(root, "services"))) {
  const dir = path.join(root, "services", name);
  if (!fs.statSync(dir).isDirectory()) {
    continue;
  }
  for (const file of [".env", ".env.example"]) {
    const target = path.join(dir, file);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`removed services/${name}/${file}`);
    }
  }
}
