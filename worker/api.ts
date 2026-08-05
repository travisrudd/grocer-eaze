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
};
import { ensureAuthSchema, getSessionUser, handleAuthRequest, hasProductAccess, rateLimit } from "./auth";
import { cancelStripeSubscription, handleBillingRequest } from "./billing";
import { cleanRecipeText, normalizeRecipeInstructions, renderRecipeReader, type RecipeInstructionSection, type RecipeReaderContent } from "./recipe-reader";

const preferredSources = ["allrecipes.com", "foodnetwork.com", "eatingwell.com", "seriouseats.com", "simplyrecipes.com"];
const publicAppOrigin = "https://grocer-eaze.com";

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

const genericIngredientLabel = /^(?:fresh\s+)?(?:vegetables?|produce|fruit|proteins?|lean protein or beans|beans or protein|herbs?|herbs and pantry staples|pantry staples|seasonings?|garnish|toppings?|sides?)$/i;

function isConcreteIngredientName(value: unknown) {
  const normalized = String(value || "").replace(/[–—/&+]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > 1 && !genericIngredientLabel.test(normalized);
}

function concreteFallbackIngredients(title: string) {
  const lower = title.toLowerCase();
  const ingredients: Array<{ name: string; aisle: string; original: string }> = [];
  const add = (name: string, original: string) => {
    if (!ingredients.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      ingredients.push({ name, aisle: ingredientAisle(name), original });
    }
  };

  if (/salmon/.test(lower)) add("salmon fillets", "1 1/2 pounds salmon fillets");
  if (/shrimp/.test(lower)) add("peeled shrimp", "1 1/2 pounds peeled shrimp");
  if (/chicken/.test(lower)) add("boneless skinless chicken breasts", "1 1/2 pounds boneless skinless chicken breasts");
  if (/turkey/.test(lower)) add(/box|bento|bites|roll-up|wrap|pita/.test(lower) ? "sliced turkey" : "lean ground turkey", /box|bento|bites|roll-up|wrap|pita/.test(lower) ? "12 ounces sliced turkey" : "1 1/2 pounds lean ground turkey");
  if (/pork/.test(lower)) add(/chop/.test(lower) ? "boneless pork chops" : "pork tenderloin", /chop/.test(lower) ? "4 boneless pork chops" : "1 1/2 pounds pork tenderloin");
  if (/beef|kofta/.test(lower)) add(/broccoli|rice bowl/.test(lower) ? "beef sirloin" : "lean ground beef", /broccoli|rice bowl/.test(lower) ? "1 1/2 pounds beef sirloin" : "1 1/2 pounds lean ground beef");
  if (/\bcod\b/.test(lower)) add("cod fillets", "1 1/2 pounds cod fillets");
  if (/\btuna\b|niçoise/.test(lower)) add("canned tuna", "2 5-ounce cans tuna");
  if (/white bean/.test(lower)) add("cannellini beans", "2 15-ounce cans cannellini beans");
  if (/black bean/.test(lower)) add("black beans", "2 15-ounce cans black beans");
  if (/chickpea/.test(lower)) add("chickpeas", "2 15-ounce cans chickpeas");
  if (/lentil/.test(lower)) add("dry lentils", "1 1/2 cups dry lentils");
  if (/\begg\b|frittata|shakshuka/.test(lower)) add("large eggs", "8 large eggs");
  if (/hummus/.test(lower)) add("plain hummus", "2 cups plain hummus");
  if (/falafel/.test(lower)) add("gluten-free prepared falafel", "12 gluten-free prepared falafel");
  if (/sunflower butter/.test(lower)) add("sunflower seed butter", "1 cup sunflower seed butter");
  if (/mushroom/.test(lower)) add("cremini mushrooms", "16 ounces cremini mushrooms");
  if (/cauliflower/.test(lower)) add("cauliflower", "1 large head cauliflower");

  if (/rice/.test(lower)) add("long-grain rice", "1 1/2 cups long-grain rice");
  if (/quinoa|grain bowl/.test(lower)) add("quinoa", "1 1/2 cups quinoa");
  if (/polenta/.test(lower)) add("polenta", "1 1/2 cups polenta");
  if (/risotto/.test(lower)) add("arborio rice", "1 1/2 cups arborio rice");
  if (/\bpasta\b/.test(lower)) add("gluten-free pasta", "12 ounces gluten-free pasta");
  if (/\borzo\b/.test(lower)) add("gluten-free orzo", "12 ounces gluten-free orzo");
  if (/noodles/.test(lower)) add("rice noodles", "12 ounces rice noodles");
  if (/couscous/.test(lower)) add("gluten-free corn couscous", "1 1/2 cups gluten-free corn couscous");
  if (/pita|flatbread/.test(lower)) add("gluten-free pita bread", "8 gluten-free pita breads");
  if (/taco|quesadilla|pinwheel|roll-up|wrap/.test(lower)) add("gluten-free tortillas", "8 gluten-free tortillas");
  if (/cracker/.test(lower)) add("gluten-free crackers", "8 ounces gluten-free crackers");
  if (/potato/.test(lower)) add(/sweet potato/.test(lower) ? "sweet potatoes" : "Yukon gold potatoes", /sweet potato/.test(lower) ? "3 large sweet potatoes" : "2 pounds Yukon gold potatoes");

  if (/tomato|caprese|piccata|ratatouille|shakshuka/.test(lower)) add("Roma tomatoes", "6 Roma tomatoes");
  if (/broccoli/.test(lower)) add("broccoli florets", "4 cups broccoli florets");
  if (/zucchini/.test(lower)) add("zucchini", "4 medium zucchini");
  if (/eggplant|moussaka/.test(lower)) add("eggplant", "2 large eggplants");
  if (/pepper|fajita/.test(lower)) add("bell peppers", "4 bell peppers");
  if (/spinach/.test(lower)) add("baby spinach", "6 cups baby spinach");
  if (/kale|greens/.test(lower)) add("lacinato kale", "1 large bunch lacinato kale");
  if (/lettuce|salad|niçoise/.test(lower)) add("romaine lettuce", "2 heads romaine lettuce");
  if (/green bean/.test(lower)) add("green beans", "1 pound green beans");
  if (/artichoke/.test(lower)) add("artichoke hearts", "2 14-ounce cans artichoke hearts");
  if (/squash/.test(lower)) add("acorn squash", "2 medium acorn squash");
  if (/cucumber|tzatziki|sushi|greek/.test(lower)) add("English cucumbers", "2 English cucumbers");
  if (/vegetable|veggie|rainbow|tagine|fajita|ratatouille/.test(lower)) {
    add("red bell peppers", "2 red bell peppers");
    add("zucchini", "2 medium zucchini");
    add("carrots", "4 medium carrots");
  }

  if (/apple/.test(lower)) add("apples", "3 medium apples");
  if (/pear/.test(lower)) add("ripe pears", "3 ripe pears");
  if (/pineapple/.test(lower)) add("pineapple chunks", "2 cups pineapple chunks");
  if (/orange|citrus/.test(lower)) add("oranges", "3 medium oranges");
  if (/berry/.test(lower)) add("strawberries", "2 cups strawberries");
  if (/banana/.test(lower)) add("bananas", "4 medium bananas");
  if (/avocado/.test(lower)) add("avocados", "2 ripe avocados");
  if (/lemon|piccata/.test(lower)) add("lemons", "3 lemons");
  if (/lime/.test(lower)) add("limes", "3 limes");

  if (/pesto/.test(lower)) add("dairy-free basil pesto", "3/4 cup dairy-free basil pesto");
  if (/honey mustard/.test(lower)) add("Dijon mustard", "3 tablespoons Dijon mustard");
  if (/miso/.test(lower)) add("white miso paste", "3 tablespoons white miso paste");
  if (/coconut|curry/.test(lower)) add("coconut milk", "1 14-ounce can coconut milk");
  if (/harissa/.test(lower)) add("harissa paste", "3 tablespoons harissa paste");
  if (/sesame/.test(lower)) add("toasted sesame oil", "2 tablespoons toasted sesame oil");
  if (/balsamic/.test(lower)) add("balsamic vinegar", "3 tablespoons balsamic vinegar");
  if (/rosemary/.test(lower)) add("fresh rosemary", "2 tablespoons chopped fresh rosemary");
  if (/dill/.test(lower)) add("fresh dill", "1/4 cup chopped fresh dill");
  if (/herb/.test(lower)) add("fresh parsley", "1/2 cup chopped fresh parsley");
  if (/oregano|greek|souvlaki/.test(lower)) add("dried oregano", "2 teaspoons dried oregano");
  if (/paprika/.test(lower)) add("smoked paprika", "2 teaspoons smoked paprika");
  if (/basil|caprese/.test(lower)) add("fresh basil", "1 cup fresh basil leaves");
  if (/caprese/.test(lower)) add("fresh mozzarella", "8 ounces fresh mozzarella");
  if (/feta|greek|mediterranean/.test(lower)) add("feta cheese", "6 ounces feta cheese");
  if (/tzatziki|yogurt/.test(lower)) add("plain Greek yogurt", "1 cup plain Greek yogurt");
  if (/cheddar/.test(lower)) add("cheddar cheese", "8 ounces cheddar cheese");
  if (/caesar/.test(lower)) add("Caesar dressing", "3/4 cup Caesar dressing");
  if (/olive|niçoise/.test(lower)) add("pitted Kalamata olives", "1 cup pitted Kalamata olives");
  if (/corn/.test(lower)) add("corn kernels", "2 cups corn kernels");

  const readyToPack = /box|bento|roll-up|bites|cracker kit|pinwheel|skewer|boats/.test(lower);
  if (!readyToPack) {
    add("extra-virgin olive oil", "3 tablespoons extra-virgin olive oil");
    add("garlic cloves", "3 garlic cloves");
    add("kosher salt", "1 teaspoon kosher salt");
    add("black pepper", "1/2 teaspoon black pepper");
  }
  if (ingredients.length < 4) {
    add("baby carrots", "2 cups baby carrots");
    add("English cucumbers", "2 English cucumbers");
  }
  return ingredients.filter((ingredient) => isConcreteIngredientName(ingredient.name));
}

const fallbackRecipes = fallbackTitles.map((title, index) => {
  const extendedIngredients = concreteFallbackIngredients(title);
  const ingredientText = extendedIngredients.map((ingredient) => ingredient.name).join(" ");
  return {
    id: `demo-${index + 1}`,
    title,
    sourceName: ["EatingWell", "Food Network", "Allrecipes", "Serious Eats", "Simply Recipes"][index % 5],
    sourceUrl: ["https://www.eatingwell.com/recipes/", "https://www.foodnetwork.com/recipes", "https://www.allrecipes.com/recipes/", "https://www.seriouseats.com/recipes-5117985", "https://www.simplyrecipes.com/recipes-5090746"][index % 5],
    readyInMinutes: 20 + (index % 5) * 5,
    servings: 4,
    glutenFree: true,
    dairyFree: !/\b(?:milk|cheese|cream|butter|yogurt|yoghurt|whey|ghee|mascarpone|mozzarella|parmesan|feta)\b/i.test(ingredientText),
    image: "",
    pricePerServing: 280 + (index % 7) * 55,
    diets: ["gluten free", "Mediterranean"],
    extendedIngredients,
    instructions: [] as RecipeInstructionSection[],
  };
});

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
  instructions: RecipeInstructionSection[];
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
  if (!Array.isArray(recipe.extendedIngredients) || !recipe.extendedIngredients.some((item) => isConcreteIngredientName(item.name))) return false;
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
  }).filter((ingredient): ingredient is NonNullable<typeof ingredient> => Boolean(ingredient && isConcreteIngredientName(ingredient.name)));
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
    instructions: normalizeRecipeInstructions(meal.strInstructions),
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
    const recipes = (data.results || []).map((result) => {
      const recipe = result as Record<string, unknown>;
      const extendedIngredients = Array.isArray(recipe.extendedIngredients)
        ? recipe.extendedIngredients.flatMap((ingredient) => {
          if (!ingredient || typeof ingredient !== "object") return [];
          const item = ingredient as Record<string, unknown>;
          const name = String(item.name || item.nameClean || item.original || "").trim();
          return isConcreteIngredientName(name) ? [{ name, aisle: String(item.aisle || ingredientAisle(name)), original: String(item.original || name) }] : [];
        })
        : [];
      const ingredientText = extendedIngredients.map((ingredient) => ingredient.name).join(" ");
      return {
        id: String(recipe.id || crypto.randomUUID()),
        title: String(recipe.title || "Spoonacular recipe"),
        sourceName: String(recipe.sourceName || "Spoonacular"),
        sourceUrl: safeHttpUrl(recipe.sourceUrl || recipe.spoonacularSourceUrl),
        readyInMinutes: Math.max(1, Number(recipe.readyInMinutes || 40)),
        servings: Math.max(1, Number(recipe.servings || 4)),
        glutenFree: recipe.glutenFree === true || !glutenWords.test(ingredientText),
        dairyFree: recipe.dairyFree === true || !dairyWords.test(ingredientText),
        image: safeHttpUrl(recipe.image),
        pricePerServing: Math.max(0, Number(recipe.pricePerServing || 0)),
        diets: Array.isArray(recipe.diets) ? recipe.diets.map(String).slice(0, 20) : [],
        extendedIngredients,
        instructions: normalizeRecipeInstructions(recipe.analyzedInstructions || recipe.instructions),
      } satisfies Recipe;
    }).filter((recipe) => recipe.extendedIngredients.length > 0);
    return { recipes, status: "ok" };
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
    db.prepare("CREATE TABLE IF NOT EXISTS recipe_readers (share_token TEXT PRIMARY KEY, owner_id TEXT NOT NULL, recipe_key TEXT NOT NULL, source_url TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT, revoked_at TEXT)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS recipe_readers_owner_recipe_idx ON recipe_readers(owner_id, recipe_key)"),
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
  }).map((recipe) => recipe ? { ...recipe, extendedIngredients: Array.isArray(recipe.extendedIngredients) ? recipe.extendedIngredients.filter((ingredient) => isConcreteIngredientName(ingredient.name)) : [] } : null)
    .filter((recipe): recipe is Recipe => Boolean(recipe && recipeMatches(recipe, url))).slice(offset, offset + requested);
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
  await Promise.all([
    cacheRecipes(env.DB, spoonacular.recipes, "spoonacular"),
    cacheRecipes(env.DB, mealDb.recipes, "themealdb"),
  ]);
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
  if (!safe || safe.length > 2_048) return "";
  const parsed = new URL(safe);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (parsed.username || parsed.password || !["", "80", "443"].includes(parsed.port)) return "";
  if (host === "localhost" || host === "metadata" || host === "instance-data" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home") || host.endsWith(".lan") || host.endsWith(".svc") || host === "0.0.0.0" || host === "::1") return "";
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
      signal: AbortSignal.timeout(10_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = isPublicRecipeUrl(new URL(response.headers.get("location") || "", current).toString());
      if (!next) throw new Error("That recipe link redirects to an unsupported address.");
      current = next;
      continue;
    }
    if (!response.ok) throw new Error("That recipe page could not be opened.");
    if (!String(response.headers.get("content-type") || "").toLowerCase().includes("html")) throw new Error("That link is not an HTML recipe page.");
    const maximumBytes = 1_500_000;
    const declaredBytes = Number(response.headers.get("content-length") || 0);
    if (declaredBytes > maximumBytes) throw new Error("That recipe page is too large to read safely.");
    if (!response.body) return { html: "", finalUrl: response.url || current };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let html = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel();
        throw new Error("That recipe page is too large to read safely.");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return { html, finalUrl: response.url || current };
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

function recipeJsonLdFromHtml(html: string) {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const recipe = findRecipeJsonLd(JSON.parse(match[1].trim()));
      if (recipe) return recipe;
    } catch { /* Some pages include unrelated malformed structured data; try the next block. */ }
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
    const recipeData = recipeJsonLdFromHtml(html);
    if (!recipeData) return json({ error: "We couldn’t find structured recipe details on that page. Try another recipe link." }, 422);
    const ingredientLines = Array.isArray(recipeData.recipeIngredient) ? recipeData.recipeIngredient.map(String).filter(Boolean) : [];
    if (!ingredientLines.length) return json({ error: "That page names a recipe but does not provide an ingredient list we can import." }, 422);
    const ingredientText = ingredientLines.join(" ");
    const extendedIngredients = ingredientLines.map((original) => {
      const name = original.replace(/^\s*[\d¼½¾⅓⅔⅛⅜⅝⅞.,/\-–—\s]+/, "").replace(/\([^)]*\)/g, "").trim() || original;
      return { name, aisle: ingredientAisle(name), original };
    }).filter((ingredient) => isConcreteIngredientName(ingredient.name));
    if (!extendedIngredients.length) return json({ error: "That page does not provide specific ingredients we can safely add to a grocery list." }, 422);
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
      instructions: normalizeRecipeInstructions(recipeData.recipeInstructions),
    };
    await ensureSchema(env.DB);
    await cacheRecipes(env.DB, [recipe], "import");
    return json({ recipe });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "That recipe could not be imported." }, 502);
  }
}

