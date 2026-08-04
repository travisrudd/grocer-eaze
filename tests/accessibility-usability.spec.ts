import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("grocer-eaze-onboarding-complete", "true");
    window.localStorage.removeItem("grocer-eaze-active-plan");
  });
});

async function openPlan(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle("Plan meals | Grocer-Eaze");
  await expect(page.getByRole("heading", { name: "Better Food, Less Waste." })).toBeVisible();
}

test("has no serious or critical automated accessibility violations", async ({ page }) => {
  await openPlan(page);

  const homeResults = await new AxeBuilder({ page }).analyze();
  expect(homeResults.violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""))).toEqual([]);

  await page.getByRole("button", { name: "Accessibility" }).click();
  await expect(page.getByRole("heading", { name: "Meal planning should work for everyone." })).toBeVisible();

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""))).toEqual([]);
});

test("supports keyboard navigation and a working skip link", async ({ page }) => {
  await openPlan(page);
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#page-content")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("paid navigation directs signed-out visitors to a clear next step", async ({ page }) => {
  const signedOutAccountRequests: string[] = [];
  page.on("request", (request) => {
    if (["/api/profile", "/api/favorites", "/api/family", "/api/ratings", "/api/active-plan"].includes(new URL(request.url()).pathname)) signedOutAccountRequests.push(request.url());
  });
  await openPlan(page);
  await page.waitForTimeout(300);
  expect(signedOutAccountRequests).toEqual([]);

  await page.getByRole("button", { name: "Grocery list" }).click();
  await expect(page.getByRole("heading", { name: "Sign in or create an account" })).toBeVisible();
  await expect(page.getByText("Sign in before using meal planning tools.")).toBeVisible();

  await page.getByRole("button", { name: "Family" }).click();
  await expect(page.getByRole("heading", { name: "Sign in or create an account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeDisabled();
});

test("the recipe catalog loads progressively and filters remain usable", async ({ page }) => {
  const recipes = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    title: `Accessible test recipe ${index + 1}`,
    sourceName: "Grocer-Eaze test kitchen",
    sourceUrl: "https://example.com/recipe",
    readyInMinutes: 25,
    servings: 4,
    glutenFree: true,
    dairyFree: true,
    image: "",
    pricePerServing: 350,
    diets: ["gluten free", "Mediterranean"],
    extendedIngredients: [{ name: "fresh vegetables", aisle: "Produce", original: "2 cups fresh vegetables" }],
  }));
  await page.route("**/api/recipes/search?*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes }) });
  });
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: {
      id: "test-user", name: "Test User", email: "test@example.com", phone: "", role: "user",
      accessStatus: "active", complimentaryUntil: null, billingExempt: false,
      subscriptionStatus: "active", subscriptionEndsAt: null, hasAccess: true,
    } }) });
  });

  await openPlan(page);
  const browseRecipes = page.getByRole("button", { name: /Browse recipes for my plan/ });
  await expect(browseRecipes).toBeEnabled();
  await browseRecipes.click();
  await expect(page.getByRole("heading", { name: "Build your plan from the catalog." })).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".recipe-card")).toHaveCount(12);

  await page.getByRole("button", { name: "Show 12 more recipes" }).click();
  await expect(page.locator(".recipe-card")).toHaveCount(24);

  const filter = page.getByRole("textbox", { name: "Filter recipes by name or ingredient" });
  await filter.fill("recipe 2");
  await expect(page.locator(".recipe-card").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear" })).toBeEnabled();
});

