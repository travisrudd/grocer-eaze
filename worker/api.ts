type AppEnv = {
  DB: D1Database;
  SPOONACULAR_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_SECRET?: string;
  INITIAL_ADMIN_EMAIL?: string;
  INITIAL_ADMIN_EMAILS?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_MONTHLY_PRICE_ID?: string;
  STRIPE_YEARLY_PRICE_ID?: string;
  PEXELS_API_KEY?: string;
  THEMEALDB_API_KEY?: string;
  INSTACART_API_KEY?: string;
};
import { getSessionUser, handleAuthRequest, hasProductAccess } from "./auth";
import { handleBillingRequest } from "./billing";

const preferredSources = ["allrecipes.com", "foodnetwork.com", "eatingwell.com", "seriouseats.com", "simplyrecipes.com"];

const fallbackTitles = [
  "Lemon Herb Salmon", "Tuscan White Bean Skillet", "Chicken Souvlaki Bowls", "Tomato Basil Turkey Meatballs",
  "Garlic Shrimp and Polenta", "Sheet Pan Chicken with Olives", "Chickpea Vegetable Tagine", "Greek Stuffed Peppers",
  "Rosemary Pork with Apples", "Baked Cod with Tomatoes", "Lentil Sweet Potato Stew", "Herbed Quinoa Chicken",
  "Zucchini Turkey Burgers", "Spinach Artichoke Chicken", "Citrus Salmon Rice Bowls", "Mushroom White Bean Risotto",
  "Mediterranean Beef Kofta", "Roasted Vegetable Frittata", "Pesto Chicken with Green Beans", "Red Lentil Coconut Curry",
  "Seared Tuna Niçoise Bowls", "Paprika Chicken and Potatoes", "Black Bean Stuffed Squash", "Lemon Oregano Turkey Kebabs",
  "Ginger Sesame Salmon", "Harissa Chickpea Bowls", "Chicken Piccata with Broccoli", "Tomato Braised Cod",
  "Greek Turkey Lettuce Cups", "Eggplant Lentil Moussaka", "Orange Herb Roast Chicken", "Shrimp and White Bean Sauté",
  "Rainbow Hummus Lunch Box", "Turkey Cucumber Roll-Ups", "Sunflower Butter Berry Box", "Chicken Pita Bento",
  "Mediterranean Pasta Salad Box", "Egg and Veggie Snack Box", "Bean and Corn Quesadilla Box", "Apple Cheddar Turkey Bites",
  "Za’atar Chicken Grain Bowls", "White Bean Pesto Pasta", "Honey Mustard Salmon", "Turkey Taco Lettuce Wraps",
  "Roasted Cauliflower Shawarma", "Beef and Broccoli Rice Bowls", "Lemon Dill Cod Packets", "Pork Tenderloin with Pears",
  "Crispy Chickpea Greek Salad", "Chicken Orzo Vegetable Soup", "Shrimp Fajita Bowls", "Balsamic Mushroom Polenta",
  "Salmon Cucumber Sushi Bowls", "Turkey Spinach Stuffed Peppers", "Herbed Pork and Sweet Potatoes", "White Bean Tomato Bruschetta",
  "Chicken Tzatziki Flatbreads", "Garlic Lime Shrimp Tacos", "Beef Kofta Salad Bowls", "Roasted Red Pepper Lentil Soup",
  "Tuna White Bean Picnic Salad", "Chicken Caprese Sheet Pan", "Pork and Pineapple Rice Bowls", "Cedar Plank Salmon",
  "Vegetable Hummus Pinwheels", "Turkey Avocado Bento", "Chicken Caesar Pasta Box", "Mini Falafel Pita Pockets",
  "Sunflower Butter Banana Roll-Ups", "Greek Yogurt Berry Snack Box", "Tuna Cucumber Cracker Kit", "Egg Salad Lettuce Cups",
  "Chicken Apple Wraps", "Black Bean Corn Pinwheels", "Turkey Hummus Pita Box", "Mediterranean Chickpea Bento",
  "Caprese Skewer Lunch Box", "Salmon Salad Cucumber Boats", "Veggie Fried Rice Cups", "Chicken Quinoa Mason Jar Salad",
  "Miso Glazed Salmon and Greens", "Skillet Beef Stuffed Zucchini", "Rosemary Chicken White Bean Soup", "Pork Souvlaki Plates",
  "Shrimp Tomato Couscous", "Spinach Feta Turkey Burgers", "Lentil Walnut Lettuce Cups", "Cod with Olive Tapenade",
  "Chicken Ratatouille Bake", "Beef Tomato Zucchini Skillet", "Coconut Lime Shrimp Curry", "Pork Chops with Fennel",
  "Salmon with Warm Lentil Salad", "Tuscan Chicken and Kale", "Greek Beef Stuffed Eggplant", "Chickpea Spinach Shakshuka",
  "Turkey Meatloaf with Green Beans", "Shrimp and Broccoli Noodles", "White Bean Artichoke Bake", "Chicken Lemon Rice Soup",
];
const fallbackRecipes = fallbackTitles.map((title, index) => ({
  id: `demo-${index + 1}`,
  title,
  sourceName: ["EatingWell", "Food Network", "Allrecipes", "Serious Eats", "Simply Recipes"][index % 5],
  sourceUrl: ["https://www.eatingwell.com/recipes/", "https://www.foodnetwork.com/recipes", "https://www.allrecipes.com/recipes/", "https://www.seriouseats.com/recipes-5117985", "https://www.simplyrecipes.com/recipes-5090746"][index % 5],
  readyInMinutes: 20 + (index % 5) * 5,
  servings: 4,
  glutenFree: true,
  dairyFree: index % 3 !== 0,
  image: "",
  pricePerServing: 280 + (index % 7) * 55,
  diets: ["gluten free", "Mediterranean"],
  extendedIngredients: [{ name: "fresh vegetables", aisle: "Produce", original: "Fresh vegetables" }, { name: title.toLowerCase().includes("salmon") ? "salmon fillets" : title.toLowerCase().includes("shrimp") ? "shrimp" : "lean protein or beans", aisle: "Meat & seafood", original: "Lean protein or beans" }, { name: "herbs and pantry staples", aisle: "Pantry", original: "Herbs and pantry staples" }],
}));

