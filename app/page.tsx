"use client";

import { useEffect, useMemo, useState } from "react";

type Meal = {
  id: string; day: string; date: string; kind: string; title: string; detail: string;
  time: string; cost: string; tone: string; emoji: string; sourceUrl?: string;
};
type Member = { id: string; name: string; role: string; allergies: string; preferences?: { glutenFree?: boolean; lowDairy?: boolean; kidFriendly?: boolean } };
type Rating = { quality: number; ease: number };
type LocationResult = { label: string; lat?: string; lon?: string };

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
  const [view, setView] = useState<"plan" | "meals" | "list" | "account" | "family" | "plans">("plan");
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

  const estimated = useMemo(() => Math.round(people * (range === "Day" ? 9 : range === "Week" ? 27 : 104)), [people, range]);
  const lunchCount = kidLunches && mealType !== "Dinner only" ? 5 : 0;

  useEffect(() => {
    let id = window.localStorage.getItem("grocer-eaze-owner");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("grocer-eaze-owner", id); }
    setOwnerId(id);
    Promise.all([
      fetch("/api/profile", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/favorites", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/family", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
      fetch("/api/ratings", { headers: { "x-grocer-owner": id } }).then((r) => r.json()),
    ]).then(([profileData, favoriteData, familyData, ratingData]) => {
      if (profileData.profile) {
        setHousehold(profileData.profile.household_name); setPeople(profileData.profile.people);
        setLocation(profileData.profile.location); setLocationQuery(profileData.profile.location);
      }
      if (favoriteData.favorites) setFavorites(favoriteData.favorites.map((recipe: { title: string }) => recipe.title));
      if (familyData.members) setMembers(familyData.members);
      if (ratingData.ratings) setRatings(Object.fromEntries(ratingData.ratings.map((r: { recipe_id: string; quality: number; ease: number }) => [r.recipe_id, { quality: r.quality, ease: r.ease }])));
    }).catch(() => undefined);
  }, []);

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
    return {
      id: String(recipe.id || `recipe-${index}`), day: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][index % 7],
      date: String(12 + (index % 7)), kind, title: String(recipe.title),
      detail: `from ${String(recipe.sourceName || "a trusted recipe source")}`,
      time: `${Number(recipe.readyInMinutes || 35)} min`, cost: `$${((Number(recipe.pricePerServing || 420)) / 100).toFixed(2)} / serving`,
      tone: ["salmon", "gold", "green", "blue"][index % 4], emoji: kind.includes("lunch") ? "🍱" : ["🥗", "🍲", "🐟", "🍅"][index % 4],
      sourceUrl: String(recipe.sourceUrl || ""),
    };
  }

  async function generatePlan(queryOverride?: string) {
    setPlanning(true);
    const minutes = maxTime.match(/\d+/)?.[0] || "45";
    const dinnerQuery = queryOverride || `${mediterranean ? "Mediterranean " : ""}family dinner ${exclusions ? `without ${exclusions}` : ""}`;
    try {
      const requests = [fetch(`/api/recipes/search?${new URLSearchParams({ q: dinnerQuery, maxTime: minutes, glutenFree: String(glutenFree) })}`)];
      if (kidLunches && mealType !== "Dinner only") requests.push(fetch(`/api/recipes/search?${new URLSearchParams({ q: `school lunch box kid friendly weekday ${exclusions ? `without ${exclusions}` : ""}`, maxTime: "20", glutenFree: String(glutenFree) })}`));
      const responses = await Promise.all(requests);
      const dinnerData = await responses[0].json();
      const lunchData = responses[1] ? await responses[1].json() : { recipes: [] };
      const dinners = (dinnerData.recipes || []).slice(0, range === "Day" ? 1 : 7).map((r: Record<string, unknown>, i: number) => mapRecipe(r, i));
      const lunches = (lunchData.recipes || []).slice(0, range === "Day" ? 1 : 5).map((r: Record<string, unknown>, i: number) => mapRecipe(r, i, "School lunch"));
      if (dinners.length) setPlannedMeals([...dinners, ...lunches].sort((a, b) => a.day.localeCompare(b.day)));
      if (ownerId) await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ householdName: household, people, location, preferences: { range, mealType, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, maxTime, skill, exclusions } }) });
      setSimilarTo(queryOverride || ""); setView("meals"); window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setPlanning(false); }
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
      </nav>
      <button className="avatar" aria-label="Open profile" onClick={() => setView("account")}>TR</button>
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
      <div className="page-heading"><div><p className="eyebrow">{people} PEOPLE · {household.toUpperCase()} · {location.toUpperCase()}</p><h2>{similarTo ? `More like ${similarTo}.` : "Your week is ready."}</h2><p>{glutenFree ? "Gluten-free · " : ""}{mediterranean ? "Mediterranean · " : ""}{lowDairy ? "Low dairy · " : ""}max {maxTime.toLowerCase()}</p></div><button className="outline" onClick={() => setView("plan")}>Adjust plan</button></div>
      <div className="summary-strip"><div><span>{Math.min(7, plannedMeals.filter((m) => m.kind === "Dinner").length)}</span><small>dinners</small></div><div><span>{lunchCount}</span><small>school lunches</small></div><div><span>{leftovers ? 3 : 0}</span><small>leftover nights</small></div><div className="total"><small>estimated total</small><span>${Math.min(Math.max(budget - 8, 50), estimated)}</span><em>${budget >= 500 ? "500+" : budget} budget</em></div></div>
      {kidLunches && mealType !== "Dinner only" && <section className="lunch-banner"><div className="icon-centered">🍱</div><div><strong>Monday–Friday school lunches are covered</strong><p>Packable in 20 minutes or less, allergy-aware, and balanced for kids.</p></div><span>5 weekday lunches</span></section>}
      <div className="meal-grid">{plannedMeals.map((meal) => <article className="meal-card" key={`${meal.id}-${meal.kind}`}>
        <div className="date"><strong>{meal.day}</strong><span>{meal.date}</span></div><div className={`meal-art ${meal.tone}`}><span>{meal.emoji}</span><small>{meal.kind}</small></div>
        <div className="meal-copy"><p>{meal.kind.toUpperCase()}</p><h3>{meal.title}</h3><span>{meal.detail}</span><footer><small>◷ {meal.time}</small><small>{meal.cost}</small>{ratings[meal.id] && <small>★ {ratings[meal.id].quality}/5 quality · {ratings[meal.id].ease}/5 ease</small>}</footer><div className="recipe-actions"><button onClick={() => setRatingMeal(meal)}>Rate</button><button onClick={() => generatePlan(meal.title)}>Find similar</button>{meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer">Recipe ↗</a>}</div></div>
        <button className={`favorite icon-centered ${favorites.includes(meal.title) ? "saved" : ""}`} onClick={() => toggleFavorite(meal)} aria-label={`${favorites.includes(meal.title) ? "Remove" : "Add"} favorite`}>{favorites.includes(meal.title) ? "♥" : "♡"}</button>
      </article>)}</div>
      <div className="action-bar"><p><strong>Looks good?</strong> Your ingredients are combined and sorted by store.</p><button className="primary compact" onClick={() => setView("list")}>Review grocery list →</button></div>
    </div>}

    {view === "list" && <div className="dashboard"><div className="page-heading"><div><p className="eyebrow">GROCERIES · THIS PLAN</p><h2>Everything you need, sorted.</h2><p>Quantities are adjusted for {people} people near {location}.</p></div><button className="outline" onClick={() => setView("meals")}>← Back to meals</button></div><div className="list-layout"><section className="grocery-panel"><div className="store-compare"><span className="mini-label">COMPARE NEARBY STORES</span><div>{[["Whole Foods", "$94", "24/27 items"], ["Jewel-Osco", "$88", "26/27 items"], ["Trader Joe’s", "$81", "21/27 items"]].map(([store, price, stock]) => <button key={store} className={selectedStore === store ? "selected-store" : ""} onClick={() => setSelectedStore(store)}><strong>{store}</strong><span>{price}</span><small>{stock}</small></button>)}</div></div><div className="grocery-head"><strong>{selectedStore}</strong><span>Best-fit list · price estimate</span></div>{groceryGroups.map((group) => <details open key={group.title}><summary><span>{group.icon} {group.title}</span><small>{group.count} items</small></summary><div className="checklist">{group.items.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span><em>1</em></label>)}</div></details>)}</section><aside className="export-panel"><span className="mini-label">READY WHEN YOU ARE</span><h3>Take your plan with you</h3><p>Send lists, recipes, and reminders where you already use them.</p><button onClick={copyForReminders}><span className="icon-centered">✓</span><div><strong>Apple Reminders</strong><small>Copy this grocery list</small></div><b>Copy</b></button><button onClick={downloadCalendar}><span className="icon-centered">31</span><div><strong>Google or Apple Calendar</strong><small>Import daily recipes</small></div><b>Export</b></button><div className="email-export"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /><button onClick={emailRecipes}><span className="icon-centered">@</span><div><strong>Email me recipes</strong><small>Send the complete plan</small></div><b>Email</b></button></div>{exportStatus && <p className="export-status">{exportStatus}</p>}</aside></div></div>}

    {view === "family" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">HOUSEHOLD PREFERENCES</p><h2>Your family, thoughtfully fed.</h2><p>Each person’s allergies and preferences shape every recommendation.</p></div></div><div className="family-grid"><section className="settings-card"><h3>Family members</h3>{members.length === 0 && <p className="empty-state">No family members yet. Add the first person below.</p>}{members.map((member) => <article className="member-card" key={member.id}><span className="member-avatar icon-centered">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.role} · {member.allergies || "No listed allergies"}</small><p>{member.preferences?.glutenFree ? "Gluten-free · " : ""}{member.preferences?.lowDairy ? "Low dairy · " : ""}{member.preferences?.kidFriendly ? "Kid-friendly" : ""}</p></div><button onClick={() => deleteMember(member.id)} aria-label={`Remove ${member.name}`}>×</button></article>)}</section><section className="settings-card"><h3>Add a family member</h3><div className="field"><label>Name</label><input className="text-input" value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} /></div><div className="field"><label>Role</label><select value={memberDraft.role} onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value })}><option>Adult</option><option>Teen</option><option>Child</option></select></div><div className="field"><label>Allergies / avoid</label><input className="text-input" placeholder="Peanuts, shellfish…" value={memberDraft.allergies} onChange={(e) => setMemberDraft({ ...memberDraft, allergies: e.target.value })} /></div><Toggle label="Gluten-free" checked={memberDraft.glutenFree} onChange={() => setMemberDraft({ ...memberDraft, glutenFree: !memberDraft.glutenFree })} /><Toggle label="Low dairy" checked={memberDraft.lowDairy} onChange={() => setMemberDraft({ ...memberDraft, lowDairy: !memberDraft.lowDairy })} /><Toggle label="Kid-friendly" checked={memberDraft.kidFriendly} onChange={() => setMemberDraft({ ...memberDraft, kidFriendly: !memberDraft.kidFriendly })} /><button className="primary" onClick={addMember}>Add family member</button></section></div></div>}

    {view === "account" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">PROFILE & SECURITY</p><h2>Account management</h2><p>Control your household, privacy, and plan.</p></div></div><div className="settings-stack"><section className="settings-card"><h3>Profile</h3><div className="two-col"><div className="field"><label>Household name</label><input className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /></div><div className="field"><label>Email for recipes</label><input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div></div><button className="outline" onClick={async () => { await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ householdName: household, people, location, preferences: {} }) }); setAccountStatus("Profile saved."); }}>Save profile</button>{accountStatus && <span className="success-note">{accountStatus}</span>}</section><section className="settings-card security-card"><div className="icon-centered">🔒</div><div><h3>Security</h3><p>Your profile, family preferences, favorites, and ratings are stored separately under your private household identifier. API keys never reach your browser.</p></div></section><section className="settings-card plan-row"><div><span className="mini-label">CURRENT PLAN</span><h3>30-day free trial</h3><p>Choose monthly or yearly billing. You won’t be charged until the trial ends.</p></div><button className="primary compact" onClick={() => setView("plans")}>View plans</button></section><section className="settings-card danger-zone"><h3>Account controls</h3><button className="outline" onClick={() => { window.localStorage.removeItem("grocer-eaze-owner"); window.location.reload(); }}>Sign out of this device</button></section></div></div>}

    {view === "plans" && <div className="dashboard narrow"><div className="page-heading"><div><p className="eyebrow">SIMPLE PRICING</p><h2>Try everything free for 30 days.</h2><p>Cancel any time before the trial ends.</p></div></div><div className="pricing-grid"><article className="price-card"><span>MONTHLY</span><h3><b>$10</b> / month</h3><p>Flexible month-to-month access.</p><button onClick={() => setAccountStatus("Monthly plan selected. Secure checkout will open when payments are connected.")}>Start 30-day trial</button></article><article className="price-card featured"><span>BEST VALUE · SAVE $21</span><h3><b>$99</b> / year</h3><p>Everything included, billed annually after your trial.</p><button onClick={() => setAccountStatus("Yearly plan selected. Secure checkout will open when payments are connected.")}>Start 30-day trial</button></article></div>{accountStatus && <p className="checkout-note">{accountStatus}</p>}<button className="outline back-button" onClick={() => setView("account")}>← Back to account</button></div>}

    {ratingMeal && <div className="modal-backdrop" onClick={() => setRatingMeal(null)}><section className="rating-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close icon-centered" onClick={() => setRatingMeal(null)}>×</button><span className="mini-label">RATE THIS RECIPE</span><h3>{ratingMeal.title}</h3><label>Meal quality</label><Stars label="Meal quality" value={ratings[ratingMeal.id]?.quality || 0} onChange={(quality) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality, ease: current[ratingMeal.id]?.ease || 0 } }))} /><label>Ease of preparation</label><Stars label="Ease of preparation" value={ratings[ratingMeal.id]?.ease || 0} onChange={(ease) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality: current[ratingMeal.id]?.quality || 0, ease } }))} /><button className="primary" disabled={!ratings[ratingMeal.id]?.quality || !ratings[ratingMeal.id]?.ease} onClick={() => saveRating(ratingMeal, ratings[ratingMeal.id])}>Save rating</button></section></div>}

    <footer className="site-footer"><span>Grocer•Eaze</span><p>Plan less. Eat well.</p><div><button onClick={() => setView("plans")}>Plans</button><button onClick={() => setView("account")}>Privacy & security</button><a href="https://spoonacular.com/food-api" target="_blank" rel="noreferrer">Recipe sources</a></div></footer>
  </main>;
}