type ReaderMealInput = {
  mealId?: unknown;
  recipeId?: unknown;
  title?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  readyInMinutes?: unknown;
  servings?: unknown;
  ingredients?: unknown;
  instructions?: unknown;
  recipeServings?: unknown;
  extendedIngredients?: unknown;
  recipeInstructions?: unknown;
  analyzedInstructions?: unknown;
};

function readerContentFromRecipe(value: ReaderMealInput | Record<string, unknown>): RecipeReaderContent | null {
  const sourceUrl = isPublicRecipeUrl(value.sourceUrl);
  if (!sourceUrl) return null;
  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.flatMap((ingredient) => {
      if (typeof ingredient === "string") {
        const text = cleanRecipeText(ingredient, 400);
        return text ? [text] : [];
      }
      if (!ingredient || typeof ingredient !== "object") return [];
      const item = ingredient as Record<string, unknown>;
      const text = cleanRecipeText(item.original || item.name, 400);
      return text ? [text] : [];
    }).slice(0, 250)
    : Array.isArray(value.extendedIngredients)
      ? (value.extendedIngredients as unknown[]).flatMap((ingredient) => {
        if (!ingredient || typeof ingredient !== "object") return [];
        const item = ingredient as Record<string, unknown>;
        const text = cleanRecipeText(item.original || item.name, 400);
        return text ? [text] : [];
      }).slice(0, 250)
      : [];
  const instructions = normalizeRecipeInstructions(value.instructions || value.recipeInstructions || value.analyzedInstructions);
  return {
    title: cleanRecipeText(value.title, 200) || "Recipe",
    sourceName: cleanRecipeText(value.sourceName, 120) || new URL(sourceUrl).hostname.replace(/^www\./, ""),
    sourceUrl,
    readyInMinutes: Math.max(0, Math.min(1_440, Math.round(Number(value.readyInMinutes || 0)) || 0)),
    servings: Math.max(0, Math.min(100, Math.round(Number(value.servings || value.recipeServings || 0)) || 0)),
    ingredients,
    instructions,
    extractionStatus: instructions.length ? "complete" : "pending",
  };
}

