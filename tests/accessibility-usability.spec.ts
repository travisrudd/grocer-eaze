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
  await openPlan(page);

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

test("school lunches stay separate and grocery totals remain editable", async ({ page }) => {
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
    extendedIngredients: [{ name: "fresh vegetables", aisle: "Produce", original: "2 cups fresh vegetables" }],
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

  await openPlan(page);
  await expect(page.getByText("5 extra weekday lunches · separate from lunch")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Everything you need, sorted." })).toBeVisible();
  await expect(page.getByLabel("Total amount needed for Fresh vegetables")).toHaveValue("4 cups");
  await expect(page.getByLabel("Total amount needed for Individual chip bags")).toHaveValue("4");
  await expect(page.getByText(/not additional or optional items/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Shop on Instacart" })).toHaveCount(0);

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
