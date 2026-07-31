"use client";

import { useEffect, useMemo, useState } from "react";

type Meal = {
  id: string; day: string; date: string; kind: string; title: string; detail: string;
  time: string; cost: string; tone: string; emoji: string; sourceUrl?: string; image?: string; sortOrder?: number;
  sourceName?: string; readyMinutes?: number; recipeId?: string; pricePerServing?: number;
  ingredients?: Array<{ name: string; aisle?: string; original?: string }>; tags?: string[];
};
type MemberPreferences = {
  glutenFree?: boolean; lowDairy?: boolean; kidFriendly?: boolean; avoidOnions?: boolean; proteins?: string[];
};
type Member = { id: string; name: string; role: string; allergies: string; preferences?: MemberPreferences };
type Rating = { quality: number; ease: number };
type LocationResult = { label: string; lat?: string; lon?: string };
type AccountUser = { id: string; name: string; email: string; phone: string; role: "user" | "admin"; accessStatus: string; complimentaryUntil: string | null; billingExempt: boolean; subscriptionStatus: string | null; subscriptionEndsAt: string | null };
type AdminUser = { id: string; name: string; email: string; phone: string; role: string; access_status: string; trial_ends_at?: string; complimentary_until?: string; billing_exempt: number };

const recipeSourceLinks = [
  { name: "Allrecipes", url: "https://www.allrecipes.com/" },
  { name: "Food Network", url: "https://www.foodnetwork.com/recipes" },
  { name: "EatingWell", url: "https://www.eatingwell.com/recipes/" },
  { name: "Serious Eats", url: "https://www.seriouseats.com/recipes-5117985" },
  { name: "Simply Recipes", url: "https://www.simplyrecipes.com/recipes-5090746" },
];
const proteinOptions = ["Beef", "Pork", "Fish", "Shrimp"];
const storeNames = ["Whole Foods", "Jewel-Osco", "Trader Joe’s"];

function parseServingCost(meal: Meal) {
  return meal.pricePerServing || Number(meal.cost.match(/\$([\d.]+)/)?.[1] || 3.75);
}

function calendarStamp(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;
}

function calendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function mealDateFor(kind: string, index: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  if (kind === "School lunch") {
    let schoolDays = -1;
    while (schoolDays < index) {
      if (date.getDay() !== 0 && date.getDay() !== 6) schoolDays++;
      if (schoolDays < index) date.setDate(date.getDate() + 1);
    }
  } else {
    date.setDate(date.getDate() + index);
  }
  return {
    day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    date: String(date.getDate()),
    sortOrder: date.getTime(),
  };
}

function Toggle({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: () => void; note?: string }) {
  return <button className="toggle-row" onClick={onChange} type="button" aria-pressed={checked}><span><strong>{label}</strong>{note && <small>{note}</small>}</span><span className={`toggle ${checked ? "on" : ""}`}><i /></span></button>;
}

function Stars({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return <div className="stars" aria-label={label}>{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => onChange(star)} aria-label={`${star} out of 5`}>{star <= value ? "★" : "☆"}</button>)}</div>;
}

