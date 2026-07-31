"use client";

import { useEffect, useMemo, useState } from "react";

const meals = [
  {
    id: "demo-salmon",
    day: "MON",
    date: "12",
    kind: "Dinner",
    title: "Lemon Herb Salmon",
    detail: "with roasted asparagus & quinoa",
    time: "35 min",
    cost: "$4.80 / serving",
    tone: "salmon",
    emoji: "🐟",
  },
  {
    id: "demo-hummus",
    day: "TUE",
    date: "13",
    kind: "Lunch",
    title: "Rainbow Hummus Box",
    detail: "kid-friendly · pack in 10 minutes",
    time: "10 min",
    cost: "$2.40 / serving",
    tone: "gold",
    emoji: "🥕",
  },
  {
    id: "demo-beans",
    day: "TUE",
    date: "13",
    kind: "Dinner",
    title: "Tuscan White Bean Skillet",
    detail: "with spinach, tomatoes & herbs",
    time: "30 min",
    cost: "$3.10 / serving",
    tone: "green",
    emoji: "🍅",
  },
  {
    id: "demo-souvlaki",
    day: "WED",
    date: "14",
    kind: "Dinner",
    title: "Chicken Souvlaki Bowls",
    detail: "with cucumber salad & dairy-free tzatziki",
    time: "40 min",
    cost: "$4.25 / serving",
    tone: "blue",
    emoji: "🥗",
  },
];

const groceryGroups = [
  { icon: "🥬", title: "Produce", count: 12, items: ["Asparagus", "Baby spinach", "Cherry tomatoes", "Cucumbers"] },
  { icon: "🐟", title: "Meat & seafood", count: 3, items: ["Salmon fillets", "Chicken breast", "Eggs"] },
  { icon: "🥫", title: "Pantry", count: 8, items: ["Quinoa", "White beans", "Hummus", "Olive oil"] },
  { icon: "🧊", title: "Refrigerated", count: 4, items: ["Oat yogurt", "Feta alternative", "Almond milk"] },
];

function Toggle({
  label,
  checked,
  onChange,
  note,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  note?: string;
}) {
  return (
    <button className="toggle-row" onClick={onChange} type="button" aria-pressed={checked}>
      <span>
        <strong>{label}</strong>
        {note && <small>{note}</small>}
      </span>
      <span className={`toggle ${checked ? "on" : ""}`}><i /></span>
    </button>
  );
}