async function readerRecipeKey(recipeId: string, sourceUrl: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${recipeId}\n${sourceUrl}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomReaderToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requestTextWithinLimit(request: Request, maximumBytes: number) {
  const declaredBytes = Number(request.headers.get("content-length") || 0);
  if (declaredBytes > maximumBytes) throw new Error("REQUEST_TOO_LARGE");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maximumBytes) {
      await reader.cancel();
      throw new Error("REQUEST_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function createRecipeReaders(request: Request, env: AppEnv, ownerId: string) {
  let bodyText = "";
  try { bodyText = await requestTextWithinLimit(request, 750_000); }
  catch { return json({ error: "This meal plan is too large to prepare for the recipe reader." }, 413); }
  let body: { meals?: ReaderMealInput[] };
  try { body = JSON.parse(bodyText) as { meals?: ReaderMealInput[] }; }
  catch { return json({ error: "A valid meal plan is required." }, 400); }
  const meals = Array.isArray(body.meals) ? body.meals.slice(0, 100) : [];
  if (!meals.length) return json({ error: "Add at least one recipe before creating calendar links." }, 400);
  await ensureSchema(env.DB);

  const catalogResults = await env.DB.batch(meals.map((meal) => env.DB.prepare("SELECT recipe_json FROM recipe_catalog WHERE id = ? OR source_url = ? ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END LIMIT 1")
    .bind(String(meal.recipeId || "").slice(0, 200), isPublicRecipeUrl(meal.sourceUrl), String(meal.recipeId || "").slice(0, 200))));
  const prepared = (await Promise.all(meals.map(async (meal, index) => {
    const mealId = String(meal.mealId || "").slice(0, 200);
    const recipeId = String(meal.recipeId || mealId || "").slice(0, 200);
    let submitted = readerContentFromRecipe(meal);
    const catalogRow = catalogResults[index]?.results?.[0] as { recipe_json?: unknown } | undefined;
    if (catalogRow?.recipe_json) {
      try {
        const cached = readerContentFromRecipe(JSON.parse(String(catalogRow.recipe_json)) as Record<string, unknown>);
        if (cached) {
          submitted = submitted ? {
            ...submitted,
            ingredients: submitted.ingredients.length ? submitted.ingredients : cached.ingredients,
            instructions: submitted.instructions.length ? submitted.instructions : cached.instructions,
            extractionStatus: submitted.instructions.length || cached.instructions.length ? "complete" : "pending",
          } : cached;
        }
      } catch { /* Use the validated plan copy when an old catalog row is malformed. */ }
    }
    if (!submitted) return null;
    return { mealId, recipeId, recipeKey: await readerRecipeKey(recipeId, submitted.sourceUrl), content: submitted };
  }))).filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe));
  if (!prepared.length) return json({ error: "These recipes do not include supported public source links." }, 422);

  const uniqueRecipes = [...new Map(prepared.map((recipe) => [recipe.recipeKey, recipe])).values()];
  const existingResults = await env.DB.batch(uniqueRecipes.map((recipe) => env.DB.prepare("SELECT share_token, content_json FROM recipe_readers WHERE owner_id = ? AND recipe_key = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) LIMIT 1").bind(ownerId, recipe.recipeKey, new Date().toISOString())));
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
  const readers = uniqueRecipes.map((recipe, index) => {
    const existing = existingResults[index]?.results?.[0] as { share_token?: unknown; content_json?: unknown } | undefined;
    let content = recipe.content;
    if (!content.instructions.length && existing?.content_json) {
      try {
        const previous = readerContentFromRecipe(JSON.parse(String(existing.content_json)) as Record<string, unknown>);
        if (previous?.instructions.length) content = { ...content, instructions: previous.instructions, extractionStatus: "complete" };
        else if ((JSON.parse(String(existing.content_json)) as Record<string, unknown>).extractionStatus === "unavailable") content = { ...content, extractionStatus: "unavailable" };
      } catch { /* Replace malformed legacy content with the normalized current recipe. */ }
    }
    return { ...recipe, token: String(existing?.share_token || randomReaderToken()), content };
  });
  await env.DB.batch(readers.map((reader) => env.DB.prepare("INSERT INTO recipe_readers(share_token, owner_id, recipe_key, source_url, content_json, created_at, updated_at, expires_at, revoked_at) VALUES(?,?,?,?,?,?,?,?,NULL) ON CONFLICT(owner_id, recipe_key) DO UPDATE SET share_token=excluded.share_token, source_url=excluded.source_url, content_json=excluded.content_json, updated_at=excluded.updated_at, expires_at=excluded.expires_at, revoked_at=NULL")
    .bind(reader.token, ownerId, reader.recipeKey, reader.content.sourceUrl, JSON.stringify(reader.content), now, now, expiresAt)));
  const tokensByRecipe = new Map(readers.map((reader) => [reader.recipeKey, reader.token]));
  return json({ readers: prepared.map((recipe) => ({ mealId: recipe.mealId, recipeId: recipe.recipeId, url: `${publicAppOrigin}/recipe/${tokensByRecipe.get(recipe.recipeKey)}` })) });
}

