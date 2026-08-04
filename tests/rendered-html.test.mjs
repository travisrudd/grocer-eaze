import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("ships product-specific metadata and no starter preview", async () => {
  const [layout, page, packageJson, robots, sitemap] = await Promise.all([
    source("app/layout.tsx"),
    source("app/page.tsx"),
    source("package.json"),
    source("app/robots.ts"),
    source("app/sitemap.ts"),
  ]);

  assert.match(layout, /Grocer-Eaze \| Better Food, Less Waste/);
  assert.match(layout, /metadataBase: new URL\("https:\/\/grocer-eaze\.com"\)/);
  assert.match(layout, /alternates: \{ canonical: "\/" \}/);
  assert.match(layout, /robots: \{ index: true, follow: true/);
  assert.match(layout, /"@type": "WebApplication"/);
  assert.match(robots, /sitemap: "https:\/\/grocer-eaze\.com\/sitemap\.xml"/);
  assert.match(sitemap, /url: "https:\/\/grocer-eaze\.com\/"/);
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

test("supports location search controls and keeps recipe providers out of the footer", async () => {
  const page = await source("app/page.tsx");

  assert.match(page, /Use my location/);
  assert.match(page, /Clear shopping location/);
  assert.match(page, /aria-autocomplete="list"/);
  assert.match(page, /Plan preferences/);
  assert.doesNotMatch(page, /recipeSourceLinks/);
});

test("combines a cached catalog, TheMealDB, and user-controlled web recipe imports", async () => {
  const [page, api, worker, schema] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("worker/index.ts"),
    source("db/schema.ts"),
  ]);

  assert.match(api, /THEMEALDB_API_KEY/);
  assert.match(worker, /THEMEALDB_API_KEY/);
  assert.match(api, /themealdb\.com\/api\/json\/v2/);
  assert.match(api, /recipe_catalog/);
  assert.match(schema, /recipeCatalog/);
  assert.match(api, /\/api\/recipes\/import/);
  assert.match(api, /application\\\/ld\\\+json/);
  assert.match(page, /Search the web ↗/);
  assert.match(page, /www\.google\.com\/search/);
  assert.match(page, /Import recipe/);
  assert.doesNotMatch(api, /google\.com\/search[\s\S]*fetch/);
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

test("locks paid features and ships the updated membership price", async () => {
  const [page, api, auth] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("worker/auth.ts"),
  ]);

  assert.match(page, /<b>\$49<\/b> \/ year/);
  assert.match(page, /BEST VALUE · SAVE \$71/);
  assert.doesNotMatch(page, /<b>\$99<\/b> \/ year/);
  assert.match(page, /user\.hasAccess/);
  assert.match(api, /code: "PAYMENT_REQUIRED"/);
  assert.match(api, /hasProductAccess\(sessionUser\)/);
  assert.match(auth, /"pending", null/);
});

test("shares grocery lists cross-platform and safely links emailed recipes", async () => {
  const [page, api] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
  ]);

  assert.match(page, /navigator\.share/);
  assert.match(page, /Apple Reminders, Notes, Google Tasks, Keep/);
  assert.match(page, /Choose what happens next/);
  assert.match(page, /Select all/);
  assert.match(page, /meals: plannedMeals\.map/);
  assert.match(api, /recipients/);
  assert.match(api, /linkedTitle = recipeUrl \? `<a href=/);
  assert.match(api, /escapeHtml\(recipeUrl\)/);
});

test("resolves recipe thumbnails from source metadata with a licensed fallback", async () => {
  const [page, api] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
  ]);

  assert.match(page, /\/api\/recipe-image/);
  assert.match(page, /meal\.image \|\| recipeThumbnail\(meal\)/);
  assert.match(api, /"og:image"/);
  assert.match(api, /api\.pexels\.com\/v1\/search/);
  assert.match(api, /PEXELS_API_KEY/);
});

test("restores returning accounts and hardens passwordless sign-in", async () => {
  const [page, auth, api, worker] = await Promise.all([
    source("app/page.tsx"),
    source("worker/auth.ts"),
    source("worker/api.ts"),
    source("worker/index.ts"),
  ]);

  assert.match(page, /Returning households are restored automatically/);
  assert.match(page, /reloadPersonalData/);
  assert.match(auth, /code: "NAME_REQUIRED"/);
  assert.match(auth, /auth_rate_limits/);
  assert.match(auth, /constantTimeEqual/);
  assert.match(api, /sec-fetch-site/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /X-Frame-Options/);
  assert.match(worker, /X-Content-Type-Options/);
  assert.match(worker, /Strict-Transport-Security/);
});

test("keeps school lunches separate and turns merged ingredients into editable totals", async () => {
  const [page, api] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
  ]);

  assert.match(page, /const lunchTarget = totalLunchDays/);
  assert.match(page, /const \[planDays, setPlanDays\] = useState\(7\)/);
  assert.match(page, /const \[adults, setAdults\] = useState\(2\)/);
  assert.match(page, /const \[kids, setKids\] = useState\(0\)/);
  assert.match(page, /const servingEquivalents = adults \+ kids \* \.5/);
  assert.match(page, /weekdaysInPlan/);
  assert.match(page, /Choose between 1 and 31 consecutive days/);
  assert.match(page, /Try to reuse ingredients/);
  assert.match(page, /Individual chip bags/);
  assert.match(page, /Clear selections/);
  assert.match(page, /suggestedQuantity/);
  assert.match(page, /Total amount needed for/);
  assert.match(page, /Already have/);
  assert.match(page, /Confirm ingredients & build shopping list/);
  assert.match(page, /Review the list you’ll take shopping/);
  assert.match(page, /This is your final shopping list—not optional add-ons/);
  assert.match(page, /Approve list & choose how to send or save/);
  assert.match(page, /canonicalIngredientKey/);
  assert.match(page, /mergeIngredientQuantities/);
  assert.match(page, /Amount not provided/);
  assert.match(page, /Use as needed/);
  assert.match(page, /Report incorrect value/);
  assert.match(page, /\/api\/ingredient-feedback/);
  assert.match(page, /grocery-approval-actions/);
  assert.match(page, /confirmedIngredientsSignature/);
  assert.match(api, /WHERE id = \? AND owner_id = \?/);
  assert.match(api, /url\.pathname === "\/api\/ingredient-feedback"/);
  assert.match(api, /hasProductAccess\(sessionUser\)/);
});

test("tracks recipe provider expansion as a release-safe backlog item", async () => {
  const backlog = await source("docs/product-backlog.md");
  assert.match(backlog, /FatSecret Platform API/);
  assert.match(backlog, /complete ingredient quantities/);
  assert.match(backlog, /graceful fallback/);
});

test("prepares a secure Instacart shopping-list handoff", async () => {
  const [page, api, worker] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("worker/index.ts"),
  ]);

  assert.match(page, /Open in Instacart/);
  assert.match(page, /\/api\/instacart\/shopping-list/);
  assert.match(api, /INSTACART_API_KEY/);
  assert.match(worker, /INSTACART_API_KEY/);
  assert.match(api, /connect\.instacart\.com\/idp\/v1\/products\/products_link/);
  assert.match(api, /hasProductAccess\(sessionUser\)/);
  assert.match(api, /instacartShopping: Boolean\(env\.INSTACART_API_KEY\)/);
  assert.match(page, /instacartEnabled &&/);
});

test("syncs active plans to owner-scoped account storage with a device fallback", async () => {
  const [page, api, schema] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("db/schema.ts"),
  ]);

  assert.match(page, /grocer-eaze-active-plan:\$\{authData\.user\.id\}/);
  assert.match(page, /grocer-eaze-active-plan:\$\{planStorageOwnerId\}/);
  assert.match(page, /fetch\("\/api\/active-plan"/);
  assert.match(api, /WHERE owner_id = \?/);
  assert.match(api, /INSERT INTO active_plans/);
  assert.match(schema, /activePlans/);
  assert.match(page, /removeItem\("grocer-eaze-active-plan"\)/);
  assert.match(page, /window\.location\.replace\("\/#account"\)/);
});

test("retains prioritized nearby stores at the account level", async () => {
  const [page, api] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
  ]);

  assert.match(page, /Store priorities/);
  assert.match(page, /preferredStores, storeRadius, locationCoordinates/);
  assert.match(page, /movePreferredStore/);
  assert.match(page, /\/api\/stores\/search/);
  assert.match(api, /overpass-api\.de\/api\/interpreter/);
  assert.match(api, /distanceInMiles/);
});

test("recovers approved administrators after the hosting migration", async () => {
  const [page, auth, worker, config, workflow] = await Promise.all([
    source("app/page.tsx"),
    source("worker/auth.ts"),
    source("worker/index.ts"),
    source("wrangler.production.jsonc"),
    source(".github/workflows/cloudflare-deploy.yml"),
  ]);

  assert.match(auth, /INITIAL_ADMIN_EMAILS/);
  assert.match(auth, /split\(","\)/);
  assert.match(auth, /isInitialAdmin \? "admin" : "user"/);
  assert.match(page, /Administrator access/);
  assert.match(page, /administrator account does not require billing/);
  assert.match(worker, /INITIAL_ADMIN_EMAILS/);
  assert.match(config, /"database_name": "grocer-eaze-production"/);
  assert.match(config, /"INITIAL_ADMIN_EMAILS"/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /wrangler\.production\.jsonc/);
});