export default function Home() {
  const [view, setView] = useState<"plan" | "meals" | "list">("plan");
  const [range, setRange] = useState("Week");
  const [mealType, setMealType] = useState("Lunch + dinner");
  const [people, setPeople] = useState(4);
  const [budget, setBudget] = useState(135);
  const [leftovers, setLeftovers] = useState(true);
  const [glutenFree, setGlutenFree] = useState(true);
  const [lowDairy, setLowDairy] = useState(true);
  const [mediterranean, setMediterranean] = useState(true);
  const [kidLunches, setKidLunches] = useState(true);
  const [oneStore, setOneStore] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [household, setHousehold] = useState("The Rudd household");
  const [maxTime, setMaxTime] = useState("45 minutes");
  const [skill, setSkill] = useState("Comfortable");
  const [exclusions, setExclusions] = useState("Tree nuts");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState("Whole Foods");
  const [exportStatus, setExportStatus] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [plannedMeals, setPlannedMeals] = useState(meals);
  const [planning, setPlanning] = useState(false);
  const [email, setEmail] = useState("");

  const estimated = useMemo(() => Math.round(people * (range === "Day" ? 9 : range === "Week" ? 27 : 104)), [people, range]);

  useEffect(() => {
    let id = window.localStorage.getItem("grocer-eaze-owner");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("grocer-eaze-owner", id);
    }
    setOwnerId(id);
    Promise.all([
      fetch("/api/profile", { headers: { "x-grocer-owner": id } }).then((response) => response.json()),
      fetch("/api/favorites", { headers: { "x-grocer-owner": id } }).then((response) => response.json()),
    ]).then(([profileData, favoriteData]) => {
      if (profileData.profile) {
        setHousehold(profileData.profile.household_name);
        setPeople(profileData.profile.people);
      }
      if (favoriteData.favorites) setFavorites(favoriteData.favorites.map((recipe: { title: string }) => recipe.title));
    }).catch(() => undefined);
  }, []);

  async function generatePlan() {
    setPlanning(true);
    const minutes = maxTime.match(/\d+/)?.[0] || "45";
    const params = new URLSearchParams({ q: `${mediterranean ? "Mediterranean " : ""}${mealType.toLowerCase()}`, maxTime: minutes });
    try {
      const [searchResponse] = await Promise.all([
        fetch(`/api/recipes/search?${params}`),
        ownerId ? fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId },
          body: JSON.stringify({ householdName: household, people, location: "Uptown, Chicago, IL", preferences: { range, mealType, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, maxTime, skill, exclusions } }),
        }) : Promise.resolve(null),
      ]);
      const data = await searchResponse.json();
      if (data.recipes?.length) {
        setPlannedMeals(data.recipes.slice(0, 7).map((recipe: Record<string, unknown>, index: number) => ({
          id: String(recipe.id || `recipe-${index}`),
          day: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][index],
          date: String(12 + index),
          kind: index === 1 && mealType !== "Dinner only" ? "Lunch" : "Dinner",
          title: String(recipe.title),
          detail: `from ${String(recipe.sourceName || "a trusted recipe source")}`,
          time: `${Number(recipe.readyInMinutes || 35)} min`,
          cost: `$${((Number(recipe.pricePerServing || 420)) / 100).toFixed(2)} / serving`,
          tone: ["salmon", "gold", "green", "blue"][index % 4],
          emoji: ["🥗", "🍲", "🐟", "🍅"][index % 4],
          sourceUrl: String(recipe.sourceUrl || ""),
        })));
      }
      setGenerated(true);
      setView("meals");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPlanning(false);
    }
  }

  async function toggleFavorite(meal: (typeof plannedMeals)[number]) {
    const isSaved = favorites.includes(meal.title);
    setFavorites((current) => isSaved ? current.filter((item) => item !== meal.title) : [...current, meal.title]);
    if (!ownerId) return;
    await fetch(`/api/favorites${isSaved ? `?recipeId=${encodeURIComponent(meal.id)}` : ""}`, {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId },
      body: isSaved ? undefined : JSON.stringify(meal),
    });
  }

  function groceryText() {
    return `Groceries, May 12–18\n\n${groceryGroups.map((group) => `${group.title}\n${group.items.map((item) => `• ${item}`).join("\n")}`).join("\n\n")}`;
  }

  async function copyForReminders() {
    await navigator.clipboard.writeText(groceryText());
    setExportStatus("Grocery list copied — paste it into Apple Reminders.");
  }

  function downloadCalendar() {
    const events = plannedMeals.map((meal, index) => `BEGIN:VEVENT\r\nUID:grocer-eaze-${index}@grocer-eaze\r\nDTSTART:202605${String(12 + index).padStart(2, "0")}T173000\r\nDTEND:202605${String(12 + index).padStart(2, "0")}T183000\r\nSUMMARY:${meal.title}\r\nDESCRIPTION:${meal.detail} (${meal.time})\r\nEND:VEVENT`).join("\r\n");
    const file = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Grocer-Eaze//Meal Plan//EN\r\n${events}\r\nEND:VCALENDAR`], { type: "text/calendar" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "grocer-eaze-meal-plan.ics";
    link.click();
    URL.revokeObjectURL(link.href);
    setExportStatus("Calendar file downloaded.");
  }

  async function emailRecipes() {
    const subject = encodeURIComponent("My Grocer-Eaze recipes · May 12–18");
    const body = encodeURIComponent(plannedMeals.map((meal) => `${meal.day}: ${meal.title}\n${meal.detail}`).join("\n\n"));
    if (email) {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId },
        body: JSON.stringify({
          to: email,
          subject: "My Grocer-Eaze recipes · May 12–18",
          html: `<h1>Your Grocer-Eaze meal plan</h1>${plannedMeals.map((meal) => `<h2>${meal.day}: ${meal.title}</h2><p>${meal.detail} · ${meal.time}</p>`).join("")}`,
        }),
      });
      if (response.ok) {
        setExportStatus(`Recipes sent to ${email}.`);
        return;
      }
      setExportStatus("Automatic delivery needs the email service key; opening your email app instead.");
    }
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setExportStatus("Opening your email app.");
  }

  return (
    <main>
      <header>
        <a className="brand" href="#" onClick={() => setView("plan")}>
          <span className="brand-mark">g</span>
          <span>Grocer<span>•</span>Eaze</span>
        </a>
        <nav aria-label="Primary navigation">
          <button className={view === "plan" ? "active" : ""} onClick={() => setView("plan")}>Plan</button>
          <button className={view === "meals" ? "active" : ""} onClick={() => setView("meals")}>My meals</button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Grocery list</button>
        </nav>
        <button className="avatar" aria-label="Open profile">TR</button>
      </header>

      {view === "plan" && (
        <div className="shell">
          <section className="hero">
            <p className="eyebrow">MEAL PLANNING, MADE HUMAN</p>
            <h1>Good food. Less fuss.<br /><em>One easy plan.</em></h1>
            <p className="lede">Tell us what works for your household. We’ll find recipes, balance your week, and turn it all into one tidy grocery list.</p>
            <div className="trust-row">
              <span><b>✓</b> Gluten-free first</span>
              <span><b>✓</b> Budget aware</span>
              <span><b>✓</b> Real-life friendly</span>
            </div>
          </section>

          <section className="planner">
            <div className="planner-top">
              <div><span>1</span><strong>Build your plan</strong></div>
              <p>About 60 seconds</p>
            </div>

            <div className="field">
              <label>How far ahead?</label>
              <div className="segmented">
                {["Day", "Week", "Month"].map((item) => (
                  <button key={item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>
                ))}
              </div>
            </div>

            <div className="two-col">
              <div className="field">
                <label>Meals to plan</label>
                <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                  <option>Lunch + dinner</option>
                  <option>Dinner only</option>
                </select>
              </div>
              <div className="field">
                <label>People</label>
                <div className="stepper">
                  <button onClick={() => setPeople(Math.max(1, people - 1))}>−</button>
                  <strong>{people}</strong>
                  <button onClick={() => setPeople(Math.min(12, people + 1))}>+</button>
                </div>
              </div>
            </div>

            <div className="field">
              <label>Household profile</label>
              <input className="text-input" value={household} onChange={(event) => setHousehold(event.target.value)} aria-label="Household profile name" />
              <small className="field-help">Save different preferences for family members or households later.</small>
            </div>

            <div className="two-col">
              <div className="field">
                <label>Maximum cook time</label>
                <select value={maxTime} onChange={(event) => setMaxTime(event.target.value)}>
                  <option>20 minutes</option><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option>
                </select>
              </div>
              <div className="field">
                <label>Cooking comfort</label>
                <select value={skill} onChange={(event) => setSkill(event.target.value)}>
                  <option>Keep it simple</option><option>Comfortable</option><option>Adventurous</option>
                </select>
              </div>
            </div>

            <div className="field">
              <div className="label-line"><label>Weekly grocery budget</label><strong>${budget}</strong></div>
              <input aria-label="Weekly grocery budget" type="range" min="50" max="300" step="5" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
              <div className="range-labels"><span>$50</span><span>$300+</span></div>
            </div>

            <div className="option-grid">
              <Toggle label="Plan for leftovers" checked={leftovers} onChange={() => setLeftovers(!leftovers)} note="Cook once, eat twice" />
              <Toggle label="Kid-friendly lunches" checked={kidLunches} onChange={() => setKidLunches(!kidLunches)} note="School days only" />
              <Toggle label="Gluten-free" checked={glutenFree} onChange={() => setGlutenFree(!glutenFree)} />
              <Toggle label="Low dairy" checked={lowDairy} onChange={() => setLowDairy(!lowDairy)} />
              <Toggle label="Mediterranean" checked={mediterranean} onChange={() => setMediterranean(!mediterranean)} />
              <Toggle label="One store only" checked={oneStore} onChange={() => setOneStore(!oneStore)} />
            </div>

            <div className="field">
              <label>Allergies or ingredients to avoid</label>
              <input className="text-input" placeholder="e.g. shellfish, peanuts, mushrooms" value={exclusions} onChange={(event) => setExclusions(event.target.value)} />
              <small className="field-help">We’ll exclude these from recipe results and suggested substitutions.</small>
            </div>

            <div className="store-row">
              <span className="pin">⌖</span>
              <div><small>SHOPPING NEAR</small><strong>Evanston, IL</strong></div>
              <button>Change</button>
            </div>

            <button className="primary" onClick={generatePlan}>
              {planning ? "Finding the best recipes…" : "Make my meal plan"} <span>→</span>
            </button>
            <p className="estimate">Estimated groceries: <strong>${estimated}–${Math.max(estimated + 18, budget)}</strong></p>
          </section>
        </div>
      )}

      {view === "meals" && (
        <div className="dashboard">
          <div className="page-heading">
            <div>
              <p className="eyebrow">MAY 12–18 · {people} PEOPLE · {household.toUpperCase()}</p>
              <h2>{generated ? "Your week is ready." : "A delicious week, already planned."}</h2>
              <p>Gluten-free · Mediterranean · Low dairy · max {maxTime.toLowerCase()} · avoids {exclusions || "selected allergens"}</p>
            </div>
            <button className="outline" onClick={() => setView("plan")}>Adjust plan</button>
          </div>
          <div className="summary-strip">
            <div><span>7</span><small>dinners</small></div>
            <div><span>{mealType === "Dinner only" ? "0" : "5"}</span><small>lunches</small></div>
            <div><span>3</span><small>leftover nights</small></div>
            <div className="total"><small>estimated total</small><span>${Math.min(budget - 8, estimated)}</span><em>${budget} budget</em></div>
          </div>
          <div className="meal-grid">
            {plannedMeals.map((meal, index) => (
              <article className="meal-card" key={`${meal.day}-${meal.kind}`}>
                <div className="date"><strong>{meal.day}</strong><span>{meal.date}</span></div>
                <div className={`meal-art ${meal.tone}`}><span>{meal.emoji}</span><small>{meal.kind}</small></div>
                <div className="meal-copy">
                  <p>{meal.kind.toUpperCase()}</p>
                  <h3>{meal.title}</h3>
                  <span>{meal.detail}</span>
                  <footer><small>◷ {meal.time}</small><small>{meal.cost}</small></footer>
                </div>
                <button className={`favorite ${favorites.includes(meal.title) ? "saved" : ""}`} onClick={() => toggleFavorite(meal)} aria-label={`${favorites.includes(meal.title) ? "Remove" : "Add"} ${meal.title} ${favorites.includes(meal.title) ? "from" : "to"} favorites`}>{favorites.includes(meal.title) ? "♥" : "♡"}</button>
                {index === 0 && <span className="source">from EatingWell ↗</span>}
              </article>
            ))}
          </div>
          <div className="action-bar">
            <p><strong>Looks good?</strong> We found 27 ingredients across 2 nearby stores.</p>
            <button className="primary compact" onClick={() => setView("list")}>Review grocery list →</button>
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="dashboard">
          <div className="page-heading">
            <div>
              <p className="eyebrow">GROCERIES · MAY 12–18</p>
              <h2>Everything you need, sorted.</h2>
              <p>Quantities are combined across recipes and adjusted for {people} people.</p>
            </div>
            <button className="outline" onClick={() => setView("meals")}>← Back to meals</button>
          </div>
          <div className="list-layout">
            <section className="grocery-panel">
              <div className="store-compare">
                <span className="mini-label">COMPARE NEARBY STORES</span>
                <div>
                  {[
                    ["Whole Foods", "$94", "24/27 items"],
                    ["Jewel-Osco", "$88", "26/27 items"],
                    ["Trader Joe’s", "$81", "21/27 items"],
                  ].map(([store, price, stock]) => (
                    <button key={store} className={selectedStore === store ? "selected-store" : ""} onClick={() => setSelectedStore(store)}>
                      <strong>{store}</strong><span>{price}</span><small>{stock}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grocery-head"><strong>{selectedStore}</strong><span>Best-fit list · price estimate</span></div>
              {groceryGroups.map((group) => (
                <details open key={group.title}>
                  <summary><span>{group.icon} {group.title}</span><small>{group.count} items</small></summary>
                  <div className="checklist">
                    {group.items.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span><em>1</em></label>)}
                  </div>
                </details>
              ))}
              <div className="substitutions">
                <strong>Smart substitutions</strong>
                <p><span>Greek yogurt</span><b>→</b><span>Plain oat yogurt</span><em>saves $1.20 · low dairy</em></p>
                <p><span>Couscous</span><b>→</b><span>Quinoa</span><em>gluten-free match</em></p>
              </div>
            </section>
            <aside className="export-panel">
              <span className="mini-label">READY WHEN YOU ARE</span>
              <h3>Take your plan with you</h3>
              <p>Connect your favorite services to send lists, recipes, and reminders where you already use them.</p>
              <button onClick={copyForReminders}><span>✓</span><div><strong>Apple Reminders</strong><small>Copy “Groceries, May 12–18”</small></div><b>Copy</b></button>
              <button onClick={downloadCalendar}><span>31</span><div><strong>Google Calendar</strong><small>Import daily recipes</small></div><b>Export</b></button>
              <button onClick={downloadCalendar}><span>⌘</span><div><strong>Apple Calendar</strong><small>Download calendar file</small></div><b>Export</b></button>
              <div className="email-export"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-label="Email address" /><button onClick={emailRecipes}><span>@</span><div><strong>Email me recipes</strong><small>{email ? `Send to ${email}` : "Open a ready-to-send email"}</small></div><b>Email</b></button></div>
              {exportStatus && <p className="export-status" role="status">{exportStatus}</p>}
              <div className="saving"><span>✓</span><p><strong>$18 under budget</strong><br /><small>Based on nearby store estimates</small></p></div>
            </aside>
          </div>
        </div>
      )}

      <footer className="site-footer">
        <span>Grocer•Eaze</span>
        <p>Plan less. Eat well.</p>
        <div><a href="#">How it works</a><a href="#">Privacy</a><a href="#">Recipe sources</a></div>
      </footer>
    </main>
  );
}
