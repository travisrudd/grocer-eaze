type AppEnv = {
  DB: D1Database;
  SPOONACULAR_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

const preferredSources = ["allrecipes.com", "foodnetwork.com", "eatingwell.com"];

const fallbackRecipes = [
  { id: "demo-salmon", title: "Lemon Herb Salmon", sourceName: "EatingWell", sourceUrl: "https://www.eatingwell.com/", readyInMinutes: 35, servings: 4, glutenFree: true, dairyFree: true, image: "", extendedIngredients: [{ original: "4 salmon fillets" }, { original: "1 bunch asparagus" }, { original: "1 cup quinoa" }] },
  { id: "demo-beans", title: "Tuscan White Bean Skillet", sourceName: "Food Network", sourceUrl: "https://www.foodnetwork.com/recipes", readyInMinutes: 30, servings: 4, glutenFree: true, dairyFree: true, image: "", extendedIngredients: [{ original: "2 cans white beans" }, { original: "5 oz baby spinach" }, { original: "1 pint cherry tomatoes" }] },
  { id: "demo-souvlaki", title: "Chicken Souvlaki Bowls", sourceName: "Allrecipes", sourceUrl: "https://www.allrecipes.com/", readyInMinutes: 40, servings: 4, glutenFree: true, dairyFree: true, image: "", extendedIngredients: [{ original: "1.5 lb chicken breast" }, { original: "2 cucumbers" }, { original: "1 cup oat yogurt" }] },
];

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS profiles (owner_id TEXT PRIMARY KEY, household_name TEXT NOT NULL, people INTEGER NOT NULL DEFAULT 4, location TEXT NOT NULL DEFAULT 'Uptown, Chicago, IL', preferences_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, recipe_id TEXT NOT NULL, recipe_json TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS favorites_owner_idx ON favorites(owner_id)"),
  ]);
}

async function searchRecipes(url: URL, env: AppEnv) {
  const query = url.searchParams.get("q") || "Mediterranean dinner";
  const maxTime = url.searchParams.get("maxTime") || "45";
  if (!env.SPOONACULAR_API_KEY) return json({ recipes: fallbackRecipes, demo: true });
  const params = new URLSearchParams({
    apiKey: env.SPOONACULAR_API_KEY,
    query,
    number: "18",
    addRecipeInformation: "true",
    fillIngredients: "true",
    instructionsRequired: "true",
    diet: "gluten free",
    maxReadyTime: maxTime,
  });
  const response = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${params}`);
  if (!response.ok) return json({ error: "Recipe provider is temporarily unavailable." }, 502);
  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  const preferred = (data.results || []).sort((a, b) => {
    const aUrl = String(a.sourceUrl || "");
    const bUrl = String(b.sourceUrl || "");
    return Number(preferredSources.some((host) => bUrl.includes(host))) - Number(preferredSources.some((host) => aUrl.includes(host)));
  });
  return json({ recipes: preferred, demo: false });
}

function calendarResponse(body: { meals?: Array<{ title: string; detail?: string }> }) {
  const meals = body.meals?.length ? body.meals : fallbackRecipes;
  const events = meals.map((meal, index) => `BEGIN:VEVENT\r\nUID:grocer-eaze-${index}@grocer-eaze\r\nDTSTART:202605${String(12 + index).padStart(2, "0")}T173000\r\nDTEND:202605${String(12 + index).padStart(2, "0")}T183000\r\nSUMMARY:${meal.title}\r\nDESCRIPTION:${meal.detail || "Grocer-Eaze meal"}\r\nEND:VEVENT`).join("\r\n");
  return new Response(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Grocer-Eaze//Meal Plan//EN\r\n${events}\r\nEND:VCALENDAR`, {
    headers: { "Content-Type": "text/calendar", "Content-Disposition": 'attachment; filename="grocer-eaze-meal-plan.ics"' },
  });
}

export async function handleApiRequest(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const ownerId = request.headers.get("x-grocer-owner") || "";
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/recipes/search" && request.method === "GET") return searchRecipes(url, env);
  if (url.pathname === "/api/calendar" && request.method === "POST") return calendarResponse(await request.json());
  if (!ownerId) return json({ error: "Missing household identifier." }, 400);
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

  if (url.pathname === "/api/email" && request.method === "POST") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return json({ error: "Email delivery is not configured yet." }, 503);
    const body = await request.json() as { to: string; subject: string; html: string };
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [body.to], subject: body.subject, html: body.html }),
    });
    return json(await sent.json(), sent.status);
  }
  return json({ error: "Not found." }, 404);
}
