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
type View = "plan" | "meals" | "list" | "account" | "family" | "plans" | "admin" | "accessibility";
type UndoAction = { message: string; restore: () => void };
type AccountUser = { id: string; name: string; email: string; phone: string; role: "user" | "admin"; accessStatus: string; complimentaryUntil: string | null; billingExempt: boolean; subscriptionStatus: string | null; subscriptionEndsAt: string | null; hasAccess: boolean };
type AdminUser = { id: string; name: string; email: string; phone: string; role: string; access_status: string; trial_ends_at?: string; complimentary_until?: string; billing_exempt: number };

const proteinOptions = ["Beef", "Pork", "Fish", "Shrimp"];
const storeNames = ["Whole Foods", "Jewel-Osco", "Trader Joe’s"];
const defaultRecipeFilters = { query: "", kind: "All meals", maxTime: "Any time", source: "All sources", protein: "All proteins", favoritesOnly: false };
const recipeBatchSize = 12;
const onboardingSteps = [
  { eyebrow: "STEP 1 OF 4", title: "Start with your household.", body: "Choose your dates, meals, budget, and dietary needs. Family preferences are included automatically." },
  { eyebrow: "STEP 2 OF 4", title: "Browse a catalog built for you.", body: "Filter a large recipe collection, save favorites, and add each recipe to lunch, dinner, or school lunch." },
  { eyebrow: "STEP 3 OF 4", title: "Shape your schedule.", body: "Quick-fill open slots or reorder meals by date. Every change stays saved on this device." },
  { eyebrow: "STEP 4 OF 4", title: "Review once, then take it anywhere.", body: "Check merged ingredients and package notes before copying your list, emailing recipes, or exporting your calendar." },
];

function parseServingCost(meal: Meal) {
  return meal.pricePerServing || Number(meal.cost.match(/\$([\d.]+)/)?.[1] || 3.75);
}

function calendarStamp(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;
}

function calendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function todayInputDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function recipeThumbnail(meal: { title?: string; sourceUrl?: string; image?: string; id?: string }) {
  if (meal.image?.startsWith("/api/recipe-image?")) return meal.image;
  const isBackupRecipe = String(meal.id || "").startsWith("demo-");
  const params = new URLSearchParams({
    title: meal.title || "recipe",
    ...(!isBackupRecipe && meal.sourceUrl ? { source: meal.sourceUrl } : {}),
    ...(meal.image ? { fallback: meal.image } : {}),
  });
  return `/api/recipe-image?${params}`;
}

function mealDateFor(kind: string, index: number, startDate?: string) {
  const date = startDate ? new Date(`${startDate}T12:00:00`) : new Date();
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
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    sortOrder: date.getTime(),
  };
}

function Toggle({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: () => void; note?: string }) {
  return <button className="toggle-row" onClick={onChange} type="button" aria-pressed={checked}><span><strong>{label}</strong>{note && <small>{note}</small>}</span><span className={`toggle ${checked ? "on" : ""}`}><i /></span></button>;
}

function Stars({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return <div className="stars" role="group" aria-label={label}>{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-pressed={star === value} onClick={() => onChange(star)} aria-label={`${star} out of 5`}>{star <= value ? "★" : "☆"}</button>)}</div>;
}

