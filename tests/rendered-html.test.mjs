import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("ships product-specific metadata and no starter preview", async () => {
  const [layout, page, packageJson] = await Promise.all([
    source("app/layout.tsx"),
    source("app/page.tsx"),
    source("package.json"),
  ]);

  assert.match(layout, /Grocer-Eaze \| Better Food, Less Waste/);
  assert.match(layout, /metadataBase: new URL\("https:\/\/grocer-eaze\.com"\)/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("keeps core accessibility foundations in the product", async () => {
  const [page, css] = await Promise.all([
    source("app/page.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(page, /className="skip-link"/);
  assert.match(page, /<header>/);
  assert.match(page, /<main>/);
  assert.match(page, /<footer className="site-footer">/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /ACCESSIBILITY AT GROCER-EAZE/);
  assert.match(page, /\/api\/accessibility-feedback/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /textarea:focus-visible/);
});

test("includes accessibility and usability checks in the release workflow", async () => {
  const [workflow, checklist, packageJson] = await Promise.all([
    source(".github/workflows/release-quality.yml"),
    source("docs/accessibility-usability-release-checklist.md"),
    source("package.json"),
  ]);

  assert.match(workflow, /Audit accessibility and usability/);
  assert.match(workflow, /npm run ux:audit/);
  assert.match(packageJson, /"ux:audit": "playwright test/);
  assert.match(checklist, /VoiceOver and Safari/);
  assert.match(checklist, /NVDA and Chrome/);
  assert.match(checklist, /400% browser zoom/);
  assert.match(checklist, /General usability/);
});
