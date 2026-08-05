import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

async function importTypeScriptModule(path) {
  const compiled = ts.transpileModule(await source(path), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
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

test("delivers grocery lists and recipes privately to validated recipients", async () => {
  const [page, api] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
  ]);

  assert.match(page, /type DeliveryRecipient/);
  assert.match(page, /Text message/);
  assert.match(page, /openTextDraft/);
  assert.match(page, /sms:\$\{encodeURIComponent\(recipient\.address\)\}\?&body=\$\{encodeURIComponent\(message\)\}/);
  assert.match(page, /digits\.length < 7 \|\| digits\.length > 15/);
  assert.match(page, /Who else should receive the plan\?/);
  assert.match(page, /Groceries \+ \$\{groceryDateLabel\(\)\}/);
  assert.doesNotMatch(page, /Apple Reminders|Reminder or task list/);
  assert.match(page, /function scrollViewportToTop\(\)/);
  assert.match(page, /root\.style\.scrollBehavior = "auto"/);
  assert.match(page, /window\.scrollTo\(0, 0\)/);
  assert.match(page, /Who should receive your plan/);
  assert.match(page, /Select everything/);
  assert.match(page, /Calendar recipe order/);
  assert.doesNotMatch(page, /Optional ways to save or shop/);
  assert.doesNotMatch(page, /ON THIS DEVICE/);
  assert.match(api, /href="\$\{escapeHtml\(meal\.readerUrl\)\}"/);
  assert.match(page, /meals: plannedMeals\.map/);
  assert.match(api, /recipients/);
  assert.match(api, /href="\$\{escapeHtml\(meal\.sourceUrl\)\}"/);
  assert.match(api, /for \(const recipient of recipients\)/);
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
  assert.match(page, /Create account/);
  assert.match(auth, /sendAccountNotFound/);
  assert.match(auth, /intent === "signup"/);
  assert.doesNotMatch(auth, /NAME_REQUIRED/);
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
  const [page, api, css] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("app/globals.css"),
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
  assert.match(page, /Approve list & choose recipients/);
  assert.match(page, /canonicalIngredientKey/);
  assert.match(page, /mergeIngredientQuantities/);
  assert.match(page, /Amount not provided/);
  assert.match(page, /Use as needed/);
  assert.match(page, /asNeededIngredients/);
  assert.match(page, /disabled=\{useAsNeeded\}/);
  assert.match(page, /schoolLunchSideIngredients/);
  assert.match(page, /Report incorrect value/);
  assert.match(page, /\/api\/ingredient-feedback/);
  assert.match(page, /grocery-approval-actions/);
  assert.match(page, /confirmedIngredientsSignature/);
  assert.match(api, /WHERE id = \? AND owner_id = \?/);
  assert.match(api, /url\.pathname === "\/api\/ingredient-feedback"/);
  assert.match(api, /hasProductAccess\(sessionUser\)/);
  assert.match(api, /concreteFallbackIngredients/);
  assert.match(api, /isConcreteIngredientName/);
  assert.doesNotMatch(api, /extendedIngredients:\s*\[\{ name: "fresh vegetables"/i);
  assert.match(css, /grid-template-columns:\s*minmax\(180px, 1\.2fr\)\s+minmax\(160px, \.85fr\)\s+minmax\(140px, \.65fr\)\s+minmax\(150px, \.7fr\)/);
  assert.match(css, /ingredient-choice-control/);
  assert.match(css, /\.ingredient-choice-control\s*\{[^}]*height:\s*40px[^}]*margin-top:\s*18\.5px/);
  assert.match(css, /\.ingredient-review-list\s*\{\s*display:\s*grid/);
  assert.doesNotMatch(css, /\.ingredient-review-list\s*\{[^}]*max-height/);
  assert.doesNotMatch(css, /\.ingredient-review-list\s*\{[^}]*overflow-y/);
});

test("uses a recipient-first, private delivery flow", async () => {
  const [page, api, css] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("app/globals.css"),
  ]);

  assert.match(page, /Who should receive your plan\?/);
  assert.match(page, /Send everything to myself/);
  assert.match(page, /Choose what each person receives/);
  assert.match(page, /sanitizeDeliveryRecipients/);
  assert.match(page, /pendingTextRecipients/);
  assert.match(page, /Requires an email recipient/);
  assert.match(page, /Each recipient gets a separate private draft/);
  assert.match(page, /recipient-calendar-settings/);
  assert.match(page, /const activeDialog/);
  assert.match(page, /\[activeDialog\]/);
  assert.doesNotMatch(page, /deviceActions/);
  assert.doesNotMatch(page, /Optional ways to save or shop/);
  assert.doesNotMatch(page, /groceryRecipientDialog/);
  assert.doesNotMatch(page, /emailDialogOpen/);
  assert.match(api, /deliveryEmailAllowed/);
  assert.match(api, /delivery-email:/);
  assert.match(api, /Idempotency-Key/);
  assert.match(api, /to: \[recipient\]/);
  assert.match(api, /grocer-eaze-meal-plan\.ics/);
  assert.match(api, /attachments/);
  assert.match(api, /One or more clean recipe links are missing/);
  assert.match(css, /delivery-recipient-card/);
  assert.match(css, /recipient-content-options/);
  assert.match(css, /recipient-calendar-settings/);
  assert.doesNotMatch(css, /device-action-grid/);
});

test("tracks recipe provider expansion as a release-safe backlog item", async () => {
  const backlog = await source("docs/product-backlog.md");
  assert.match(backlog, /FatSecret Platform API/);
  assert.match(backlog, /complete ingredient quantities/);
  assert.match(backlog, /graceful fallback/);
});