export default function Home() {
  const [view, setView] = useState<View>("plan");
  const [range, setRange] = useState("Week");
  const [planStartDate, setPlanStartDate] = useState(todayInputDate);
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
  const [visibleRecipeCount, setVisibleRecipeCount] = useState(recipeBatchSize);
  const [catalogBeforeSimilar, setCatalogBeforeSimilar] = useState<Meal[] | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeNotice, setRecipeNotice] = useState("");
  const [plannerNotice, setPlannerNotice] = useState("");
  const [planHydrated, setPlanHydrated] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [calendarOrder, setCalendarOrder] = useState<"plan" | "random">("plan");
  const [draggedMealId, setDraggedMealId] = useState("");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [ingredientAdjustments, setIngredientAdjustments] = useState<Record<string, string>>({});
  const [reviewedPlanSignature, setReviewedPlanSignature] = useState("");
  const [familyStatus, setFamilyStatus] = useState("");
  const [recipeFilters, setRecipeFilters] = useState(defaultRecipeFilters);
  const [accessibilityFeedback, setAccessibilityFeedback] = useState({ name: "", email: "", details: "", website: "" });
  const [accessibilityStatus, setAccessibilityStatus] = useState("");
  const [accessibilityBusy, setAccessibilityBusy] = useState(false);

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
  const familyRuleDetails = useMemo(() => members.flatMap((member) => {
    const rules = [
      ...member.allergies.split(",").map((item) => item.trim()).filter(Boolean).map((item) => `Avoid ${item}`),
      ...(member.preferences?.avoidOnions ? ["Avoid onions"] : []),
      ...(member.preferences?.glutenFree ? ["Gluten-free required"] : []),
      ...(member.preferences?.lowDairy ? ["Low dairy preferred"] : []),
      ...(member.preferences?.kidFriendly ? ["Kid-friendly preferred"] : []),
      ...(member.preferences?.proteins || []).map((protein) => `${protein} favorite`),
    ];
    return rules.map((rule) => ({ member: member.name, rule }));
  }), [members]);
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
  const groceryEntries = useMemo(() => {
    const merged = new Map<string, { name: string; occurrences: number; originals: string[] }>();
    plannedMeals.flatMap((meal) => meal.ingredients || []).forEach((ingredient) => {
      const name = (ingredient.name || ingredient.original || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      const current = merged.get(key) || { name: name[0].toUpperCase() + name.slice(1), occurrences: 0, originals: [] };
      current.occurrences += 1;
      if (ingredient.original && !current.originals.includes(ingredient.original)) current.originals.push(ingredient.original);
      merged.set(key, current);
    });
    return [...merged.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => a.name.localeCompare(b.name));
  }, [plannedMeals]);
  const planSignature = useMemo(() => `${people}:${plannedMeals.map((meal) => meal.id).join("|")}`, [people, plannedMeals]);
  const ingredientsReviewed = Boolean(planSignature && reviewedPlanSignature === planSignature);
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
      && (!effectiveLowDairy || meal.tags?.includes("Low dairy"))
      && (!mediterranean || meal.tags?.includes("Mediterranean"))
      && (!recipeFilters.favoritesOnly || favorites.includes(meal.title));
  }), [recipeIdeas, recipeFilters, favorites, effectiveGlutenFree, effectiveLowDairy, mediterranean]);
  const visibleRecipeIdeas = filteredRecipeIdeas.slice(0, visibleRecipeCount);
  const recipeFiltersActive = recipeFilters.query !== ""
    || recipeFilters.kind !== defaultRecipeFilters.kind
    || recipeFilters.maxTime !== defaultRecipeFilters.maxTime
    || recipeFilters.source !== defaultRecipeFilters.source
    || recipeFilters.protein !== defaultRecipeFilters.protein
    || recipeFilters.favoritesOnly;
  const shortLocation = location.split(",").slice(0, 2).join(",").trim() || location;

  useEffect(() => {
    let id = window.localStorage.getItem("grocer-eaze-owner");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("grocer-eaze-owner", id); }
    const cachedPlan = window.localStorage.getItem("grocer-eaze-active-plan");
    const onboardingComplete = window.localStorage.getItem("grocer-eaze-onboarding-complete") === "true";
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
          if (preferences.planStartDate) setPlanStartDate(preferences.planStartDate);
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
      const requestedView = window.location.hash.replace("#", "") as View;
      if (["meals", "list"].includes(requestedView) && !authData.user?.hasAccess) {
        const destination: View = authData.user ? "plans" : "account";
        setView(destination);
        window.history.replaceState(null, "", `#${destination}`);
        setAccountStatus(authData.user ? "Choose a membership to unlock meal planning and exports." : "Sign in before using meal planning tools.");
      }
      setAuthLoaded(true);
      if (cachedPlan) {
        try {
          const saved = JSON.parse(cachedPlan);
          if (Array.isArray(saved.plannedMeals)) setPlannedMeals(saved.plannedMeals.map((meal: Meal) => ({ ...meal, image: recipeThumbnail(meal) })));
          if (Array.isArray(saved.recipeIdeas)) setRecipeIdeas(saved.recipeIdeas.map((meal: Meal) => ({ ...meal, image: recipeThumbnail(meal) })));
          if (saved.range) setRange(saved.range);
          if (saved.planStartDate) setPlanStartDate(saved.planStartDate);
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
      if (!onboardingComplete) setOnboardingStep(0);
    }).catch(() => {
      const requestedView = window.location.hash.replace("#", "") as View;
      if (["meals", "list"].includes(requestedView)) {
        setView("account");
        window.history.replaceState(null, "", "#account");
        setAccountStatus("Sign in before using meal planning tools.");
      }
      setAuthLoaded(true);
      setPlanHydrated(true);
      if (!onboardingComplete) setOnboardingStep(0);
    });
  }, []);

  useEffect(() => {
    if (!planHydrated) return;
    try {
      window.localStorage.setItem("grocer-eaze-active-plan", JSON.stringify({
        plannedMeals,
        recipeIdeas: recipeIdeas.slice(0, 90),
        range, planStartDate, mealType, people, budget, leftovers, glutenFree, lowDairy, mediterranean,
        kidLunches, oneStore, selectedStore, household, maxTime, skill, exclusions, location, calendarOrder,
      }));
    } catch { /* Device storage can be unavailable in private browsing. */ }
  }, [planHydrated, plannedMeals, recipeIdeas, range, planStartDate, mealType, people, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, selectedStore, household, maxTime, skill, exclusions, location, calendarOrder]);

  useEffect(() => {
    if (!undoAction) return;
    const timer = window.setTimeout(() => setUndoAction(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undoAction]);

  useEffect(() => {
    const validViews: View[] = ["plan", "meals", "list", "account", "family", "plans", "admin", "accessibility"];
    const syncViewFromUrl = () => {
      const nextView = window.location.hash.replace("#", "") as View;
      if (validViews.includes(nextView)) {
        setView(nextView);
        window.scrollTo({ top: 0 });
      }
    };
    syncViewFromUrl();
    window.addEventListener("popstate", syncViewFromUrl);
    window.addEventListener("hashchange", syncViewFromUrl);
    return () => {
      window.removeEventListener("popstate", syncViewFromUrl);
      window.removeEventListener("hashchange", syncViewFromUrl);
    };
  }, []);

  useEffect(() => {
    const titles: Record<View, string> = {
      plan: "Plan meals",
      meals: "Recipe catalog",
      list: "Grocery list",
      account: "Account",
      family: "Family preferences",
      plans: "Membership plans",
      admin: "Admin",
      accessibility: "Accessibility",
    };
    document.title = `${titles[view]} | Grocer-Eaze`;
  }, [view]);

  useEffect(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(document.querySelectorAll<HTMLElement>("header, main, footer"));
    const previousAriaHidden = backgroundElements.map((element) => element.getAttribute("aria-hidden"));
    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
    dialog.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (ratingMeal) setRatingMeal(null);
        else finishOnboarding();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element, index) => {
        element.removeAttribute("inert");
        const previousValue = previousAriaHidden[index];
        if (previousValue === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", previousValue);
      });
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onboardingStep, ratingMeal]);

  async function startAuth() {
    setAuthBusy(true); setAccountStatus("");
    if (!authForm.name.trim()) { setAuthBusy(false); setAccountStatus("Enter your name to continue."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authForm.email.trim())) { setAuthBusy(false); setAccountStatus("Enter a valid email address to continue."); return; }
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
    const me = await fetch("/api/auth/me").then((r) => r.json()); setUser(me.user); setEmail(me.user.email); setAccountStatus("Your secure account is ready. Choose a plan to start your free trial.");
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
    if (!user) { navigateTo("account"); setAccountStatus("Create or sign in to your account before choosing a plan."); return; }
    setBillingBusy(true); setAccountStatus("");
    const result = await fetch(`/api/billing/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan ? { plan } : {}) });
    const data = await result.json(); setBillingBusy(false);
    if (!result.ok) { setAccountStatus(data.error || "Billing is temporarily unavailable."); return; }
    window.location.href = data.url;
  }

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 2 || query === location) {
      const clearTimer = window.setTimeout(() => setLocationResults([]), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        const results = data.results || [];
        setLocationResults(results);
        setLocationStatus(results.length ? "Choose a suggested location." : "No location matches yet. Try a neighborhood, city, or ZIP.");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setLocationStatus("Location search is temporarily unavailable.");
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locationQuery, location]);

  function mapRecipe(recipe: Record<string, unknown>, index: number, kind = "Dinner"): Meal {
    const scheduled = mealDateFor(kind, index, planStartDate);
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
      ...(leftovers && kind !== "School lunch" ? ["Leftover-friendly"] : []),
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
    const recipeId = String(recipe.id || `recipe-${index}`);
    const rawImage = String(recipe.image || "");
    const sourceUrl = String(recipe.sourceUrl || "");
    return {
      id: recipeId, recipeId, ...scheduled, kind, title,
      detail: `from ${String(recipe.sourceName || "a trusted recipe source")}`,
      time: `${Number(recipe.readyInMinutes || 35)} min`, cost: `$${servingCost.toFixed(2)} / serving`,
      tone: ["salmon", "gold", "green", "blue"][index % 4], emoji: kind.includes("lunch") ? "🍱" : ["🥗", "🍲", "🐟", "🍅"][index % 4],
      sourceUrl,
      image: recipeThumbnail({ id: recipeId, title, sourceUrl, image: rawImage }),
      sourceName: String(recipe.sourceName || "Recipe source"),
      readyMinutes: Number(recipe.readyInMinutes || 35),
      pricePerServing: servingCost,
      ingredients,
      tags: [...new Set(tags)],
    };
  }

  async function generatePlan(queryOverride?: string) {
    if (!requireMembership()) return;
    setPlanning(true); setPlannerNotice("");
    const minutes = maxTime.match(/\d+/)?.[0] || "45";
    const proteinPrompt = familyProteins.length ? familyProteins.join(" or ") : "healthy";
    const avoidPrompt = familyAvoids.length ? `without ${familyAvoids.join(", ")}` : "";
    const skillPrompt = skill === "Keep it simple" ? "easy" : skill === "Adventurous" ? "gourmet" : "";
    const batchPrompt = leftovers ? "meal prep" : "";
    const dinnerQuery = queryOverride || `${mediterranean ? "Mediterranean " : ""}${skillPrompt} ${batchPrompt} ${proteinPrompt} dinner ${avoidPrompt}`;
    const lunchQuery = `${mediterranean ? "Mediterranean " : ""}${skillPrompt} ${batchPrompt} ${proteinPrompt} lunch ${avoidPrompt}`;
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
      if (!uniqueIdeas.length) throw new Error("No recipes matched this search. Try relaxing one preference and search again.");
      const previousPlan = plannedMeals;
      if (previousPlan.length) {
        setUndoAction({ message: "Your previous schedule was cleared for the new catalog.", restore: () => setPlannedMeals(previousPlan) });
      }
      setPlannedMeals([]);
      setRecipeIdeas(uniqueIdeas);
      setRecipeFilters({ ...defaultRecipeFilters });
      setRecipePage(1);
      setVisibleRecipeCount(recipeBatchSize);
      setCatalogBeforeSimilar(null);
      const fallbackActive = payloads.some((data) => data.demo);
      setRecipeNotice(`${uniqueIdeas.length} recipes ready to browse.${fallbackActive ? " The live recipe provider is unavailable, so backup recipes are included." : ""}`);
      if (ownerId) await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ householdName: household, people, location, preferences: { range, planStartDate, mealType, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, selectedStore, maxTime, skill, exclusions } }) });
      setSimilarTo(queryOverride || ""); navigateTo("meals");
    } catch (error) {
      setPlannerNotice(error instanceof Error ? error.message : "Recipes are temporarily unavailable. Please try again.");
    } finally { setPlanning(false); }
  }

  async function loadMoreRecipes() {
    setRecipeLoading(true); setRecipeNotice("");
    const kind = recipeFilters.kind !== "All meals" ? recipeFilters.kind : activeMealKinds[recipePage % activeMealKinds.length] || "Dinner";
    const familyProtein = familyProteins.length ? familyProteins[recipePage % familyProteins.length] : "healthy";
    const proteinPrompt = recipeFilters.protein === "All proteins" ? familyProtein : recipeFilters.protein;
    const skillPrompt = skill === "Keep it simple" ? "easy" : skill === "Adventurous" ? "gourmet" : "";
    const query = recipeFilters.query.trim() || (kind === "School lunch" ? "wrap" : `${mediterranean ? "Mediterranean " : ""}${skillPrompt} ${leftovers ? "meal prep " : ""}${proteinPrompt} ${kind.toLowerCase()}`);
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
      setVisibleRecipeCount((current) => current + recipeBatchSize);
      setRecipeNotice(fresh.length ? `${fresh.length} more recipes added.${data.demo ? " Backup recipes are active while the live provider is unavailable." : ""}` : "No new matches in that batch. Try broader filters or load another batch.");
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
      if (!similarTo) setCatalogBeforeSimilar(recipeIdeas);
      setRecipeIdeas([...new Map(similar.map((item: Meal) => [`${item.kind}:${item.title.toLowerCase()}`, item])).values()]);
      setRecipeFilters((current) => ({ ...current, query: "" }));
      setVisibleRecipeCount(recipeBatchSize);
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
    const scheduled = mealDateFor(kind, currentCount, planStartDate);
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

  function resequenceMeals(meals: Meal[], startDate = planStartDate) {
    const kinds = [...new Set(meals.map((meal) => meal.kind))];
    return kinds.flatMap((kind) => meals
      .filter((meal) => meal.kind === kind)
      .map((meal, index) => ({ ...meal, ...mealDateFor(kind, index, startDate) })))
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.kind.localeCompare(b.kind));
  }

  function showUndo(message: string, restore: () => void) {
    setUndoAction({ message, restore });
  }

  function removePlannedMeal(id: string) {
    const removed = plannedMeals.find((meal) => meal.id === id);
    if (!removed) return;
    const previous = plannedMeals;
    setPlannedMeals(resequenceMeals(plannedMeals.filter((meal) => meal.id !== id)));
    showUndo(`${removed.title} removed from ${removed.kind.toLowerCase()}.`, () => setPlannedMeals(previous));
  }

  function clearSelections() {
    if (!plannedMeals.length) return;
    const previous = plannedMeals;
    setPlannedMeals([]);
    showUndo("All selected meals were cleared.", () => setPlannedMeals(previous));
  }

  function movePlannedMeal(id: string, direction: -1 | 1) {
    const meal = plannedMeals.find((item) => item.id === id);
    if (!meal) return;
    const sameKind = plannedMeals.filter((item) => item.kind === meal.kind).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    const currentIndex = sameKind.findIndex((item) => item.id === id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= sameKind.length) return;
    [sameKind[currentIndex], sameKind[nextIndex]] = [sameKind[nextIndex], sameKind[currentIndex]];
    const otherMeals = plannedMeals.filter((item) => item.kind !== meal.kind);
    setPlannedMeals(resequenceMeals([...otherMeals, ...sameKind]));
    const category = meal.kind === "School lunch" ? "school lunches" : `${meal.kind.toLowerCase()}s`;
    setRecipeNotice(`${meal.title} moved ${direction < 0 ? "earlier" : "later"} in ${category}.`);
  }

  function reorderPlannedMeal(sourceId: string, targetId: string, kind: string) {
    if (!sourceId || sourceId === targetId) return;
    const sameKind = plannedMeals.filter((meal) => meal.kind === kind).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    const sourceIndex = sameKind.findIndex((meal) => meal.id === sourceId);
    const targetIndex = sameKind.findIndex((meal) => meal.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setRecipeNotice("Meals can be reordered within the same meal category.");
      return;
    }
    const [moved] = sameKind.splice(sourceIndex, 1);
    sameKind.splice(targetIndex, 0, moved);
    const otherMeals = plannedMeals.filter((meal) => meal.kind !== kind);
    setPlannedMeals(resequenceMeals([...otherMeals, ...sameKind]));
    setDraggedMealId("");
    setRecipeNotice(`${moved.title} moved to a new date.`);
  }

  function updatePlanStartDate(value: string) {
    if (!value) return;
    const previousDate = planStartDate;
    const previousMeals = plannedMeals;
    setPlanStartDate(value);
    if (plannedMeals.length) {
      setPlannedMeals(resequenceMeals(plannedMeals, value));
      showUndo("Plan dates were updated.", () => {
        setPlanStartDate(previousDate);
        setPlannedMeals(previousMeals);
      });
    }
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
        const usedTitles = new Set(next.map((meal) => meal.title.toLowerCase()));
        const rankedPool = (preferred.length ? preferred : recipeIdeas)
          .sort((a, b) => Number(Boolean(b.tags?.includes("Budget fit"))) - Number(Boolean(a.tags?.includes("Budget fit"))));
        const unusedPool = rankedPool.filter((meal) => !usedTitles.has(meal.title.toLowerCase()));
        const pool = unusedPool.length ? unusedPool : rankedPool;
        for (let index = existingCount; index < target; index++) {
          const meal = pool[(index - existingCount) % pool.length];
          next.push({
            ...meal,
            ...mealDateFor(kind, index, planStartDate),
            id: `${meal.recipeId || meal.id}-${kind}-${crypto.randomUUID()}`,
            recipeId: meal.recipeId || meal.id,
            kind,
            tags: [...new Set([...(meal.tags || []), ...(kind === "School lunch" ? ["Kid-friendly", "Packable"] : [])])],
          });
        }
      });
      return next.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.kind.localeCompare(b.kind));
    });
    setRecipeNotice("Open meal slots filled with the best available preference and price matches. You can still remove or replace any recipe.");
  }

  function toggleSchoolLunches() {
    if (kidLunches) {
      setPlannedMeals((current) => current.filter((meal) => meal.kind !== "School lunch"));
      setRecipeFilters((current) => ({ ...current, kind: current.kind === "School lunch" ? "All meals" : current.kind }));
      setVisibleRecipeCount(recipeBatchSize);
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

  function clearLocation() {
    setLocation("");
    setLocationQuery("");
    setLocationResults([]);
    setLocationStatus("Enter a neighborhood, city, or ZIP, or use your location.");
  }

  async function toggleFavorite(meal: Meal) {
    const saved = favorites.includes(meal.title);
    setFavorites((current) => saved ? current.filter((item) => item !== meal.title) : [...current, meal.title]);
    setRecipeNotice(saved ? `${meal.title} removed from favorites.` : `${meal.title} saved to favorites.`);
    if (ownerId) await fetch(`/api/favorites${saved ? `?recipeId=${encodeURIComponent(meal.id)}` : ""}`, { method: saved ? "DELETE" : "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: saved ? undefined : JSON.stringify(meal) });
  }

  async function saveRating(meal: Meal, rating: Rating) {
    setRatings((current) => ({ ...current, [meal.id]: rating }));
    await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ recipeId: meal.id, ...rating }) });
    setRatingMeal(null);
    setRecipeNotice(`Your rating for ${meal.title} was saved.`);
  }

  async function saveMember() {
    if (!memberDraft.name.trim()) { setFamilyStatus("Enter a name before saving."); return; }
    const member: Member = {
      id: editingMemberId || crypto.randomUUID(), name: memberDraft.name.trim(), role: memberDraft.role, allergies: memberDraft.allergies,
      preferences: { glutenFree: memberDraft.glutenFree, lowDairy: memberDraft.lowDairy, kidFriendly: memberDraft.kidFriendly, avoidOnions: memberDraft.avoidOnions, proteins: memberDraft.proteins },
    };
    setMembers((current) => editingMemberId ? current.map((item) => item.id === editingMemberId ? member : item) : [...current, member]);
    await fetch("/api/family", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify(member) });
    setFamilyStatus(`${member.name}’s preferences are now included in recipe searches.`);
    setEditingMemberId("");
    setMemberDraft({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false, avoidOnions: false, proteins: [] });
  }

  async function deleteMember(id: string) {
    const removed = members.find((member) => member.id === id);
    if (!removed) return;
    setMembers((current) => current.filter((member) => member.id !== id));
    await fetch(`/api/family?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-grocer-owner": ownerId } });
    setFamilyStatus(`${removed.name} was removed.`);
    showUndo(`${removed.name} was removed from the family.`, () => {
      setMembers((current) => [...current, removed]);
      void fetch("/api/family", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify(removed) });
      setFamilyStatus(`${removed.name} was restored.`);
    });
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

  async function shareGroceryList() {
    if (!ingredientsReviewed) { setExportStatus("Review and confirm the merged ingredient list before exporting."); return; }
    const start = new Date(`${planStartDate}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + (range === "Day" ? 0 : range === "Week" ? 6 : 29));
    const dateLabel = range === "Day"
      ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const text = `Groceries, ${dateLabel}\n\n${groceryGroups.map((group) => `${group.title}\n${group.items.map((item) => `• ${item}${ingredientAdjustments[item.toLowerCase()] ? ` — ${ingredientAdjustments[item.toLowerCase()]}` : ""}`).join("\n")}`).join("\n\n")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Groceries, ${dateLabel}`, text });
        setExportStatus("Grocery list shared. Choose Notes, Reminders, Keep, or another list app on your device.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") { setExportStatus("Sharing cancelled. Your grocery list is unchanged."); return; }
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setExportStatus("Grocery list copied. Paste it into Apple Notes, Reminders, Google Keep, or your preferred list app.");
    } catch {
      setExportStatus("Your browser blocked sharing and copying. Try the calendar or email export instead.");
    }
  }
  function downloadCalendar() {
    if (!plannedMeals.length) { setExportStatus("Add recipes to your plan before exporting a calendar."); return; }
    if (!ingredientsReviewed) { setExportStatus("Review and confirm the merged ingredient list before exporting."); return; }
    const slots = [...plannedMeals].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    const shuffledByKind = new Map<string, Meal[]>();
    if (calendarOrder === "random") {
      [...new Set(slots.map((meal) => meal.kind))].forEach((kind) => {
        shuffledByKind.set(kind, slots.filter((meal) => meal.kind === kind).sort(() => Math.random() - .5));
      });
    }
    const shuffledIndexes = new Map<string, number>();
    const recipes = calendarOrder === "random" ? slots.map((slot) => {
      const index = shuffledIndexes.get(slot.kind) || 0;
      shuffledIndexes.set(slot.kind, index + 1);
      return shuffledByKind.get(slot.kind)?.[index] || slot;
    }) : slots;
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
    setExportStatus(`Calendar downloaded in ${calendarOrder === "random" ? "a shuffled order within each meal category" : "your selected recipe order"}.`);
  }
  async function emailRecipes() {
    if (!email) { setExportStatus("Enter your email address first."); return; }
    if (!ingredientsReviewed) { setExportStatus("Review and confirm the merged ingredient list before exporting."); return; }
    const response = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ to: email, subject: "My Grocer-Eaze recipes", meals: plannedMeals.map(({ day, title, detail, time, sourceUrl }) => ({ day, title, detail, time, sourceUrl })) }) });
    setExportStatus(response.ok ? `Recipes sent to ${email}.` : "We couldn’t send that email. Please try again.");
  }

  async function submitAccessibilityFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccessibilityStatus("");
    const details = accessibilityFeedback.details.trim();
    const feedbackEmail = accessibilityFeedback.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(feedbackEmail)) {
      setAccessibilityStatus("Enter a valid email address so we can follow up.");
      return;
    }
    if (details.length < 10) {
      setAccessibilityStatus("Please share a little more detail about the barrier you encountered.");
      return;
    }
    setAccessibilityBusy(true);
    try {
      const response = await fetch("/api/accessibility-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessibilityFeedback),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setAccessibilityStatus(data.error || "We couldn’t send your feedback. Please try again.");
        return;
      }
      setAccessibilityFeedback((current) => ({ ...current, details: "" }));
      setAccessibilityStatus("Thank you. Your accessibility feedback has been sent to the Grocer-Eaze team.");
    } catch {
      setAccessibilityStatus("We couldn’t send your feedback. Please try again.");
    } finally {
      setAccessibilityBusy(false);
    }
  }

  function requireMembership() {
    if (!user) { navigateTo("account"); setAccountStatus("Sign in before using meal planning tools."); return false; }
    if (!user.hasAccess) { navigateTo("plans"); setAccountStatus("Choose a membership to unlock meal planning and exports."); return false; }
    return true;
  }

  function navigateTo(nextView: View) {
    if (["meals", "list"].includes(nextView) && authLoaded) {
      if (!user) { nextView = "account"; setAccountStatus("Sign in before using meal planning tools."); }
      else if (!user.hasAccess) { nextView = "plans"; setAccountStatus("Choose a membership to unlock meal planning and exports."); }
    }
    if (nextView === "family" && authLoaded && !user) { nextView = "account"; setAccountStatus("Sign in before adding family preferences."); }
    setView(nextView);
    const nextHash = `#${nextView}`;
    if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusMainContent() {
    window.setTimeout(() => {
      const content = document.getElementById("page-content");
      if (!content) return;
      content.setAttribute("tabindex", "-1");
      content.focus();
    });
  }

  function updateRecipeFilters(nextFilters: typeof defaultRecipeFilters) {
    setRecipeFilters(nextFilters);
    setVisibleRecipeCount(recipeBatchSize);
    setRecipeNotice("");
  }

  function showMoreRecipes() {
    if (visibleRecipeCount < filteredRecipeIdeas.length) {
      const nextCount = Math.min(filteredRecipeIdeas.length, visibleRecipeCount + recipeBatchSize);
      setVisibleRecipeCount(nextCount);
      setRecipeNotice(`Showing ${nextCount} of ${filteredRecipeIdeas.length} matching recipes.`);
      return;
    }
    void loadMoreRecipes();
  }

  function returnToFullCatalog() {
    if (catalogBeforeSimilar) {
      setRecipeIdeas(catalogBeforeSimilar);
      setCatalogBeforeSimilar(null);
      setSimilarTo("");
      setRecipeFilters({ ...defaultRecipeFilters });
      setVisibleRecipeCount(recipeBatchSize);
      setRecipeNotice("Your full recipe catalog is back.");
    }
  }

  function finishOnboarding() {
    window.localStorage.setItem("grocer-eaze-onboarding-complete", "true");
    setOnboardingStep(null);
  }

  function startOnboarding() {
    setOnboardingStep(0);
  }

  return <div className="app">
    <a className="skip-link" href="#page-content" onClick={focusMainContent}>Skip to main content</a>
    <header>
      <button className="brand" aria-label="Grocer-Eaze home" onClick={() => navigateTo("plan")}><span className="brand-mark" aria-hidden="true"><span>g</span></span><span>Grocer<span>•</span>Eaze</span></button>
      <nav aria-label="Primary navigation">
        <button className={view === "plan" ? "active" : ""} aria-current={view === "plan" ? "page" : undefined} onClick={() => navigateTo("plan")}>Plan</button>
        <button className={view === "meals" ? "active" : ""} aria-current={view === "meals" ? "page" : undefined} onClick={() => navigateTo("meals")}>My meals</button>
        <button className={view === "list" ? "active" : ""} aria-current={view === "list" ? "page" : undefined} onClick={() => navigateTo("list")}>Grocery list</button>
        <button className={view === "family" ? "active" : ""} aria-current={view === "family" ? "page" : undefined} onClick={() => navigateTo("family")}>Family</button>
        {user?.role === "admin" && <button className={view === "admin" ? "active" : ""} aria-current={view === "admin" ? "page" : undefined} onClick={() => { navigateTo("admin"); loadAdminUsers(); }}>Admin</button>}
      </nav>
      <button className="avatar" aria-label="Open profile" aria-current={view === "account" ? "page" : undefined} onClick={() => navigateTo("account")}>{user ? user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "ME"}</button>
    </header>
    <main>

    {view === "plan" && <div className="shell" id="page-content" tabIndex={-1}>
      <section className="hero"><p className="eyebrow">MEAL PLANNING, MADE HUMAN</p><h1><span>Better Food,</span><br /><em>Less Waste.</em></h1><p className="lede">A recipe catalog shaped around every person at your table, so you buy what you need and enjoy what you make.</p><div className="trust-row"><span><b>✓</b> Family preferences included</span><span><b>✓</b> Shop with a smarter list</span><span><b>✓</b> Use more, waste less</span></div></section>
      <section className="planner">
        <div className="planner-top"><div><span>1</span><strong>Build your plan</strong></div><p>About 60 seconds</p></div>
        <div className="field"><label id="planning-range-label">How far ahead?</label><div className="segmented" role="group" aria-labelledby="planning-range-label">{["Day", "Week", "Month"].map((item) => <button key={item} aria-pressed={range === item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>)}</div></div>
        <div className="field"><label htmlFor="plan-start-date">When should this plan start?</label><input id="plan-start-date" className="text-input" type="date" min={todayInputDate()} value={planStartDate} suppressHydrationWarning onChange={(event) => updatePlanStartDate(event.target.value)} /><small className="field-help">Your schedule, reminders, and calendar exports will use this date.</small></div>
        <div className="two-col"><div className="field"><label htmlFor="meal-type">Meals to plan</label><select id="meal-type" value={mealType} onChange={(e) => setMealType(e.target.value)}><option>Lunch + dinner</option><option>Dinner only</option></select></div><div className="field"><label id="people-label">People</label><div className="stepper" role="group" aria-labelledby="people-label"><button type="button" disabled={people <= 1} aria-label="Decrease number of people" onClick={() => setPeople(Math.max(1, people - 1))}>−</button><strong aria-live="polite">{people}</strong><button type="button" disabled={people >= 20} aria-label="Increase number of people" onClick={() => setPeople(Math.min(20, people + 1))}>+</button></div></div></div>
        <div className="field"><label htmlFor="household-name">Household profile</label><input id="household-name" className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /><small className="field-help">{members.length ? `${members.length} family member${members.length === 1 ? "" : "s"} included in preferences.` : "Add individual preferences on the Family page."}</small></div>
        {familyRuleDetails.length ? <details className="family-rule-panel"><summary><span>Family search rules</span><small>{familyRuleDetails.length} active</small></summary><div>{familyRuleDetails.map((item) => <p key={`${item.member}-${item.rule}`}><strong>{item.member}</strong><span>{item.rule}</span></p>)}</div></details> : <button className="family-empty-link" onClick={() => navigateTo("family")}>+ Add family preferences to personalize the search</button>}
        <div className="two-col"><div className="field"><label htmlFor="max-cook-time">Maximum cook time</label><select id="max-cook-time" value={maxTime} onChange={(e) => setMaxTime(e.target.value)}><option>20 minutes</option><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option></select></div><div className="field"><label htmlFor="cooking-comfort">Cooking comfort</label><select id="cooking-comfort" value={skill} onChange={(e) => setSkill(e.target.value)}><option>Keep it simple</option><option>Comfortable</option><option>Adventurous</option></select></div></div>
        <div className="field"><div className="label-line"><label htmlFor="grocery-budget">Grocery budget for this plan</label><strong>{budget >= 500 ? "$500+" : `$${budget}`}</strong></div><input id="grocery-budget" aria-label="Grocery budget for this plan" type="range" min="50" max="500" step="10" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /><div className="range-labels"><span>$50</span><span>$500+</span></div></div>
        <div className="preference-heading"><strong>Plan preferences</strong><span>Choose the options that should shape your recipes and shopping plan.</span></div>
        <div className="option-grid"><Toggle label="Plan for leftovers" checked={leftovers} onChange={() => setLeftovers(!leftovers)} note="Cook once, eat twice" /><Toggle label="School lunches" checked={kidLunches} onChange={toggleSchoolLunches} note={`${schoolLunchTarget || (range === "Month" ? 22 : range === "Week" ? 5 : 1)} packable weekday lunch${range === "Day" ? "" : "es"}`} /><Toggle label="Gluten-free" checked={glutenFree} onChange={() => setGlutenFree(!glutenFree)} note={familyGlutenFree ? "Also required by a family member" : undefined} /><Toggle label="Low dairy" checked={lowDairy} onChange={() => setLowDairy(!lowDairy)} note={familyLowDairy ? "Also preferred by a family member" : undefined} /><Toggle label="Mediterranean" checked={mediterranean} onChange={() => setMediterranean(!mediterranean)} /><Toggle label="One store only" checked={oneStore} onChange={() => setOneStore(!oneStore)} /></div>
        {oneStore && <div className="field"><label htmlFor="preferred-store">Preferred store</label><select id="preferred-store" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>{storeNames.map((store) => <option key={store}>{store}</option>)}</select></div>}
        <div className="field"><label htmlFor="ingredient-exclusions">Allergies or ingredients to avoid</label><input id="ingredient-exclusions" className="text-input" placeholder="e.g. shellfish, peanuts, mushrooms" value={exclusions} onChange={(e) => setExclusions(e.target.value)} /></div>
        <div className="location-picker">
          <label htmlFor="shopping-location">Shopping location</label><div className="location-input"><span className="location-mark" aria-hidden="true"><i>⌖</i></span><input id="shopping-location" value={locationQuery} onChange={(e) => { const nextLocation = e.target.value; setLocationQuery(nextLocation); setLocationResults([]); setLocationStatus(nextLocation.trim().length >= 2 ? "Finding location matches…" : nextLocation ? "Type at least 2 characters to search." : "Enter a neighborhood, city, or ZIP, or use your location."); }} placeholder="Neighborhood, city, or ZIP" aria-label="Shopping location" role="combobox" aria-autocomplete="list" aria-controls="location-options" aria-expanded={locationResults.length > 0} /><div className="location-actions">{locationQuery && <button className="location-clear" type="button" onClick={clearLocation} aria-label="Clear shopping location">Clear</button>}<button className="location-use" type="button" onClick={locateMe}><span aria-hidden="true">◎</span>Use my location</button></div></div>
          {locationResults.length > 0 && <div className="location-results" id="location-options" role="listbox" aria-label="Location suggestions">{locationResults.map((result) => <button role="option" aria-selected="false" key={`${result.lat}-${result.lon}`} onClick={() => { setLocation(result.label); setLocationQuery(result.label); setLocationResults([]); setLocationStatus("Location updated."); }}>{result.label}</button>)}</div>}
          <small aria-live="polite">{locationStatus || `Searching stores near ${location}`}</small>
        </div>
        <button className="primary" onClick={() => generatePlan()} disabled={planning}>{planning ? "Building your recipe catalog…" : "Browse recipes for my plan"} <span>→</span></button><p className="estimate">Estimated groceries for a full plan: <strong>${planningEstimate.low}–${planningEstimate.high}</strong>{planningEstimate.high > budget && <span> · above your {budget >= 500 ? "$500+" : `$${budget}`} target</span>}</p>{plannerNotice && <p className="form-notice error" role="alert">{plannerNotice}</p>}
      </section>
    </div>}

    {view === "meals" && <div className="dashboard catalog-dashboard" id="page-content" tabIndex={-1}>
      <div className="page-heading catalog-heading"><div><p className="eyebrow">{people} PEOPLE · {household.toUpperCase()}</p><h2>{similarTo ? `More like ${similarTo}.` : "Build your plan from the catalog."}</h2><p>Browse, filter, and add each recipe to the meal where it belongs.</p></div><div className="page-heading-actions">{similarTo && catalogBeforeSimilar && <button className="outline" onClick={returnToFullCatalog}>← Full catalog</button>}<button className="outline" onClick={() => navigateTo("plan")}>Adjust full plan</button></div></div>

      <section className="plan-progress" aria-label={`${filledCount} of ${totalTarget} meal slots filled`}>
        <div className="progress-copy"><span>{filledCount} / {totalTarget}</span><div><strong>{planIsFull ? "Your schedule is full" : `${totalTarget - filledCount} meal slots left`}</strong><small>Starts {new Date(`${planStartDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {selectedStore} estimate {selectedEstimate ? `$${selectedEstimate}` : "$0"} · {selectedEstimate <= budget ? `$${budget - selectedEstimate} under budget` : `$${selectedEstimate - budget} over budget`}</small></div>{planIsFull ? <button className="progress-cta" onClick={() => navigateTo("list")}>Build grocery list →</button> : recipeIdeas.length > 0 && <button className="progress-cta" onClick={quickFillRemaining}>Quick-fill open slots</button>}</div>
        <div className="progress-track"><i style={{ width: `${Math.min(100, (filledCount / Math.max(1, totalTarget)) * 100)}%` }} /></div>
        <div className="progress-breakdown">{activeMealKinds.map((kind) => {
          const count = plannedMeals.filter((meal) => meal.kind === kind).length;
          const target = mealTargets[kind as keyof typeof mealTargets];
          return <span key={kind} className={count >= target ? "complete" : ""}>{kind} {count}/{target}</span>;
        })}</div>
        {recipeNotice && <p className="progress-notice" role="status" aria-live="polite">{recipeNotice}</p>}
      </section>

      <section className="recipe-library">
        <div className="library-heading"><div><p className="eyebrow">RECIPE CATALOG</p><h3>Find the right fit.</h3><span>{visibleRecipeIdeas.length} showing · {filteredRecipeIdeas.length} matches · {recipeIdeas.length} loaded</span></div><strong className="catalog-location">⌖ Near {shortLocation}</strong></div>
        <div className="preference-filter-row" aria-label="Active meal preferences">
          <button className={effectiveGlutenFree ? "active" : ""} aria-pressed={effectiveGlutenFree} disabled={familyGlutenFree} title={familyGlutenFree ? "Required by a family member" : undefined} onClick={() => setGlutenFree(!glutenFree)}>Gluten-free</button>
          <button className={effectiveLowDairy ? "active" : ""} aria-pressed={effectiveLowDairy} disabled={familyLowDairy} title={familyLowDairy ? "Preferred by a family member" : undefined} onClick={() => setLowDairy(!lowDairy)}>Low dairy</button>
          <button className={mediterranean ? "active" : ""} aria-pressed={mediterranean} onClick={() => setMediterranean(!mediterranean)}>Mediterranean</button>
          <button className={kidLunches ? "active" : ""} aria-pressed={kidLunches} onClick={toggleSchoolLunches}>School lunches</button>
          {leftovers && <span>Leftovers planned</span>}
          {familyGlutenFree && <span>Family requires gluten-free</span>}
          {familyLowDairy && <span>Family prefers low dairy</span>}
          {familyKidFriendly && <span>Family prefers kid-friendly</span>}
          {familyAvoids.map((avoid) => <span key={avoid}>Avoid {avoid}</span>)}
          {familyProteins.map((protein) => <span key={protein}>{protein} favorite</span>)}
        </div>
        {familyRuleDetails.length > 0 && <details className="family-rule-panel catalog-family-rules">
          <summary><span>Why these recipes match your family</span><small>{members.length} member{members.length === 1 ? "" : "s"} included</small></summary>
          <div>{familyRuleDetails.map((item) => <p key={`catalog-${item.member}-${item.rule}`}><strong>{item.member}</strong><span>{item.rule}</span></p>)}</div>
        </details>}
        <details className="catalog-filter-panel" open>
          <summary><span>Filter recipes</span><small>{filteredRecipeIdeas.length} matches</small></summary>
          <div className="recipe-filters">
          <div className="filter-search"><span className="icon-centered" aria-hidden="true">⌕</span><input aria-label="Filter recipes by name or ingredient" placeholder="Search recipes or ingredients" value={recipeFilters.query} onChange={(event) => updateRecipeFilters({ ...recipeFilters, query: event.target.value })} /></div>
          <select aria-label="Filter by meal type" value={recipeFilters.kind} onChange={(event) => updateRecipeFilters({ ...recipeFilters, kind: event.target.value })}><option>All meals</option>{activeMealKinds.map((kind) => <option key={kind}>{kind}</option>)}</select>
          <select aria-label="Filter by protein" value={recipeFilters.protein} onChange={(event) => updateRecipeFilters({ ...recipeFilters, protein: event.target.value })}><option>All proteins</option>{proteinOptions.map((protein) => <option key={protein}>{protein}</option>)}</select>
          <select aria-label="Filter by cook time" value={recipeFilters.maxTime} onChange={(event) => updateRecipeFilters({ ...recipeFilters, maxTime: event.target.value })}><option>Any time</option><option value="20">20 minutes or less</option><option value="30">30 minutes or less</option><option value="45">45 minutes or less</option><option value="60">60 minutes or less</option></select>
          <select aria-label="Filter by recipe source" value={recipeFilters.source} onChange={(event) => updateRecipeFilters({ ...recipeFilters, source: event.target.value })}><option>All sources</option>{recipeSources.map((source) => <option key={source}>{source}</option>)}</select>
          <button className={recipeFilters.favoritesOnly ? "active" : ""} aria-pressed={recipeFilters.favoritesOnly} onClick={() => updateRecipeFilters({ ...recipeFilters, favoritesOnly: !recipeFilters.favoritesOnly })}>♡ Favorites</button>
          <button disabled={!recipeFiltersActive} onClick={() => updateRecipeFilters({ ...defaultRecipeFilters })}>Clear</button>
          </div>
        </details>
        {filteredRecipeIdeas.length ? <div className="recipe-card-grid">{visibleRecipeIdeas.map((meal) => <article className="recipe-card" key={`idea-${meal.kind}-${meal.id}-${meal.title}`}>
          <div className={`recipe-thumb ${meal.tone}`}>{meal.image ? <><img src={meal.image} alt={`${meal.title} recipe`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} /><span hidden aria-hidden="true">{meal.emoji}</span></> : <span aria-hidden="true">{meal.emoji}</span>}<em>{meal.kind === "School lunch" ? "Kid-friendly lunch" : meal.kind}</em><button className={favorites.includes(meal.title) ? "saved" : ""} onClick={() => toggleFavorite(meal)} aria-label={`${favorites.includes(meal.title) ? "Remove" : "Add"} ${meal.title} ${favorites.includes(meal.title) ? "from" : "to"} favorites`}>{favorites.includes(meal.title) ? "♥" : "♡"}</button></div>
          <div className="recipe-card-copy"><small>{meal.sourceName}</small><h4>{meal.title}</h4><p>{meal.readyMinutes} min · {meal.cost}</p><div className="recipe-tags">{meal.tags?.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="catalog-secondary-actions">{meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer">Recipe ↗</a>}<button onClick={() => findSimilar(meal)}>Find similar</button><button onClick={() => setRatingMeal(meal)}>Rate</button></div><div className="add-meal-actions">{activeMealKinds.map((kind) => {
            const target = mealTargets[kind as keyof typeof mealTargets];
            const full = plannedMeals.filter((item) => item.kind === kind).length >= target;
            return <button key={kind} className="add-meal-button" disabled={full} onClick={() => addToMeal(meal, kind)}>{full ? `${kind} full` : `+ Add to ${kind.toLowerCase()}`}</button>;
          })}</div></div>
        </article>)}</div> : <div className="empty-state empty-state-action"><p>No loaded recipes match these filters.</p>{recipeFiltersActive ? <button className="outline" onClick={() => updateRecipeFilters({ ...defaultRecipeFilters })}>Clear filters</button> : <button className="outline" onClick={() => navigateTo("plan")}>Adjust plan preferences</button>}</div>}
        <div className="load-more-row"><button className="primary compact" disabled={recipeLoading} onClick={showMoreRecipes}>{recipeLoading ? "Finding more recipes…" : visibleRecipeCount < filteredRecipeIdeas.length ? `Show ${recipeBatchSize} more recipes` : "Find more recipes"}</button><span>{visibleRecipeIdeas.length} of {filteredRecipeIdeas.length} matching recipes shown</span></div>
      </section>

      <section className="selection-board">
        <div className="selection-heading"><div><p className="eyebrow">YOUR SCHEDULE</p><h3>Selected meals</h3><span>Drag meals—or use the arrow buttons—to change which recipe lands on each date.</span></div><div className="selection-actions"><button className="outline" onClick={quickFillRemaining} disabled={planIsFull || !recipeIdeas.length}>Quick-fill remaining</button>{plannedMeals.length > 0 && <button className="outline" onClick={clearSelections}>Clear selections</button>}</div></div>
        {activeMealKinds.map((kind) => {
          const selected = plannedMeals.filter((meal) => meal.kind === kind).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
          const target = mealTargets[kind as keyof typeof mealTargets];
          const kindLabel = kind === "School lunch" ? "School lunches" : kind === "Lunch" ? "Lunches" : "Dinners";
          return <details className="selected-meal-section" open key={kind}>
            <summary><span>{kind === "School lunch" ? "🍱" : kind === "Lunch" ? "🥗" : "🍽"} {kindLabel}</span><small>{selected.length} of {target} selected</small></summary>
            {selected.length ? <div className="selected-meal-list">{selected.map((meal, index) => <article
              key={meal.id}
              draggable
              className={draggedMealId === meal.id ? "dragging" : ""}
              onDragStart={() => setDraggedMealId(meal.id)}
              onDragEnd={() => setDraggedMealId("")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorderPlannedMeal(draggedMealId, meal.id, kind)}
            >
              <span className="drag-handle" aria-hidden="true">⋮⋮</span>
              <span className="meal-date">{meal.day}<b>{meal.date}</b></span>
              <div className="scheduled-meal-copy"><strong>{meal.title}</strong><small>{meal.sourceName} · {meal.time} · {meal.cost}</small></div>
              <div className="schedule-actions">
                <button disabled={index === 0} onClick={() => movePlannedMeal(meal.id, -1)} aria-label={`Move ${meal.title} to an earlier date`}>↑</button>
                <button disabled={index === selected.length - 1} onClick={() => movePlannedMeal(meal.id, 1)} aria-label={`Move ${meal.title} to a later date`}>↓</button>
                <button onClick={() => removePlannedMeal(meal.id)} aria-label={`Remove ${meal.title} from ${kind}`}>Remove</button>
              </div>
            </article>)}</div> : <p className="empty-selection">Choose {target} {kind.toLowerCase()} recipe{target === 1 ? "" : "s"} from the catalog above.</p>}
          </details>;
        })}
      </section>

      <div className={`action-bar confirm-bar ${planIsFull ? "ready" : ""}`}><p><strong>{planIsFull ? "Schedule complete." : `${filledCount} of ${totalTarget} meals selected.`}</strong> {planIsFull ? "Your recipe ingredients are ready to combine into one grocery list." : "Keep browsing to fill every meal slot."}</p><button className="primary compact" disabled={!planIsFull} onClick={() => navigateTo("list")}>{planIsFull ? "Confirm & build grocery list →" : `${totalTarget - filledCount} slots remaining`}</button></div>
    </div>}

    {view === "list" && <div className="dashboard" id="page-content" tabIndex={-1}>
      <div className="page-heading"><div><p className="eyebrow">GROCERIES · {plannedMeals.length} SELECTED MEALS</p><h2>Everything you need, sorted.</h2><p>{groceryGroups.reduce((sum, group) => sum + group.count, 0)} unique ingredients for {people} people near {location}. {selectedStore} estimate: ${selectedEstimate}.</p></div><button className="outline" onClick={() => navigateTo("meals")}>← Back to recipes</button></div>
      {plannedMeals.length ? <div className="list-layout">
        <section className="grocery-panel">
          <div className="store-compare"><span className="mini-label">{oneStore ? "YOUR SELECTED STORE" : "COMPARE NEARBY STORES"}</span><div>{visibleStoreEstimates.map((store) => <button key={store.name} className={selectedStore === store.name ? "selected-store" : ""} onClick={() => setSelectedStore(store.name)}><strong>{store.name}</strong><span>${store.price}</span><small>{store.availability}% estimated availability</small></button>)}</div></div>
          <div className="grocery-head"><strong>{selectedStore}</strong><span>{plannedMeals.length} meals × {people} people · recipe-derived estimate</span></div>
          <p className="estimate-method"><strong>How this is calculated:</strong> We add each selected recipe’s listed cost per serving for {people} people, then adjust for typical pricing at {selectedStore}. It is an estimate—not an exact checkout total—because package sizes, sales, taxes, availability, and items you already have can change the final cost.</p>
          <details className="ingredient-review" open={!ingredientsReviewed}>
            <summary><span>Review merged ingredients</span><small>{ingredientsReviewed ? "Confirmed" : "Required before export"}</small></summary>
            <div className="ingredient-review-body">
              <p>We merged repeated ingredients from every recipe. Add a package or quantity note wherever the recipe wording needs clarification.</p>
              <div className="ingredient-review-list">{groceryEntries.map((entry) => <label key={entry.key}>
                <span><strong>{entry.name}</strong><small>Used in {entry.occurrences} recipe{entry.occurrences === 1 ? "" : "s"}{entry.originals[0] ? ` · ${entry.originals[0]}` : ""}</small></span>
                <input className="text-input" value={ingredientAdjustments[entry.key] || ""} onChange={(event) => {
                  setIngredientAdjustments((current) => ({ ...current, [entry.key]: event.target.value }));
                  setReviewedPlanSignature("");
                }} placeholder="Quantity or package note" aria-label={`Quantity or package note for ${entry.name}`} />
              </label>)}</div>
              <button className="primary compact" disabled={!groceryEntries.length} onClick={() => { setReviewedPlanSignature(planSignature); setExportStatus("Ingredients confirmed. Your exports are ready."); }}>{ingredientsReviewed ? "Ingredients confirmed" : "Confirm ingredient list"}</button>
            </div>
          </details>
          {groceryGroups.length ? groceryGroups.map((group) => <details open key={group.title}><summary><span>{group.icon} {group.title}</span><small>{group.count} {group.count === 1 ? "item" : "items"}</small></summary><div className="checklist">{group.items.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span><em>{ingredientAdjustments[item.toLowerCase()] || `for ${people}`}</em></label>)}</div></details>) : <p className="empty-state">Select recipes to build your grocery list.</p>}
        </section>
        <aside className="export-panel">
          <span className="mini-label">READY WHEN YOU ARE</span><h3>Take your plan with you</h3><p>Send lists, recipes, and reminders where you already use them.</p>
          {!ingredientsReviewed && <p className="review-required">Confirm the merged ingredient list to unlock exports.</p>}
          <button disabled={!ingredientsReviewed} onClick={shareGroceryList}><span className="icon-centered" aria-hidden="true">↗</span><div><strong>Share grocery list</strong><small>Send to Notes, Reminders, Keep, or another app</small></div><b>Share</b></button>
          <div className="calendar-export"><label htmlFor="calendar-order">Calendar recipe order</label><select id="calendar-order" value={calendarOrder} onChange={(event) => setCalendarOrder(event.target.value as "plan" | "random")}><option value="plan">Keep my selected order</option><option value="random">Shuffle within each meal type</option></select><button disabled={!ingredientsReviewed} onClick={downloadCalendar}><span className="icon-centered" aria-hidden="true">31</span><div><strong>Google or Apple Calendar</strong><small>Recipes appear on their scheduled dates</small></div><b>Export</b></button></div>
          <div className="email-export"><input type="email" aria-label="Email address for recipe export" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /><button disabled={!ingredientsReviewed} onClick={emailRecipes}><span className="icon-centered" aria-hidden="true">@</span><div><strong>Email me recipes</strong><small>Send the complete plan</small></div><b>Email</b></button></div>
          {exportStatus && <p className="export-status" aria-live="polite">{exportStatus}</p>}
        </aside>
      </div> : <section className="empty-journey"><span className="empty-journey-icon icon-centered" aria-hidden="true">🛒</span><h3>Your grocery list starts with a meal.</h3><p>Browse the recipe catalog, add meals to your schedule, and Grocer-Eaze will combine the ingredients here.</p><div><button className="primary compact" onClick={() => navigateTo(recipeIdeas.length ? "meals" : "plan")}>{recipeIdeas.length ? "Choose recipes" : "Build my plan"}</button></div></section>}
    </div>}

    {view === "family" && <div className="dashboard narrow" id="page-content"><div className="page-heading"><div><p className="eyebrow">HOUSEHOLD PREFERENCES</p><h2>Your family, thoughtfully fed.</h2><p>Allergies, avoided ingredients, and favorite proteins shape every catalog search.</p></div></div>{familyStatus && <p className="form-notice success" aria-live="polite">{familyStatus}</p>}<div className="family-grid"><section className="settings-card"><h3>Family members</h3>{members.length === 0 && <p className="empty-state">No family members yet. Add the first person below.</p>}{members.map((member) => <article className="member-card" key={member.id}><span className="member-avatar icon-centered">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.role} · {member.allergies || "No listed allergies"}</small><p>{[member.preferences?.glutenFree && "Gluten-free", member.preferences?.lowDairy && "Low dairy", member.preferences?.kidFriendly && "Kid-friendly", member.preferences?.avoidOnions && "Avoid onions", ...(member.preferences?.proteins || []).map((protein) => `${protein} favorite`)].filter(Boolean).join(" · ") || "No preferences yet"}</p></div><div className="member-actions"><button onClick={() => editMember(member)}>Edit</button><button onClick={() => deleteMember(member.id)} aria-label={`Remove ${member.name}`}>Remove</button></div></article>)}</section><section className="settings-card"><h3>{editingMemberId ? "Edit family member" : "Add a family member"}</h3><div className="field"><label htmlFor="family-member-name">Name</label><input id="family-member-name" className="text-input" value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} /></div><div className="field"><label htmlFor="family-member-role">Role</label><select id="family-member-role" value={memberDraft.role} onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value })}><option>Adult</option><option>Teen</option><option>Child</option></select></div><div className="field"><label htmlFor="family-member-allergies">Allergies / avoid</label><input id="family-member-allergies" className="text-input" placeholder="Peanuts, shellfish…" value={memberDraft.allergies} onChange={(e) => setMemberDraft({ ...memberDraft, allergies: e.target.value })} /></div><div className="field"><label>Favorite proteins</label><div className="preference-check-grid" role="group" aria-label="Favorite proteins">{proteinOptions.map((protein) => <button type="button" key={protein} className={memberDraft.proteins.includes(protein) ? "selected" : ""} aria-pressed={memberDraft.proteins.includes(protein)} onClick={() => setMemberDraft({ ...memberDraft, proteins: memberDraft.proteins.includes(protein) ? memberDraft.proteins.filter((item) => item !== protein) : [...memberDraft.proteins, protein] })}>{protein}</button>)}</div></div><Toggle label="Avoid onions" checked={memberDraft.avoidOnions} onChange={() => setMemberDraft({ ...memberDraft, avoidOnions: !memberDraft.avoidOnions })} /><Toggle label="Gluten-free" checked={memberDraft.glutenFree} onChange={() => setMemberDraft({ ...memberDraft, glutenFree: !memberDraft.glutenFree })} /><Toggle label="Low dairy" checked={memberDraft.lowDairy} onChange={() => setMemberDraft({ ...memberDraft, lowDairy: !memberDraft.lowDairy })} /><Toggle label="Kid-friendly" checked={memberDraft.kidFriendly} onChange={() => setMemberDraft({ ...memberDraft, kidFriendly: !memberDraft.kidFriendly })} /><button className="primary" onClick={saveMember}>{editingMemberId ? "Save changes" : "Add family member"}</button>{editingMemberId && <button className="text-button" onClick={() => { setEditingMemberId(""); setMemberDraft({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false, avoidOnions: false, proteins: [] }); }}>Cancel editing</button>}</section></div></div>}

    {view === "account" && <div className="dashboard narrow" id="page-content">
      <div className="page-heading"><div><p className="eyebrow">PROFILE & SECURITY</p><h2>{user ? `Welcome, ${user.name}.` : "Create your account"}</h2><p>{user ? "Control your household, privacy, and plan." : "No password needed. We’ll verify your email with a one-time code."}</p></div></div>
      {!user ? <section className="settings-card auth-card">
        <div className="auth-trust"><span className="icon-centered" aria-hidden="true">🔒</span><strong>Secure passwordless signup</strong><small>Only your name and verified email are required. Phone is optional.</small></div>
        {authStep === "details" ? <>
          <div className="field"><label htmlFor="signup-name">Name</label><input id="signup-name" className="text-input" autoComplete="name" required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="signup-email">Email</label><input id="signup-email" className="text-input" type="email" autoComplete="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="signup-phone">Phone <small>(optional)</small></label><input id="signup-phone" className="text-input" type="tel" autoComplete="tel" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></div>
          <button className="primary" disabled={authBusy || !authForm.name.trim() || !authForm.email.trim()} onClick={startAuth}>{authBusy ? "Sending code…" : "Continue with email"}</button>
        </> : <>
          <div className="field"><label htmlFor="verification-code">Six-digit verification code</label><input id="verification-code" className="text-input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={authForm.code} onChange={(e) => setAuthForm({ ...authForm, code: e.target.value.replace(/\D/g, "") })} /></div>
          <button className="primary" disabled={authBusy || authForm.code.length !== 6} onClick={verifyAuth}>{authBusy ? "Verifying…" : "Verify and create account"}</button>
          <button className="text-button" onClick={() => setAuthStep("details")}>Use a different email</button>
        </>}
        {accountStatus && <p className="checkout-note" role="status">{accountStatus}</p>}
      </section> : <div className="settings-stack">
        <section className="settings-card">
          <h3>Profile</h3>
          <div className="account-identity"><span className="member-avatar icon-centered">{user.name[0].toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}{user.phone ? ` · ${user.phone}` : ""}</small></div><em>{user.role}</em></div>
          <div className="two-col"><div className="field"><label htmlFor="profile-household">Household name</label><input id="profile-household" className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /></div><div className="field"><label htmlFor="profile-email">Email for recipes</label><input id="profile-email" className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
          <button className="outline" onClick={async () => { await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ householdName: household, people, location, preferences: { range, planStartDate, mealType, budget, leftovers, glutenFree, lowDairy, mediterranean, kidLunches, oneStore, selectedStore, maxTime, skill, exclusions } }) }); setAccountStatus("Profile saved."); }}>Save profile</button>{accountStatus && <span className="success-note" role="status">{accountStatus}</span>}
        </section>
        <section className="settings-card security-card"><div className="icon-centered" aria-hidden="true">🔒</div><div><h3>Security</h3><p>Your email is verified. Your session is stored in a secure, HTTP-only cookie, protected data is checked on the server, and sensitive service keys never reach your browser.</p></div></section>
        <section className="settings-card plan-row"><div><span className="mini-label">ACCESS STATUS</span><h3>{user.billingExempt ? "Billing exempt" : user.accessStatus === "complimentary" ? "Complimentary account" : user.subscriptionStatus === "active" ? "Active membership" : user.subscriptionStatus === "trialing" ? "30-day free trial" : "Plan required"}</h3><p>{user.complimentaryUntil ? `Complimentary through ${user.complimentaryUntil}` : user.subscriptionEndsAt ? `Current period ends ${new Date(user.subscriptionEndsAt).toLocaleDateString()}` : user.hasAccess ? "Your Grocer-Eaze tools are unlocked." : "Choose monthly or yearly billing to start your 30-day trial."}</p></div>{user.subscriptionStatus ? <button className="primary compact" disabled={billingBusy} onClick={() => openBilling("portal")}>Manage billing</button> : <button className="primary compact" onClick={() => navigateTo("plans")}>View plans</button>}</section>
        <section className="settings-card danger-zone"><h3>Account controls</h3><button className="outline" onClick={async () => { await fetch("/api/auth/signout", { method: "POST" }); setUser(null); setAuthStep("details"); }}>Sign out</button></section>
      </div>}
    </div>}

    {view === "admin" && user?.role === "admin" && <div className="dashboard" id="page-content"><div className="page-heading"><div><p className="eyebrow">SECURE ADMIN CONSOLE</p><h2>User access management</h2><p>Grant free access, exempt billing, suspend accounts, and manage administrators.</p></div></div><section className="admin-toolbar"><input className="text-input" aria-label="Search users by name or email" placeholder="Search name or email" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} /><button className="outline" onClick={() => loadAdminUsers()}>Search</button></section>{accountStatus && <p className="checkout-note" role="status">{accountStatus}</p>}<div className="admin-list">{adminUsers.map((account) => <article className="admin-user" key={account.id}><div><strong>{account.name}</strong><small>{account.email}{account.phone ? ` · ${account.phone}` : ""}</small></div><div className="access-badges"><span>{account.role}</span><span>{account.access_status}</span>{Boolean(account.billing_exempt) && <span>billing exempt</span>}</div><div className="admin-actions"><button onClick={() => adminAction(account.id, account.access_status === "complimentary" ? "revoke_complimentary" : "grant_complimentary")}>{account.access_status === "complimentary" ? "Remove free access" : "Give free access"}</button><button onClick={() => adminAction(account.id, account.billing_exempt ? "billing_required" : "billing_exempt")}>{account.billing_exempt ? "Require payment" : "Turn off payment"}</button><button onClick={() => adminAction(account.id, account.access_status === "suspended" ? "activate" : "suspend")}>{account.access_status === "suspended" ? "Reactivate" : "Suspend"}</button><button onClick={() => adminAction(account.id, account.role === "admin" ? "remove_admin" : "make_admin")}>{account.role === "admin" ? "Remove admin" : "Make admin"}</button></div></article>)}</div>{adminUsers.length === 0 && <p className="empty-state">No users to show yet. Search or wait for the first signup.</p>}</div>}

    {view === "plans" && <div className="dashboard narrow" id="page-content"><div className="page-heading"><div><p className="eyebrow">SIMPLE PRICING</p><h2>Try everything free for 30 days.</h2><p>Secure checkout is handled by Stripe. Cancel any time before the trial ends.</p></div></div><div className="pricing-grid"><article className="price-card"><span>MONTHLY</span><h3><b>$10</b> / month</h3><p>Flexible month-to-month access.</p><button disabled={billingBusy} onClick={() => openBilling("checkout", "monthly")}>{billingBusy ? "Opening secure checkout…" : "Start 30-day trial"}</button></article><article className="price-card featured"><span>BEST VALUE · SAVE $71</span><h3><b>$49</b> / year</h3><p>Everything included, billed annually after your trial.</p><button disabled={billingBusy} onClick={() => openBilling("checkout", "yearly")}>{billingBusy ? "Opening secure checkout…" : "Start 30-day trial"}</button></article></div>{accountStatus && <p className="checkout-note" role="status">{accountStatus}</p>}<button className="outline back-button" onClick={() => navigateTo("account")}>← Back to account</button></div>}
    {view === "accessibility" && <div className="dashboard narrow accessibility-page" id="page-content" tabIndex={-1}>
      <div className="page-heading"><div><p className="eyebrow">ACCESSIBILITY AT GROCER-EAZE</p><h2>Meal planning should work for everyone.</h2><p>We’re committed to an experience people can use with a keyboard, screen reader, magnification, voice control, or other assistive technology.</p></div></div>
      <div className="accessibility-grid">
        <section className="settings-card accessibility-statement" aria-labelledby="accessibility-commitment">
          <span className="accessibility-icon icon-centered" aria-hidden="true">A</span>
          <h3 id="accessibility-commitment">Our commitment</h3>
          <p>Grocer-Eaze aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA. We include accessibility checks in every release and regularly review keyboard navigation, screen-reader structure, contrast, text resizing, touch targets, and responsive reflow.</p>
          <h3>What you can expect</h3>
          <ul>
            <li>Meaningful headings, labels, landmarks, and status announcements.</li>
            <li>Complete keyboard access with visible focus and no keyboard traps.</li>
            <li>Layouts that reflow without horizontal scrolling at narrow widths and high zoom.</li>
            <li>Motion that respects your reduced-motion preference.</li>
          </ul>
          <h3>Ongoing work</h3>
          <p>Accessibility is an ongoing practice. We test automated rules on every deployment and perform manual checks with common screen-reader and keyboard workflows. We welcome reports about anything that remains difficult to use.</p>
        </section>
        <section className="settings-card accessibility-feedback" aria-labelledby="accessibility-feedback-title">
          <p className="mini-label">REPORT A BARRIER</p>
          <h3 id="accessibility-feedback-title">Tell us what happened</h3>
          <p>Include the page or task, what you expected, and the assistive technology or browser you were using if relevant.</p>
          <form onSubmit={submitAccessibilityFeedback}>
            <div className="field"><label htmlFor="accessibility-name">Name <small>(optional)</small></label><input id="accessibility-name" className="text-input" autoComplete="name" maxLength={100} value={accessibilityFeedback.name} onChange={(event) => setAccessibilityFeedback({ ...accessibilityFeedback, name: event.target.value })} /></div>
            <div className="field"><label htmlFor="accessibility-email">Email</label><input id="accessibility-email" className="text-input" type="email" autoComplete="email" required maxLength={254} aria-describedby="accessibility-email-help" value={accessibilityFeedback.email} onChange={(event) => setAccessibilityFeedback({ ...accessibilityFeedback, email: event.target.value })} /><small id="accessibility-email-help" className="field-help">We’ll only use this to follow up about your report.</small></div>
            <div className="field"><label htmlFor="accessibility-details">Accessibility barrier</label><textarea id="accessibility-details" required minLength={10} maxLength={3000} aria-describedby="accessibility-details-help" value={accessibilityFeedback.details} onChange={(event) => setAccessibilityFeedback({ ...accessibilityFeedback, details: event.target.value })} /><small id="accessibility-details-help" className="field-help">Please don’t include passwords, payment details, or health information.</small></div>
            <div className="feedback-honeypot" hidden><label htmlFor="accessibility-website">Website</label><input id="accessibility-website" tabIndex={-1} autoComplete="off" value={accessibilityFeedback.website} onChange={(event) => setAccessibilityFeedback({ ...accessibilityFeedback, website: event.target.value })} /></div>
            <button className="primary" type="submit" disabled={accessibilityBusy}>{accessibilityBusy ? "Sending feedback…" : "Send accessibility feedback"}</button>
            {accessibilityStatus && <p className="accessibility-status" role="status" aria-live="polite">{accessibilityStatus}</p>}
          </form>
        </section>
      </div>
    </div>}
    </main>

    {ratingMeal && <div className="modal-backdrop" onClick={() => setRatingMeal(null)}><section className="rating-modal" role="dialog" aria-modal="true" aria-labelledby="rating-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}><button className="modal-close icon-centered" aria-label="Close recipe rating" onClick={() => setRatingMeal(null)}>×</button><span className="mini-label">RATE THIS RECIPE</span><h3 id="rating-title">{ratingMeal.title}</h3><label>Meal quality</label><Stars label="Meal quality" value={ratings[ratingMeal.id]?.quality || 0} onChange={(quality) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality, ease: current[ratingMeal.id]?.ease || 0 } }))} /><label>Ease of preparation</label><Stars label="Ease of preparation" value={ratings[ratingMeal.id]?.ease || 0} onChange={(ease) => setRatings((current) => ({ ...current, [ratingMeal.id]: { quality: current[ratingMeal.id]?.quality || 0, ease } }))} /><button className="primary" disabled={!ratings[ratingMeal.id]?.quality || !ratings[ratingMeal.id]?.ease} onClick={() => saveRating(ratingMeal, ratings[ratingMeal.id])}>Save rating</button></section></div>}

    {onboardingStep !== null && <div className="onboarding-backdrop"><section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" tabIndex={-1}>
      <button className="modal-close icon-centered" aria-label="Skip introduction" onClick={finishOnboarding}>×</button>
      <span className="mini-label">{onboardingSteps[onboardingStep].eyebrow}</span>
      <div className="onboarding-icon icon-centered" aria-hidden="true">{["⌂", "⌕", "↕", "✓"][onboardingStep]}</div>
      <h2 id="onboarding-title">{onboardingSteps[onboardingStep].title}</h2>
      <p>{onboardingSteps[onboardingStep].body}</p>
      <div className="onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={onboardingSteps.length} aria-valuenow={onboardingStep + 1} aria-label={`Introduction step ${onboardingStep + 1} of ${onboardingSteps.length}`}>{onboardingSteps.map((step, index) => <i key={step.title} className={index <= onboardingStep ? "active" : ""} />)}</div>
      <div className="onboarding-actions"><button className="text-button" onClick={finishOnboarding}>Skip</button><div>{onboardingStep > 0 && <button className="outline compact" onClick={() => setOnboardingStep(onboardingStep - 1)}>Back</button>}<button className="primary compact" onClick={() => onboardingStep === onboardingSteps.length - 1 ? finishOnboarding() : setOnboardingStep(onboardingStep + 1)}>{onboardingStep === onboardingSteps.length - 1 ? "Start planning" : "Next"}</button></div></div>
    </section></div>}

    {undoAction && <div className="undo-toast" role="status"><span>{undoAction.message}</span><button onClick={() => { undoAction.restore(); setUndoAction(null); }}>Undo</button><button className="undo-dismiss" onClick={() => setUndoAction(null)} aria-label="Dismiss notification">×</button></div>}

    <footer className="site-footer"><span>Grocer•Eaze</span><p>Better food. Less waste.</p><div><button onClick={startOnboarding}>How it works</button><button onClick={() => navigateTo("plans")}>Plans</button><button onClick={() => navigateTo("account")}>Privacy & security</button><button aria-current={view === "accessibility" ? "page" : undefined} onClick={() => navigateTo("accessibility")}>Accessibility</button></div></footer>
  </div>;
}