function recipeReaderErrorPage(message: string, status = 404) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Recipe unavailable | Grocer-Eaze</title></head><body style="margin:0;background:#f5f4ed;color:#183329;font:16px/1.5 system-ui"><main style="width:min(620px,calc(100% - 32px));margin:64px auto;background:#fffdf8;border:1px solid #d8e4dc;border-radius:20px;padding:32px"><h1 style="font-family:Georgia,serif">Recipe unavailable</h1><p>${escapeHtml(message)}</p><a href="/" style="color:#126b4d;font-weight:700">Return to Grocer-Eaze</a></main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
  });
}

export async function handleRecipeReaderPage(request: Request, env: AppEnv): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return recipeReaderErrorPage("This recipe reader only supports viewing shared recipes.", 405);
  const url = new URL(request.url);
  const token = url.pathname.match(/^\/recipe\/([a-f0-9]{64})\/?$/i)?.[1]?.toLowerCase();
  if (!token) return recipeReaderErrorPage("This clean recipe link is incomplete or invalid.");
  await ensureSchema(env.DB);
  await env.DB.prepare("DELETE FROM recipe_readers WHERE expires_at IS NOT NULL AND expires_at <= ?").bind(new Date().toISOString()).run();
  const row = await env.DB.prepare("SELECT content_json FROM recipe_readers WHERE share_token = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) LIMIT 1").bind(token, new Date().toISOString()).first();
  if (!row?.content_json) return recipeReaderErrorPage("This clean recipe link is no longer available.");
  let stored: Record<string, unknown>;
  try { stored = JSON.parse(String(row.content_json)) as Record<string, unknown>; }
  catch { return recipeReaderErrorPage("This recipe could not be read safely.", 500); }
  let content = readerContentFromRecipe(stored);
  if (!content) return recipeReaderErrorPage("This recipe does not include a supported original source.", 422);
  content.extractionStatus = stored.extractionStatus === "unavailable" && !content.instructions.length ? "unavailable" : content.extractionStatus;

  if (!content.instructions.length && content.extractionStatus === "pending") {
    try {
      const { html, finalUrl } = await fetchRecipePage(content.sourceUrl);
      const recipeData = recipeJsonLdFromHtml(html);
      const instructions = normalizeRecipeInstructions(recipeData?.recipeInstructions);
      const extractedIngredients = Array.isArray(recipeData?.recipeIngredient)
        ? recipeData.recipeIngredient.map((ingredient) => cleanRecipeText(ingredient, 400)).filter(Boolean).slice(0, 250)
        : [];
      content = {
        ...content,
        sourceUrl: isPublicRecipeUrl(finalUrl) || content.sourceUrl,
        ingredients: content.ingredients.length ? content.ingredients : extractedIngredients,
        instructions,
        extractionStatus: instructions.length ? "complete" : "unavailable",
      };
    } catch {
      content = { ...content, extractionStatus: "unavailable" };
    }
    await env.DB.prepare("UPDATE recipe_readers SET source_url = ?, content_json = ?, updated_at = ? WHERE share_token = ?")
      .bind(content.sourceUrl, JSON.stringify(content), new Date().toISOString(), token).run();
  }

  const html = renderRecipeReader(content, `${publicAppOrigin}${url.pathname}`);
  return new Response(request.method === "HEAD" ? null : html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
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

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary);
}