test("removes device-only shopping handoffs from the recipient flow", async () => {
  const [page, api, worker] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("worker/index.ts"),
  ]);

  assert.doesNotMatch(page, /Open in Instacart/);
  assert.doesNotMatch(page, /\/api\/instacart\/shopping-list/);
  assert.doesNotMatch(page, /Copy grocery list/);
  assert.doesNotMatch(page, /Share to Notes or Keep/);
  assert.doesNotMatch(page, /Download my calendar/);
  assert.doesNotMatch(api, /INSTACART_API_KEY/);
  assert.doesNotMatch(worker, /INSTACART_API_KEY/);
  assert.doesNotMatch(api, /connect\.instacart\.com\/idp\/v1\/products\/products_link/);
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
  assert.match(page, /asNeededIngredients, confirmedIngredientsSignature/);
  assert.match(page, /saved\.asNeededIngredients/);
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

test("creates private clean-recipe readers for calendar links", async () => {
  const [page, api, worker, reader, readerScript, schema, migration, lifecycleMigration] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("worker/index.ts"),
    source("worker/recipe-reader.ts"),
    source("public/recipe-reader.js"),
    source("db/schema.ts"),
    source("drizzle/0007_pale_scarlet_witch.sql"),
    source("drizzle/0008_condemned_cargill.sql"),
  ]);

  assert.match(page, /fetch\("\/api\/recipe-readers"/);
  assert.match(api, /Clean recipe: \$\{recipe\.readerUrl\}/);
  assert.match(api, /Original source: \$\{recipe\.sourceUrl\}/);
  assert.match(api, /URL:\$\{calendarText\(recipe\.readerUrl\)\}/);
  assert.match(api, /recipe_readers/);
  assert.match(api, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(api, /WHERE owner_id = \? AND recipe_key = \?/);
  assert.match(api, /AbortSignal\.timeout\(10_000\)/);
  assert.match(api, /maximumBytes = 1_500_000/);
  assert.match(worker, /url\.pathname\.startsWith\("\/recipe\/"\)/);
  assert.match(schema, /recipeReaders/);
  assert.match(migration, /CREATE TABLE `recipe_readers`/);
  assert.match(reader, /noindex,nofollow,noarchive/);
  assert.match(reader, /Copy clean recipe/);
  assert.match(reader, /Open email draft/);
  assert.match(reader, /Open text draft/);
  assert.match(reader, /View the original recipe and publisher notes/);
  assert.match(reader, /recipe-reader\.js/);
  assert.match(readerScript, /Enter up to 10 valid email addresses/);
  assert.match(readerScript, /7 to 15 digits/);
  assert.match(api, /90 \* 86_400_000/);
  assert.match(api, /revoked_at IS NULL/);
  assert.match(lifecycleMigration, /\+90 days/);
  assert.doesNotMatch(reader, /api\.resend\.com/);
});

test("normalizes provider directions and escapes reader content", async () => {
  const { normalizeRecipeInstructions, renderRecipeReader } = await importTypeScriptModule("worker/recipe-reader.ts");
  const instructions = normalizeRecipeInstructions([{ name: "Sauce", steps: [{ step: "Mix &amp; stir." }, { text: "Serve <b>warm</b>." }] }]);
  assert.deepEqual(instructions, [{ name: "Sauce", steps: ["Mix & stir.", "Serve warm."] }]);
  const jsonLdSteps = normalizeRecipeInstructions([
    { "@type": "HowToStep", name: "Step 1", text: "Heat the oven." },
    { "@type": "HowToStep", name: "Step 2", text: "Bake until done." },
  ]);
  assert.deepEqual(jsonLdSteps, [{ name: "", steps: ["Heat the oven.", "Bake until done."] }]);
  const html = renderRecipeReader({
    title: "Test <Dish>", sourceName: "Publisher", sourceUrl: "https://example.com/recipe", readyInMinutes: 20,
    servings: 4, ingredients: ["2 cups rice"], instructions, extractionStatus: "complete",
  }, "https://grocer-eaze.com/recipe/test");
  assert.match(html, /Test &lt;Dish&gt;/);
  assert.match(html, /Mix &amp; stir\./);
  assert.doesNotMatch(html, /<b>warm<\/b>/);
  assert.match(html, /recipe-reader\.js/);
  assert.doesNotMatch(html, /<script>\s*\(\(\) =>/);
});

test("adds account privacy controls and limits alternate production exposure", async () => {
  const [page, api, billing, privacy, sitemap, config, worker] = await Promise.all([
    source("app/page.tsx"),
    source("worker/api.ts"),
    source("worker/billing.ts"),
    source("app/privacy/page.tsx"),
    source("app/sitemap.ts"),
    source("wrangler.production.jsonc"),
    source("worker/index.ts"),
  ]);
  assert.match(page, /Delete account/);
  assert.match(page, /Revoke all shared recipe links/);
  assert.match(page, /removeItem\(`grocer-eaze-active-plan:\$\{user\.id\}`\)/);
  assert.match(api, /url\.pathname === "\/api\/account"/);
  assert.match(api, /cancelStripeSubscription/);
  assert.match(billing, /method: "POST" \| "DELETE"/);
  assert.match(privacy, /We do not sell personal information/);
  assert.match(sitemap, /grocer-eaze\.com\/privacy/);
  assert.match(config, /"workers_dev": false/);
  assert.match(config, /"preview_urls": false/);
  assert.match(config, /"head_sampling_rate": 0\.1/);
  assert.match(worker, /script-src-attr 'none'/);
  assert.match(worker, /recipeReader \? "script-src 'self'"/);
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