function fallbackPage(url: URL, requested: number) {
  const query = url.searchParams.get("q") || "";
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const seed = [...query].reduce((sum, character) => sum + character.charCodeAt(0), 0) % fallbackRecipes.length;
  const ordered = [...fallbackRecipes.slice(seed), ...fallbackRecipes.slice(0, seed)];
  if (url.searchParams.get("schoolLunch") === "true") {
    const lunchPattern = /box|bento|roll-up|pinwheel|wrap|pita|pocket|skewer|boats|cups|lunch|snack|picnic/i;
    ordered.sort((a, b) => Number(lunchPattern.test(b.title)) - Number(lunchPattern.test(a.title)) || a.readyInMinutes - b.readyInMinutes);
  }
  const start = offset % ordered.length;
  return [...ordered.slice(start), ...ordered.slice(0, start)].slice(0, requested);
}

type Recipe = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  readyInMinutes: number;
  servings: number;
  glutenFree: boolean;
  dairyFree: boolean;
  image: string;
  pricePerServing: number;
  diets: string[];
  extendedIngredients: Array<{ name: string; aisle: string; original: string }>;
};

const glutenWords = /\b(wheat|flour|bread|breadcrumbs|pasta|noodles|couscous|barley|rye|soy sauce|tortilla)\b/i;
const dairyWords = /\b(milk|cheese|cream|butter|yogurt|yoghurt|whey|ghee|mascarpone|mozzarella|parmesan|feta)\b/i;

function ingredientAisle(name: string) {
  if (/chicken|beef|pork|lamb|fish|salmon|cod|tuna|shrimp|prawn|turkey|sausage/i.test(name)) return "Meat & seafood";
  if (/milk|cheese|cream|butter|yogurt|egg/i.test(name)) return "Dairy & eggs";
  if (/tomato|onion|garlic|pepper|lettuce|spinach|potato|carrot|lemon|lime|apple|herb|parsley|cilantro/i.test(name)) return "Produce";
  if (/frozen/i.test(name)) return "Frozen";
  return "Pantry";
}

