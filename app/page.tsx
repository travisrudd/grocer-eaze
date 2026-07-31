"use client";

import { useEffect, useMemo, useState } from "react";

type Meal = {
  id: string; day: string; date: string; kind: string; title: string; detail: string;
  time: string; cost: string; tone: string; emoji: string; sourceUrl?: string; image?: string; sortOrder?: number;
  sourceName?: string; readyMinutes?: number;
};
type Member = { id: string; name: string; role: string; allergies: string; preferences?: { glutenFree?: boolean; lowDairy?: boolean; kidFriendly?: boolean } };
type Rating = { quality: number; ease: number };
type LocationResult = { label: string; lat?: string; lon?: string };
type AccountUser = { id: string; name: string; email: string; phone: string; role: "user" | "admin"; accessStatus: string; complimentaryUntil: string | null; billingExempt: boolean; subscriptionStatus: string | null; subscriptionEndsAt: string | null };
type AdminUser = { id: string; name: string; email: string; phone: string; role: string; access_status: string; trial_ends_at?: string; complimentary_until?: string; billing_exempt: number };

const fallbackMeals: Meal[] = [
  { id: "demo-salmon", day: "MON", date: "12", kind: "Dinner", title: "Lemon Herb Salmon", detail: "with roasted asparagus & quinoa", time: "35 min", cost: "$4.80 / serving", tone: "salmon", emoji: "🐟" },
  { id: "demo-hummus", day: "TUE", date: "13", kind: "School lunch", title: "Rainbow Hummus Box", detail: "nut-free · pack in 10 minutes", time: "10 min", cost: "$2.40 / serving", tone: "gold", emoji: "🥕" },
  { id: "demo-beans", day: "TUE", date: "13", kind: "Dinner", title: "Tuscan White Bean Skillet", detail: "with spinach, tomatoes & herbs", time: "30 min", cost: "$3.10 / serving", tone: "green", emoji: "🍅" },
];
const groceryGroups = [
  { icon: "🥬", title: "Produce", count: 12, items: ["Asparagus", "Baby spinach", "Cherry tomatoes", "Cucumbers"] },
  { icon: "🐟", title: "Meat & seafood", count: 3, items: ["Salmon fillets", "Chicken breast", "Eggs"] },
  { icon: "🥫", title: "Pantry", count: 8, items: ["Quinoa", "White beans", "Hummus", "Olive oil"] },
  { icon: "🧊", title: "Refrigerated", count: 4, items: ["Oat yogurt", "Feta alternative", "Almond milk"] },
];

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
  const [plannedMeals, setPlannedMeals] = useState<Meal[]>(fallbackMeals);
  const [planning, setPlanning] = useState(false);
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("Uptown, Chicago, IL");
  const [locationQuery, setLocationQuery] = useState("Uptown, Chicago, IL");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationStatus, setLocationStatus] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberDraft, setMemberDraft] = useState({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false });
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
  const [recipeFilters, setRecipeFilters] = useState({ query: "", kind: "All meals", maxTime: "Any time", source: "All sources", favoritesOnly: false });

  const estimated = useMemo(() => Math.round(people * (range === "Day" ? 9 : range === "Week" ? 27 : 104)), [people, range]);
  const dinnerTarget = range === "Day" ? 1 : range === "Week" ? 7 : 30;
  const lunchTarget = kidLunches && mealType !== "Dinner only" ? (range === "Day" ? 1 : range === "Week" ? 5 : 22) : 0;
  const recipeSources = useMemo(() => [...new Set(recipeIdeas.map((meal) => meal.sourceName).filter(Boolean) as string[])].sort(), [recipeIdeas]);
  const filteredRecipeIdeas = useMemo(() => recipeIdeas.filter((meal) => {
    const query = recipeFilters.query.trim().toLowerCase();
    const max = recipeFilters.maxTime === "Any time" ? Infinity : Number(recipeFilters.maxTime);
    return (!query || `${meal.title} ${meal.detail}`.toLowerCase().includes(query))
      && (recipeFilters.kind === "All meals" || meal.kind === recipeFilters.kind)
      && Number(meal.readyMinutes || 0) <= max
      && (recipeFilters.source === "All sources" || meal.sourceName === recipeFilters.source)
      && (!recipeFilters.favoritesOnly || favorites.includes(meal.title));
  }), [recipeIdeas, recipeFilters, favorites]);

  useEffect(() => {
    let id = window.localStorage.getItem("grocer-eaze-owner");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("grocer-eaze-owner", id); }
    setOwnerId(id);
    Promise.all([
      fetch("/api/profile", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/favorites", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/family", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/ratings", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([profileData, favoriteData, familyData, ratingData, authData]) => {
      if (profileData.profile) {
        setHousehold(profileData.profile.household_name); setPeople(profileData.profile.people);
        setLocation(profileData.profile.location); setLocationQuery(profileData.profile.location);
      }
      if (favoriteData.favorites) setFavorites(favoriteData.favorites.map((recipe: { title: string }) => recipe.title));
      if (familyData.members) setMembers(familyData.members);
      if (ratingData.ratings) setRatings(Object.fromEntries(ratingData.ratings.map((r: { recipe_id: string; quality: number; ease: number }) => [r.recipe_id, { quality: r.quality, ease: r.ease }])));
      if (authData.user) { setUser(authData.user); setEmail(authData.user.email); }
    }).catch(() => undefined);
  }, []);

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
    if (locationQuery.trim().length < 3 || locationQuery === location) { setLocationResults([]); return; }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(locationQuery)}`);
      const data = await response.json();
      setLocationResults(data.results || []);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [locationQuery, location]);

  function mapRecipe(recipe: Record<string, unknown>, index: number, kind = "Dinner"): Meal {
    const mealDate = new Date();
    mealDate.setHours(12, 0, 0, 0);
    if (kind === "School lunch") {
      let weekdays = -1;
      while (weekdays < index) {
        if (mealDate.getDay() !== 0 && mealDate.getDay() !== 6) weekdays++;
        if (weekdays < index) mealDate.setDate(mealDate.getDate() + 1);
      }
    } else {
      mealDate.setDate(mealDate.getDate() + index);
    }
    return {
      id: String(recipe.id || `recipe-${index}`), day: mealDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      date: String(mealDate.getDate()), kind, title: String(recipe.title),
      detail: `from ${String(recipe.sourceName || "a trusted recipe source")}`,
      time: `${Number(recipe.readyInMinutes || 35)} min`, cost: `$${((Number(recipe.pricePerServing || 420)) / 100).toFixed(2)} / serving`,
      tone: ["salmon", "gold", "green", "blue"][index % 4], emoji: kind.includes("lunch") ? "🍱" : ["🥗", "🍲", "🐟", "🍅"][index % 4],
      sourceUrl: String(recipe.sourceUrl || ""),
      image: String(recipe.image || ""),
      sortOrder: mealDate.getTime(),
      sourceName: String(recipe.sourceName || "Recipe source"),
      readyMinutes: Number(recipe.readyInMinutes || 35),
    };
  }

  async function generatePlan(queryOverride?: string) {
    setPlanning(true);
    const minutes = maxTime.match(/\d+/)?.[0] || "45";
    const dinnerQuery = queryOverride || `${mediterranean ? "Mediterranean " : ""}family dinner ${exclusions ? `without ${exclusions}` : ""}`;
    try {
      const requests = [fetch(`/api/recipes/search?${new URLSearchParams({ q: dinnerQuery, maxTime: minutes, glutenFree: String(glutenFree), number: String(Math.min(100, dinnerTarget + 12)) })}`)];
      if (lunchTarget) requests.push(fetch(`/api/recipes/search?${new URLSearchParams({ q: `school lunch kid friendly packable ${exclusions ? `without ${exclusions}` : ""}`, maxTime: "20", glutenFree: String(glutenFree), number: String(Math.min(100, lunchTarget + 6)) })}`));
      const responses = await Promise.all(requests);
      const dinnerData = await responses[0].json();
      const lunchData = responses[1] ? await responses[1].json() : { recipes: [] };
      const unique = (recipes: Array<Record<string, unknown>>) => [...new Map(recipes.map((recipe) => [String(recipe.title).toLowerCase(), recipe])).values()];
      const dinners = unique(dinnerData.recipes || []).slice(0, dinnerTarget).map((r, i) => mapRecipe(r, i));
      const lunches = unique(lunchData.recipes || []).slice(0, lunchTarget).map((r, i) => mapRecipe(r, i, "School lunch"));
      const dinnerIdeas = unique(dinnerData.recipes || []).slice(dinnerTarget).map((r, i) => mapRecipe(r, i));
      const lunchIdeas = unique(lunchData.recipes || []).slice(lunchTarget).map((r, i) => mapRecipe(r, i, "School lunch"));
      if (dinners.length) setPlannedMeals([...dinners, ...lunches].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.kind.localeCompare(b.kind)));
      setRecipeIdeas([...dinnerIdeas, ...lunchIdeas]); setRecipePage(1); setRecipeNotice("");
      if (ownerId) await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ householdName: household, people, location, preferences: { range, mealType, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, maxTime, skill, exclusions } }) });
      setSimilarTo(queryOverride || ""); setView("meals"); window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setPlanning(false); }
  }

  async function loadMoreRecipes() {
    setRecipeLoading(true); setRecipeNotice("");
    const kind = recipeFilters.kind === "School lunch" ? "School lunch" : "Dinner";
    const query = recipeFilters.query.trim() || (kind === "School lunch" ? "school lunch kid friendly packable" : `${mediterranean ? "Mediterranean " : ""}family dinner`);
    const maxTimeFilter = recipeFilters.maxTime === "Any time" ? (maxTime.match(/\d+/)?.[0] || "60") : recipeFilters.maxTime;
    try {
      const response = await fetch(`/api/recipes/search?${new URLSearchParams({ q: query, maxTime: maxTimeFilter, glutenFree: String(glutenFree), number: "18", offset: String(recipePage * 18) })}`);
      const data = await response.json();
      if (!response.ok) { setRecipeNotice(data.error || "More recipes are temporarily unavailable."); return; }
      const incoming = (data.recipes || []).map((recipe: Record<string, unknown>, index: number) => mapRecipe(recipe, recipeIdeas.length + index, kind));
      const existing = new Set(recipeIdeas.map((meal) => `${meal.id}:${meal.title.toLowerCase()}`));
      const fresh = incoming.filter((meal: Meal) => !existing.has(`${meal.id}:${meal.title.toLowerCase()}`));
      setRecipeIdeas((current) => [...current, ...fresh]); setRecipePage((page) => page + 1);
      setRecipeNotice(fresh.length ? `${fresh.length} more recipes added.` : "No new matches in that batch. Try broader filters or load another batch.");
    } catch {
      setRecipeNotice("More recipes are temporarily unavailable.");
    } finally {
      setRecipeLoading(false);
    }
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

  async function addMember() {
    if (!memberDraft.name.trim()) return;
    const member: Member = { id: crypto.randomUUID(), name: memberDraft.name.trim(), role: memberDraft.role, allergies: memberDraft.allergies, preferences: { glutenFree: memberDraft.glutenFree, lowDairy: memberDraft.lowDairy, kidFriendly: memberDraft.kidFriendly } };
    setMembers((current) => [...current, member]);
    await fetch("/api/family", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify(member) });
    setMemberDraft({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false });
  }

  async function deleteMember(id: string) {
    setMembers((current) => current.filter((member) => member.id !== id));
    await fetch(`/api/family?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-grocer-owner": ownerId } });
  }

  async function copyForReminders() {
    const text = `Groceries, May 12–18\n\n${groceryGroups.map((group) => `${group.title}\n${group.items.map((item) => `• ${item}`).join("\n")}`).join("\n\n")}`;
    await navigator.clipboard.writeText(text); setExportStatus("Grocery list copied — paste it into Apple Reminders.");
  }
  function downloadCalendar() {
    const events = plannedMeals.map((meal, index) => `BEGIN:VEVENT\r\nUID:grocer-eaze-${index}@grocer-eaze\r\nDTSTART:202605${String(12 + index).padStart(2, "0")}T173000\r\nDTEND:202605${String(12 + index).padStart(2, "0")}T183000\r\nSUMMARY:${meal.title}\r\nDESCRIPTION:${meal.detail} (${meal.time})\r\nEND:VEVENT`).join("\r\n");
    const file = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Grocer-Eaze//Meal Plan//EN\r\n${events}\r\nEND:VCALENDAR`], { type: "text/calendar" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(file); link.download = "grocer-eaze-meal-plan.ics"; link.click(); URL.revokeObjectURL(link.href); setExportStatus("Calendar file downloaded.");
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
        <button className={view === "meals" ? "active" : ""} onClick={() => setView("meals")}>My meals</button>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Grocery list</button>
        <button className={view === "family" ? "active" : ""} onClick={() => setView("family")}>Family</button>
        {user?.role === "admin" && <button className={view === "admin" ? "active" : ""} onClick={() => { setView("admin"); loadAdminUsers(); }}>Admin</button>}
      </nav>
      <button className="avatar" aria-label="Open profile" onClick={() => setView("account")}>{user ? user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "ME"}</button>
    </header>

    {view === "plan" && <div className="shell">
      <section className="hero"><p className="eyebrow">MEAL PLANNING, MADE HUMAN</p><h1>Good food. Less fuss.<br /><em>One easy plan.</em></h1><p className="lede">Recipes that fit every person at your table, plus school lunches that actually make it back empty.</p><div className="trust-row"><span><b>✓</b> Allergy aware</span><span><b>✓</b> Budget smart</span><span><b>✓</b> Family ready</span></div></section>
      <section className="planner">
        <div className="planner-top"><div><span>1</span><strong>Build your plan</strong></div><p>About 60 seconds</p></div>
        <div className="field"><label>How far ahead?</label><div className="segmented">{["Day", "Week", "Month"].map((item) => <button key={item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>)}</div></div>
        <div className="two-col"><div className="field"><label>Meals to plan</label><select value={mealType} onChange={(e) => setMealType(e.target.value)}><option>Lunch + dinner</option><option>Dinner only</option></select></div><div className="field"><label>People</label><div className="stepper"><button onClick={() => setPeople(Math.max(1, people - 1))}>−</button><strong>{people}</strong><button onClick={() => setPeople(Math.min(20, people + 1))}>+</button></div></div></div>
        <div className="field"><label>Household profile</label><input className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /><small className="field-help">{members.length ? `${members.length} family member${members.length === 1 ? "" : "s"} included in preferences.` : "Add individual preferences on the Family page."}</small></div>
        <div className="two-col"><div className="field"><label>Maximum cook time</label><select value={maxTime} onChange={(e) => setMaxTime(e.target.value)}><option>20 minutes</option><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option></select></div><div className="field"><label>Cooking comfort</label><select value={skill} onChange={(e) => setSkill(e.target.value)}><option>Keep it simple</option><option>Comfortable</option><option>Adventurous</option></select></div></div>
        <div className="field"><div className="label-line"><label>Weekly grocery budget</label><strong>{budget >= 500 ? "$500+" : `$${budget}`}</strong></div><input aria-label="Weekly grocery budget" type="range" min="50" max="500" step="10" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /><div className="range-labels"><span>$50</span><span>$500+</span></div></div>
        <div className="option-grid"><Toggle label="Plan for leftovers" checked={leftovers} onChange={() => setLeftovers(!leftovers)} note="Cook once, eat twice" /><Toggle label="School lunches" checked={kidLunches} onChange={() => setKidLunches(!kidLunches)} note="5 packable weekday lunches" /><Toggle label="Gluten-free" checked={glutenFree} onChange={() => setGlutenFree(!glutenFree)} /><Toggle label="Low dairy" checked={lowDairy} onChange={() => setLowDairy(!lowDairy)} /><Toggle label="Mediterranean" checked={mediterranean} onChange={() => setMediterranean(!mediterranean)} /><Toggle label="One store only" checked={oneStore} onChange={() => setOneStore(!oneStore)} /></div>
        <div className="field"><label>Allergies or ingredients to avoid</label><input className="text-input" placeholder="e.g. shellfish, peanuts, mushrooms" value={exclusions} onChange={(e) => setExclusions(e.target.value)} /></div>
        <div className="location-picker">
          <label>Shopping location</label><div className="location-input"><span className="icon-centered">⌖</span><input value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Neighborhood, city, or ZIP" aria-label="Shopping location" /><button type="button" onClick={locateMe} aria-label="Use my current location" title="Use my current location">◎</button></div>
          {locationResults.length > 0 && <div className="location-results">{locationResults.map((result) => <button key={`${result.lat}-${result.lon}`} onClick={() => { setLocation(result.label); setLocationQuery(result.label); setLocationResults([]); setLocationStatus("Location updated."); }}>{result.label}</button>)}</div>}
          <small>{locationStatus || `Searching stores near ${location}`}</small>
        </div>
        <button className="primary" onClick={() => generatePlan()}>{planning ? "Finding the best recipes…" : "Make my meal plan"} <span>→</span></button><p className="estimate">Estimated groceries: <strong>${estimated}–${Math.max(estimated + 18, budget)}</strong></p>
      </section>
    </div>}

    {view === "meals" && <div className="dashboard">
      <div className="page-heading"><div><p className="eyebrow">{people} PEOPLE · {household.toUpperCase()} · {location.toUpperCase()}</p><h2>{similarTo ? `More like ${similarTo}.` : `Your ${range.toLowerCase()} is ready.`}</h2><p>{glutenFree ? "Gluten-free · " : ""}{mediterranean ? "Mediterranean · " : ""}{lowDairy ? "Low dairy · " : ""}max {maxTime.toLowerCase()}</p></div><button className="outline" onClick={() => setView("plan")}>Adjust plan</button></div>
      <div className="summary-strip"><div><span>{plannedMeals.filter((m) => m.kind === "Dinner").length}</span><small>dinners</small></div><div><span>{plannedMeals.filter((m) => m.kind === "School lunch").length}</span><small>school lunches</small></div><div><span>{leftovers ? Math.round(dinnerTarget / 3) : 0}</span><small>leftover nights</small></div><div className="total"><small>estimated total</small><span>${Math.min(Math.max(budget - 8, 50), estimated)}</span><em>${budget >= 500 ? "500+" : budget} budget</em></div></div>
      {kidLunches && mealType !== "Dinner only" && <section className="lunch-banner"><div className="icon-centered">🍱</div><div><strong>Weekday school lunches are covered</strong><p>Packable in 20 minutes or less, allergy-aware, and balanced for kids.</p></div><span>{plannedMeals.filter((m) => m.kind === "School lunch").length} weekday lunches</span></section>}
      <div className="meal-grid">{plannedMeals.map((meal) => <article className="meal-card" key={`${meal.id}-${meal.kind}`}>
        <div className="date"><strong>{meal.day}</strong><span>{meal.date}</span></div><div className={`meal-art ${meal.tone}`}>{meal.image ? <><img src={meal.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} /><span hidden>{meal.emoji}</span></> : <span>{meal.emoji}</span>}<small>{meal.kind}</small></div>
        <div className="meal-copy"><p>{meal.kind.toUpperCase()}</p><h3>{meal.title}</h3><span>{meal.detail}</span><footer><small>◷ {meal.time}</small><small>{meal.cost}</small>{ratings[meal.id] && <small>★ {ratings[meal.id].quality}/5 quality · {ratings[meal.id].ease}/5 ease</small>}</footer><div className="recipe-actions"><button onClick={() => setRatingMeal(meal)}>Rate</button><button onClick={() => generatePlan(meal.title)}>Find similar</button>{meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer">Recipe ↗</a>}</div></div>
        <button className={`favorite icon-centered ${favorites.includes(meal.title) ? "saved" : ""}`} onClick={() => toggleFavorite(meal)} aria-label={`${favorites.includes(meal.title) ? "Remove" : "Add"} favorite`}>{favorites.includes(meal.title) ? "♥" : "♡"}</button>
      </article>)}</div>
      <section className="recipe-library">
        <div className="library-heading"><div><p className="eyebrow">ENDLESS RECIPE IDEAS</p><h3>Keep browsing.</h3><span>Filter the current collection or load another batch of recipes that match your household.</span></div><strong>{filteredRecipeIdeas.length} shown · {recipeIdeas.length} loaded</strong></div>
        <div className="recipe-filters">
          <div className="filter-search"><span className="icon-centered">⌕</span><input aria-label="Filter recipes by name or ingredient" placeholder="Search recipes or ingredients" value={recipeFilters.query} onChange={(event) => setRecipeFilters({ ...recipeFilters, query: event.target.value })} /></div>
          <select aria-label="Filter by meal type" value={recipeFilters.kind} onChange={(event) => setRecipeFilters({ ...recipeFilters, kind: event.target.value })}><option>All meals</option><option>Dinner</option><option>School lunch</option></select>
          <select aria-label="Filter by cook time" value={recipeFilters.maxTime} onChange={(event) => setRecipeFilters({ ...recipeFilters, maxTime: event.target.value })}><option>Any time</option><option value="20">20 minutes or less</option><option value="30">30 minutes or less</option><option value="45">45 minutes or less</option><option value="60">60 minutes or less</option></select>
          <select aria-label="Filter by recipe source" value={recipeFilters.source} onChange={(event) => setRecipeFilters({ ...recipeFilters, source: event.target.value })}><option>All sources</option>{recipeSources.map((source) => <option key={source}>{source}</option>)}</select>
          <button className={recipeFilters.favoritesOnly ? "active" : ""} onClick={() => setRecipeFilters({ ...recipeFilters, favoritesOnly: !recipeFilters.favoritesOnly })}>♡ Favorites</button>
          <button onClick={() => setRecipeFilters({ query: "", kind: "All meals", maxTime: "Any time", source: "All sources", favoritesOnly: false })}>Clear</button>
        </div>
        {filteredRecipeIdeas.length ? <div className="recipe-card-grid">{filteredRecipeIdeas.map((meal) => <article className="recipe-card" key={`idea-${meal.id}-${meal.title}`}>
          <div className={`recipe-thumb ${meal.tone}`}>{meal.image ? <><img src={meal.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} /><span hidden>{meal.emoji}</span></> : <span>{meal.emoji}</span>}<em>{meal.kind}</em><button className={favorites.includes(meal.title) ? "saved" : ""} onClick={() => toggleFavorite(meal)} aria-label={`${favorites.includes(meal.title) ? "Remove" : "Add"} favorite`}>{favorites.includes(meal.title) ? "♥" : "♡"}</button></div>
          <div className="recipe-card-copy"><small>{meal.sourceName}</small><h4>{meal.title}</h4><p>{meal.readyMinutes} min · {meal.cost}</p><div>{meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer">View recipe ↗</a>}<button onClick={() => generatePlan(meal.title)}>Find similar</button></div></div>
        </article>)}</div> : <p className="empty-state">No loaded recipes match these filters. Clear a filter or load more choices.</p>}
        <div className="load-more-row"><button className="primary compact" disabled={recipeLoading} onClick={loadMoreRecipes}>{recipeLoading ? "Finding more recipes…" : "Load more recipes"}</button>{recipeNotice && <span>{recipeNotice}</span>}</div>
      </section>
      <div className="action-bar"><p><strong>Looks good?</strong> Your ingredients are combined and sorted by store.</p><button className="primary compact" onClick={() => setView("list")}>Review grocery list →</button></div>
    </div>}

    {view === "list" && <div className="dashboard"><div className="page-heading"><div><p className="eyebrow">GROCERIES · THIS PLAN</p><h2>Everything you need, sorted.</h2><p>Quantities are adjusted for {people} people near {location}.</p></div><button className="outline" onClick={() => setView("meals")}>← Back to meals</button></div><div className="list-layout"><section className="grocery-panel"><div className="store-compare"><span className="mini-label">COMPARE NEARBY STORES</span><div>{[["Whole Foods", "$94", "24/27 items"], ["Jewel-Osco", "$88", "26/27 items"], ["Trader Joe’s", "$81", "21/27 items"]].map(([store, price, stock]) => <button key={store} className={selectedStore === store ? "selected-store" : ""} onClick={() => setSelectedStore(store)}><strong>{store}</strong><span>{price}</span><small>{stock}</small></button>)}</div></div><div className="grocery-head"><strong>{selectedStore}</strong><span>Best-fit list · price estimate</span></div>{groceryGroups.map((group) => <details open key={group.title}><summary><span>{group.icon} {group.title}</span><small>{group.count} items</small></summary><div className="checklist">{group.items.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span><em>1</em></label>)}</div></details>)}</section><aside className="export-panel"><span className="mini-label">READY WHEN YOU ARE</span><h3>Take your plan with you</h3><p>Send lists, recipes, and reminders where you already use them.</p><button onClick={copyForReminders}><span className="icon-centered">✓</span><div><strong>Apple Reminders</strong><small>Copy this grocery list</small></div><b>Copy</b></button><button onClick={downloadCalendar}><span className="icon-centered">31</span><div><strong>Google or Apple Calendar</strong><small>Import daily recipes</small></div><b>Export</b></button><div className="email-export"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /><button onClick={emailRecipes}><span className="icon-centered">@</span><div><strong>Email me recipes</strong><small>Send the complete plan</small></div><b>Email</b></button></div>{exportStatus && <p className="export-status">{exportStatus}</p>}</aside></div></div>}

    {view === "family" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">HOUSEHOLD PREFERENCES</p><h2>Your family, thoughtfully fed.</h2><p>Each person’s allergies and preferences shape every recommendation.</p></div></div><div className="family-grid"><section className="settings-card"><h3>Family members</h3>{members.length === 0 && <p className="empty-state">No family members yet. Add the first person below.</p>}{members.map((member) => <article className="member-card" key={member.id}><span className="member-avatar icon-centered">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.role} · {member.allergies || "No listed allergies"}</small><p>{member.preferences?.glutenFree ? "Gluten-free · " : ""}{member.preferences?.lowDairy ? "Low dairy · " : ""}{member.preferences?.kidFriendly ? "Kid-friendly" : ""}</p></div><button onClick={() => deleteMember(member.id)} aria-label={`Remove ${member.name}`}>×</button></article>)}</section><section className="settings-card"><h3>Add a family member</h3><div className="field"><label>Name</label><input className="text-input" value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} /></div><div className="field"><label>Role</label><select value={memberDraft.role} onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value })}><option>Adult</option><option>Teen</option><option>Child</option></select></div><div className="field"><label>Allergies / avoid</label><input className="text-input" placeholder="Peanuts, shellfish…" value={memberDraft.allergies} onChange={(e) => setMemberDraft({ ...memberDraft, allergies: e.target.value })} /></div><Toggle label="Gluten-free" checked={memberDraft.glutenFree} onChange={() => setMemberDraft({ ...memberDraft, glutenFree: !memberDraft.glutenFree })} /><Toggle label="Low dairy" checked={memberDraft.lowDairy} onChange={() => setMemberDraft({ ...memberDraft, lowDairy: !memberDraft.lowDairy })} /><Toggle label="Kid-friendly" checked={memberDraft.kidFriendly} onChange={() => setMemberDraft({ ...memberDraft, kidFriendly: !memberDraft.kidFriendly })} /><button className="primary" onClick={addMember}>Add family member</button></section></div></div>}

    {view === "account" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">PROFILE & SECURITY</p><h2>{user ? `Welcome, ${user.name}.` : "Create your account"}</h2><p>{user ? "Control your household, privacy, and plan." : "No password needed. We’ll verify your email with a one-time code."}</p></div></div>{!user ? <section className="settings-card auth-card"><div className="auth-trust"><span className="icon-centered">🔒</span><strong>Secure passwordless signup</strong><small>Only your name and verified email are required. Phone is optional.</small></div>{authStep === "details" ? <><div className="field"><label>Name</label><input className="text-input" autoComplete="name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></div><div className="field"><label>Email</label><input className="text-input" type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></div><div className="field"><label>Phone <small>(optional)</small></label><input className="text-input" type="tel" autoComplete="tel" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></div><button className="primary" disabled={authBusy} onClick={startAuth}>{authBusy ? "Sending code…" : "Continue with email"}</button></> : <><div className="field"><label>Six-digit verification code</label><input className="text-input code-input" inputMode="numeric" maxLength={6} value={authForm.code} onChange={(e) => setAuthForm({ ...authForm, code: e.target.value.replace(/\D/g, "") })} /></div><button className="primary" disabled={authBusy || authForm.code.length !== 6} onClick={verifyAuth}>{authBusy ? "Verifying…" : "Verify and create account"}</button><button className="text-button" onClick={() => setAuthStep("details")}>Use a different email</button></>}{accountStatus && <p className="checkout-note">{accountStatus}</p>}</section> : <div className="settings-stack"><section className="settings-card"><h3>Profile</h3><div className="account-identity"><span className="member-avatar icon-centered">{user.name[0].toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}{user.phone ? ` · ${user.phone}` : ""}</small></div><em>{user.role}</em></div><div className="two-col"><div className="field"><label>Household name</label><input className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /></div><div className="field"><label>Email for recipes</label><input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div><button className="outline" onClick={async () => { await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ householdName: household, people, location, preferences: {} }) }); setAccountStatus("Profile saved."); }}>Save profile</button>{accountStatus && <span className="success-note">{accountStatus}</span>}</section><section className="settings-card security-card"><div className="icon-centered">🔒</div><div><h3>Security</h3><p>Your email is verified. Your session is stored in a secure, HTTP-only cookie, protected data is checked on the server, and sensitive service keys never reach your browser.</p></div></section><section className="settings-card plan-row"><div><span className="mini-label">ACCESS STATUS</span><h3>{user.billingExempt ? "Billing exempt" : user.accessStatus === "complimentary" ? "Complimentary account" : user.subscriptionStatus === "active" ? "Active membership" : user.subscriptionStatus === "trialing" ? "30-day free trial" : "30-day free trial"}</h3><p>{user.complimentaryUntil ? `Complimentary through ${user.complimentaryUntil}` : user.subscriptionEndsAt ? `Current period ends ${new Date(user.subscriptionEndsAt).toLocaleDateString()}` : "Choose monthly or yearly billing when you’re ready."}</p></div>{user.subscriptionStatus ? <button className="primary compact" disabled={billingBusy} onClick={() => openBilling("portal")}>Manage billing</button> : <button className="primary compact" onClick={() => setView("plans")}>View plans</button>}</section><section className="settings-card danger-zone"><h3>Account controls</h3><button className="outline" onClick={async () => { await fetch("/api/auth/signout", { method: "POST" }); setUser(null); setAuthStep("details"); }}>Sign out</button></section></div>}</div>}

    {view === "admin" && user?.role === "admin" && <div className="dashboard"><div className="page-heading"><div><p className="eyebrow">SECURE ADMIN CONSOLE</p><h2>User access management</h2><p>Grant free access, exempt billing, suspend accounts, and manage administrators.</p></div></div><section className="admin-toolbar"><input className="text-input" placeholder="Search name or email" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} /><button className="outline" onClick={() => loadAdminUsers()}>Search</button></section>{accountStatus && <p className="checkout-note">{accountStatus}</p>}<div className="admin-list">{adminUsers.map((account) => <article className="admin-user" key={account.id}><div><strong>{account.name}</strong><small>{account.email}{account.phone ? ` · ${account.phone}` : ""}</small></div><div className="access-badges"><span>{account.role}</span><span>{account.access_status}</span>{Boolean(account.billing_exempt) && <span>billing exempt</span>}</div><div className="admin-actions"><button onClick={() => adminAction(account.id, account.access_status === "complimentary" ? "revoke_complimentary" : "grant_complimentary")}>{account.access_status === "complimentary" ? "Remove free access" : "Give free access"}</button><button onClick={() => adminAction(account.id, account.billing_exempt ? "billing_required" : "billing_exempt")}>{account.billing_exempt ? "Require payment" : "Turn off payment"}</button><button onClick={() => adminAction(account.id, account.access_status === "suspended" ? "activate" : "suspend")}>{account.access_status === "suspended" ? "Reactivate" : "Suspend"}</button><button onClick={() => adminAction(account.id, account.role === "admin" ? "remove_admin" : "make_admin")}>{account.role === "admin" ? "Remove admin" : "Make admin"}</button></div></article>)}</div>{adminUsers.length === 0 && <p className="empty-state">No users to show yet. Search or wait for the first signup.</p>}</div>}

    {view === "plans" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">SIMPLE PRICING</p><h2>Try everything free for 30 days.</h2><p>Secure checkout is handled by Stripe. Cancel any time before the trial ends.</p></div></div><div className="pricing-grid"><article className="price-card"><span>MONTHLY</span><h3><b>$10</b> / month</h3><p>Flexible month-to-month access.</p><button disabled={billingBusy} onClick={() => openBilling("checkout", "monthly")}>{billingBusy ? "Opening secure checkout…" : "Start 30-day trial"}</button></article><article className="price-card featured"><span>BEST VALUE · SAVE $21</span><h3><b>$99</b> / year</h3><p>Everything included, billed annually after your trial.</p><button disabled={billingBusy} onClick={() => openBilling("checkout", "yearly")}>{billingBusy ? "Opening secure checkout…" : "Start 30-day trial"}</button></article></div>{accountStatus && <p className="checkout-note">{accountStatus}</p>}<button className="outline back-button" onClick={() => setView("account")}>← Back to account</button></div>}

    {ratingMeal && <div className="modal-backdrop" onClick={() => setRatingMeal(null)}><section className="rating-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close icon-centered" onClick={() => setRatingMeal(null)}>×</button><span className="mini-label">RATE THIS RECIPE</span><h3>{ratingMeal.title}</h3><label>Meal quality</label><Stars label="Meal quality" value={ratings[ratingMeal.id]?.quality || 0} onChange={(quality) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality, ease: current[ratingMeal.id]?.ease || 0 } }))} /><label>Ease of preparation</label><Stars label="Ease of preparation" value={ratings[ratingMeal.id]?.ease || 0} onChange={(ease) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality: current[ratingMeal.id]?.quality || 0, ease } }))} /><button className="primary" disabled={!ratings[ratingMeal.id]?.quality || !ratings[ratingMeal.id]?.ease} onClick={() => saveRating(ratingMeal, ratings[ratingMeal.id])}>Save rating</button></section></div>}

    <footer className="site-footer"><span>Grocer•Eaze</span><p>Plan less. Eat well.</p><div><button onClick={() => setView("plans")}>Plans</button><button onClick={() => setView("account")}>Privacy & security</button><a href="https://spoonacular.com/food-api" target="_blank" rel="noreferrer">Recipe sources</a></div></footer>
  </main>;
}