export default function Home() {
  const [view, setView] = useState<"plan" | "meals" | "list" | "account" | "family" | "plans" | "admin">("plan");
  const [range, setRange] = useState("Week");
  const [mealType, setMealType] = useState("Lunch + dinner");
  const [people, setPeople] = useState(4);
  const [budget, setBudget] = useState(150);
  const [leftovers, setLeftovers] = useState(true);
  const [glutenFree, setGlutenFree] = useState(true);
  const [lowDairy, setLowDairy] = useState(true);
  const [mediterranean, setMediterranean] = useState(true);
  const [kidLunches, setKidLunches] = useState(true);
  const [oneStore, setOneStore] = useState(false);
  const [household, setHousehold] = useState("My household");
  const [maxTime, setMaxTime] = useState("45 minutes");
  const [skill, setSkill] = useState("Comfortable");
  const [exclusions, setExclusions] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState("Whole Foods");
  const [exportStatus, setExportStatus] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [plannedMeals, setPlannedMeals] = useState<Meal[]>([]);
  const [planning, setPlanning] = useState(false);
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("Uptown, Chicago, IL");
  const [locationQuery, setLocationQuery] = useState("Uptown, Chicago, IL");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationStatus, setLocationStatus] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberDraft, setMemberDraft] = useState({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false, avoidOnions: false, proteins: [] as string[] });
  const [editingMemberId, setEditingMemberId] = useState("");
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [ratingMeal, setRatingMeal] = useState<Meal | null>(null);
  const [similarTo, setSimilarTo] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [authStep, setAuthStep] = useState<"details" | "code">("details");
  const [authForm, setAuthForm] = useState({ name: "", email: "", phone: "", code: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const [recipeIdeas, setRecipeIdeas] = useState<Meal[]>([]);
  const [recipePage, setRecipePage] = useState(1);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeNotice, setRecipeNotice] = useState("");
  const [plannerNotice, setPlannerNotice] = useState("");
  const [planHydrated, setPlanHydrated] = useState(false);
  const [calendarOrder, setCalendarOrder] = useState<"plan" | "random">("plan");
  const [recipeFilters, setRecipeFilters] = useState({ query: "", kind: "All meals", maxTime: "Any time", source: "All sources", protein: "All proteins", favoritesOnly: false });

  const dinnerTarget = range === "Day" ? 1 : range === "Week" ? 7 : 30;
  const schoolLunchTarget = kidLunches ? (range === "Day" ? 1 : range === "Week" ? 5 : 22) : 0;
  const totalLunchDays = mealType === "Lunch + dinner" ? (range === "Day" ? 1 : range === "Week" ? 7 : 30) : 0;
  const lunchTarget = Math.max(0, totalLunchDays - schoolLunchTarget);
  const mealTargets = useMemo(() => ({ Lunch: lunchTarget, Dinner: dinnerTarget, "School lunch": schoolLunchTarget }), [lunchTarget, dinnerTarget, schoolLunchTarget]);
  const activeMealKinds = useMemo(() => (Object.entries(mealTargets) as Array<[string, number]>).filter(([, target]) => target > 0).map(([kind]) => kind), [mealTargets]);
  const totalTarget = dinnerTarget + lunchTarget + schoolLunchTarget;
  const filledCount = activeMealKinds.reduce((sum, kind) => sum + Math.min(plannedMeals.filter((meal) => meal.kind === kind).length, mealTargets[kind as keyof typeof mealTargets]), 0);
  const planIsFull = totalTarget > 0 && activeMealKinds.every((kind) => plannedMeals.filter((meal) => meal.kind === kind).length >= mealTargets[kind as keyof typeof mealTargets]);
  const targetServingBudget = budget / Math.max(1, totalTarget * people);
  const familyProteins = useMemo(() => [...new Set(members.flatMap((member) => member.preferences?.proteins || []))], [members]);
  const familyGlutenFree = members.some((member) => member.preferences?.glutenFree);
  const familyLowDairy = members.some((member) => member.preferences?.lowDairy);
  const familyKidFriendly = members.some((member) => member.preferences?.kidFriendly);
  const effectiveGlutenFree = glutenFree || familyGlutenFree;
  const effectiveLowDairy = lowDairy || familyLowDairy;
  const familyAvoids = useMemo(() => [...new Set([
    ...members.flatMap((member) => member.allergies.split(",").map((item) => item.trim()).filter(Boolean)),
    ...(members.some((member) => member.preferences?.avoidOnions) ? ["onions"] : []),
    ...exclusions.split(",").map((item) => item.trim()).filter(Boolean),
  ])], [members, exclusions]);
  const planningEstimate = useMemo(() => ({
    low: Math.max(12, Math.round(totalTarget * people * 2.65 * .84)),
    high: Math.max(18, Math.round(totalTarget * people * 4.15 * .9)),
  }), [totalTarget, people]);
  const recipeSubtotal = useMemo(() => Math.round(plannedMeals.reduce((sum, meal) => sum + parseServingCost(meal) * people, 0)), [plannedMeals, people]);
  const storeEstimates = useMemo(() => [
    { name: "Whole Foods", price: Math.round(recipeSubtotal * 1.08), availability: 96 },
    { name: "Jewel-Osco", price: Math.round(recipeSubtotal * .98), availability: 98 },
    { name: "Trader Joe’s", price: Math.round(recipeSubtotal * .92), availability: 86 },
  ], [recipeSubtotal]);
  const selectedEstimate = storeEstimates.find((store) => store.name === selectedStore)?.price || recipeSubtotal;
  const visibleStoreEstimates = oneStore ? storeEstimates.filter((store) => store.name === selectedStore) : storeEstimates;
  const groceryGroups = useMemo(() => {
    const groups: Record<string, { icon: string; title: string; items: string[] }> = {
      Produce: { icon: "🥬", title: "Produce", items: [] },
      "Meat & seafood": { icon: "🐟", title: "Meat & seafood", items: [] },
      Refrigerated: { icon: "🧊", title: "Refrigerated", items: [] },
      Bakery: { icon: "🥖", title: "Bakery", items: [] },
      Pantry: { icon: "🥫", title: "Pantry", items: [] },
    };
    const seen = new Set<string>();
    plannedMeals.flatMap((meal) => meal.ingredients || []).forEach((ingredient) => {
      const name = (ingredient.name || ingredient.original || "").trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      const aisle = (ingredient.aisle || "").toLowerCase();
      const haystack = `${aisle} ${name}`.toLowerCase();
      const group = /pantry|canned|spice|pasta|rice/.test(aisle) ? "Pantry"
        : /meat|seafood/.test(aisle) ? "Meat & seafood"
          : /milk|cheese|refrigerated|dairy|egg/.test(aisle) ? "Refrigerated"
            : /bakery|bread/.test(aisle) ? "Bakery"
              : /produce|vegetable|fruit|herb|onion|garlic|lettuce|spinach|tomato|pepper|lemon|lime/.test(haystack) ? "Produce"
                : /fish|salmon|shrimp|beef|pork|chicken|turkey|tuna|cod/.test(haystack) ? "Meat & seafood"
                  : /milk|cheese|yogurt|egg|butter/.test(haystack) ? "Refrigerated"
                    : /bread|tortilla|pita|bun/.test(haystack) ? "Bakery" : "Pantry";
      groups[group].items.push(name[0].toUpperCase() + name.slice(1));
    });
    return Object.values(groups).filter((group) => group.items.length).map((group) => ({ ...group, count: group.items.length }));
  }, [plannedMeals]);
  const recipeSources = useMemo(() => [...new Set(recipeIdeas.map((meal) => meal.sourceName).filter(Boolean) as string[])].sort(), [recipeIdeas]);
  const filteredRecipeIdeas = useMemo(() => recipeIdeas.filter((meal) => {
    const query = recipeFilters.query.trim().toLowerCase();
    const max = recipeFilters.maxTime === "Any time" ? Infinity : Number(recipeFilters.maxTime);
    return (!query || `${meal.title} ${meal.detail}`.toLowerCase().includes(query))
      && (recipeFilters.kind === "All meals" || meal.kind === recipeFilters.kind)
      && Number(meal.readyMinutes || 0) <= max
      && (recipeFilters.source === "All sources" || meal.sourceName === recipeFilters.source)
      && (recipeFilters.protein === "All proteins" || meal.title.toLowerCase().includes(recipeFilters.protein.toLowerCase()))
      && (!effectiveGlutenFree || meal.tags?.includes("Gluten-free"))
      && (!recipeFilters.favoritesOnly || favorites.includes(meal.title));
  }), [recipeIdeas, recipeFilters, favorites, effectiveGlutenFree]);

  useEffect(() => {
    let id = window.localStorage.getItem("grocer-eaze-owner");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("grocer-eaze-owner", id); }
    const cachedPlan = window.localStorage.getItem("grocer-eaze-active-plan");
    Promise.all([
      fetch("/api/profile", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/favorites", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/family", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/ratings", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([profileData, favoriteData, familyData, ratingData, authData]) => {
      setOwnerId(id);
      if (profileData.profile) {
        setHousehold(profileData.profile.household_name); setPeople(profileData.profile.people);
        setLocation(profileData.profile.location); setLocationQuery(profileData.profile.location);
        try {
          const preferences = JSON.parse(profileData.profile.preferences_json || "{}");
          if (preferences.range) setRange(preferences.range);
          if (preferences.mealType) setMealType(preferences.mealType);
          if (preferences.budget) setBudget(preferences.budget);
          if (typeof preferences.leftovers === "boolean") setLeftovers(preferences.leftovers);
          if (typeof preferences.glutenFree === "boolean") setGlutenFree(preferences.glutenFree);
          if (typeof preferences.lowDairy === "boolean") setLowDairy(preferences.lowDairy);
          if (typeof preferences.mediterranean === "boolean") setMediterranean(preferences.mediterranean);
          if (typeof preferences.kidLunches === "boolean") setKidLunches(preferences.kidLunches);
          if (typeof preferences.oneStore === "boolean") setOneStore(preferences.oneStore);
          if (preferences.selectedStore) setSelectedStore(preferences.selectedStore);
          if (preferences.maxTime) setMaxTime(preferences.maxTime);
          if (preferences.skill) setSkill(preferences.skill);
          if (typeof preferences.exclusions === "string") setExclusions(preferences.exclusions);
        } catch { /* Ignore an older malformed preference record. */ }
      }
      if (favoriteData.favorites) setFavorites(favoriteData.favorites.map((recipe: { title: string }) => recipe.title));
      if (familyData.members) setMembers(familyData.members);
      if (ratingData.ratings) setRatings(Object.fromEntries(ratingData.ratings.map((r: { recipe_id: string; quality: number; ease: number }) => [r.recipe_id, { quality: r.quality, ease: r.ease }])));
      if (authData.user) { setUser(authData.user); setEmail(authData.user.email); }
      if (cachedPlan) {
        try {
          const saved = JSON.parse(cachedPlan);
          if (Array.isArray(saved.plannedMeals)) setPlannedMeals(saved.plannedMeals);
          if (Array.isArray(saved.recipeIdeas)) setRecipeIdeas(saved.recipeIdeas);
          if (saved.range) setRange(saved.range);
          if (saved.mealType) setMealType(saved.mealType);
          if (saved.people) setPeople(saved.people);
          if (saved.budget) setBudget(saved.budget);
          if (typeof saved.leftovers === "boolean") setLeftovers(saved.leftovers);
          if (typeof saved.glutenFree === "boolean") setGlutenFree(saved.glutenFree);
          if (typeof saved.lowDairy === "boolean") setLowDairy(saved.lowDairy);
          if (typeof saved.mediterranean === "boolean") setMediterranean(saved.mediterranean);
          if (typeof saved.kidLunches === "boolean") setKidLunches(saved.kidLunches);
          if (typeof saved.oneStore === "boolean") setOneStore(saved.oneStore);
          if (saved.selectedStore) setSelectedStore(saved.selectedStore);
          if (saved.household) setHousehold(saved.household);
          if (saved.maxTime) setMaxTime(saved.maxTime);
          if (saved.skill) setSkill(saved.skill);
          if (typeof saved.exclusions === "string") setExclusions(saved.exclusions);
          if (saved.location) { setLocation(saved.location); setLocationQuery(saved.location); }
          if (saved.calendarOrder === "random") setCalendarOrder("random");
        } catch { /* Ignore a corrupted device cache. */ }
      }
      setPlanHydrated(true);
    }).catch(() => setPlanHydrated(true));
  }, []);

  useEffect(() => {
    if (!planHydrated) return;
    try {
      window.localStorage.setItem("grocer-eaze-active-plan", JSON.stringify({
        plannedMeals,
        recipeIdeas: recipeIdeas.slice(0, 90),
        range, mealType, people, budget, leftovers, glutenFree, lowDairy, mediterranean,
        kidLunches, oneStore, selectedStore, household, maxTime, skill, exclusions, location, calendarOrder,
      }));
    } catch { /* Device storage can be unavailable in private browsing. */ }
  }, [planHydrated, plannedMeals, recipeIdeas, range, mealType, people, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, selectedStore, household, maxTime, skill, exclusions, location, calendarOrder]);

  async function startAuth() {
    setAuthBusy(true); setAccountStatus("");
    const result = await fetch("/api/auth/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authForm) });
    const data = await result.json(); setAuthBusy(false);
    if (!result.ok) { setAccountStatus(data.error || "Could not send a code."); return; }
    setAuthStep("code"); setAccountStatus(`We sent a six-digit code to ${authForm.email}.`);
  }

  async function verifyAuth() {
    setAuthBusy(true); setAccountStatus("");
    const result = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authForm.email, code: authForm.code }) });
    const data = await result.json(); setAuthBusy(false);
    if (!result.ok) { setAccountStatus(data.error || "That code could not be verified."); return; }
    const me = await fetch("/api/auth/me").then((r) => r.json()); setUser(me.user); setEmail(me.user.email); setAccountStatus("Your secure account is ready.");
  }

  async function loadAdminUsers(query = adminSearch) {
    const result = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    const data = await result.json();
    if (result.ok) setAdminUsers(data.users || []); else setAccountStatus(data.error || "Admin access required.");
  }

  async function adminAction(userId: string, action: string) {
    const result = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action, until: null }) });
    const data = await result.json();
    setAccountStatus(result.ok ? "Account access updated and recorded in the audit log." : data.error || "Update failed.");
    if (result.ok) await loadAdminUsers();
  }

  async function openBilling(kind: "checkout" | "portal", plan?: "monthly" | "yearly") {
    if (!user) { setView("account"); setAccountStatus("Create or sign in to your account before choosing a plan."); return; }
    setBillingBusy(true); setAccountStatus("");
    const result = await fetch(`/api/billing/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan ? { plan } : {}) });
    const data = await result.json(); setBillingBusy(false);
    if (!result.ok) { setAccountStatus(data.error || "Billing is temporarily unavailable."); return; }
    window.location.href = data.url;
  }

  useEffect(() => {
    if (locationQuery.trim().length < 3 || locationQuery === location) {
      const clearTimer = window.setTimeout(() => setLocationResults([]), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(locationQuery)}`);
      const data = await response.json();
      setLocationResults(data.results || []);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [locationQuery, location]);

  function mapRecipe(recipe: Record<string, unknown>, index: number, kind = "Dinner"): Meal {
    const scheduled = mealDateFor(kind, index);
    const title = String(recipe.title || "Untitled recipe");
    const diets = Array.isArray(recipe.diets) ? recipe.diets.map(String) : [];
    const servingCost = Number(recipe.pricePerServing || 420) / 100;
    const matchingFamilyProteins = proteinOptions.filter((protein) =>
      familyProteins.includes(protein) && title.toLowerCase().includes(protein.toLowerCase()));
    const tags = [
      ...matchingFamilyProteins.map((protein) => `Family favorite: ${protein}`),
      ...(familyAvoids.some((item) => item.toLowerCase() === "onions") ? ["No onions"] : []),
      ...(recipe.glutenFree === false ? [] : ["Gluten-free"]),
      ...(recipe.dairyFree ? ["Low dairy"] : []),
      ...(mediterranean || diets.some((diet) => diet.toLowerCase().includes("mediterranean")) ? ["Mediterranean"] : []),
      ...(kind === "School lunch" || (familyKidFriendly && kind === "Lunch") ? ["Kid-friendly"] : []),
      ...(kind === "School lunch" ? ["Packable"] : []),
      ...(Number(recipe.readyInMinutes || 35) <= 20 ? ["Quick"] : []),
      ...(servingCost <= targetServingBudget * 1.15 ? ["Budget fit"] : []),
      ...proteinOptions.filter((protein) => title.toLowerCase().includes(protein.toLowerCase())),
    ];
    const ingredients = Array.isArray(recipe.extendedIngredients)
      ? recipe.extendedIngredients.map((ingredient) => {
        const item = ingredient as Record<string, unknown>;
        return { name: String(item.name || item.nameClean || item.original || ""), aisle: String(item.aisle || ""), original: String(item.original || "") };
      }).filter((ingredient) => ingredient.name)
      : [];
    return {
      id: String(recipe.id || `recipe-${index}`), recipeId: String(recipe.id || `recipe-${index}`), ...scheduled, kind, title,
      detail: `from ${String(recipe.sourceName || "a trusted recipe source")}`,
      time: `${Number(recipe.readyInMinutes || 35)} min`, cost: `$${servingCost.toFixed(2)} / serving`,
      tone: ["salmon", "gold", "green", "blue"][index % 4], emoji: kind.includes("lunch") ? "🍱" : ["🥗", "🍲", "🐟", "🍅"][index % 4],
      sourceUrl: String(recipe.sourceUrl || ""),
      image: String(recipe.image || ""),
      sourceName: String(recipe.sourceName || "Recipe source"),
      readyMinutes: Number(recipe.readyInMinutes || 35),
      pricePerServing: servingCost,
      ingredients,
      tags: [...new Set(tags)],
    };
  }

  async function generatePlan(queryOverride?: string) {
    setPlanning(true); setPlannerNotice("");
    const minutes = maxTime.match(/\d+/)?.[0] || "45";
    const proteinPrompt = familyProteins.length ? familyProteins.join(" or ") : "healthy";
    const avoidPrompt = familyAvoids.length ? `without ${familyAvoids.join(", ")}` : "";
    const dinnerQuery = queryOverride || `${mediterranean ? "Mediterranean " : ""}${proteinPrompt} dinner ${avoidPrompt}`;
    const lunchQuery = `${mediterranean ? "Mediterranean " : ""}${proteinPrompt} lunch ${avoidPrompt}`;
    const schoolQuery = `wrap ${avoidPrompt}`;
    const providerExclusions = [...familyAvoids, ...(lowDairy ? ["cream cheese", "heavy cream"] : [])];
    const resultCount = range === "Month" ? "48" : "30";
    const searchParams = (q: string, time: string) => new URLSearchParams({
      q, maxTime: time, glutenFree: String(effectiveGlutenFree), lowDairy: String(effectiveLowDairy), mediterranean: String(mediterranean),
      excludeIngredients: providerExclusions.join(","), number: resultCount,
    });
    try {
      const searches: Array<{ kind: string; request: Promise<Response> }> = [
        { kind: "Dinner", request: fetch(`/api/recipes/search?${searchParams(dinnerQuery, minutes)}`) },
      ];
      if (lunchTarget) searches.push({ kind: "Lunch", request: fetch(`/api/recipes/search?${searchParams(lunchQuery, minutes)}`) });
      if (schoolLunchTarget) searches.push({ kind: "School lunch", request: fetch(`/api/recipes/search?${searchParams(schoolQuery, "20")}&schoolLunch=true`) });
      const responses = await Promise.all(searches.map((search) => search.request));
      const payloads = await Promise.all(responses.map((response) => response.json()));
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) throw new Error(payloads[failedIndex]?.error || "Recipe search failed.");
      const ideas = payloads.flatMap((data, requestIndex) => {
        const recipes = (data.recipes || []) as Array<Record<string, unknown>>;
        const sorted = searches[requestIndex].kind === "School lunch"
          ? [...recipes].sort((a, b) => Number(a.readyInMinutes || 99) - Number(b.readyInMinutes || 99))
          : recipes;
        return sorted.map((recipe, index) => mapRecipe(recipe, index, searches[requestIndex].kind));
      });
      const uniqueIdeas = [...new Map(ideas.map((meal) => [`${meal.kind}:${meal.title.toLowerCase()}`, meal])).values()]
        .sort((a, b) => Number(Boolean(b.tags?.includes("Budget fit"))) - Number(Boolean(a.tags?.includes("Budget fit"))));
      setPlannedMeals([]);
      setRecipeIdeas(uniqueIdeas); setRecipePage(1); setRecipeNotice(`${uniqueIdeas.length} recipes ready to browse.`);
      if (ownerId) await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ householdName: household, people, location, preferences: { range, mealType, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, selectedStore, maxTime, skill, exclusions } }) });
      setSimilarTo(queryOverride || ""); setView("meals"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setPlannerNotice(error instanceof Error ? error.message : "Recipes are temporarily unavailable. Please try again.");
    } finally { setPlanning(false); }
  }

  async function loadMoreRecipes() {
    setRecipeLoading(true); setRecipeNotice("");
    const kind = recipeFilters.kind !== "All meals" ? recipeFilters.kind : activeMealKinds[recipePage % activeMealKinds.length] || "Dinner";
    const familyProtein = familyProteins.length ? familyProteins[recipePage % familyProteins.length] : "healthy";
    const proteinPrompt = recipeFilters.protein === "All proteins" ? familyProtein : recipeFilters.protein;
    const query = recipeFilters.query.trim() || (kind === "School lunch" ? "wrap" : `${mediterranean ? "Mediterranean " : ""}${proteinPrompt} ${kind.toLowerCase()}`);
    const maxTimeFilter = recipeFilters.maxTime === "Any time" ? (maxTime.match(/\d+/)?.[0] || "60") : recipeFilters.maxTime;
    const providerExclusions = [...familyAvoids, ...(lowDairy ? ["cream cheese", "heavy cream"] : [])];
    try {
      const response = await fetch(`/api/recipes/search?${new URLSearchParams({
        q: query, maxTime: kind === "School lunch" ? "20" : maxTimeFilter, glutenFree: String(effectiveGlutenFree), lowDairy: String(effectiveLowDairy),
        mediterranean: String(mediterranean), excludeIngredients: providerExclusions.join(","), number: "24", offset: String(recipePage * 24),
        ...(kind === "School lunch" ? { schoolLunch: "true" } : {}),
      })}`);
      const data = await response.json();
      if (!response.ok) { setRecipeNotice(data.error || "More recipes are temporarily unavailable."); return; }
      const incoming = (data.recipes || []).map((recipe: Record<string, unknown>, index: number) => mapRecipe(recipe, recipeIdeas.length + index, kind));
      const existing = new Set(recipeIdeas.map((meal) => `${meal.kind}:${meal.id}:${meal.title.toLowerCase()}`));
      const fresh = incoming.filter((meal: Meal) => !existing.has(`${meal.kind}:${meal.id}:${meal.title.toLowerCase()}`));
      setRecipeIdeas((current) => [...current, ...fresh]); setRecipePage((page) => page + 1);
      setRecipeNotice(fresh.length ? `${fresh.length} more recipes added.` : "No new matches in that batch. Try broader filters or load another batch.");
    } catch {
      setRecipeNotice("More recipes are temporarily unavailable.");
    } finally {
      setRecipeLoading(false);
    }
  }

  async function findSimilar(meal: Meal) {
    setRecipeLoading(true); setRecipeNotice(`Finding recipes like ${meal.title}…`);
    try {
      const response = await fetch(`/api/recipes/search?${new URLSearchParams({
        q: meal.title, maxTime: String(meal.readyMinutes || 45), glutenFree: String(effectiveGlutenFree), lowDairy: String(effectiveLowDairy),
        mediterranean: String(mediterranean), excludeIngredients: familyAvoids.join(","), number: "30",
      })}`);
      const data = await response.json();
      if (!response.ok) { setRecipeNotice(data.error || "Similar recipes are temporarily unavailable."); return; }
      const similar = (data.recipes || []).map((recipe: Record<string, unknown>, index: number) => mapRecipe(recipe, index, meal.kind));
      setRecipeIdeas([...new Map(similar.map((item: Meal) => [`${item.kind}:${item.title.toLowerCase()}`, item])).values()]);
      setRecipeFilters((current) => ({ ...current, query: "" }));
      setSimilarTo(meal.title);
      setRecipeNotice(`${similar.length} similar recipes ready to browse.`);
      document.querySelector(".recipe-library")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setRecipeNotice("Similar recipes are temporarily unavailable.");
    } finally {
      setRecipeLoading(false);
    }
  }

  function addToMeal(meal: Meal, kind: string) {
    const target = mealTargets[kind as keyof typeof mealTargets] || 0;
    const currentCount = plannedMeals.filter((item) => item.kind === kind).length;
    if (!target || currentCount >= target) {
      setRecipeNotice(`${kind} is already full.`);
      return;
    }
    const scheduled = mealDateFor(kind, currentCount);
    setPlannedMeals((current) => [...current, {
      ...meal,
      ...scheduled,
      id: `${meal.recipeId || meal.id}-${kind}-${crypto.randomUUID()}`,
      recipeId: meal.recipeId || meal.id,
      kind,
      tags: [...new Set([...(meal.tags || []), ...(kind === "School lunch" ? ["Kid-friendly", "Packable"] : [])])],
    }].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.kind.localeCompare(b.kind)));
    setRecipeNotice(`${meal.title} added to ${kind.toLowerCase()}.`);
  }

  function removePlannedMeal(id: string) {
    setPlannedMeals((current) => {
      const remaining = current.filter((meal) => meal.id !== id);
      const grouped = activeMealKinds.flatMap((kind) => remaining.filter((meal) => meal.kind === kind).map((meal, index) => ({ ...meal, ...mealDateFor(kind, index) })));
      return grouped.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.kind.localeCompare(b.kind));
    });
  }

  function quickFillRemaining() {
    if (!recipeIdeas.length) {
      setRecipeNotice("Load the recipe catalog before using quick fill.");
      return;
    }
    setPlannedMeals((current) => {
      const next = [...current];
      activeMealKinds.forEach((kind) => {
        const target = mealTargets[kind as keyof typeof mealTargets];
        const existingCount = next.filter((meal) => meal.kind === kind).length;
        const preferred = recipeIdeas.filter((meal) => meal.kind === kind);
        const pool = (preferred.length ? preferred : recipeIdeas)
          .sort((a, b) => Number(Boolean(b.tags?.includes("Budget fit"))) - Number(Boolean(a.tags?.includes("Budget fit"))));
        for (let index = existingCount; index < target; index++) {
          const meal = pool[(index - existingCount) % pool.length];
          next.push({
            ...meal,
            ...mealDateFor(kind, index),
            id: `${meal.recipeId || meal.id}-${kind}-${crypto.randomUUID()}`,
            recipeId: meal.recipeId || meal.id,
            kind,
            tags: [...new Set([...(meal.tags || []), ...(kind === "School lunch" ? ["Kid-friendly", "Packable"] : [])])],
          });
        }
      });
      return next.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.kind.localeCompare(b.kind));
    });
    setRecipeNotice("Open meal slots filled with preference and budget matches. You can still remove or replace any recipe.");
  }

  function toggleSchoolLunches() {
    if (kidLunches) {
      setPlannedMeals((current) => current.filter((meal) => meal.kind !== "School lunch"));
      setRecipeFilters((current) => ({ ...current, kind: current.kind === "School lunch" ? "All meals" : current.kind }));
    }
    setKidLunches(!kidLunches);
  }

  async function locateMe() {
    setLocationStatus("Finding you…");
    if (!navigator.geolocation) { setLocationStatus("Location is not supported by this browser."); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`/api/location/reverse?lat=${coords.latitude}&lon=${coords.longitude}`);
        const data = await response.json(); const result = data.results?.[0];
        if (result) { setLocation(result.label); setLocationQuery(result.label); setLocationStatus("Location updated."); }
      } catch { setLocationStatus("We couldn’t identify that location. You can type it instead."); }
    }, () => setLocationStatus("Location access was not granted. You can type it instead."), { enableHighAccuracy: false, timeout: 10000 });
  }

  async function toggleFavorite(meal: Meal) {
    const saved = favorites.includes(meal.title);
    setFavorites((current) => saved ? current.filter((item) => item !== meal.title) : [...current, meal.title]);
    if (ownerId) await fetch(`/api/favorites${saved ? `?recipeId=${encodeURIComponent(meal.id)}` : ""}`, { method: saved ? "DELETE" : "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: saved ? undefined : JSON.stringify(meal) });
  }

  async function saveRating(meal: Meal, rating: Rating) {
    setRatings((current) => ({ ...current, [meal.id]: rating }));
    await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ recipeId: meal.id, ...rating }) });
    setRatingMeal(null);
  }

  async function saveMember() {
    if (!memberDraft.name.trim()) return;
    const member: Member = {
      id: editingMemberId || crypto.randomUUID(), name: memberDraft.name.trim(), role: memberDraft.role, allergies: memberDraft.allergies,
      preferences: { glutenFree: memberDraft.glutenFree, lowDairy: memberDraft.lowDairy, kidFriendly: memberDraft.kidFriendly, avoidOnions: memberDraft.avoidOnions, proteins: memberDraft.proteins },
    };
    setMembers((current) => editingMemberId ? current.map((item) => item.id === editingMemberId ? member : item) : [...current, member]);
    await fetch("/api/family", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify(member) });
    setEditingMemberId("");
    setMemberDraft({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false, avoidOnions: false, proteins: [] });
  }

  async function deleteMember(id: string) {
    setMembers((current) => current.filter((member) => member.id !== id));
    await fetch(`/api/family?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-grocer-owner": ownerId } });
  }

  function editMember(member: Member) {
    setEditingMemberId(member.id);
    setMemberDraft({
      name: member.name, role: member.role, allergies: member.allergies,
      glutenFree: Boolean(member.preferences?.glutenFree), lowDairy: Boolean(member.preferences?.lowDairy),
      kidFriendly: Boolean(member.preferences?.kidFriendly), avoidOnions: Boolean(member.preferences?.avoidOnions),
      proteins: member.preferences?.proteins || [],
    });
  }

  async function copyForReminders() {
    const start = new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + (range === "Day" ? 0 : range === "Week" ? 6 : 29));
    const dateLabel = range === "Day"
      ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const text = `Groceries, ${dateLabel}\n\n${groceryGroups.map((group) => `${group.title}\n${group.items.map((item) => `• ${item}`).join("\n")}`).join("\n\n")}`;
    await navigator.clipboard.writeText(text); setExportStatus("Grocery list copied — paste it into Apple Reminders.");
  }
  function downloadCalendar() {
    if (!plannedMeals.length) { setExportStatus("Add recipes to your plan before exporting a calendar."); return; }
    const slots = [...plannedMeals].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    const recipes = calendarOrder === "random"
      ? [...plannedMeals].sort(() => Math.random() - .5)
      : slots;
    const events = slots.map((slot, index) => {
      const recipe = recipes[index];
      const start = new Date(Number(slot.sortOrder) || Date.now());
      start.setHours(slot.kind === "Dinner" ? 17 : 12, slot.kind === "Dinner" ? 30 : 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const recipeLine = recipe.sourceUrl ? `\nRecipe: ${recipe.sourceUrl}` : "";
      return `BEGIN:VEVENT\r\nUID:grocer-eaze-${calendarText(recipe.recipeId || recipe.id)}-${Number(slot.sortOrder)}@grocer-eaze\r\nDTSTAMP:${calendarStamp(new Date())}\r\nDTSTART:${calendarStamp(start)}\r\nDTEND:${calendarStamp(end)}\r\nSUMMARY:${calendarText(`${slot.kind}: ${recipe.title}`)}\r\nDESCRIPTION:${calendarText(`${recipe.detail} · ${recipe.time}${recipeLine}`)}\r\n${recipe.sourceUrl ? `URL:${calendarText(recipe.sourceUrl)}\r\n` : ""}END:VEVENT`;
    }).join("\r\n");
    const file = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Grocer-Eaze//Meal Plan//EN\r\n${events}\r\nEND:VCALENDAR`], { type: "text/calendar" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(file); link.download = "grocer-eaze-meal-plan.ics"; link.click(); URL.revokeObjectURL(link.href);
    setExportStatus(`Calendar downloaded in ${calendarOrder === "random" ? "a shuffled" : "your selected"} recipe order.`);
  }
  async function emailRecipes() {
    if (!email) { setExportStatus("Enter your email address first."); return; }
    const response = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ to: email, subject: "My Grocer-Eaze recipes", html: `<h1>Your meal plan</h1>${plannedMeals.map((meal) => `<h2>${meal.day}: ${meal.title}</h2><p>${meal.detail} · ${meal.time}</p>`).join("")}` }) });
    setExportStatus(response.ok ? `Recipes sent to ${email}.` : "We couldn’t send that email. Please try again.");
  }

  return <main>
    <header>
      <button className="brand" onClick={() => setView("plan")}><span className="brand-mark">g</span><span>Grocer<span>•</span>Eaze</span></button>
      <nav aria-label="Primary navigation">
        <button className={view === "plan" ? "active" : ""} onClick={() => setView("plan")}>Plan</button>
        <button className={view === "meals" ? "active" : ""} disabled={!recipeIdeas.length && !plannedMeals.length} title={!recipeIdeas.length && !plannedMeals.length ? "Build a recipe catalog first" : undefined} onClick={() => setView("meals")}>My meals</button>
        <button className={view === "list" ? "active" : ""} disabled={!plannedMeals.length} title={!plannedMeals.length ? "Add meals to build a grocery list" : undefined} onClick={() => setView("list")}>Grocery list</button>
        <button className={view === "family" ? "active" : ""} onClick={() => setView("family")}>Family</button>
        {user?.role === "admin" && <button className={view === "admin" ? "active" : ""} onClick={() => { setView("admin"); loadAdminUsers(); }}>Admin</button>}
      </nav>
      <button className="avatar" aria-label="Open profile" onClick={() => setView("account")}>{user ? user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "ME"}</button>
    </header>

    {view === "plan" && <div className="shell">
      <section className="hero"><p className="eyebrow">MEAL PLANNING, MADE HUMAN</p><h1><span>Better Food,</span><br /><em>Less Waste.</em></h1><p className="lede">A recipe catalog shaped around every person at your table, so you buy what you need and enjoy what you make.</p><div className="trust-row"><span><b>✓</b> Family preferences included</span><span><b>✓</b> Shop with a smarter list</span><span><b>✓</b> Use more, waste less</span></div></section>
      <section className="planner">
        <div className="planner-top"><div><span>1</span><strong>Build your plan</strong></div><p>About 60 seconds</p></div>
        <div className="field"><label>How far ahead?</label><div className="segmented">{["Day", "Week", "Month"].map((item) => <button key={item} aria-pressed={range === item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>)}</div></div>
        <div className="two-col"><div className="field"><label>Meals to plan</label><select value={mealType} onChange={(e) => setMealType(e.target.value)}><option>Lunch + dinner</option><option>Dinner only</option></select></div><div className="field"><label>People</label><div className="stepper"><button onClick={() => setPeople(Math.max(1, people - 1))}>−</button><strong>{people}</strong><button onClick={() => setPeople(Math.min(20, people + 1))}>+</button></div></div></div>
        <div className="field"><label>Household profile</label><input className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /><small className="field-help">{members.length ? `${members.length} family member${members.length === 1 ? "" : "s"} included in preferences.` : "Add individual preferences on the Family page."}</small></div>
        <div className="two-col"><div className="field"><label>Maximum cook time</label><select value={maxTime} onChange={(e) => setMaxTime(e.target.value)}><option>20 minutes</option><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option></select></div><div className="field"><label>Cooking comfort</label><select value={skill} onChange={(e) => setSkill(e.target.value)}><option>Keep it simple</option><option>Comfortable</option><option>Adventurous</option></select></div></div>
        <div className="field"><div className="label-line"><label>Grocery budget for this plan</label><strong>{budget >= 500 ? "$500+" : `$${budget}`}</strong></div><input aria-label="Grocery budget for this plan" type="range" min="50" max="500" step="10" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /><div className="range-labels"><span>$50</span><span>$500+</span></div></div>
        <div className="option-grid"><Toggle label="Plan for leftovers" checked={leftovers} onChange={() => setLeftovers(!leftovers)} note="Cook once, eat twice" /><Toggle label="School lunches" checked={kidLunches} onChange={toggleSchoolLunches} note={`${schoolLunchTarget || (range === "Month" ? 22 : range === "Week" ? 5 : 1)} packable weekday lunch${range === "Day" ? "" : "es"}`} /><Toggle label="Gluten-free" checked={glutenFree} onChange={() => setGlutenFree(!glutenFree)} note={familyGlutenFree ? "Also required by a family member" : undefined} /><Toggle label="Low dairy" checked={lowDairy} onChange={() => setLowDairy(!lowDairy)} note={familyLowDairy ? "Also preferred by a family member" : undefined} /><Toggle label="Mediterranean" checked={mediterranean} onChange={() => setMediterranean(!mediterranean)} /><Toggle label="One store only" checked={oneStore} onChange={() => setOneStore(!oneStore)} /></div>
        {oneStore && <div className="field"><label>Preferred store</label><select value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>{storeNames.map((store) => <option key={store}>{store}</option>)}</select></div>}
        <div className="field"><label>Allergies or ingredients to avoid</label><input className="text-input" placeholder="e.g. shellfish, peanuts, mushrooms" value={exclusions} onChange={(e) => setExclusions(e.target.value)} /></div>
        <div className="location-picker">
          <label>Shopping location</label><div className="location-input"><span className="icon-centered">⌖</span><input value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Neighborhood, city, or ZIP" aria-label="Shopping location" /><button type="button" onClick={locateMe} aria-label="Use my current location" title="Use my current location">◎</button></div>
          {locationResults.length > 0 && <div className="location-results">{locationResults.map((result) => <button key={`${result.lat}-${result.lon}`} onClick={() => { setLocation(result.label); setLocationQuery(result.label); setLocationResults([]); setLocationStatus("Location updated."); }}>{result.label}</button>)}</div>}
          <small>{locationStatus || `Searching stores near ${location}`}</small>
        </div>
        <button className="primary" onClick={() => generatePlan()} disabled={planning}>{planning ? "Building your recipe catalog…" : "Browse recipes for my plan"} <span>→</span></button><p className="estimate">Estimated groceries for a full plan: <strong>${planningEstimate.low}–${planningEstimate.high}</strong>{planningEstimate.high > budget && <span> · above your {budget >= 500 ? "$500+" : `$${budget}`} target</span>}</p>{plannerNotice && <p className="form-notice error" role="alert">{plannerNotice}</p>}
      </section>
    </div>}

    {view === "meals" && <div className="dashboard catalog-dashboard">
      <div className="page-heading catalog-heading"><div><p className="eyebrow">{people} PEOPLE · {household.toUpperCase()}</p><h2>{similarTo ? `More like ${similarTo}.` : "Build your plan from the catalog."}</h2><p>Browse, filter, and add each recipe to the meal where it belongs.</p></div><button className="outline" onClick={() => setView("plan")}>Adjust full plan</button></div>

      <section className="plan-progress" aria-label={`${filledCount} of ${totalTarget} meal slots filled`}>
        <div className="progress-copy"><span>{filledCount} / {totalTarget}</span><div><strong>{planIsFull ? "Your schedule is full" : `${totalTarget - filledCount} meal slots left`}</strong><small>{range} plan · {selectedStore} estimate {selectedEstimate ? `$${selectedEstimate}` : "$0"} · {selectedEstimate <= budget ? `$${budget - selectedEstimate} under budget` : `$${selectedEstimate - budget} over budget`}</small></div></div>
        <div className="progress-track"><i style={{ width: `${Math.min(100, (filledCount / Math.max(1, totalTarget)) * 100)}%` }} /></div>
        <div className="progress-breakdown">{activeMealKinds.map((kind) => {
          const count = plannedMeals.filter((meal) => meal.kind === kind).length;
          const target = mealTargets[kind as keyof typeof mealTargets];
          return <span key={kind} className={count >= target ? "complete" : ""}>{kind} {count}/{target}</span>;
        })}</div>
      </section>

      <section className="recipe-library">
        <div className="library-heading"><div><p className="eyebrow">RECIPE CATALOG</p><h3>Find the right fit.</h3><span>{filteredRecipeIdeas.length} shown · {recipeIdeas.length} loaded · load more whenever you reach the end</span></div><strong>{location}</strong></div>
        <div className="preference-filter-row" aria-label="Active meal preferences">
          <button className={glutenFree ? "active" : ""} aria-pressed={glutenFree} onClick={() => setGlutenFree(!glutenFree)}>Gluten-free</button>
          <button className={lowDairy ? "active" : ""} aria-pressed={lowDairy} onClick={() => setLowDairy(!lowDairy)}>Low dairy</button>
          <button className={mediterranean ? "active" : ""} aria-pressed={mediterranean} onClick={() => setMediterranean(!mediterranean)}>Mediterranean</button>
          <button className={kidLunches ? "active" : ""} aria-pressed={kidLunches} onClick={toggleSchoolLunches}>School lunches</button>
          {leftovers && <span>Leftovers planned</span>}
          {familyGlutenFree && <span>Family requires gluten-free</span>}
          {familyLowDairy && <span>Family prefers low dairy</span>}
          {familyKidFriendly && <span>Family prefers kid-friendly</span>}
          {familyAvoids.map((avoid) => <span key={avoid}>Avoid {avoid}</span>)}
          {familyProteins.map((protein) => <span key={protein}>{protein} favorite</span>)}
        </div>
        <details className="catalog-filter-panel" open>
          <summary><span>Filter recipes</span><small>{filteredRecipeIdeas.length} matches</small></summary>
          <div className="recipe-filters">
          <div className="filter-search"><span className="icon-centered">⌕</span><input aria-label="Filter recipes by name or ingredient" placeholder="Search recipes or ingredients" value={recipeFilters.query} onChange={(event) => setRecipeFilters({ ...recipeFilters, query: event.target.value })} /></div>
          <select aria-label="Filter by meal type" value={recipeFilters.kind} onChange={(event) => setRecipeFilters({ ...recipeFilters, kind: event.target.value })}><option>All meals</option>{activeMealKinds.map((kind) => <option key={kind}>{kind}</option>)}</select>
          <select aria-label="Filter by protein" value={recipeFilters.protein} onChange={(event) => setRecipeFilters({ ...recipeFilters, protein: event.target.value })}><option>All proteins</option>{proteinOptions.map((protein) => <option key={protein}>{protein}</option>)}</select>
          <select aria-label="Filter by cook time" value={recipeFilters.maxTime} onChange={(event) => setRecipeFilters({ ...recipeFilters, maxTime: event.target.value })}><option>Any time</option><option value="20">20 minutes or less</option><option value="30">30 minutes or less</option><option value="45">45 minutes or less</option><option value="60">60 minutes or less</option></select>
          <select aria-label="Filter by recipe source" value={recipeFilters.source} onChange={(event) => setRecipeFilters({ ...recipeFilters, source: event.target.value })}><option>All sources</option>{recipeSources.map((source) => <option key={source}>{source}</option>)}</select>
          <button className={recipeFilters.favoritesOnly ? "active" : ""} onClick={() => setRecipeFilters({ ...recipeFilters, favoritesOnly: !recipeFilters.favoritesOnly })}>♡ Favorites</button>
          <button onClick={() => setRecipeFilters({ query: "", kind: "All meals", maxTime: "Any time", source: "All sources", protein: "All proteins", favoritesOnly: false })}>Clear</button>
          </div>
        </details>
        {filteredRecipeIdeas.length ? <div className="recipe-card-grid">{filteredRecipeIdeas.map((meal) => <article className="recipe-card" key={`idea-${meal.kind}-${meal.id}-${meal.title}`}>
          <div className={`recipe-thumb ${meal.tone}`}>{meal.image ? <><img src={meal.image} alt={`${meal.title} recipe`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} /><span hidden>{meal.emoji}</span></> : <span>{meal.emoji}</span>}<em>{meal.kind === "School lunch" ? "Kid-friendly lunch" : meal.kind}</em><button className={favorites.includes(meal.title) ? "saved" : ""} onClick={() => toggleFavorite(meal)} aria-label={`${favorites.includes(meal.title) ? "Remove" : "Add"} favorite`}>{favorites.includes(meal.title) ? "♥" : "♡"}</button></div>
          <div className="recipe-card-copy"><small>{meal.sourceName}</small><h4>{meal.title}</h4><p>{meal.readyMinutes} min · {meal.cost}</p><div className="recipe-tags">{meal.tags?.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="catalog-secondary-actions">{meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer">Recipe ↗</a>}<button onClick={() => findSimilar(meal)}>Find similar</button><button onClick={() => setRatingMeal(meal)}>Rate</button></div><div className="add-meal-actions">{activeMealKinds.map((kind) => {
            const target = mealTargets[kind as keyof typeof mealTargets];
            const full = plannedMeals.filter((item) => item.kind === kind).length >= target;
            return <button key={kind} className="add-meal-button" disabled={full} onClick={() => addToMeal(meal, kind)}>{full ? `${kind} full` : `+ Add to ${kind.toLowerCase()}`}</button>;
          })}</div></div>
        </article>)}</div> : <p className="empty-state">No loaded recipes match these filters. Clear a filter or load more choices.</p>}
        <div className="load-more-row"><button className="primary compact" disabled={recipeLoading} onClick={loadMoreRecipes}>{recipeLoading ? "Finding more recipes…" : "Load more recipes"}</button>{recipeNotice && <span aria-live="polite">{recipeNotice}</span>}</div>
      </section>

      <section className="selection-board">
        <div className="selection-heading"><div><p className="eyebrow">YOUR SCHEDULE</p><h3>Selected meals</h3><span>Collapse any section to keep a long week or month easy to scan.</span></div><div className="selection-actions"><button className="outline" onClick={quickFillRemaining} disabled={planIsFull || !recipeIdeas.length}>Quick-fill remaining</button>{plannedMeals.length > 0 && <button className="outline" onClick={() => setPlannedMeals([])}>Clear selections</button>}</div></div>
        {activeMealKinds.map((kind) => {
          const selected = plannedMeals.filter((meal) => meal.kind === kind);
          const target = mealTargets[kind as keyof typeof mealTargets];
          const kindLabel = kind === "School lunch" ? "School lunches" : kind === "Lunch" ? "Lunches" : "Dinners";
          return <details className="selected-meal-section" open key={kind}><summary><span>{kind === "School lunch" ? "🍱" : kind === "Lunch" ? "🥗" : "🍽"} {kindLabel}</span><small>{selected.length} of {target} selected</small></summary>{selected.length ? <div className="selected-meal-list">{selected.map((meal) => <article key={meal.id}><span>{meal.day}<b>{meal.date}</b></span><div><strong>{meal.title}</strong><small>{meal.sourceName} · {meal.time} · {meal.cost}</small></div><button onClick={() => removePlannedMeal(meal.id)} aria-label={`Remove ${meal.title} from ${kind}`}>Remove</button></article>)}</div> : <p className="empty-selection">Choose {target} {kind.toLowerCase()} recipe{target === 1 ? "" : "s"} from the catalog above.</p>}</details>;
        })}
      </section>

      <div className={`action-bar confirm-bar ${planIsFull ? "ready" : ""}`}><p><strong>{planIsFull ? "Schedule complete." : `${filledCount} of ${totalTarget} meals selected.`}</strong> {planIsFull ? "Your recipe ingredients are ready to combine into one grocery list." : "Keep browsing to fill every meal slot."}</p><button className="primary compact" disabled={!planIsFull} onClick={() => setView("list")}>{planIsFull ? "Confirm & build grocery list →" : `${totalTarget - filledCount} slots remaining`}</button></div>
    </div>}

    {view === "list" && <div className="dashboard"><div className="page-heading"><div><p className="eyebrow">GROCERIES · {plannedMeals.length} SELECTED MEALS</p><h2>Everything you need, sorted.</h2><p>{groceryGroups.reduce((sum, group) => sum + group.count, 0)} unique ingredients for {people} people near {location}. {selectedStore} estimate: ${selectedEstimate}.</p></div><button className="outline" onClick={() => setView("meals")}>← Back to recipes</button></div><div className="list-layout"><section className="grocery-panel"><div className="store-compare"><span className="mini-label">{oneStore ? "YOUR SELECTED STORE" : "COMPARE NEARBY STORES"}</span><div>{visibleStoreEstimates.map((store) => <button key={store.name} className={selectedStore === store.name ? "selected-store" : ""} onClick={() => setSelectedStore(store.name)}><strong>{store.name}</strong><span>${store.price}</span><small>{store.availability}% estimated availability</small></button>)}</div></div><div className="grocery-head"><strong>{selectedStore}</strong><span>{plannedMeals.length} meals × {people} people · recipe-derived estimate</span></div>{groceryGroups.length ? groceryGroups.map((group) => <details open key={group.title}><summary><span>{group.icon} {group.title}</span><small>{group.count} {group.count === 1 ? "item" : "items"}</small></summary><div className="checklist">{group.items.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span><em>for {people}</em></label>)}</div></details>) : <p className="empty-state">Select recipes to build your grocery list.</p>}</section><aside className="export-panel"><span className="mini-label">READY WHEN YOU ARE</span><h3>Take your plan with you</h3><p>Send lists, recipes, and reminders where you already use them.</p><button onClick={copyForReminders}><span className="icon-centered">✓</span><div><strong>Apple Reminders</strong><small>Copy this grocery list</small></div><b>Copy</b></button><div className="calendar-export"><label htmlFor="calendar-order">Calendar recipe order</label><select id="calendar-order" value={calendarOrder} onChange={(event) => setCalendarOrder(event.target.value as "plan" | "random")}><option value="plan">Keep my selected order</option><option value="random">Shuffle recipes across dates</option></select><button onClick={downloadCalendar}><span className="icon-centered">31</span><div><strong>Google or Apple Calendar</strong><small>Recipes appear on their scheduled dates</small></div><b>Export</b></button></div><div className="email-export"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /><button onClick={emailRecipes}><span className="icon-centered">@</span><div><strong>Email me recipes</strong><small>Send the complete plan</small></div><b>Email</b></button></div>{exportStatus && <p className="export-status" aria-live="polite">{exportStatus}</p>}</aside></div></div>}

    {view === "family" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">HOUSEHOLD PREFERENCES</p><h2>Your family, thoughtfully fed.</h2><p>Allergies, avoided ingredients, and favorite proteins shape every catalog search.</p></div></div><div className="family-grid"><section className="settings-card"><h3>Family members</h3>{members.length === 0 && <p className="empty-state">No family members yet. Add the first person below.</p>}{members.map((member) => <article className="member-card" key={member.id}><span className="member-avatar icon-centered">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.role} · {member.allergies || "No listed allergies"}</small><p>{[member.preferences?.glutenFree && "Gluten-free", member.preferences?.lowDairy && "Low dairy", member.preferences?.kidFriendly && "Kid-friendly", member.preferences?.avoidOnions && "Avoid onions", ...(member.preferences?.proteins || []).map((protein) => `${protein} favorite`)].filter(Boolean).join(" · ") || "No preferences yet"}</p></div><div className="member-actions"><button onClick={() => editMember(member)}>Edit</button><button onClick={() => deleteMember(member.id)} aria-label={`Remove ${member.name}`}>Remove</button></div></article>)}</section><section className="settings-card"><h3>{editingMemberId ? "Edit family member" : "Add a family member"}</h3><div className="field"><label>Name</label><input className="text-input" value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} /></div><div className="field"><label>Role</label><select value={memberDraft.role} onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value })}><option>Adult</option><option>Teen</option><option>Child</option></select></div><div className="field"><label>Allergies / avoid</label><input className="text-input" placeholder="Peanuts, shellfish…" value={memberDraft.allergies} onChange={(e) => setMemberDraft({ ...memberDraft, allergies: e.target.value })} /></div><div className="field"><label>Favorite proteins</label><div className="preference-check-grid">{proteinOptions.map((protein) => <button type="button" key={protein} className={memberDraft.proteins.includes(protein) ? "selected" : ""} aria-pressed={memberDraft.proteins.includes(protein)} onClick={() => setMemberDraft({ ...memberDraft, proteins: memberDraft.proteins.includes(protein) ? memberDraft.proteins.filter((item) => item !== protein) : [...memberDraft.proteins, protein] })}>{protein}</button>)}</div></div><Toggle label="Avoid onions" checked={memberDraft.avoidOnions} onChange={() => setMemberDraft({ ...memberDraft, avoidOnions: !memberDraft.avoidOnions })} /><Toggle label="Gluten-free" checked={memberDraft.glutenFree} onChange={() => setMemberDraft({ ...memberDraft, glutenFree: !memberDraft.glutenFree })} /><Toggle label="Low dairy" checked={memberDraft.lowDairy} onChange={() => setMemberDraft({ ...memberDraft, lowDairy: !memberDraft.lowDairy })} /><Toggle label="Kid-friendly" checked={memberDraft.kidFriendly} onChange={() => setMemberDraft({ ...memberDraft, kidFriendly: !memberDraft.kidFriendly })} /><button className="primary" onClick={saveMember}>{editingMemberId ? "Save changes" : "Add family member"}</button>{editingMemberId && <button className="text-button" onClick={() => { setEditingMemberId(""); setMemberDraft({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false, avoidOnions: false, proteins: [] }); }}>Cancel editing</button>}</section></div></div>}

    {view === "account" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">PROFILE & SECURITY</p><h2>{user ? `Welcome, ${user.name}.` : "Create your account"}</h2><p>{user ? "Control your household, privacy, and plan." : "No password needed. We’ll verify your email with a one-time code."}</p></div></div>{!user ? <section className="settings-card auth-card"><div className="auth-trust"><span className="icon-centered">🔒</span><strong>Secure passwordless signup</strong><small>Only your name and verified email are required. Phone is optional.</small></div>{authStep === "details" ? <><div className="field"><label>Name</label><input className="text-input" autoComplete="name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></div><div className="field"><label>Email</label><input className="text-input" type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></div><div className="field"><label>Phone <small>(optional)</small></label><input className="text-input" type="tel" autoComplete="tel" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></div><button className="primary" disabled={authBusy} onClick={startAuth}>{authBusy ? "Sending code…" : "Continue with email"}</button></> : <><div className="field"><label>Six-digit verification code</label><input className="text-input code-input" inputMode="numeric" maxLength={6} value={authForm.code} onChange={(e) => setAuthForm({ ...authForm, code: e.target.value.replace(/\D/g, "") })} /></div><button className="primary" disabled={authBusy || authForm.code.length !== 6} onClick={verifyAuth}>{authBusy ? "Verifying…" : "Verify and create account"}</button><button className="text-button" onClick={() => setAuthStep("details")}>Use a different email</button></>}{accountStatus && <p className="checkout-note">{accountStatus}</p>}</section> : <div className="settings-stack"><section className="settings-card"><h3>Profile</h3><div className="account-identity"><span className="member-avatar icon-centered">{user.name[0].toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}{user.phone ? ` · ${user.phone}` : ""}</small></div><em>{user.role}</em></div><div className="two-col"><div className="field"><label>Household name</label><input className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /></div><div className="field"><label>Email for recipes</label><input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div><button className="outline" onClick={async () => { await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ householdName: household, people, location, preferences: { range, mealType, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, selectedStore, maxTime, skill, exclusions } }) }); setAccountStatus("Profile saved."); }}>Save profile</button>{accountStatus && <span className="success-note">{accountStatus}</span>}</section><section className="settings-card security-card"><div className="icon-centered">🔒</div><div><h3>Security</h3><p>Your email is verified. Your session is stored in a secure, HTTP-only cookie, protected data is checked on the server, and sensitive service keys never reach your browser.</p></div></section><section className="settings-card plan-row"><div><span className="mini-label">ACCESS STATUS</span><h3>{user.billingExempt ? "Billing exempt" : user.accessStatus === "complimentary" ? "Complimentary account" : user.subscriptionStatus === "active" ? "Active membership" : user.subscriptionStatus === "trialing" ? "30-day free trial" : "30-day free trial"}</h3><p>{user.complimentaryUntil ? `Complimentary through ${user.complimentaryUntil}` : user.subscriptionEndsAt ? `Current period ends ${new Date(user.subscriptionEndsAt).toLocaleDateString()}` : "Choose monthly or yearly billing when you’re ready."}</p></div>{user.subscriptionStatus ? <button className="primary compact" disabled={billingBusy} onClick={() => openBilling("portal")}>Manage billing</button> : <button className="primary compact" onClick={() => setView("plans")}>View plans</button>}</section><section className="settings-card danger-zone"><h3>Account controls</h3><button className="outline" onClick={async () => { await fetch("/api/auth/signout", { method: "POST" }); setUser(null); setAuthStep("details"); }}>Sign out</button></section></div>}</div>}

    {view === "admin" && user?.role === "admin" && <div className="dashboard"><div className="page-heading"><div><p className="eyebrow">SECURE ADMIN CONSOLE</p><h2>User access management</h2><p>Grant free access, exempt billing, suspend accounts, and manage administrators.</p></div></div><section className="admin-toolbar"><input className="text-input" placeholder="Search name or email" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} /><button className="outline" onClick={() => loadAdminUsers()}>Search</button></section>{accountStatus && <p className="checkout-note">{accountStatus}</p>}<div className="admin-list">{adminUsers.map((account) => <article className="admin-user" key={account.id}><div><strong>{account.name}</strong><small>{account.email}{account.phone ? ` · ${account.phone}` : ""}</small></div><div className="access-badges"><span>{account.role}</span><span>{account.access_status}</span>{Boolean(account.billing_exempt) && <span>billing exempt</span>}</div><div className="admin-actions"><button onClick={() => adminAction(account.id, account.access_status === "complimentary" ? "revoke_complimentary" : "grant_complimentary")}>{account.access_status === "complimentary" ? "Remove free access" : "Give free access"}</button><button onClick={() => adminAction(account.id, account.billing_exempt ? "billing_required" : "billing_exempt")}>{account.billing_exempt ? "Require payment" : "Turn off payment"}</button><button onClick={() => adminAction(account.id, account.access_status === "suspended" ? "activate" : "suspend")}>{account.access_status === "suspended" ? "Reactivate" : "Suspend"}</button><button onClick={() => adminAction(account.id, account.role === "admin" ? "remove_admin" : "make_admin")}>{account.role === "admin" ? "Remove admin" : "Make admin"}</button></div></article>)}</div>{adminUsers.length === 0 && <p className="empty-state">No users to show yet. Search or wait for the first signup.</p>}</div>}

    {view === "plans" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">SIMPLE PRICING</p><h2>Try everything free for 30 days.</h2><p>Secure checkout is handled by Stripe. Cancel any time before the trial ends.</p></div></div><div className="pricing-grid"><article className="price-card"><span>MONTHLY</span><h3><b>$10</b> / month</h3><p>Flexible month-to-month access.</p><button disabled={billingBusy} onClick={() => openBilling("checkout", "monthly")}>{billingBusy ? "Opening secure checkout…" : "Start 30-day trial"}</button></article><article className="price-card featured"><span>BEST VALUE · SAVE $21</span><h3><b>$99</b> / year</h3><p>Everything included, billed annually after your trial.</p><button disabled={billingBusy} onClick={() => openBilling("checkout", "yearly")}>{billingBusy ? "Opening secure checkout…" : "Start 30-day trial"}</button></article></div>{accountStatus && <p className="checkout-note">{accountStatus}</p>}<button className="outline back-button" onClick={() => setView("account")}>← Back to account</button></div>}

    {ratingMeal && <div className="modal-backdrop" onClick={() => setRatingMeal(null)}><section className="rating-modal" role="dialog" aria-modal="true" aria-labelledby="rating-title" onClick={(e) => e.stopPropagation()}><button className="modal-close icon-centered" aria-label="Close recipe rating" onClick={() => setRatingMeal(null)}>×</button><span className="mini-label">RATE THIS RECIPE</span><h3 id="rating-title">{ratingMeal.title}</h3><label>Meal quality</label><Stars label="Meal quality" value={ratings[ratingMeal.id]?.quality || 0} onChange={(quality) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality, ease: current[ratingMeal.id]?.ease || 0 } }))} /><label>Ease of preparation</label><Stars label="Ease of preparation" value={ratings[ratingMeal.id]?.ease || 0} onChange={(ease) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality: current[ratingMeal.id]?.quality || 0, ease } }))} /><button className="primary" disabled={!ratings[ratingMeal.id]?.quality || !ratings[ratingMeal.id]?.ease} onClick={() => saveRating(ratingMeal, ratings[ratingMeal.id])}>Save rating</button></section></div>}

    <footer className="site-footer"><span>Grocer•Eaze</span><p>Better food. Less waste.</p><div><button onClick={() => setView("plans")}>Plans</button><button onClick={() => setView("account")}>Privacy & security</button>{recipeSourceLinks.map((source) => <a key={source.name} href={source.url} target="_blank" rel="noreferrer">{source.name}</a>)}</div></footer>
  </main>;
}