async function deliveryEmailAllowed(env: AppEnv, ownerId: string, attempts = 1) {
  const bucket = Math.floor(Date.now() / 3_600_000);
  const id = `delivery-email:${ownerId}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * 3_600_000).toISOString();
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO auth_rate_limits(id,attempts,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+excluded.attempts").bind(id, attempts, expiresAt).run();
  const row = await env.DB.prepare("SELECT attempts FROM auth_rate_limits WHERE id = ?").bind(id).first();
  return Number(row?.attempts || 0) <= 30;
}

type DeliveryCalendarMeal = { id: string; title: string; detail: string; kind: string; sortOrder: number; sourceUrl: string; readerUrl: string };

function deliveryCalendarFile(meals: DeliveryCalendarMeal[]) {
  const events = meals.map((recipe, index) => {
    const start = new Date(recipe.sortOrder || Date.now() + index * 86_400_000);
    start.setHours(recipe.kind === "Dinner" ? 17 : 12, recipe.kind === "Dinner" ? 30 : 0, 0, 0);
    const end = new Date(start.getTime() + 3_600_000);
    const recipeLine = `\nClean recipe: ${recipe.readerUrl}${recipe.sourceUrl ? `\nOriginal source: ${recipe.sourceUrl}` : ""}`;
    return `BEGIN:VEVENT\r\nUID:grocer-eaze-${calendarText(recipe.id || String(index))}-${recipe.sortOrder}@grocer-eaze\r\nDTSTAMP:${calendarStamp(new Date())}\r\nDTSTART:${calendarStamp(start)}\r\nDTEND:${calendarStamp(end)}\r\nSUMMARY:${calendarText(`${recipe.kind}: ${recipe.title}`)}\r\nDESCRIPTION:${calendarText(`${recipe.detail || "Grocer-Eaze meal"}${recipeLine}`)}\r\nURL:${calendarText(recipe.readerUrl)}\r\nEND:VEVENT`;
  }).join("\r\n");
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Grocer-Eaze//Meal Plan//EN\r\n${events}\r\nEND:VCALENDAR`;
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
  if (url.pathname === "/api/capabilities" && request.method === "GET") return json({});
  if (["/api/location/search", "/api/location/reverse"].includes(url.pathname) && request.method === "POST") {
    await ensureAuthSchema(env.DB);
    if (!await rateLimit(request, env, "location-lookup", 60)) return json({ error: "Too many location searches. Please wait a few minutes and try again." }, 429);
    let body: Record<string, unknown>;
    try { body = JSON.parse(await requestTextWithinLimit(request, 8_192)) as Record<string, unknown>; }
    catch { return json({ error: "Enter a valid location search." }, 400); }
    const lookupUrl = new URL(url.pathname, url.origin);
    if (url.pathname.endsWith("/search")) lookupUrl.searchParams.set("q", String(body.q || "").slice(0, 200));
    else {
      lookupUrl.searchParams.set("lat", String(body.lat || "").slice(0, 30));
      lookupUrl.searchParams.set("lon", String(body.lon || "").slice(0, 30));
    }
    return locationLookup(lookupUrl, url.pathname.endsWith("/reverse"));
  }
  if (url.pathname === "/api/accessibility-feedback" && request.method === "POST") {
    await ensureAuthSchema(env.DB);
    if (!await rateLimit(request, env, "accessibility-feedback", 5)) return json({ error: "Too many reports were submitted. Please try again later." }, 429);
    let body: { name?: string; email?: string; details?: string; website?: string };
    try { body = JSON.parse(await requestTextWithinLimit(request, 16_384)) as typeof body; }
    catch { return json({ error: "Enter valid feedback." }, 400); }
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

  if (url.pathname === "/api/privacy-request" && request.method === "POST") {
    await ensureAuthSchema(env.DB);
    if (!await rateLimit(request, env, "privacy-request", 5)) return json({ error: "Too many requests were submitted. Please try again later." }, 429);
    let body: { name?: string; email?: string; requestType?: string; details?: string; website?: string };
    try { body = JSON.parse(await requestTextWithinLimit(request, 16_384)) as typeof body; }
    catch { return json({ error: "Enter a valid privacy request." }, 400); }
    if (body.website) return json({ sent: true });
    const name = cleanRecipeText(body.name, 100);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const requestType = ["Access my data", "Correct my data", "Delete my data", "Privacy question"].includes(String(body.requestType)) ? String(body.requestType) : "Privacy question";
    const details = cleanRecipeText(body.details, 3000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return json({ error: "Privacy request delivery is temporarily unavailable." }, 503);
    const recipient = [env.INITIAL_ADMIN_EMAIL, ...(env.INITIAL_ADMIN_EMAILS || "").split(",")].map((value) => String(value || "").trim()).find(Boolean);
    if (!recipient) return json({ error: "Privacy request delivery is temporarily unavailable." }, 503);
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [recipient],
        reply_to: email,
        subject: `Grocer-Eaze privacy request: ${requestType}`,
        html: `<h1>${escapeHtml(requestType)}</h1><p><strong>From:</strong> ${escapeHtml(name || "Not provided")} (${escapeHtml(email)})</p><p>${escapeHtml(details || "No additional details provided.").replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!sent.ok) return json({ error: "We couldn’t send your request. Please try again." }, 502);
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

  const paidPaths = new Set(["/api/recipes/search", "/api/recipes/import", "/api/recipe-image", "/api/calendar", "/api/favorites", "/api/ratings", "/api/email"]);
  const paidRequest = paidPaths.has(url.pathname) || (url.pathname === "/api/recipe-readers" && request.method === "POST");
  if (paidRequest && !sessionUser) return json({ error: "Sign in and choose a membership to continue.", code: "PAYMENT_REQUIRED" }, 401);
  if (paidRequest && !hasProductAccess(sessionUser)) return json({ error: "An active membership or trial is required.", code: "PAYMENT_REQUIRED" }, 402);
  if (url.pathname === "/api/recipes/search" && request.method === "POST") {
    if (!await rateLimit(request, env, "recipe-search", 120, sessionUser!.id, 120)) return json({ error: "You’ve reached the recipe-search limit. Please wait a few minutes and try again." }, 429);
    let body: Record<string, unknown>;
    try { body = JSON.parse(await requestTextWithinLimit(request, 16_384)) as Record<string, unknown>; }
    catch { return json({ error: "Enter a valid recipe search." }, 400); }
    const searchUrl = new URL(url.pathname, url.origin);
    const allowed = new Set(["q", "maxTime", "glutenFree", "lowDairy", "mediterranean", "excludeIngredients", "number", "schoolLunch", "offset"]);
    for (const [key, value] of Object.entries(body)) if (allowed.has(key)) searchUrl.searchParams.set(key, String(value).slice(0, key === "excludeIngredients" || key === "q" ? 1000 : 30));
    return searchRecipes(searchUrl, env);
  }
  if (url.pathname === "/api/recipes/import" && request.method === "POST") {
    if (!await rateLimit(request, env, "recipe-import", 30, sessionUser!.id, 30)) return json({ error: "You’ve reached the recipe-import limit. Please wait a few minutes and try again." }, 429);
    return importRecipe(request, env);
  }
  if (url.pathname === "/api/recipe-image" && request.method === "GET") return recipeImageResponse(url, env);
  if (url.pathname === "/api/recipe-readers" && request.method === "POST" && sessionUser) {
    if (!await rateLimit(request, env, "recipe-reader-create", 30, sessionUser.id, 30)) return json({ error: "You’ve reached the clean-recipe link limit. Please try again later." }, 429);
    return createRecipeReaders(request, env, sessionUser.id);
  }
  if (url.pathname === "/api/calendar" && request.method === "POST") return calendarResponse(await request.json());
  if (!sessionUser) return json({ error: "Sign in to access household information." }, 401);
  const ownerId = sessionUser.id;
  await ensureSchema(env.DB);

  if (url.pathname === "/api/recipe-readers" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT share_token, content_json, created_at, updated_at, expires_at FROM recipe_readers WHERE owner_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY updated_at DESC LIMIT 100").bind(ownerId, new Date().toISOString()).all();
    return json({ readers: result.results.map((row) => {
      let title = "Shared recipe";
      try { title = cleanRecipeText((JSON.parse(String(row.content_json)) as Record<string, unknown>).title, 200) || title; } catch { /* Keep the generic title for malformed legacy content. */ }
      return { token: row.share_token, title, createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at };
    }) });
  }

  if (url.pathname === "/api/recipe-readers" && request.method === "DELETE") {
    await env.DB.prepare("UPDATE recipe_readers SET revoked_at = ?, updated_at = ? WHERE owner_id = ? AND revoked_at IS NULL").bind(new Date().toISOString(), new Date().toISOString(), ownerId).run();
    return json({ revoked: true });
  }

  if (url.pathname === "/api/account" && request.method === "DELETE") {
    let body: { confirmation?: string };
    try { body = JSON.parse(await requestTextWithinLimit(request, 4_096)) as typeof body; }
    catch { return json({ error: "Enter the deletion confirmation." }, 400); }
    if (body.confirmation !== "DELETE") return json({ error: "Type DELETE to confirm permanent account deletion." }, 400);
    const account = await env.DB.prepare("SELECT email, role, stripe_subscription_id, subscription_status FROM users WHERE id = ? LIMIT 1").bind(ownerId).first();
    if (!account) return json({ error: "That account could not be found." }, 404);
    if (String(account.role) === "admin") {
      const administrators = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").first();
      if (Number(administrators?.count || 0) <= 1) return json({ error: "The last administrator cannot delete their account. Assign another administrator first." }, 409);
    }
    const subscriptionId = String(account.stripe_subscription_id || "");
    const subscriptionStatus = String(account.subscription_status || "");
    if (subscriptionId && !["canceled", "incomplete_expired"].includes(subscriptionStatus)) {
      try { await cancelStripeSubscription(subscriptionId, env); }
      catch { return json({ error: "We could not cancel the active billing subscription, so the account was not deleted. Please try again or use Manage billing first." }, 502); }
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM profiles WHERE owner_id = ?").bind(ownerId),
      env.DB.prepare("DELETE FROM active_plans WHERE owner_id = ?").bind(ownerId),
      env.DB.prepare("DELETE FROM favorites WHERE owner_id = ?").bind(ownerId),
      env.DB.prepare("DELETE FROM family_members WHERE owner_id = ?").bind(ownerId),
      env.DB.prepare("DELETE FROM recipe_ratings WHERE owner_id = ?").bind(ownerId),
      env.DB.prepare("DELETE FROM recipe_readers WHERE owner_id = ?").bind(ownerId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(ownerId),
      env.DB.prepare("DELETE FROM auth_codes WHERE email = ?").bind(String(account.email)),
      env.DB.prepare("DELETE FROM admin_audit_log WHERE admin_user_id = ? OR target_user_id = ?").bind(ownerId, ownerId),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(ownerId),
    ]);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": "grocer_eaze_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" } });
  }

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

  if (url.pathname === "/api/stores/search" && request.method === "POST") {
    if (!await rateLimit(request, env, "store-lookup", 60, ownerId, 60)) return json({ error: "Too many store searches. Please wait a few minutes and try again." }, 429);
    let body: Record<string, unknown>;
    try { body = JSON.parse(await requestTextWithinLimit(request, 8_192)) as Record<string, unknown>; }
    catch { return json({ error: "Enter a valid store search." }, 400); }
    const storeUrl = new URL(url.pathname, url.origin);
    for (const key of ["lat", "lon", "radius", "q"]) if (body[key] !== undefined) storeUrl.searchParams.set(key, String(body[key]).slice(0, key === "q" ? 120 : 30));
    return nearbyStoreLookup(storeUrl);
  }

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
    if (!sessionUser) return json({ error: "Sign in before sending your plan." }, 401);
    let bodyText = "";
    try { bodyText = await requestTextWithinLimit(request, 400_000); }
    catch { return json({ error: "That delivery is too large to send safely." }, 413); }
    let body: {
      deliveryId?: string;
      to?: string | string[];
      recipientName?: string;
      selections?: { recipes?: boolean; grocery?: boolean; calendar?: boolean };
      groceryTitle?: string;
      groceryGroups?: Array<{ title?: string; items?: Array<{ name?: string; quantity?: string }> }>;
      meals?: Array<{ id?: string; day?: string; date?: string; kind?: string; title?: string; detail?: string; time?: string; sourceUrl?: string; readerUrl?: string }>;
      calendarMeals?: Array<{ id?: string; title?: string; detail?: string; kind?: string; sortOrder?: number; sourceUrl?: string; readerUrl?: string }>;
    };
    try { body = JSON.parse(bodyText) as typeof body; }
    catch { return json({ error: "A valid delivery is required." }, 400); }
    const recipients = [...new Set((Array.isArray(body.to) ? body.to : String(body.to || "").split(/[;,\n]/)).map((address) => String(address).trim().toLowerCase()).filter(Boolean))];
    if (recipients.length !== 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipients[0])) return json({ error: "Enter one valid email recipient." }, 400);
    const deliveryId = String(body.deliveryId || "").trim();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(deliveryId)) return json({ error: "A valid delivery ID is required." }, 400);
    if (!await deliveryEmailAllowed(env, sessionUser.id, recipients.length)) return json({ error: "You’ve reached the hourly email limit. Please wait before sending more plans." }, 429);
    const selections = body.selections
      ? { recipes: Boolean(body.selections.recipes), grocery: Boolean(body.selections.grocery), calendar: Boolean(body.selections.calendar) }
      : { recipes: true, grocery: false, calendar: false };
    if (!selections.recipes && !selections.grocery && !selections.calendar) return json({ error: "Choose recipes, groceries, or a calendar before sending." }, 400);
    const readerUrl = (value: unknown) => {
      const safe = safeHttpUrl(value);
      if (!safe) return "";
      try {
        const parsed = new URL(safe);
        return parsed.origin === publicAppOrigin && /^\/recipe\/[a-f0-9]{64}$/i.test(parsed.pathname) ? parsed.toString() : "";
      } catch { return ""; }
    };
    const meals = Array.isArray(body.meals) ? body.meals.slice(0, 100).flatMap((meal) => {
      const title = cleanRecipeText(meal.title, 200);
      if (!title) return [];
      return [{
        id: cleanRecipeText(meal.id, 120),
        day: cleanRecipeText(meal.day, 80) || "Meal",
        date: cleanRecipeText(meal.date, 30),
        kind: cleanRecipeText(meal.kind, 40) || "Meal",
        title,
        detail: cleanRecipeText(meal.detail, 500),
        time: cleanRecipeText(meal.time, 80),
        sourceUrl: safeHttpUrl(meal.sourceUrl),
        readerUrl: readerUrl(meal.readerUrl),
      }];
    }) : [];
    if ((selections.recipes || selections.calendar) && !meals.length) return json({ error: "Add at least one recipe before sending your plan." }, 400);
    if (selections.recipes && meals.some((meal) => !meal.readerUrl)) return json({ error: "One or more clean recipe links are missing. Please try again." }, 400);
    let groceryItemCount = 0;
    const groceryGroups = Array.isArray(body.groceryGroups) ? body.groceryGroups.slice(0, 20).flatMap((group) => {
      const title = cleanRecipeText(group.title, 80);
      const items = Array.isArray(group.items) ? group.items.slice(0, Math.max(0, 300 - groceryItemCount)).flatMap((item) => {
        const name = cleanRecipeText(item.name, 160);
        const quantity = cleanRecipeText(item.quantity, 120);
        return name ? [{ name, quantity: quantity || "Amount not provided" }] : [];
      }) : [];
      groceryItemCount += items.length;
      return items.length ? [{ title: title || "Groceries", items }] : [];
    }) : [];
    if (selections.grocery && !groceryGroups.length) return json({ error: "There is no grocery list to send." }, 400);
    const calendarMeals = Array.isArray(body.calendarMeals) ? body.calendarMeals.slice(0, 100).flatMap((meal, index): DeliveryCalendarMeal[] => {
      const title = cleanRecipeText(meal.title, 200);
      const cleanReaderUrl = readerUrl(meal.readerUrl);
      const sortOrder = Number(meal.sortOrder);
      if (!title || !cleanReaderUrl || !Number.isFinite(sortOrder) || sortOrder < 946_684_800_000 || sortOrder > 4_102_444_800_000) return [];
      return [{
        id: cleanRecipeText(meal.id, 120) || String(index),
        title,
        detail: cleanRecipeText(meal.detail, 500),
        kind: cleanRecipeText(meal.kind, 40) || "Meal",
        sortOrder,
        sourceUrl: safeHttpUrl(meal.sourceUrl),
        readerUrl: cleanReaderUrl,
      }];
    }) : [];
    if (selections.calendar && calendarMeals.length !== meals.length) return json({ error: "The dated calendar could not be prepared. Please try again." }, 400);
    const recipientName = cleanRecipeText(body.recipientName, 80);
    const recipeHtml = selections.recipes ? `<h2 style="color:#183329">Recipes</h2>${meals.map((meal) => `<div style="margin:0 0 20px"><p style="margin:0 0 5px;color:#66756c;font-size:13px">${escapeHtml(`${meal.day} · ${meal.kind}`)}</p><h3 style="margin:0 0 6px"><a href="${escapeHtml(meal.readerUrl)}" style="color:#126b4d">${escapeHtml(meal.title)}</a></h3><p style="margin:0;color:#48584f">${escapeHtml([meal.detail, meal.time].filter(Boolean).join(" · "))}</p>${meal.sourceUrl ? `<p style="margin:5px 0 0;font-size:12px"><a href="${escapeHtml(meal.sourceUrl)}" style="color:#66756c">View original recipe</a></p>` : ""}</div>`).join("")}` : "";
    const groceryTitle = cleanRecipeText(body.groceryTitle, 120) || "Grocery list";
    const groceryHtml = selections.grocery ? `<h2 style="color:#183329">${escapeHtml(groceryTitle)}</h2>${groceryGroups.map((group) => `<h3 style="margin-bottom:6px">${escapeHtml(group.title)}</h3><ul>${group.items.map((item) => `<li>${escapeHtml(item.name)} — ${escapeHtml(item.quantity)}</li>`).join("")}</ul>`).join("")}` : "";
    const calendarHtml = selections.calendar ? `<h2 style="color:#183329">Calendar</h2><p>Your dated meal plan is attached as <strong>grocer-eaze-meal-plan.ics</strong>. Open it to add the meals to Google Calendar, Apple Calendar, or another compatible calendar.</p>` : "";
    const selectedLabels = [selections.recipes && "recipes", selections.grocery && "grocery list", selections.calendar && "calendar"].filter(Boolean) as string[];
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#183329;max-width:680px;margin:auto"><p style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#126b4d">GROCER-EAZE</p><h1 style="font-family:Georgia,serif">${recipientName ? `Hi ${escapeHtml(recipientName)}, here’s your plan.` : "Here’s your meal plan."}</h1>${recipeHtml}${groceryHtml}${calendarHtml}<hr style="border:0;border-top:1px solid #d8e4dc;margin:28px 0"><p style="font-size:12px;color:#66756c">Sent privately from Grocer-Eaze by ${escapeHtml(sessionUser.name)}.</p></div>`;
    const text = [recipientName ? `Hi ${recipientName}, here’s your Grocer-Eaze plan.` : "Here’s your Grocer-Eaze plan.", selections.recipes ? `Recipes\n${meals.map((meal) => `${meal.day} ${meal.kind}: ${meal.title}\n${meal.readerUrl}`).join("\n")}` : "", selections.grocery ? `${groceryTitle}\n${groceryGroups.map((group) => `${group.title}\n${group.items.map((item) => `${item.name} — ${item.quantity}`).join("\n")}`).join("\n\n")}` : "", selections.calendar ? "A dated calendar file is attached." : ""].filter(Boolean).join("\n\n");
    const subject = `Your Grocer-Eaze ${selectedLabels.join(", ").replace(/, ([^,]*)$/, " & $1")}`;
    const attachments = selections.calendar ? [{ filename: "grocer-eaze-meal-plan.ics", content: base64Utf8(deliveryCalendarFile(calendarMeals)) }] : undefined;
    for (const recipient of recipients) {
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)", "Idempotency-Key": `grocer-eaze-delivery-${deliveryId}` },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [recipient], subject, html, text, ...(attachments ? { attachments } : {}) }),
      });
      if (!sent.ok) {
        console.error(JSON.stringify({ message: "Resend plan delivery failed", status: sent.status }));
        return json({ error: "We couldn’t send that plan right now. Please try again." }, 502);
      }
    }
    return json({ sent: true, recipients: recipients.length });
  }
  return json({ error: "Not found." }, 404);
}