function recipeMatches(recipe: Recipe, url: URL) {
  const ingredients = recipe.extendedIngredients.map((item) => item.name).join(" ");
  const excluded = String(url.searchParams.get("excludeIngredients") || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (excluded.some((item) => `${recipe.title} ${ingredients}`.toLowerCase().includes(item.toLowerCase()))) return false;
  if (url.searchParams.get("glutenFree") !== "false" && !recipe.glutenFree) return false;
  if (url.searchParams.get("lowDairy") === "true" && !recipe.dairyFree) return false;
  const maxTime = Number(url.searchParams.get("maxTime") || 0);
  if (maxTime && recipe.readyInMinutes > maxTime) return false;
  return true;
}

function dedupeRecipes(recipes: Recipe[]) {
  const seen = new Set<string>();
  return recipes.filter((recipe) => {
    const key = `${recipe.sourceUrl || ""}|${recipe.title}`.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mealDbSearchTerm(query: string) {
  const protein = query.match(/\b(chicken|beef|pork|lamb|salmon|cod|tuna|fish|shrimp|prawn|turkey|lentil|chickpea|bean)\b/i)?.[0];
  if (protein) return protein.toLowerCase();
  return query.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 3 && !["mediterranean", "dinner", "lunch", "healthy", "gourmet", "easy", "meal", "prep", "without"].includes(word))[0] || "chicken";
}

function normalizeMealDb(meal: Record<string, unknown>): Recipe {
  const ingredients = Array.from({ length: 20 }, (_, index) => {
    const name = String(meal[`strIngredient${index + 1}`] || "").trim();
    const measure = String(meal[`strMeasure${index + 1}`] || "").trim();
    return name ? { name, aisle: ingredientAisle(name), original: `${measure} ${name}`.trim() } : null;
  }).filter(Boolean) as Recipe["extendedIngredients"];
  const ingredientText = ingredients.map((item) => item.name).join(" ");
  const area = String(meal.strArea || "");
  const tags = String(meal.strTags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  const mediterranean = /Greek|Italian|Moroccan|Spanish|Turkish|Lebanese|Croatian|Portuguese|Tunisian|Egyptian|Mediterranean/i.test(`${area} ${tags.join(" ")}`);
  return {
    id: `mealdb-${String(meal.idMeal || crypto.randomUUID())}`,
    title: String(meal.strMeal || "TheMealDB recipe"),
    sourceName: "TheMealDB",
    sourceUrl: safeHttpUrl(meal.strSource) || `https://www.themealdb.com/meal/${String(meal.idMeal || "")}`,
    readyInMinutes: 40,
    servings: 4,
    glutenFree: !glutenWords.test(ingredientText),
    dairyFree: !dairyWords.test(ingredientText),
    image: safeHttpUrl(meal.strMealThumb),
    pricePerServing: Math.min(900, 250 + ingredients.length * 18),
    diets: mediterranean ? ["Mediterranean"] : [],
    extendedIngredients: ingredients,
  };
}

async function mealDbRecipes(url: URL, env: AppEnv, requested: number) {
  if (!env.THEMEALDB_API_KEY) return { recipes: [] as Recipe[], status: "not-configured" };
  const base = `https://www.themealdb.com/api/json/v2/${encodeURIComponent(env.THEMEALDB_API_KEY)}`;
  const term = mealDbSearchTerm(url.searchParams.get("q") || "chicken");
  try {
    const response = await fetch(`${base}/search.php?${new URLSearchParams({ s: term })}`);
    if (!response.ok) return { recipes: [] as Recipe[], status: `error-${response.status}` };
    const payload = await response.json() as { meals?: Array<Record<string, unknown>> | null };
    let meals = payload.meals || [];
    if (Number(url.searchParams.get("offset") || 0) > 0 || meals.length < Math.min(8, requested)) {
      const randomResponse = await fetch(`${base}/randomselection.php`);
      if (randomResponse.ok) {
        const randomPayload = await randomResponse.json() as { meals?: Array<Record<string, unknown>> | null };
        meals = [...meals, ...(randomPayload.meals || [])];
      }
    }
    const recipes = dedupeRecipes(meals.map(normalizeMealDb)).filter((recipe) => recipeMatches(recipe, url)).slice(0, requested);
    return { recipes, status: "ok" };
  } catch {
    return { recipes: [] as Recipe[], status: "unreachable" };
  }
}

async function spoonacularRecipes(url: URL, env: AppEnv, requested: number) {
  if (!env.SPOONACULAR_API_KEY) return { recipes: [] as Recipe[], status: "not-configured" };
  const params = new URLSearchParams({
    apiKey: env.SPOONACULAR_API_KEY,
    query: url.searchParams.get("q") || "Mediterranean dinner",
    number: String(requested),
    offset: String(Math.max(0, Number(url.searchParams.get("offset") || 0))),
    addRecipeInformation: "true",
    fillIngredients: "true",
    instructionsRequired: "true",
    ...(url.searchParams.get("glutenFree") !== "false" ? { intolerances: "gluten" } : {}),
    ...(url.searchParams.get("excludeIngredients") ? { excludeIngredients: url.searchParams.get("excludeIngredients") || "" } : {}),
    maxReadyTime: url.searchParams.get("maxTime") || "45",
    sort: "random",
  });
  try {
    const response = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${params}`);
    if (!response.ok) return { recipes: [] as Recipe[], status: `error-${response.status}` };
    const data = await response.json() as { results?: Array<Record<string, unknown>> };
    return { recipes: (data.results || []) as unknown as Recipe[], status: "ok" };
  } catch {
    return { recipes: [] as Recipe[], status: "unreachable" };
  }
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function safeHttpUrl(value: unknown) {
  try {
    const parsed = new URL(String(value || ""));
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function metaImage(html: string, pageUrl: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1].toLowerCase(), match[2]]));
    const key = String(attributes.property || attributes.name || "").toLowerCase();
    if (!["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(key) || !attributes.content) continue;
    try {
      const image = new URL(attributes.content, pageUrl);
      if (["http:", "https:"].includes(image.protocol)) return image.toString();
    } catch { /* Try the next image metadata tag. */ }
  }
  return "";
}

async function recipeImageResponse(url: URL, env: AppEnv) {
  const source = safeHttpUrl(url.searchParams.get("source"));
  const fallback = safeHttpUrl(url.searchParams.get("fallback"));
  const title = String(url.searchParams.get("title") || "recipe").trim().slice(0, 120);
  let resolved = "";

  if (source) {
    const host = new URL(source).hostname.replace(/^www\./, "");
    if (preferredSources.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) || host === "themealdb.com" || host.endsWith(".themealdb.com")) {
      try {
        const page = await fetch(source, { headers: { "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)", Accept: "text/html" }, redirect: "follow" });
        if (page.ok) resolved = metaImage((await page.text()).slice(0, 750_000), page.url || source);
      } catch { /* Continue to the provider image or licensed fallback. */ }
    }
  }

  if (!resolved && fallback) {
    const fallbackHost = new URL(fallback).hostname.replace(/^www\./, "");
    const sourceHost = source ? new URL(source).hostname.replace(/^www\./, "") : "";
    const trustedImage = fallbackHost === sourceHost || fallbackHost.endsWith(`.${sourceHost}`) || sourceHost.endsWith(`.${fallbackHost}`)
      || fallbackHost === "themealdb.com" || fallbackHost.endsWith(".themealdb.com")
      || fallbackHost === "spoonacular.com" || fallbackHost.endsWith(".spoonacular.com");
    if (trustedImage) resolved = fallback;
  }

  if (!resolved && env.PEXELS_API_KEY) {
    try {
      const response = await fetch(`https://api.pexels.com/v1/search?${new URLSearchParams({ query: `${title} dish`, per_page: "1", orientation: "landscape" })}`, {
        headers: { Authorization: env.PEXELS_API_KEY, "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)" },
      });
      const data = await response.json() as { photos?: Array<{ src?: { large?: string; medium?: string } }> };
      resolved = safeHttpUrl(data.photos?.[0]?.src?.large || data.photos?.[0]?.src?.medium);
    } catch { /* The existing food icon remains the final visual fallback. */ }
  }

  if (!resolved) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return new Response(null, { status: 302, headers: { Location: resolved, "Cache-Control": "public, max-age=86400" } });
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS profiles (owner_id TEXT PRIMARY KEY, household_name TEXT NOT NULL, people INTEGER NOT NULL DEFAULT 4, location TEXT NOT NULL DEFAULT 'Uptown, Chicago, IL', preferences_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS active_plans (owner_id TEXT PRIMARY KEY, plan_json TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, recipe_id TEXT NOT NULL, recipe_json TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS favorites_owner_idx ON favorites(owner_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS family_members (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, preferences_json TEXT NOT NULL DEFAULT '{}', allergies TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS family_members_owner_idx ON family_members(owner_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS recipe_ratings (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, recipe_id TEXT NOT NULL, quality INTEGER NOT NULL, ease INTEGER NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS recipe_ratings_owner_idx ON recipe_ratings(owner_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS recipe_catalog (id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_name TEXT NOT NULL, source_url TEXT NOT NULL, title TEXT NOT NULL, search_text TEXT NOT NULL, recipe_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS recipe_catalog_updated_idx ON recipe_catalog(updated_at)"),
  ]);
}

async function cacheRecipes(db: D1Database, recipes: Recipe[], sourceType: string) {
  if (!recipes.length) return;
  const now = new Date().toISOString();
  await db.batch(recipes.map((recipe) => db.prepare("INSERT INTO recipe_catalog(id, source_type, source_name, source_url, title, search_text, recipe_json, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_name=excluded.source_name, source_url=excluded.source_url, title=excluded.title, search_text=excluded.search_text, recipe_json=excluded.recipe_json, updated_at=excluded.updated_at")
    .bind(recipe.id, sourceType, recipe.sourceName, recipe.sourceUrl, recipe.title, `${recipe.title} ${recipe.sourceName} ${recipe.diets.join(" ")} ${recipe.extendedIngredients.map((item) => item.name).join(" ")}`.toLowerCase(), JSON.stringify(recipe), now, now)));
}

async function catalogRecipes(db: D1Database, url: URL, requested: number) {
  const query = String(url.searchParams.get("q") || "").toLowerCase();
  const terms = query.split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !["mediterranean", "dinner", "lunch", "healthy", "easy", "meal", "prep", "without"].includes(term)).slice(0, 4);
  const where = terms.length ? `WHERE ${terms.map(() => "search_text LIKE ?").join(" OR ")}` : "";
  const statement = db.prepare(`SELECT recipe_json FROM recipe_catalog ${where} ORDER BY updated_at DESC LIMIT 150`);
  const result = await (terms.length ? statement.bind(...terms.map((term) => `%${term}%`)) : statement).all();
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  return result.results.map((row) => {
    try { return JSON.parse(String(row.recipe_json)) as Recipe; } catch { return null; }
  }).filter((recipe): recipe is Recipe => Boolean(recipe && recipeMatches(recipe, url))).slice(offset, offset + requested);
}

async function searchRecipes(url: URL, env: AppEnv) {
  const requested = Math.max(1, Math.min(100, Number(url.searchParams.get("number") || 18)));
  await ensureSchema(env.DB);
  const local = await catalogRecipes(env.DB, url, requested);
  if (local.length >= requested) return json({ recipes: local, demo: false, providers: ["Saved catalog"], providerStatus: { catalog: "ok" } });
  const [spoonacular, mealDb] = await Promise.all([
    spoonacularRecipes(url, env, requested),
    mealDbRecipes(url, env, requested),
  ]);
  await cacheRecipes(env.DB, mealDb.recipes, "themealdb");
  const preferred = spoonacular.recipes.sort((a, b) => {
    const aUrl = String(a.sourceUrl || "");
    const bUrl = String(b.sourceUrl || "");
    const sourceScore = Number(preferredSources.some((host) => bUrl.includes(host))) - Number(preferredSources.some((host) => aUrl.includes(host)));
    if (sourceScore) return sourceScore;
    if (url.searchParams.get("schoolLunch") === "true") return Number(a.readyInMinutes || 99) - Number(b.readyInMinutes || 99);
    return 0;
  });
  const live = dedupeRecipes([...local, ...preferred, ...mealDb.recipes]).filter((recipe) => recipeMatches(recipe, url));
  const used = new Set(live.map((recipe) => String(recipe.title).toLowerCase()));
  const supplemental = (fallbackPage(url, fallbackRecipes.length) as Recipe[]).filter((recipe) => !used.has(recipe.title.toLowerCase()));
  if (url.searchParams.get("schoolLunch") === "true") {
    supplemental.sort((a, b) => {
      const lunchPattern = /box|bento|roll-up|quesadilla|bites|lunch|pita|snack/i;
      const kidScore = Number(lunchPattern.test(b.title)) - Number(lunchPattern.test(a.title));
      return kidScore || a.readyInMinutes - b.readyInMinutes;
    });
  }
  const recipes = [...live, ...supplemental].slice(0, requested);
  const providers = [...new Set(recipes.filter((recipe) => !recipe.id.startsWith("demo-")).map((recipe) => recipe.sourceName))];
  return json({
    recipes,
    demo: recipes.some((recipe) => recipe.id.startsWith("demo-")),
    providers,
    providerStatus: { catalog: "ok", spoonacular: spoonacular.status, themealdb: mealDb.status },
  });
}

function isPublicRecipeUrl(value: unknown) {
  const safe = safeHttpUrl(value);
  if (!safe) return "";
  const parsed = new URL(safe);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (parsed.username || parsed.password || !["", "80", "443"].includes(parsed.port)) return "";
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") return "";
  if (/^\d+$/.test(host) || host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return "";
  return parsed.toString();
}

async function fetchRecipePage(input: string) {
  let current = input;
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)", Accept: "text/html,application/xhtml+xml" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = isPublicRecipeUrl(new URL(response.headers.get("location") || "", current).toString());
      if (!next) throw new Error("That recipe link redirects to an unsupported address.");
      current = next;
      continue;
    }
    if (!response.ok) throw new Error("That recipe page could not be opened.");
    if (!String(response.headers.get("content-type") || "").toLowerCase().includes("html")) throw new Error("That link is not an HTML recipe page.");
    return { html: (await response.text()).slice(0, 1_500_000), finalUrl: response.url || current };
  }
  throw new Error("That recipe link redirects too many times.");
}

function findRecipeJsonLd(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findRecipeJsonLd(item); if (found) return found; }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (types.some((type) => String(type).toLowerCase() === "recipe")) return record;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const found = findRecipeJsonLd(record[key]);
    if (found) return found;
  }
  return null;
}

function parseDuration(value: unknown) {
  const match = String(value || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  return match ? Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
}

function jsonLdImage(value: unknown) {
  if (typeof value === "string") return safeHttpUrl(value);
  if (Array.isArray(value)) return jsonLdImage(value[0]);
  if (value && typeof value === "object") return safeHttpUrl((value as Record<string, unknown>).url || (value as Record<string, unknown>).contentUrl);
  return "";
}

async function importRecipe(request: Request, env: AppEnv) {
  const body = await request.json() as { url?: string };
  const input = isPublicRecipeUrl(body.url);
  if (!input) return json({ error: "Enter a public recipe page link beginning with http:// or https://." }, 400);
  try {
    const { html, finalUrl } = await fetchRecipePage(input);
    let recipeData: Record<string, unknown> | null = null;
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        recipeData = findRecipeJsonLd(JSON.parse(match[1].trim()));
        if (recipeData) break;
      } catch { /* Some pages include unrelated malformed structured data; try the next block. */ }
    }
    if (!recipeData) return json({ error: "We couldn’t find structured recipe details on that page. Try another recipe link." }, 422);
    const ingredientLines = Array.isArray(recipeData.recipeIngredient) ? recipeData.recipeIngredient.map(String).filter(Boolean) : [];
    if (!ingredientLines.length) return json({ error: "That page names a recipe but does not provide an ingredient list we can import." }, 422);
    const ingredientText = ingredientLines.join(" ");
    const extendedIngredients = ingredientLines.map((original) => {
      const name = original.replace(/^\s*[\d¼½¾⅓⅔⅛⅜⅝⅞.,/\-–—\s]+/, "").replace(/\([^)]*\)/g, "").trim() || original;
      return { name, aisle: ingredientAisle(name), original };
    });
    const ready = parseDuration(recipeData.totalTime) || parseDuration(recipeData.prepTime) + parseDuration(recipeData.cookTime) || 40;
    const yieldText = Array.isArray(recipeData.recipeYield) ? recipeData.recipeYield[0] : recipeData.recipeYield;
    const servings = Math.max(1, Number(String(yieldText || "4").match(/\d+/)?.[0] || 4));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(finalUrl));
    const id = `import-${[...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    const descriptor = `${String(recipeData.keywords || "")} ${String(recipeData.recipeCuisine || "")} ${String(recipeData.recipeCategory || "")}`;
    const recipe: Recipe = {
      id,
      title: String(recipeData.name || "Imported recipe").trim().slice(0, 200),
      sourceName: new URL(finalUrl).hostname.replace(/^www\./, ""),
      sourceUrl: finalUrl,
      readyInMinutes: Math.min(1440, ready),
      servings,
      glutenFree: /gluten[- ]free/i.test(descriptor) || !glutenWords.test(ingredientText),
      dairyFree: /dairy[- ]free|vegan/i.test(descriptor) || !dairyWords.test(ingredientText),
      image: jsonLdImage(recipeData.image),
      pricePerServing: Math.min(900, 250 + extendedIngredients.length * 18),
      diets: /mediterranean/i.test(descriptor) ? ["Mediterranean"] : [],
      extendedIngredients,
    };
    await ensureSchema(env.DB);
    await cacheRecipes(env.DB, [recipe], "import");
    return json({ recipe });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "That recipe could not be imported." }, 502);
  }
}

async function locationLookup(url: URL, reverse = false) {
  const endpoint = reverse ? "reverse" : "search";
  const params = reverse
    ? new URLSearchParams({ lat: url.searchParams.get("lat") || "", lon: url.searchParams.get("lon") || "", format: "jsonv2", zoom: "14" })
    : new URLSearchParams({ q: url.searchParams.get("q") || "", format: "jsonv2", addressdetails: "1", limit: "6", countrycodes: "us" });
  const response = await fetch(`https://nominatim.openstreetmap.org/${endpoint}?${params}`, {
    headers: { "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)", "Accept-Language": "en-US,en" },
  });
  if (!response.ok) return json({ error: "Location search is temporarily unavailable." }, 502);
  const payload = await response.json() as Array<{ display_name?: string; lat?: string; lon?: string }> | { display_name?: string; lat?: string; lon?: string };
  const results = (Array.isArray(payload) ? payload : [payload]).filter(Boolean).map((item) => ({
    label: item.display_name || "Current location",
    lat: item.lat,
    lon: item.lon,
  }));
  return json({ results });
}

function distanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadiusMiles = 3958.8;
  const latitudeDistance = toRadians(lat2 - lat1);
  const longitudeDistance = toRadians(lon2 - lon1);
  const a = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(longitudeDistance / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function nearbyStoreLookup(url: URL) {
  const latitudeParam = url.searchParams.get("lat");
  const longitudeParam = url.searchParams.get("lon");
  let latitude = latitudeParam === null || latitudeParam === "" ? Number.NaN : Number(latitudeParam);
  let longitude = longitudeParam === null || longitudeParam === "" ? Number.NaN : Number(longitudeParam);
  const radiusMiles = Math.max(1, Math.min(25, Number(url.searchParams.get("radius") || 5)));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    const query = String(url.searchParams.get("q") || "").trim().slice(0, 200);
    if (!query) return json({ error: "Add a shopping location before finding stores." }, 400);
    try {
      const geocode = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, format: "jsonv2", limit: "1", countrycodes: "us" })}`, {
        headers: { "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)", "Accept-Language": "en-US,en" },
      });
      if (!geocode.ok) return json({ error: "Nearby store search is temporarily unavailable." }, 502);
      const locations = await geocode.json() as Array<{ lat?: string; lon?: string }>;
      latitude = Number(locations[0]?.lat);
      longitude = Number(locations[0]?.lon);
    } catch {
      return json({ error: "Nearby store search is temporarily unavailable." }, 502);
    }
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return json({ error: "Choose a more specific shopping location." }, 400);
  const radiusMeters = Math.round(radiusMiles * 1609.344);
  const query = `[out:json][timeout:15];(node["shop"~"supermarket|grocery"](around:${radiusMeters},${latitude},${longitude});way["shop"~"supermarket|grocery"](around:${radiusMeters},${latitude},${longitude});relation["shop"~"supermarket|grocery"](around:${radiusMeters},${latitude},${longitude}););out center tags 60;`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)" },
      body: new URLSearchParams({ data: query }),
    });
    if (!response.ok) return json({ error: "Nearby store search is temporarily unavailable." }, 502);
    const payload = await response.json() as { elements?: Array<{ id?: number; type?: string; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }> };
    const seen = new Set<string>();
    const stores = (payload.elements || []).flatMap((element) => {
      const tags = element.tags || {};
      const name = String(tags.name || tags.brand || "").trim();
      const lat = Number(element.lat ?? element.center?.lat);
      const lon = Number(element.lon ?? element.center?.lon);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      const address = [
        [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
        tags["addr:city"],
      ].filter(Boolean).join(", ");
      const dedupeKey = `${name}|${address || `${lat.toFixed(4)}:${lon.toFixed(4)}`}`.toLowerCase();
      if (seen.has(dedupeKey)) return [];
      seen.add(dedupeKey);
      return [{
        id: `osm-${element.type || "place"}-${element.id || crypto.randomUUID()}`,
        name: name.slice(0, 120),
        address: address.slice(0, 200),
        distanceMiles: Math.round(distanceInMiles(latitude, longitude, lat, lon) * 10) / 10,
        lat: String(lat),
        lon: String(lon),
      }];
    }).sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, 24);
    return json({ stores, center: { lat: String(latitude), lon: String(longitude) } });
  } catch {
    return json({ error: "Nearby store search is temporarily unavailable." }, 502);
  }
}

function calendarStamp(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;
}

function calendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function calendarResponse(body: { meals?: Array<{ id?: string; title: string; detail?: string; kind?: string; sortOrder?: number; sourceUrl?: string }>; randomize?: boolean }) {
  const meals = body.meals?.length ? body.meals : fallbackRecipes;
  const slots = meals.map((meal, index) => ({ ...meal, sortOrder: meal.sortOrder || Date.now() + index * 86400000 }))
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  const recipes = body.randomize ? [...meals].sort(() => Math.random() - .5) : slots;
  const events = slots.map((slot, index) => {
    const recipe = recipes[index];
    const start = new Date(Number(slot.sortOrder));
    start.setHours(slot.kind === "Dinner" ? 17 : 12, slot.kind === "Dinner" ? 30 : 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    return `BEGIN:VEVENT\r\nUID:grocer-eaze-${calendarText(String(recipe.id || index))}-${Number(slot.sortOrder)}@grocer-eaze\r\nDTSTAMP:${calendarStamp(new Date())}\r\nDTSTART:${calendarStamp(start)}\r\nDTEND:${calendarStamp(end)}\r\nSUMMARY:${calendarText(`${slot.kind || "Meal"}: ${recipe.title}`)}\r\nDESCRIPTION:${calendarText(`${recipe.detail || "Grocer-Eaze meal"}${recipe.sourceUrl ? `\nRecipe: ${recipe.sourceUrl}` : ""}`)}\r\n${recipe.sourceUrl ? `URL:${calendarText(recipe.sourceUrl)}\r\n` : ""}END:VEVENT`;
  }).join("\r\n");
  return new Response(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Grocer-Eaze//Meal Plan//EN\r\n${events}\r\nEND:VCALENDAR`, {
    headers: { "Content-Type": "text/calendar", "Content-Disposition": 'attachment; filename="grocer-eaze-meal-plan.ics"' },
  });
}