test("nearby stores can be added, reprioritized, removed, and retained through the profile API", async ({ page }) => {
  let profileWrites = 0;
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: {
      id: "store-test-user", name: "Store Test User", email: "stores@example.com", phone: "", role: "user",
      accessStatus: "active", complimentaryUntil: null, billingExempt: false,
      subscriptionStatus: "active", subscriptionEndsAt: null, hasAccess: true,
    } }) });
  });
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT") { profileWrites += 1; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: true }) }); }
    else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: null }) });
  });
  await page.route("**/api/stores/search?*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: [{ id: "osm-node-42", name: "Lakeview Market", address: "123 Clark St, Chicago", distanceMiles: 1.2, lat: "41.97", lon: "-87.66" }], center: { lat: "41.97", lon: "-87.66" } }) });
  });

  await openPlan(page);
  const storePriorities = page.locator(".store-preferences");
  await expect(storePriorities.getByRole("button", { name: /One store only/ })).toBeVisible();
  await expect(page.locator(".option-grid").getByRole("button", { name: /One store only/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Find nearby stores" }).click();
  await page.getByRole("button", { name: /Lakeview Market/ }).click();
  await expect(page.locator(".preferred-store-list").getByText("Lakeview Market", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Move Lakeview Market higher" }).click();
  await expect(page.locator(".preferred-store-list li").nth(2).getByText("Lakeview Market", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove Lakeview Market" }).click();
  await expect(page.locator(".preferred-store-list").getByText("Lakeview Market", { exact: true })).toHaveCount(0);
  await expect.poll(() => profileWrites).toBeGreaterThan(0);
});

test("school lunches stay separate and grocery totals remain editable", async ({ page }) => {
  let ingredientReportBody: Record<string, unknown> | null = null;
  const recipes = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    title: `Lunch planning recipe ${index + 1}`,
    sourceName: "Grocer-Eaze test kitchen",
    sourceUrl: "https://example.com/recipe",
    readyInMinutes: 20,
    servings: 4,
    glutenFree: true,
    dairyFree: true,
    image: "",
    pricePerServing: 350,
    diets: ["gluten free", "Mediterranean"],
    extendedIngredients: [
      { name: "broccoli florets", aisle: "Produce", original: "2 cups broccoli florets" },
      { name: "yellow onions", aisle: "Produce", original: "1/2 cup yellow onions" },
      { name: "yellow onion, diced", aisle: "Produce", original: "2 tablespoons diced yellow onion" },
      { name: "garnish chopped parsley", aisle: "Produce", original: "garnish chopped parsley" },
      { name: "herbs and pantry staples", aisle: "Pantry", original: "herbs and pantry staples" },
    ],
  }));
  await page.route("**/api/recipes/search?*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipes }) });
  });
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: {
      id: "grocery-test-user", name: "Grocery Test User", email: "grocery@example.com", phone: "", role: "user",
      accessStatus: "active", complimentaryUntil: null, billingExempt: false,
      subscriptionStatus: "active", subscriptionEndsAt: null, hasAccess: true,
    } }) });
  });
  await page.route("**/api/capabilities", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ instacartShopping: false }) });
  });
  await page.route("**/api/ingredient-feedback", async (route) => {
    ingredientReportBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sent: true }) });
  });

  await openPlan(page);
  const daysToPlan = page.getByLabel("Days to plan");
  await expect(daysToPlan).toHaveValue("7");
  await daysToPlan.fill("3");
  await expect(daysToPlan).toHaveValue("3");
  await daysToPlan.fill("7");
  const schoolLunchToggle = page.getByRole("button", { name: /School lunches/ });
  await expect(schoolLunchToggle).toBeDisabled();
  await page.getByRole("button", { name: "Increase kids" }).click();
  await expect(page.getByText("2.5 serving equivalents: each child counts as half a serving.")).toBeVisible();
  await expect(schoolLunchToggle).toBeEnabled();
  await schoolLunchToggle.click();
  await expect(page.getByText("5 extra weekday lunches · separate from regular lunches")).toBeVisible();
  await expect(page.getByRole("button", { name: /Individual chip bags/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Try to reuse ingredients" }).click();
  const browseRecipes = page.getByRole("button", { name: /Browse recipes for my plan/ });
  await expect(browseRecipes).toBeEnabled();
  await browseRecipes.click();
  await expect(page.getByText("Ingredient reuse prioritized")).toBeVisible();

  await page.getByRole("button", { name: "+ Add to lunch", exact: true }).first().click();
  await page.getByRole("button", { name: "+ Add to school lunch", exact: true }).first().click();
  await expect(page.getByText("Lunch 1/7")).toBeVisible();
  await expect(page.getByText("School lunch 1/5")).toBeVisible();

  await page.getByRole("button", { name: "Grocery list" }).click();
  await expect(page.getByRole("heading", { name: "Confirm what your household needs." })).toBeVisible();
  await expect(page.getByLabel("Total amount needed for Broccoli florets")).toHaveValue("1½ cups");
  await expect(page.locator(".ingredient-edit-row").filter({ hasText: "Herbs and pantry staples" })).toHaveCount(0);
  await expect(page.getByLabel(/Total amount needed for Yellow onions/)).toHaveCount(1);
  await expect(page.getByLabel(/Total amount needed for Yellow onions/)).toHaveValue("0.47 cups");
  await expect(page.getByLabel("Total amount needed for Individual chip bags")).toHaveValue("1");
  const missingAmountRow = page.locator(".ingredient-edit-row").filter({ hasText: "Garnish chopped parsley" });
  await expect(missingAmountRow.getByLabel("Total amount needed for Garnish chopped parsley")).toHaveValue("");
  await expect(missingAmountRow.getByLabel("Total amount needed for Garnish chopped parsley")).toHaveAttribute("placeholder", "Amount not provided");
  await missingAmountRow.getByRole("button", { name: "Report incorrect value" }).click();
  await expect(page.getByRole("heading", { name: "Help us correct Garnish chopped parsley" })).toBeVisible();
  await page.getByLabel(/Correct amount or value/).fill("1 bunch");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect.poll(() => ingredientReportBody?.ingredient).toBe("Garnish chopped parsley");
  const amountInput = missingAmountRow.getByLabel("Total amount needed for Garnish chopped parsley");
  const asNeededToggle = missingAmountRow.getByRole("checkbox", { name: /Use as needed/ });
  await amountInput.fill("1 bunch");
  await asNeededToggle.check();
  await expect(amountInput).toBeDisabled();
  await expect(amountInput).not.toHaveAttribute("required", "");
  await expect(amountInput).toHaveValue("");
  await asNeededToggle.uncheck();
  await expect(amountInput).toBeEnabled();
  await expect(amountInput).toHaveValue("1 bunch");
  await asNeededToggle.check();
  const broccoliRow = page.locator(".ingredient-edit-row").filter({ hasText: "Broccoli florets" });
  const controlBoxes = await broccoliRow.evaluate((row) => [
    ...row.querySelectorAll<HTMLInputElement>(".text-input"),
    ...row.querySelectorAll<HTMLElement>(".ingredient-choice-control"),
  ].map((control) => ({ top: Math.round(control.getBoundingClientRect().top), height: Math.round(control.getBoundingClientRect().height) })));
  if (await page.evaluate(() => window.innerWidth > 800)) {
    expect(Math.max(...controlBoxes.map((box) => box.top)) - Math.min(...controlBoxes.map((box) => box.top))).toBeLessThanOrEqual(1);
    expect([...new Set(controlBoxes.map((box) => box.height))]).toEqual([40]);
  }
  const ingredientListOverflow = await page.locator(".ingredient-review-list").evaluate((list) => ({ maxHeight: getComputedStyle(list).maxHeight, overflowY: getComputedStyle(list).overflowY }));
  expect(ingredientListOverflow).toEqual({ maxHeight: "none", overflowY: "visible" });
  await page.locator(".already-have-control input").first().check();
  await expect(page.getByRole("button", { name: "Open in Instacart" })).toHaveCount(0);
  await page.evaluate(() => { window.location.hash = "#delivery"; });
  await expect(page.getByRole("heading", { name: "Confirm what your household needs." })).toBeVisible();
  await expect(page.getByText("Confirm your ingredients before choosing how to send or save the plan.")).toBeVisible();

  await page.getByRole("button", { name: "Confirm ingredients & build shopping list →" }).click();
  await expect(page.getByRole("heading", { name: "Review the list you’ll take shopping." })).toBeVisible();
  await expect(page.getByText("This is your final shopping list—not optional add-ons.", { exact: false })).toBeVisible();
  await expect(page.locator(".shopping-list-preview input")).toHaveCount(0);
  await expect(page.locator(".shopping-list-preview li").filter({ hasText: "Yellow onions" })).toHaveCount(1);
  await expect(page.locator(".shopping-list-preview li").filter({ hasText: "Yellow onions" }).getByText("0.47 cups")).toBeVisible();
  await expect(page.getByText("excluded from shopping", { exact: false })).toBeVisible();
  const approvalCard = page.locator(".grocery-approval-card");
  await expect(approvalCard.getByRole("button", { name: "← Edit ingredients" })).toBeVisible();
  await approvalCard.getByRole("button", { name: "← Edit ingredients" }).click();
  await expect(page.getByRole("heading", { name: "Confirm what your household needs." })).toBeVisible();
  await expect(page.getByLabel(/Total amount needed for Yellow onions/)).toHaveValue("0.47 cups");
  await page.getByRole("button", { name: "Confirm ingredients & build shopping list →" }).click();
  await page.evaluate(() => { window.location.hash = "#delivery"; });
  await expect(page.getByRole("heading", { name: "Review the list you’ll take shopping." })).toBeVisible();
  await expect(page.getByText("Approve your shopping list before choosing how to send or save it.")).toBeVisible();
  await page.getByRole("button", { name: "Approve list & choose how to send or save →" }).click();
  await expect(page.getByRole("heading", { name: "Choose what happens next." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select all" })).toBeVisible();
  await page.getByRole("button", { name: "← Review shopping list" }).click();
  await expect(page.getByRole("heading", { name: "Review the list you’ll take shopping." })).toBeVisible();
  await page.locator(".page-heading").getByRole("button", { name: "← Edit ingredients" }).click();

  await page.getByRole("button", { name: "← Back to recipes" }).click();
  await page.getByRole("button", { name: "Clear selections" }).click();
  await expect(page.getByText("0 of 19 meals selected.")).toBeVisible();
});

test("reflows at the 320 CSS-pixel equivalent of 400% zoom", async ({ page }) => {
  await openPlan(page);
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(homeOverflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Accessibility" }).click();
  const accessibilityOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(accessibilityOverflow).toBeLessThanOrEqual(1);
});

test("visible interactive targets meet the WCAG 2.2 minimum size", async ({ page }) => {
  await openPlan(page);
  const undersizedTargets = await page.locator("button:visible, a[href]:visible, input:visible, select:visible, textarea:visible").evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName, width: rect.width, height: rect.height };
      })
      .filter((target) => target.width < 24 || target.height < 24),
  );
  expect(undersizedTargets).toEqual([]);
});
