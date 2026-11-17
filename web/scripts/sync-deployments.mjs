// Copies deployments/*.json (written by deploy scripts) into public/ so the app can fetch them at runtime.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(root, "web/public/deployments");
mkdirSync(out, { recursive: true });
const src = resolve(root, "deployments");
if (existsSync(src)) {
  for (const f of readdirSync(src).filter((f) => f.endsWith(".json"))) cpSync(resolve(src, f), resolve(out, f));
}