export async function handleApiRequest(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const origin = request.headers.get("origin");
  const crossSite = request.headers.get("sec-fetch-site") === "cross-site";
  if (isMutation && url.pathname !== "/api/stripe/webhook" && ((origin && origin !== url.origin) || crossSite)) {
    return json({ error: "This request did not come from Grocer-Eaze." }, 403);
  }
  const billingResponse = await handleBillingRequest(request, env);
  if (billingResponse) return billingResponse;
  const authResponse = await handleAuthRequest(request, env);
  if (authResponse) return authResponse;
  const sessionUser = await getSessionUser(request, env);
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/capabilities" && request.method === "GET") return json({ instacartShopping: Boolean(env.INSTACART_API_KEY) });
  if (url.pathname === "/api/location/search" && request.method === "GET") return locationLookup(url);
  if (url.pathname === "/api/location/reverse" && request.method === "GET") return locationLookup(url, true);
  if (url.pathname === "/api/accessibility-feedback" && request.method === "POST") {
    const body = await request.json() as { name?: string; email?: string; details?: string; website?: string };
    if (body.website) return json({ sent: true });
    const name = String(body.name || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().slice(0, 254);
    const details = String(body.details || "").trim().slice(0, 3000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (details.length < 10) return json({ error: "Please share a little more detail about the barrier." }, 400);
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return json({ error: "Feedback delivery is temporarily unavailable." }, 503);
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [env.INITIAL_ADMIN_EMAIL || "travis.rudd@gmail.com"],
        reply_to: email,
        subject: "Grocer-Eaze accessibility feedback",
        html: `<h1>Accessibility feedback</h1><p><strong>From:</strong> ${escapeHtml(name || "Anonymous")} (${escapeHtml(email)})</p><p>${escapeHtml(details).replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!sent.ok) return json({ error: "We couldn’t send your feedback. Please try again." }, 502);
    return json({ sent: true });
  }

  if (url.pathname === "/api/ingredient-feedback" && request.method === "POST") {
    if (!sessionUser) return json({ error: "Sign in before reporting a grocery-list issue." }, 401);
    if (!hasProductAccess(sessionUser)) return json({ error: "An active membership or trial is required." }, 402);
    const body = await request.json() as {
      category?: string; ingredient?: string; observedAmount?: string; correction?: string; details?: string;
      originals?: unknown; sources?: unknown; plan?: unknown;
    };
    const allowedCategories = new Set(["Incorrect amount", "Incorrect ingredient", "Duplicate ingredient", "Other"]);
    const category = allowedCategories.has(String(body.category)) ? String(body.category) : "Other";
    const ingredient = String(body.ingredient || "").trim().slice(0, 200);
    const observedAmount = String(body.observedAmount || "").trim().slice(0, 200);
    const correction = String(body.correction || "").trim().slice(0, 200);
    const details = String(body.details || "").trim().slice(0, 1000);
    if (!ingredient) return json({ error: "The ingredient name is required." }, 400);
    const originals = Array.isArray(body.originals) ? body.originals.map((value) => String(value).trim().slice(0, 300)).filter(Boolean).slice(0, 5) : [];
    const sources = Array.isArray(body.sources) ? body.sources.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      return [{ title: String(item.title || "Unknown recipe").trim().slice(0, 200), sourceName: String(item.sourceName || "Unknown source").trim().slice(0, 120), sourceUrl: safeHttpUrl(item.sourceUrl) }];
    }).slice(0, 5) : [];
    const plan = body.plan && typeof body.plan === "object" && !Array.isArray(body.plan) ? body.plan as Record<string, unknown> : {};
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return json({ error: "Issue reporting is temporarily unavailable." }, 503);
    const sourceList = sources.length ? `<ul>${sources.map((source) => `<li>${escapeHtml(source.title)} — ${escapeHtml(source.sourceName)}${source.sourceUrl ? ` — <a href="${escapeHtml(source.sourceUrl)}">Open recipe</a>` : ""}</li>`).join("")}</ul>` : "<p>No recipe source was recorded.</p>";
    const originalList = originals.length ? `<ul>${originals.map((original) => `<li>${escapeHtml(original)}</li>`).join("")}</ul>` : "<p>No raw ingredient value was recorded.</p>";
    const recipient = [env.INITIAL_ADMIN_EMAIL, ...(env.INITIAL_ADMIN_EMAILS || "").split(",")].map((email) => String(email || "").trim()).find(Boolean) || "travis.rudd@gmail.com";
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [recipient],
        reply_to: sessionUser.email,
        subject: `Grocer-Eaze ingredient report: ${category}`,
        html: `<h1>Ingredient-list report</h1><p><strong>Reporter:</strong> ${escapeHtml(sessionUser.name)} (${escapeHtml(sessionUser.email)})</p><p><strong>Category:</strong> ${escapeHtml(category)}</p><p><strong>Ingredient:</strong> ${escapeHtml(ingredient)}</p><p><strong>Observed amount:</strong> ${escapeHtml(observedAmount || "Not provided")}</p><p><strong>Suggested correction:</strong> ${escapeHtml(correction || "Not provided")}</p><p><strong>Details:</strong> ${escapeHtml(details || "Not provided").replace(/\n/g, "<br>")}</p><p><strong>Plan:</strong> ${escapeHtml(String(plan.planDays || "?"))} days; ${escapeHtml(String(plan.adults || 0))} adults; ${escapeHtml(String(plan.kids || 0))} kids; starts ${escapeHtml(String(plan.planStartDate || "unknown"))}</p><h2>Recipe sources</h2>${sourceList}<h2>Raw ingredient values</h2>${originalList}`,
      }),
    });
    if (!sent.ok) return json({ error: "We couldn’t send this report. Please try again." }, 502);
    return json({ sent: true });
  }

  const paidPaths = new Set(["/api/recipes/search", "/api/recipes/import", "/api/recipe-image", "/api/calendar", "/api/favorites", "/api/ratings", "/api/email", "/api/instacart/shopping-list"]);
  if (paidPaths.has(url.pathname) && !sessionUser) return json({ error: "Sign in and choose a membership to continue.", code: "PAYMENT_REQUIRED" }, 401);
  if (paidPaths.has(url.pathname) && !hasProductAccess(sessionUser)) return json({ error: "An active membership or trial is required.", code: "PAYMENT_REQUIRED" }, 402);
  if (url.pathname === "/api/recipes/search" && request.method === "GET") return searchRecipes(url, env);
  if (url.pathname === "/api/recipes/import" && request.method === "POST") return importRecipe(request, env);
  if (url.pathname === "/api/recipe-image" && request.method === "GET") return recipeImageResponse(url, env);
  if (url.pathname === "/api/calendar" && request.method === "POST") return calendarResponse(await request.json());
  if (url.pathname === "/api/instacart/shopping-list" && request.method === "POST") {
    if (!env.INSTACART_API_KEY) return json({ error: "Instacart shopping will activate after provider approval and production-key setup." }, 503);
    const body = await request.json() as {
      title?: string;
      items?: Array<{ name?: string; displayText?: string; measurements?: Array<{ quantity?: number; unit?: string }> }>;
    };
    const allowedUnits = new Set(["each", "cup", "tablespoon", "teaspoon", "ounce", "pound", "gram", "kilogram", "milliliter", "liter", "gallon", "pint", "quart", "can", "package", "bunch", "head", "large", "medium", "small"]);
    const items = Array.isArray(body.items) ? body.items.slice(0, 200).map((item) => {
      const name = String(item.name || "").trim().slice(0, 160);
      const measurements = (Array.isArray(item.measurements) ? item.measurements : []).slice(0, 4).flatMap((measurement) => {
        const quantity = Number(measurement.quantity || 0);
        const unit = String(measurement.unit || "each").toLowerCase();
        return quantity > 0 && quantity <= 10_000 && allowedUnits.has(unit) ? [{ quantity, unit }] : [];
      });
      return {
        name,
        display_text: String(item.displayText || name).trim().slice(0, 220),
        ...(measurements.length ? { line_item_measurements: measurements } : {}),
      };
    }).filter((item) => item.name) : [];
    if (!items.length) return json({ error: "Your grocery list needs at least one ingredient before shopping." }, 400);
    try {
      const instacartResponse = await fetch("https://connect.instacart.com/idp/v1/products/products_link", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.INSTACART_API_KEY}`, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)" },
        body: JSON.stringify({
          title: String(body.title || "Grocer-Eaze grocery list").trim().slice(0, 200),
          link_type: "shopping_list",
          expires_in: 30,
          line_items: items,
          landing_page_configuration: { partner_linkback_url: `${url.origin}/#list` },
        }),
      });
      const payload = await instacartResponse.json() as { products_link_url?: string; message?: string; error?: string };
      if (!instacartResponse.ok || !safeHttpUrl(payload.products_link_url)) return json({ error: payload.message || payload.error || "Instacart could not match this grocery list." }, 502);
      return json({ url: safeHttpUrl(payload.products_link_url) });
    } catch {
      return json({ error: "Instacart is temporarily unavailable. Your Grocer-Eaze list is unchanged." }, 502);
    }
  }

  if (!sessionUser) return json({ error: "Sign in to access household information." }, 401);
  const ownerId = sessionUser.id;
  await ensureSchema(env.DB);

  if (url.pathname === "/api/active-plan") {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT plan_json, updated_at FROM active_plans WHERE owner_id = ?").bind(ownerId).first();
      if (!row) return json({ plan: null });
      try { return json({ plan: JSON.parse(String(row.plan_json)), updatedAt: row.updated_at }); }
      catch { return json({ plan: null }); }
    }
    if (request.method === "PUT") {
      const body = await request.json() as { plan?: unknown };
      if (!body.plan || typeof body.plan !== "object" || Array.isArray(body.plan)) return json({ error: "A valid meal plan is required." }, 400);
      const planJson = JSON.stringify(body.plan);
      if (planJson.length > 1_500_000) return json({ error: "This meal plan is too large to save." }, 413);
      const updatedAt = new Date().toISOString();
      await env.DB.prepare("INSERT INTO active_plans(owner_id, plan_json, updated_at) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET plan_json=excluded.plan_json, updated_at=excluded.updated_at")
        .bind(ownerId, planJson, updatedAt).run();
      return json({ saved: true, updatedAt });
    }
    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM active_plans WHERE owner_id = ?").bind(ownerId).run();
      return json({ deleted: true });
    }
  }

  if (url.pathname === "/api/stores/search" && request.method === "GET") return nearbyStoreLookup(url);

  if (url.pathname === "/api/profile") {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM profiles WHERE owner_id = ?").bind(ownerId).first();
      return json({ profile: row || null });
    }
    if (request.method === "PUT") {
      const body = await request.json() as { householdName?: string; people?: number; location?: string; preferences?: unknown };
      const householdName = String(body.householdName || "My household").trim().slice(0, 120) || "My household";
      const people = Math.max(1, Math.min(20, Math.round(Number(body.people) || 1)));
      const location = String(body.location || "").trim().slice(0, 300);
      const preferences = body.preferences && typeof body.preferences === "object" && !Array.isArray(body.preferences) ? body.preferences : {};
      const preferencesJson = JSON.stringify(preferences);
      if (preferencesJson.length > 50_000) return json({ error: "Profile preferences are too large to save." }, 413);
      await env.DB.prepare("INSERT INTO profiles(owner_id, household_name, people, location, preferences_json, updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET household_name=excluded.household_name, people=excluded.people, location=excluded.location, preferences_json=excluded.preferences_json, updated_at=excluded.updated_at")
        .bind(ownerId, householdName, people, location, preferencesJson, new Date().toISOString()).run();
      return json({ saved: true });
    }
  }

  if (url.pathname === "/api/favorites") {
    if (request.method === "GET") {
      const result = await env.DB.prepare("SELECT recipe_json FROM favorites WHERE owner_id = ? ORDER BY created_at DESC").bind(ownerId).all();
      return json({ favorites: result.results.map((row) => JSON.parse(String(row.recipe_json))) });
    }
    if (request.method === "POST") {
      const recipe = await request.json() as { id?: string | number; title: string };
      const recipeId = String(recipe.id || recipe.title);
      await env.DB.prepare("INSERT OR REPLACE INTO favorites(id, owner_id, recipe_id, recipe_json, created_at) VALUES(?,?,?,?,?)")
        .bind(`${ownerId}:${recipeId}`, ownerId, recipeId, JSON.stringify(recipe), new Date().toISOString()).run();
      return json({ saved: true });
    }
    if (request.method === "DELETE") {
      const recipeId = url.searchParams.get("recipeId");
      await env.DB.prepare("DELETE FROM favorites WHERE owner_id = ? AND recipe_id = ?").bind(ownerId, recipeId).run();
      return json({ deleted: true });
    }
  }

  if (url.pathname === "/api/family") {
    if (request.method === "GET") {
      const result = await env.DB.prepare("SELECT * FROM family_members WHERE owner_id = ? ORDER BY created_at").bind(ownerId).all();
      return json({ members: result.results.map((row) => ({ ...row, preferences: JSON.parse(String(row.preferences_json || "{}")) })) });
    }
    if (request.method === "POST") {
      const body = await request.json() as { id?: string; name: string; role: string; preferences?: unknown; allergies?: string };
      const id = String(body.id || crypto.randomUUID()).trim().slice(0, 100);
      const name = String(body.name || "").trim().slice(0, 100);
      if (!id || !name) return json({ error: "Enter a name for this family member." }, 400);
      const role = ["Adult", "Teen", "Child"].includes(String(body.role)) ? String(body.role) : "Family member";
      const submittedPreferences = body.preferences && typeof body.preferences === "object" ? body.preferences as Record<string, unknown> : {};
      const preferences = {
        glutenFree: Boolean(submittedPreferences.glutenFree),
        lowDairy: Boolean(submittedPreferences.lowDairy),
        kidFriendly: Boolean(submittedPreferences.kidFriendly),
        avoidOnions: Boolean(submittedPreferences.avoidOnions),
        proteins: Array.isArray(submittedPreferences.proteins)
          ? submittedPreferences.proteins.map(String).filter((protein) => ["Beef", "Pork", "Fish", "Shrimp"].includes(protein)).slice(0, 4)
          : [],
      };
      const allergies = String(body.allergies || "").trim().slice(0, 500);
      const now = new Date().toISOString();
      const existing = await env.DB.prepare("SELECT owner_id FROM family_members WHERE id = ?").bind(id).first();
      if (existing && String(existing.owner_id) !== ownerId) return json({ error: "That family member was not found." }, 404);
      if (existing) {
        await env.DB.prepare("UPDATE family_members SET name = ?, role = ?, preferences_json = ?, allergies = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
          .bind(name, role, JSON.stringify(preferences), allergies, now, id, ownerId).run();
      } else {
        await env.DB.prepare("INSERT INTO family_members(id, owner_id, name, role, preferences_json, allergies, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)")
          .bind(id, ownerId, name, role, JSON.stringify(preferences), allergies, now, now).run();
      }
      return json({ saved: true, id });
    }
    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM family_members WHERE owner_id = ? AND id = ?").bind(ownerId, url.searchParams.get("id")).run();
      return json({ deleted: true });
    }
  }

  if (url.pathname === "/api/ratings") {
    if (request.method === "GET") {
      const result = await env.DB.prepare("SELECT recipe_id, quality, ease FROM recipe_ratings WHERE owner_id = ?").bind(ownerId).all();
      return json({ ratings: result.results });
    }
    if (request.method === "POST") {
      const body = await request.json() as { recipeId: string; quality: number; ease: number };
      await env.DB.prepare("INSERT OR REPLACE INTO recipe_ratings(id, owner_id, recipe_id, quality, ease, updated_at) VALUES(?,?,?,?,?,?)")
        .bind(`${ownerId}:${body.recipeId}`, ownerId, body.recipeId, Math.max(1, Math.min(5, body.quality)), Math.max(1, Math.min(5, body.ease)), new Date().toISOString()).run();
      return json({ saved: true });
    }
  }

  if (url.pathname === "/api/email" && request.method === "POST") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return json({ error: "Email delivery is not configured yet." }, 503);
    const body = await request.json() as { to?: string | string[]; subject?: string; meals?: Array<{ day?: string; title?: string; detail?: string; time?: string; sourceUrl?: string }> };
    const recipients = [...new Set((Array.isArray(body.to) ? body.to : String(body.to || "").split(/[;,\n]/)).map((address) => String(address).trim().toLowerCase()).filter(Boolean))].slice(0, 10);
    if (!recipients.length || recipients.some((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) return json({ error: "Enter up to 10 valid email addresses." }, 400);
    const meals = Array.isArray(body.meals) ? body.meals.slice(0, 100) : [];
    if (!meals.length) return json({ error: "Add at least one recipe before emailing your plan." }, 400);
    const html = `<h1>Your meal plan</h1>${meals.map((meal) => {
      const title = escapeHtml(String(meal.title || "Recipe"));
      const recipeUrl = safeHttpUrl(meal.sourceUrl);
      const linkedTitle = recipeUrl ? `<a href="${escapeHtml(recipeUrl)}">${title}</a>` : title;
      return `<h2>${escapeHtml(String(meal.day || "Meal"))}: ${linkedTitle}</h2><p>${escapeHtml(String(meal.detail || ""))} · ${escapeHtml(String(meal.time || ""))}</p>`;
    }).join("")}`;
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)",
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: recipients, subject: String(body.subject || "My Grocer-Eaze recipes"), html }),
    });
    return json(await sent.json(), sent.status);
  }
  return json({ error: "Not found." }, 404);
}
