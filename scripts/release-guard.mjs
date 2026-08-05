import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const scanFiles = tracked.filter((file) => !file.startsWith("drizzle/meta/") && !["package-lock.json"].includes(file) && [".ts", ".tsx", ".js", ".mjs", ".json", ".jsonc", ".yml", ".yaml", ".md", ".sql"].includes(extname(file)));
const secretPatterns = [
  { name: "Stripe secret key", pattern: /sk_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: "Resend API key", pattern: /re_[A-Za-z0-9_\-]{20,}/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: "private PEM key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];
for (const file of scanFiles) {
  const content = readFileSync(file, "utf8");
  for (const secret of secretPatterns) assert.equal(secret.pattern.test(content), false, `${secret.name} may be committed in ${file}`);
}

const config = readFileSync("wrangler.production.jsonc", "utf8");
assert.match(config, /"workers_dev"\s*:\s*false/);
assert.match(config, /"preview_urls"\s*:\s*false/);
assert.match(config, /"head_sampling_rate"\s*:\s*0\.1/);

const api = readFileSync("worker/api.ts", "utf8");
assert.doesNotMatch(api, /\/api\/(?:location\/search|location\/reverse|stores\/search|recipes\/search)"\s*&&\s*request\.method\s*===\s*"GET"/);
assert.match(api, /url\.pathname === "\/api\/account"/);
assert.match(api, /revoked_at IS NULL/);

const builtAssets = tracked.length && execFileSync("find", ["dist/client", "-type", "f"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const javascript = builtAssets.filter((file) => file.endsWith(".js"));
const styles = builtAssets.filter((file) => file.endsWith(".css"));
const totalJs = javascript.reduce((total, file) => total + statSync(file).size, 0);
assert.ok(javascript.every((file) => statSync(file).size <= 250_000), "A client JavaScript asset exceeds the 250 KB release budget.");
assert.ok(totalJs <= 500_000, `Client JavaScript totals ${totalJs} bytes and exceeds the 500 KB release budget.`);
assert.ok(styles.every((file) => statSync(file).size <= 100_000), "A stylesheet exceeds the 100 KB release budget.");

console.log(`Release guard passed: ${scanFiles.length} tracked files scanned; ${totalJs} bytes of client JavaScript.`);
