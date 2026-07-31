type AppEnv = {
  DB: D1Database;
  SPOONACULAR_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_SECRET?: string;
  INITIAL_ADMIN_EMAIL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_MONTHLY_PRICE_ID?: string;
  STRIPE_YEARLY_PRICE_ID?: string;
  PEXELS_API_KEY?: string;
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
    if (preferredSources.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      try {
        const page = await fetch(source, { headers: { "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)", Accept: "text/html" }, redirect: "follow" });
        if (page.ok) resolved = metaImage((await page.text()).slice(0, 750_000), page.url || source);
      } catch { /* Continue to the provider image or licensed fallback. */ }
    }
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

  if (!resolved && fallback) {
    const host = new URL(fallback).hostname.replace(/^www\./, "");
    if (host === "spoonacular.com" || host.endsWith(".spoonacular.com")) resolved = fallback;
  }

  if (!resolved) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return new Response(null, { status: 302, headers: { Location: resolved, "Cache-Control": "public, max-age=86400" } });
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS profiles (owner_id TEXT PRIMARY KEY, household_name TEXT NOT NULL, people INTEGER NOT NULL DEFAULT 4, location TEXT NOT NULL DEFAULT 'Uptown, Chicago, IL', preferences_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, recipe_id TEXT NOT NULL, recipe_json TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS favorites_owner_idx ON favorites(owner_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS family_members (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, preferences_json TEXT NOT NULL DEFAULT '{}', allergies TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS family_members_owner_idx ON family_members(owner_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS recipe_ratings (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, recipe_id TEXT NOT NULL, quality INTEGER NOT NULL, ease INTEGER NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS recipe_ratings_owner_idx ON recipe_ratings(owner_id)"),
  ]);
}

async function searchRecipes(url: URL, env: AppEnv) {
  const query = url.searchParams.get("q") || "Mediterranean dinner";
  const maxTime = url.searchParams.get("maxTime") || "45";
  const requested = Math.max(1, Math.min(100, Number(url.searchParams.get("number") || 18)));
  if (!env.SPOONACULAR_API_KEY) return json({ recipes: fallbackPage(url, requested), demo: true, providerStatus: "fallback" });
  const params = new URLSearchParams({
    apiKey: env.SPOONACULAR_API_KEY,
    query,
    number: String(requested),
    offset: String(Math.max(0, Number(url.searchParams.get("offset") || 0))),
    addRecipeInformation: "true",
    fillIngredients: "true",
    instructionsRequired: "true",
    ...(url.searchParams.get("glutenFree") !== "false" ? { intolerances: "gluten" } : {}),
    ...(url.searchParams.get("excludeIngredients") ? { excludeIngredients: url.searchParams.get("excludeIngredients") || "" } : {}),
    maxReadyTime: maxTime,
    sort: "random",
  });
  let response: Response;
  try {
    response = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${params}`);
  } catch {
    return json({ recipes: fallbackPage(url, requested), demo: true, providerStatus: "unreachable" });
  }
  if (!response.ok) return json({ recipes: fallbackPage(url, requested), demo: true, providerStatus: `error-${response.status}` });
  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  const preferred = (data.results || []).sort((a, b) => {
    const aUrl = String(a.sourceUrl || "");
    const bUrl = String(b.sourceUrl || "");
    const sourceScore = Number(preferredSources.some((host) => bUrl.includes(host))) - Number(preferredSources.some((host) => aUrl.includes(host)));
    if (sourceScore) return sourceScore;
    if (url.searchParams.get("schoolLunch") === "true") return Number(a.readyInMinutes || 99) - Number(b.readyInMinutes || 99);
    return 0;
  });
  const used = new Set(preferred.map((recipe) => String(recipe.title).toLowerCase()));
  const supplemental = fallbackPage(url, fallbackRecipes.length).filter((recipe) => !used.has(recipe.title.toLowerCase()));
  if (url.searchParams.get("schoolLunch") === "true") {
    supplemental.sort((a, b) => {
      const lunchPattern = /box|bento|roll-up|quesadilla|bites|lunch|pita|snack/i;
      const kidScore = Number(lunchPattern.test(b.title)) - Number(lunchPattern.test(a.title));
      return kidScore || a.readyInMinutes - b.readyInMinutes;
    });
  }
  return json({ recipes: [...preferred, ...supplemental].slice(0, requested), demo: false });
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
  const billingResponse = await handleBillingRequest(request, env);
  if (billingResponse) return billingResponse;
  const authResponse = await handleAuthRequest(request, env);
  if (authResponse) return authResponse;
  const sessionUser = await getSessionUser(request, env);
  if (url.pathname === "/api/health") return json({ ok: true });
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

  const paidPaths = new Set(["/api/recipes/search", "/api/recipe-image", "/api/calendar", "/api/favorites", "/api/ratings", "/api/email"]);
  if (paidPaths.has(url.pathname) && !sessionUser) return json({ error: "Sign in and choose a membership to continue.", code: "PAYMENT_REQUIRED" }, 401);
  if (paidPaths.has(url.pathname) && !hasProductAccess(sessionUser)) return json({ error: "An active membership or trial is required.", code: "PAYMENT_REQUIRED" }, 402);
  if (url.pathname === "/api/recipes/search" && request.method === "GET") return searchRecipes(url, env);
  if (url.pathname === "/api/recipe-image" && request.method === "GET") return recipeImageResponse(url, env);
  if (url.pathname === "/api/calendar" && request.method === "POST") return calendarResponse(await request.json());

  if (!sessionUser) return json({ error: "Sign in to access household information." }, 401);
  const ownerId = sessionUser.id;
  await ensureSchema(env.DB);

  if (url.pathname === "/api/profile") {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM profiles WHERE owner_id = ?").bind(ownerId).first();
      return json({ profile: row || null });
    }
    if (request.method === "PUT") {
      const body = await request.json() as { householdName: string; people: number; location: string; preferences: unknown };
      await env.DB.prepare("INSERT INTO profiles(owner_id, household_name, people, location, preferences_json, updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET household_name=excluded.household_name, people=excluded.people, location=excluded.location, preferences_json=excluded.preferences_json, updated_at=excluded.updated_at")
        .bind(ownerId, body.householdName, body.people, body.location, JSON.stringify(body.preferences), new Date().toISOString()).run();
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
      const id = body.id || crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare("INSERT INTO family_members(id, owner_id, name, role, preferences_json, allergies, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, preferences_json=excluded.preferences_json, allergies=excluded.allergies, updated_at=excluded.updated_at")
        .bind(id, ownerId, body.name, body.role, JSON.stringify(body.preferences || {}), body.allergies || "", now, now).run();
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
    const body = await request.json() as { to?: string; subject?: string; meals?: Array<{ day?: string; title?: string; detail?: string; time?: string; sourceUrl?: string }> };
    const to = String(body.to || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: "Enter a valid email address." }, 400);
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
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: String(body.subject || "My Grocer-Eaze recipes"), html }),
    });
    return json(await sent.json(), sent.status);
  }
  return json({ error: "Not found." }, 404);
}
