"use client";

import { useEffect, useMemo, useState } from "react";

type Meal = {
  id: string; day: string; date: string; kind: string; title: string; detail: string;
  time: string; cost: string; tone: string; emoji: string; sourceUrl?: string; image?: string; sortOrder?: number;
  sourceName?: string; readyMinutes?: number; recipeId?: string; pricePerServing?: number; recipeServings?: number;
  ingredients?: Array<{ name: string; aisle?: string; original?: string }>; tags?: string[];
};
type MemberPreferences = {
  glutenFree?: boolean; lowDairy?: boolean; kidFriendly?: boolean; avoidOnions?: boolean; proteins?: string[];
};
type Member = { id: string; name: string; role: string; allergies: string; preferences?: MemberPreferences };
type Rating = { quality: number; ease: number };
type LocationResult = { label: string; lat?: string; lon?: string };
type StorePreference = { id: string; name: string; address: string; distanceMiles?: number; lat?: string; lon?: string };
type View = "plan" | "meals" | "list" | "shopping" | "delivery" | "account" | "family" | "plans" | "admin" | "accessibility";
type UndoAction = { message: string; restore: () => void };
type AccountUser = { id: string; name: string; email: string; phone: string; role: "user" | "admin"; accessStatus: string; complimentaryUntil: string | null; billingExempt: boolean; subscriptionStatus: string | null; subscriptionEndsAt: string | null; hasAccess: boolean };
type AdminUser = { id: string; name: string; email: string; phone: string; role: string; access_status: string; trial_ends_at?: string; complimentary_until?: string; billing_exempt: number };
type ProfilePayload = { profile?: { household_name: string; people: number; location: string; preferences_json?: string } | null };
type FavoritesPayload = { favorites?: Array<{ title: string }> };
type FamilyPayload = { members?: Member[] };
type RatingsPayload = { ratings?: Array<{ recipe_id: string; quality: number; ease: number }> };
type CapabilitiesPayload = { instacartShopping?: boolean };
type IngredientReport = { key: string; name: string; amount: string; originals: string[]; sources: Array<{ title: string; sourceName: string; sourceUrl: string }> };
type DeliverySelections = { recipes: boolean; grocery: boolean; calendar: boolean };
type DeliveryRecipient = { id: string; name: string; channel: "email" | "text"; address: string; selections: DeliverySelections };
type DeliveryRecipientDraft = { id: string; name: string; channel: "email" | "text"; address: string };

const proteinOptions = ["Beef", "Pork", "Fish", "Shrimp"];
const defaultStores: StorePreference[] = [
  { id: "default-whole-foods", name: "Whole Foods", address: "Near your shopping location" },
  { id: "default-jewel-osco", name: "Jewel-Osco", address: "Near your shopping location" },
  { id: "default-trader-joes", name: "Trader Joe’s", address: "Near your shopping location" },
];
const defaultRecipeFilters = { query: "", kind: "All meals", maxTime: "Any time", source: "All sources", protein: "All proteins", favoritesOnly: false };
const recipeBatchSize = 12;
const missingIngredientAmount = "Amount not provided";
const schoolLunchSideOptions = ["Individual chip bags", "Fresh fruit", "Yogurt cups", "Crunchy vegetables", "Snack bars"];
const schoolLunchSideIngredients: Record<string, { name: string; aisle: string }> = {
  "Individual chip bags": { name: "individual chip bags", aisle: "Pantry" },
  "Fresh fruit": { name: "apples", aisle: "Produce" },
  "Yogurt cups": { name: "yogurt cups", aisle: "Refrigerated" },
  "Crunchy vegetables": { name: "baby carrots", aisle: "Produce" },
  "Snack bars": { name: "gluten-free snack bars", aisle: "Pantry" },
};
const defaultDeliverySelections: DeliverySelections = { recipes: true, grocery: true, calendar: true };
const emailAddressPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const onboardingSteps = [
  { eyebrow: "STEP 1 OF 4", title: "Start with your household.", body: "Choose your dates, meals, budget, and dietary needs. Family preferences are included automatically." },
  { eyebrow: "STEP 2 OF 4", title: "Browse a catalog built for you.", body: "Filter a large recipe collection, save favorites, and add each recipe to lunch, dinner, or school lunch." },
  { eyebrow: "STEP 3 OF 4", title: "Shape your schedule.", body: "Quick-fill open slots or reorder meals by date. Your active plan follows your account across devices." },
  { eyebrow: "STEP 4 OF 4", title: "Review once, then take it anywhere.", body: "Confirm your ingredients, approve the final shopping list, then choose exactly how to send or save it." },
];

const unitAliases: Record<string, string> = {
  cup: "cup", cups: "cup", c: "cup",
  tablespoon: "tablespoon", tablespoons: "tablespoon", tbsp: "tablespoon", tbsps: "tablespoon",
  teaspoon: "teaspoon", teaspoons: "teaspoon", tsp: "teaspoon", tsps: "teaspoon",
  ounce: "ounce", ounces: "ounce", oz: "ounce",
  pound: "pound", pounds: "pound", lb: "pound", lbs: "pound",
  gram: "gram", grams: "gram", g: "gram",
  kilogram: "kilogram", kilograms: "kilogram", kg: "kilogram",
  milliliter: "milliliter", milliliters: "milliliter", ml: "milliliter",
  liter: "liter", liters: "liter", l: "liter",
  gallon: "gallon", gallons: "gallon", gal: "gallon", pint: "pint", pints: "pint", pt: "pint",
  quart: "quart", quarts: "quart", qt: "quart", can: "can", cans: "can", package: "package", packages: "package",
  bunch: "bunch", bunches: "bunch", head: "head", heads: "head", large: "large", medium: "medium", small: "small",
  clove: "each", cloves: "each", bag: "each", bags: "each", slice: "each", slices: "each", piece: "each", pieces: "each", serving: "each", servings: "each",
};

function parseNumber(value: string) {
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map(Number);
    return denominator ? numerator / denominator : 0;
  }
  return Number(value) || 0;
}

function normalizeDeliveryAddress(channel: "email" | "text", value: string) {
  const trimmed = value.trim();
  if (channel === "email") return emailAddressPattern.test(trimmed) ? trimmed.toLowerCase() : "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function validDeliverySelections(value: unknown): DeliverySelections {
  const selections = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { recipes: Boolean(selections.recipes), grocery: Boolean(selections.grocery), calendar: Boolean(selections.calendar) };
}

function sanitizeDeliveryRecipients(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry): DeliveryRecipient[] => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const channel = record.channel === "text" ? "text" : record.channel === "email" ? "email" : null;
    if (!channel) return [];
    const address = normalizeDeliveryAddress(channel, String(record.address || ""));
    const dedupeKey = `${channel}:${address}`;
    if (!address || seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);
    const selections = validDeliverySelections(record.selections);
    return [{
      id: String(record.id || crypto.randomUUID()).slice(0, 100),
      name: String(record.name || "").trim().slice(0, 80),
      channel,
      address,
      selections: channel === "text" ? { ...selections, calendar: false } : selections,
    }];
  }).slice(0, 10);
}

function hasDeliverySelection(selections: DeliverySelections) {
  return selections.recipes || selections.grocery || selections.calendar;
}

function parseIngredientMeasurement(original: string) {
  const normalized = original.trim()
    .replace(/([0-9])([¼½¾⅓⅔⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/[¼]/g, "1/4").replace(/[½]/g, "1/2").replace(/[¾]/g, "3/4")
    .replace(/[⅓]/g, "1/3").replace(/[⅔]/g, "2/3").replace(/[⅛]/g, "1/8")
    .replace(/[⅜]/g, "3/8").replace(/[⅝]/g, "5/8").replace(/[⅞]/g, "7/8");
  const match = normalized.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(.*)$/i);
  if (!match) return null;
  const quantity = match[1].split(/\s+/).reduce((sum, token) => sum + parseNumber(token), 0);
  if (!quantity) return null;
  const unitMatch = match[2].replace(/^\([^)]*\)\s*/, "").match(/^([a-zA-Z]+)\b/);
  const unit = unitMatch ? unitAliases[unitMatch[1].toLowerCase()] || "each" : "each";
  return { quantity, unit };
}

function isAcceptedIngredientAmount(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "as needed" || Boolean(parseIngredientMeasurement(value));
}

function formatIngredientAmount(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const whole = Math.floor(rounded);
  const decimal = Math.round((rounded - whole) * 100) / 100;
  const fractions: Record<string, string> = { "0.13": "⅛", "0.25": "¼", "0.33": "⅓", "0.38": "⅜", "0.5": "½", "0.63": "⅝", "0.67": "⅔", "0.75": "¾", "0.88": "⅞" };
  const fraction = fractions[String(decimal)];
  if (fraction) return whole ? `${whole}${fraction}` : fraction;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatMeasurement(quantity: number, unit: string) {
  const plurals: Record<string, string> = { bunch: "bunches", large: "large", medium: "medium", small: "small" };
  const label = unit === "each" ? "" : ` ${quantity === 1 ? unit : plurals[unit] || `${unit}s`}`;
  return `${formatIngredientAmount(quantity)}${label}`;
}

const ingredientPluralAliases: Record<string, string> = {
  tomatoes: "tomato", potatoes: "potato", leaves: "leaf", loaves: "loaf", halves: "half",
};

function canonicalIngredientKey(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[-–—/&+]/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\b(?:finely|roughly|coarsely)\b/g, " ")
    .replace(/\b(?:chopped|diced|minced|sliced|shredded|grated|crushed|peeled|seeded|drained|rinsed|divided|softened|melted)\b/g, " ")
    .replace(/\b(?:for garnish|for serving|to taste|as needed)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  const words = normalized.split(" ");
  const last = words.at(-1) || "";
  if (ingredientPluralAliases[last]) words[words.length - 1] = ingredientPluralAliases[last];
  else if (last.length > 4 && last.endsWith("ies")) words[words.length - 1] = `${last.slice(0, -3)}y`;
  else if (last.length > 3 && last.endsWith("s") && !/(?:ss|us|is|ous)$/.test(last)) words[words.length - 1] = last.slice(0, -1);
  return words.join(" ");
}

const genericIngredientLabel = /^(?:fresh\s+)?(?:vegetables?|produce|fruit|proteins?|lean protein or beans|beans or protein|herbs?|herbs and pantry staples|pantry staples|seasonings?|garnish|toppings?|sides?)$/i;

function isConcreteIngredientName(value: unknown) {
  const normalized = String(value || "").replace(/[–—/&+]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > 1 && !genericIngredientLabel.test(normalized);
}

const convertibleMeasurements: Record<string, { dimension: "volume" | "weight"; factor: number }> = {
  teaspoon: { dimension: "volume", factor: 1 }, tablespoon: { dimension: "volume", factor: 3 },
  milliliter: { dimension: "volume", factor: 0.202884 }, cup: { dimension: "volume", factor: 48 },
  pint: { dimension: "volume", factor: 96 }, quart: { dimension: "volume", factor: 192 },
  liter: { dimension: "volume", factor: 202.884 }, gallon: { dimension: "volume", factor: 768 },
  gram: { dimension: "weight", factor: 1 }, ounce: { dimension: "weight", factor: 28.3495 },
  pound: { dimension: "weight", factor: 453.592 }, kilogram: { dimension: "weight", factor: 1000 },
};

function mergeIngredientQuantities(values: string[]) {
  const dimensions = new Map<string, { total: number; largestUnit: string; largestFactor: number }>();
  const exactUnits = new Map<string, number>();
  let includesAsNeeded = false;
  values.flatMap((value) => value.split(/\s+\+\s+/)).forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === missingIngredientAmount) return;
    if (trimmed.toLowerCase() === "as needed") { includesAsNeeded = true; return; }
    const measurement = parseIngredientMeasurement(trimmed);
    if (!measurement) return;
    const convertible = convertibleMeasurements[measurement.unit];
    if (!convertible) {
      exactUnits.set(measurement.unit, (exactUnits.get(measurement.unit) || 0) + measurement.quantity);
      return;
    }
    const current = dimensions.get(convertible.dimension) || { total: 0, largestUnit: measurement.unit, largestFactor: convertible.factor };
    current.total += measurement.quantity * convertible.factor;
    if (convertible.factor > current.largestFactor) {
      current.largestUnit = measurement.unit;
      current.largestFactor = convertible.factor;
    }
    dimensions.set(convertible.dimension, current);
  });
  const quantities = [
    ...[...dimensions.values()].map((measurement) => formatMeasurement(measurement.total / measurement.largestFactor, measurement.largestUnit)),
    ...[...exactUnits.entries()].map(([unit, quantity]) => formatMeasurement(quantity, unit)),
    ...(includesAsNeeded ? ["As needed"] : []),
  ];
  return quantities.join(" + ") || missingIngredientAmount;
}

function grocerySection(name: string, aisle = "") {
  const haystack = `${aisle} ${name}`.toLowerCase();
  if (/pantry|canned|spice|pasta|rice|chip|snack bar/.test(haystack)) return "Pantry";
  if (/meat|seafood|fish|salmon|shrimp|beef|pork|chicken|turkey|tuna|cod/.test(haystack)) return "Meat & seafood";
  if (/milk|cheese|refrigerated|dairy|egg|yogurt|butter/.test(haystack)) return "Refrigerated";
  if (/bakery|bread|tortilla|pita|bun/.test(haystack)) return "Bakery";
  if (/produce|vegetable|fruit|herb|onion|garlic|lettuce|spinach|tomato|pepper|lemon|lime/.test(haystack)) return "Produce";
  return "Pantry";
}

function ingredientOverlapScore(meal: Meal, ingredientNames: Set<string>) {
  return (meal.ingredients || []).reduce((score, ingredient) => score + Number(ingredientNames.has(ingredient.name.trim().toLowerCase())), 0);
}

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
  if (/^(mealdb-|import-)/.test(String(meal.id || "")) && /^https?:\/\//.test(String(meal.image || ""))) return String(meal.image);
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

function weekdaysInPlan(startDate: string, days: number) {
  const date = new Date(`${startDate}T12:00:00`);
  let weekdays = 0;
  for (let offset = 0; offset < days; offset += 1) {
    if (date.getDay() !== 0 && date.getDay() !== 6) weekdays += 1;
    date.setDate(date.getDate() + 1);
  }
  return weekdays;
}

function Toggle({ label, checked, onChange, note, disabled = false }: { label: string; checked: boolean; onChange: () => void; note?: string; disabled?: boolean }) {
  return <button className="toggle-row" onClick={onChange} type="button" aria-pressed={checked} disabled={disabled}><span><strong>{label}</strong>{note && <small>{note}</small>}</span><span className={`toggle ${checked ? "on" : ""}`}><i /></span></button>;
}

function Stars({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return <div className="stars" role="group" aria-label={label}>{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-pressed={star === value} onClick={() => onChange(star)} aria-label={`${star} out of 5`}>{star <= value ? "★" : "☆"}</button>)}</div>;
}

export default function Home() {
  const [view, setView] = useState<View>("plan");
  const [planDays, setPlanDays] = useState(7);
  const [planStartDate, setPlanStartDate] = useState(todayInputDate);
  const [mealType, setMealType] = useState("Lunch + dinner");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [budget, setBudget] = useState(150);
  const [leftovers, setLeftovers] = useState(true);
  const [reuseIngredients, setReuseIngredients] = useState(false);
  const [glutenFree, setGlutenFree] = useState(true);
  const [lowDairy, setLowDairy] = useState(true);
  const [mediterranean, setMediterranean] = useState(true);
  const [kidLunches, setKidLunches] = useState(false);
  const [schoolLunchSides, setSchoolLunchSides] = useState(["Individual chip bags", "Fresh fruit"]);
  const [oneStore, setOneStore] = useState(false);
  const [household, setHousehold] = useState("My household");
  const [maxTime, setMaxTime] = useState("45 minutes");
  const [skill, setSkill] = useState("Comfortable");
  const [exclusions, setExclusions] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState("Whole Foods");
  const [preferredStores, setPreferredStores] = useState<StorePreference[]>(defaultStores);
  const [storeRadius, setStoreRadius] = useState(5);
  const [nearbyStores, setNearbyStores] = useState<StorePreference[]>([]);
  const [storeSearchStatus, setStoreSearchStatus] = useState("");
  const [storeSearchBusy, setStoreSearchBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [plannedMeals, setPlannedMeals] = useState<Meal[]>([]);
  const [planning, setPlanning] = useState(false);
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("Uptown, Chicago, IL");
  const [locationQuery, setLocationQuery] = useState("Uptown, Chicago, IL");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationCoordinates, setLocationCoordinates] = useState<{ lat: string; lon: string } | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberDraft, setMemberDraft] = useState({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false, avoidOnions: false, proteins: [] as string[] });
  const [editingMemberId, setEditingMemberId] = useState("");
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [ratingMeal, setRatingMeal] = useState<Meal | null>(null);
  const [similarTo, setSimilarTo] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [authStep, setAuthStep] = useState<"email" | "details" | "code">("email");
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
  const [importUrl, setImportUrl] = useState("");
  const [importKind, setImportKind] = useState("Dinner");
  const [importBusy, setImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [plannerNotice, setPlannerNotice] = useState("");
  const [planHydrated, setPlanHydrated] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [calendarOrder, setCalendarOrder] = useState<"plan" | "random">("plan");
  const [draggedMealId, setDraggedMealId] = useState("");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [ingredientAdjustments, setIngredientAdjustments] = useState<Record<string, string>>({});
  const [ingredientNameEdits, setIngredientNameEdits] = useState<Record<string, string>>({});
  const [confirmedIngredientsSignature, setConfirmedIngredientsSignature] = useState("");
  const [reviewedPlanSignature, setReviewedPlanSignature] = useState("");
  const [alreadyHaveIngredients, setAlreadyHaveIngredients] = useState<string[]>([]);
  const [asNeededIngredients, setAsNeededIngredients] = useState<string[]>([]);
  const [planStorageOwnerId, setPlanStorageOwnerId] = useState("");
  const [planSaveStatus, setPlanSaveStatus] = useState("");
  const [instacartEnabled, setInstacartEnabled] = useState(false);
  const [selfDeliverySelections, setSelfDeliverySelections] = useState<DeliverySelections>(defaultDeliverySelections);
  const [deliveryRecipients, setDeliveryRecipients] = useState<DeliveryRecipient[]>([]);
  const [recipientDraft, setRecipientDraft] = useState<DeliveryRecipientDraft | null>(null);
  const [recipientError, setRecipientError] = useState("");
  const [deviceActions, setDeviceActions] = useState({ copy: false, notes: false, calendar: false, instacart: false });
  const [calendarProvider, setCalendarProvider] = useState<"google" | "apple">("google");
  const [pendingTextRecipients, setPendingTextRecipients] = useState<DeliveryRecipient[]>([]);
  const [pendingTextReaderLinks, setPendingTextReaderLinks] = useState<Record<string, string>>({});
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [familyStatus, setFamilyStatus] = useState("");
  const [recipeFilters, setRecipeFilters] = useState(defaultRecipeFilters);
  const [accessibilityFeedback, setAccessibilityFeedback] = useState({ name: "", email: "", details: "", website: "" });
  const [accessibilityStatus, setAccessibilityStatus] = useState("");
  const [accessibilityBusy, setAccessibilityBusy] = useState(false);
  const [ingredientReport, setIngredientReport] = useState<IngredientReport | null>(null);
  const [ingredientReportCategory, setIngredientReportCategory] = useState("Incorrect amount");
  const [ingredientReportCorrection, setIngredientReportCorrection] = useState("");
  const [ingredientReportDetails, setIngredientReportDetails] = useState("");
  const [ingredientReportStatus, setIngredientReportStatus] = useState("");
  const [ingredientReportBusy, setIngredientReportBusy] = useState(false);

  const people = adults + kids;
  const servingEquivalents = adults + kids * .5;
  const dinnerTarget = planDays;
  const schoolLunchTarget = kidLunches && kids > 0 ? weekdaysInPlan(planStartDate, planDays) : 0;
  const totalLunchDays = mealType === "Lunch + dinner" ? planDays : 0;
  const lunchTarget = totalLunchDays;
  const mealTargets = useMemo(() => ({ Lunch: lunchTarget, Dinner: dinnerTarget, "School lunch": schoolLunchTarget }), [lunchTarget, dinnerTarget, schoolLunchTarget]);
  const activeMealKinds = useMemo(() => (Object.entries(mealTargets) as Array<[string, number]>).filter(([, target]) => target > 0).map(([kind]) => kind), [mealTargets]);
  const totalTarget = dinnerTarget + lunchTarget + schoolLunchTarget;
  const filledCount = activeMealKinds.reduce((sum, kind) => sum + Math.min(plannedMeals.filter((meal) => meal.kind === kind).length, mealTargets[kind as keyof typeof mealTargets]), 0);
  const planIsFull = totalTarget > 0 && activeMealKinds.every((kind) => plannedMeals.filter((meal) => meal.kind === kind).length >= mealTargets[kind as keyof typeof mealTargets]);
  const targetServingUnits = (dinnerTarget + lunchTarget) * servingEquivalents + schoolLunchTarget * kids * .5;
  const targetServingBudget = budget / Math.max(1, targetServingUnits);
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
    low: Math.max(12, Math.round(targetServingUnits * 2.65 * .84)),
    high: Math.max(18, Math.round(targetServingUnits * 4.15 * .9)),
  }), [targetServingUnits]);
  const schoolLunchSideEstimate = useMemo(() => {
    const perPerson: Record<string, number> = { "Individual chip bags": .55, "Fresh fruit": .7, "Yogurt cups": .8, "Crunchy vegetables": .5, "Snack bars": .65 };
    const schoolLunchCount = plannedMeals.filter((meal) => meal.kind === "School lunch").length;
    return schoolLunchCount * kids * schoolLunchSides.reduce((sum, side) => sum + (perPerson[side] || 0), 0);
  }, [plannedMeals, kids, schoolLunchSides]);
  const recipeSubtotal = useMemo(() => Math.round(plannedMeals.reduce((sum, meal) => sum + parseServingCost(meal) * (meal.kind === "School lunch" ? kids * .5 : servingEquivalents), 0) + schoolLunchSideEstimate), [plannedMeals, kids, servingEquivalents, schoolLunchSideEstimate]);
  const storeEstimates = useMemo(() => preferredStores.map((store, index) => {
    const normalizedName = store.name.toLowerCase();
    const priceFactor = normalizedName.includes("whole foods") ? 1.08
      : normalizedName.includes("trader joe") || normalizedName.includes("aldi") ? .92
      : normalizedName.includes("jewel") || normalizedName.includes("mariano") ? .98
      : 1 + Math.min(index, 4) * .01;
    return { ...store, price: Math.round(recipeSubtotal * priceFactor), availability: Math.max(84, 98 - index * 2) };
  }), [preferredStores, recipeSubtotal]);
  const selectedEstimate = storeEstimates.find((store) => store.name === selectedStore)?.price || recipeSubtotal;
  const visibleStoreEstimates = oneStore ? storeEstimates.filter((store) => store.name === selectedStore) : storeEstimates;
  const groceryIngredients = useMemo(() => plannedMeals.flatMap((meal) => {
    const mealServings = meal.kind === "School lunch" ? kids * .5 : servingEquivalents;
    const scale = mealServings / Math.max(1, meal.recipeServings || 4);
    const source = { title: meal.title, sourceName: meal.sourceName || "Unknown source", sourceUrl: meal.sourceUrl || "" };
    const recipeIngredients = (meal.ingredients || []).filter((ingredient) => isConcreteIngredientName(ingredient.name)).map((ingredient) => ({ ingredient, scale, source }));
    if (meal.kind !== "School lunch") return recipeIngredients;
    const sides = schoolLunchSides.map((side) => schoolLunchSideIngredients[side]).filter(Boolean).map((ingredient) => ({
      ingredient: { ...ingredient, original: `${kids} ${ingredient.name}` }, scale: 1, source,
    }));
    return [...recipeIngredients, ...sides];
  }), [plannedMeals, kids, servingEquivalents, schoolLunchSides]);
  const groceryEntries = useMemo(() => {
    const merged = new Map<string, { name: string; aisle: string; occurrences: number; originals: string[]; totals: Record<string, number>; sources: Array<{ title: string; sourceName: string; sourceUrl: string }> }>();
    groceryIngredients.forEach(({ ingredient, scale, source }) => {
      const name = (ingredient.name || ingredient.original || "").trim();
      if (!name) return;
      const key = canonicalIngredientKey(name);
      if (!key) return;
      const current = merged.get(key) || { name: name[0].toUpperCase() + name.slice(1), aisle: ingredient.aisle || "", occurrences: 0, originals: [], totals: {}, sources: [] };
      current.occurrences += 1;
      if (ingredient.original && !current.originals.includes(ingredient.original)) current.originals.push(ingredient.original);
      if (!current.sources.some((item) => item.title === source.title && item.sourceUrl === source.sourceUrl)) current.sources.push(source);
      const measurement = parseIngredientMeasurement(ingredient.original || "");
      if (measurement) current.totals[measurement.unit] = (current.totals[measurement.unit] || 0) + measurement.quantity * scale;
      merged.set(key, current);
    });
    return [...merged.entries()].map(([key, value]) => ({
      key,
      ...value,
      suggestedQuantity: Object.entries(value.totals).length
        ? mergeIngredientQuantities(Object.entries(value.totals).map(([unit, quantity]) => formatMeasurement(quantity, unit)))
        : missingIngredientAmount,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [groceryIngredients]);
  const { shoppingEntries, alreadyHaveEntries } = useMemo(() => {
    const consolidate = (entries: typeof groceryEntries) => {
      const merged = new Map<string, (typeof groceryEntries)[number] & { quantities: string[] }>();
      entries.forEach((entry) => {
        const name = ingredientNameEdits[entry.key]?.trim() || entry.name;
        const key = canonicalIngredientKey(name);
        if (!key) return;
        const current = merged.get(key) || { ...entry, key: `final:${key}`, name, occurrences: 0, originals: [], quantities: [] };
        current.occurrences += entry.occurrences;
        entry.originals.forEach((original) => { if (!current.originals.includes(original)) current.originals.push(original); });
        current.quantities.push(asNeededIngredients.includes(entry.key) ? "As needed" : ingredientAdjustments[entry.key]?.trim() || entry.suggestedQuantity);
        if (!current.aisle && entry.aisle) current.aisle = entry.aisle;
        merged.set(key, current);
      });
      return [...merged.values()].map(({ quantities, ...entry }) => ({
        ...entry,
        suggestedQuantity: mergeIngredientQuantities(quantities),
      })).sort((a, b) => a.name.localeCompare(b.name));
    };
    return {
      shoppingEntries: consolidate(groceryEntries.filter((entry) => !alreadyHaveIngredients.includes(entry.key))),
      alreadyHaveEntries: consolidate(groceryEntries.filter((entry) => alreadyHaveIngredients.includes(entry.key))),
    };
  }, [groceryEntries, ingredientNameEdits, ingredientAdjustments, alreadyHaveIngredients, asNeededIngredients]);
  const unresolvedAmountEntries = useMemo(() => groceryEntries.filter((entry) => {
    if (alreadyHaveIngredients.includes(entry.key) || asNeededIngredients.includes(entry.key)) return false;
    return !isAcceptedIngredientAmount(ingredientAdjustments[entry.key] ?? entry.suggestedQuantity);
  }), [groceryEntries, ingredientAdjustments, alreadyHaveIngredients, asNeededIngredients]);
  const groceryGroups = useMemo(() => {
    const groups: Record<string, { icon: string; title: string; items: typeof groceryEntries }> = {
      Produce: { icon: "🥬", title: "Produce", items: [] },
      "Meat & seafood": { icon: "🐟", title: "Meat & seafood", items: [] },
      Refrigerated: { icon: "🧊", title: "Refrigerated", items: [] },
      Bakery: { icon: "🥖", title: "Bakery", items: [] },
      Pantry: { icon: "🥫", title: "Pantry", items: [] },
    };
    shoppingEntries.forEach((entry) => groups[grocerySection(entry.name, entry.aisle)].items.push(entry));
    return Object.values(groups).filter((group) => group.items.length).map((group) => ({ ...group, count: group.items.length }));
  }, [shoppingEntries]);
  const planSignature = useMemo(() => JSON.stringify({
    planDays,
    adults,
    kids,
    mealType,
    kidLunches,
    schoolLunchSides,
    mealIds: plannedMeals.map((meal) => meal.id),
    ingredientAdjustments,
    ingredientNameEdits,
    alreadyHaveIngredients: [...alreadyHaveIngredients].sort(),
    asNeededIngredients: [...asNeededIngredients].sort(),
  }), [planDays, adults, kids, mealType, kidLunches, schoolLunchSides, plannedMeals, ingredientAdjustments, ingredientNameEdits, alreadyHaveIngredients, asNeededIngredients]);
  const ingredientsConfirmed = Boolean(planSignature && confirmedIngredientsSignature === planSignature);
  const groceryListApproved = Boolean(planSignature && reviewedPlanSignature === planSignature);
  const recipeSources = useMemo(() => [...new Set(recipeIdeas.map((meal) => meal.sourceName).filter(Boolean) as string[])].sort(), [recipeIdeas]);
  const selectedIngredientNames = useMemo(() => new Set(plannedMeals.flatMap((meal) => meal.ingredients || []).map((ingredient) => ingredient.name.trim().toLowerCase()).filter(Boolean)), [plannedMeals]);
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
  }).sort((a, b) => reuseIngredients ? ingredientOverlapScore(b, selectedIngredientNames) - ingredientOverlapScore(a, selectedIngredientNames) : 0), [recipeIdeas, recipeFilters, favorites, effectiveGlutenFree, effectiveLowDairy, mediterranean, reuseIngredients, selectedIngredientNames]);
  const visibleRecipeIdeas = filteredRecipeIdeas.slice(0, visibleRecipeCount);
  const recipeFiltersActive = recipeFilters.query !== ""
    || recipeFilters.kind !== defaultRecipeFilters.kind
    || recipeFilters.maxTime !== defaultRecipeFilters.maxTime
    || recipeFilters.source !== defaultRecipeFilters.source
    || recipeFilters.protein !== defaultRecipeFilters.protein
    || recipeFilters.favoritesOnly;
  const shortLocation = location.split(",").slice(0, 2).join(",").trim() || location;
  const selfDeliveryRecipient = useMemo<DeliveryRecipient | null>(() => user ? ({ id: "self", name: user.name || "Me", channel: "email", address: user.email, selections: selfDeliverySelections }) : null, [user, selfDeliverySelections]);
  const externalDeliveryRecipients = useMemo(() => deliveryRecipients.filter((recipient) => !(selfDeliveryRecipient && recipient.channel === "email" && recipient.address === selfDeliveryRecipient.address)), [deliveryRecipients, selfDeliveryRecipient]);
  const allDeliveryRecipients = useMemo(() => selfDeliveryRecipient ? [selfDeliveryRecipient, ...externalDeliveryRecipients] : externalDeliveryRecipients, [selfDeliveryRecipient, externalDeliveryRecipients]);
  const effectiveDeliveryRecipients = useMemo(() => allDeliveryRecipients.map((recipient) => ({ ...recipient, selections: { ...recipient.selections, grocery: groceryGroups.length > 0 && recipient.selections.grocery } })), [allDeliveryRecipients, groceryGroups.length]);
  const selectedRecipientCount = effectiveDeliveryRecipients.filter((recipient) => hasDeliverySelection(recipient.selections)).length;
  const selectedDeviceActionCount = [groceryGroups.length > 0 && deviceActions.copy, groceryGroups.length > 0 && deviceActions.notes, deviceActions.calendar, groceryGroups.length > 0 && instacartEnabled && deviceActions.instacart].filter(Boolean).length;
  const selectedDeliveryActionCount = selectedRecipientCount + selectedDeviceActionCount;
  const allDeliveryActionsSelected = allDeliveryRecipients.length > 0
    && allDeliveryRecipients.every((recipient) => recipient.selections.recipes && (!groceryGroups.length || recipient.selections.grocery) && (recipient.channel === "text" || recipient.selections.calendar))
    && (!groceryGroups.length || (deviceActions.copy && deviceActions.notes)) && deviceActions.calendar && (!instacartEnabled || !groceryGroups.length || deviceActions.instacart);
  const profilePreferences = useMemo(() => ({
    planDays, adults, kids, planStartDate, mealType, budget, leftovers, reuseIngredients, glutenFree, lowDairy, mediterranean,
    kidLunches, schoolLunchSides, oneStore, selectedStore, maxTime, skill, exclusions,
    preferredStores, storeRadius, locationCoordinates,
  }), [planDays, adults, kids, planStartDate, mealType, budget, leftovers, reuseIngredients, glutenFree, lowDairy, mediterranean, kidLunches, schoolLunchSides, oneStore, selectedStore, maxTime, skill, exclusions, preferredStores, storeRadius, locationCoordinates]);

  function applyPersonalData(profileData: ProfilePayload, favoriteData: FavoritesPayload, familyData: FamilyPayload, ratingData: RatingsPayload) {
    if (profileData.profile) {
      setHousehold(profileData.profile.household_name); setAdults(profileData.profile.people); setKids(0);
      setLocation(profileData.profile.location); setLocationQuery(profileData.profile.location);
      try {
        const preferences = JSON.parse(profileData.profile.preferences_json || "{}");
        const savedPlanDays = Number(preferences.planDays) || (preferences.range === "Day" ? 1 : preferences.range === "Month" ? 30 : preferences.range === "Week" ? 7 : 0);
        const savedAdults = Number.isFinite(Number(preferences.adults)) ? Math.max(0, Math.min(20, Math.round(Number(preferences.adults)))) : profileData.profile.people;
        const savedKids = Number.isFinite(Number(preferences.kids)) ? Math.max(0, Math.min(20, Math.round(Number(preferences.kids)))) : 0;
        if (savedPlanDays) setPlanDays(Math.max(1, Math.min(31, Math.round(savedPlanDays))));
        setAdults(savedAdults); setKids(savedKids);
        if (preferences.planStartDate) setPlanStartDate(preferences.planStartDate);
        if (preferences.mealType) setMealType(preferences.mealType);
        if (preferences.budget) setBudget(preferences.budget);
        if (typeof preferences.leftovers === "boolean") setLeftovers(preferences.leftovers);
        if (typeof preferences.reuseIngredients === "boolean") setReuseIngredients(preferences.reuseIngredients);
        if (typeof preferences.glutenFree === "boolean") setGlutenFree(preferences.glutenFree);
        if (typeof preferences.lowDairy === "boolean") setLowDairy(preferences.lowDairy);
        if (typeof preferences.mediterranean === "boolean") setMediterranean(preferences.mediterranean);
        if (typeof preferences.kidLunches === "boolean") setKidLunches(preferences.kidLunches && savedKids > 0);
        if (Array.isArray(preferences.schoolLunchSides)) setSchoolLunchSides(preferences.schoolLunchSides.filter((side: unknown) => schoolLunchSideOptions.includes(String(side))).map(String));
        if (typeof preferences.oneStore === "boolean") setOneStore(preferences.oneStore);
        if (preferences.selectedStore) setSelectedStore(preferences.selectedStore);
        if (Array.isArray(preferences.preferredStores)) {
          const savedStores = preferences.preferredStores.slice(0, 12).flatMap((store: unknown) => {
            if (!store || typeof store !== "object") return [];
            const item = store as Record<string, unknown>;
            const name = String(item.name || "").trim().slice(0, 120);
            if (!name) return [];
            return [{ id: String(item.id || crypto.randomUUID()).slice(0, 160), name, address: String(item.address || "").slice(0, 200), distanceMiles: Number(item.distanceMiles) || undefined, lat: String(item.lat || "") || undefined, lon: String(item.lon || "") || undefined }];
          });
          if (savedStores.length) {
            setPreferredStores(savedStores);
            if (!savedStores.some((store: StorePreference) => store.name === preferences.selectedStore)) setSelectedStore(savedStores[0].name);
          }
        }
        if ([1, 3, 5, 10, 15, 25].includes(Number(preferences.storeRadius))) setStoreRadius(Number(preferences.storeRadius));
        if (preferences.locationCoordinates && typeof preferences.locationCoordinates === "object") {
          const coordinates = preferences.locationCoordinates as Record<string, unknown>;
          if (coordinates.lat && coordinates.lon) setLocationCoordinates({ lat: String(coordinates.lat), lon: String(coordinates.lon) });
        }
        if (preferences.maxTime) setMaxTime(preferences.maxTime);
        if (preferences.skill) setSkill(preferences.skill);
        if (typeof preferences.exclusions === "string") setExclusions(preferences.exclusions);
      } catch { /* Ignore an older malformed preference record. */ }
    }
    if (favoriteData.favorites) setFavorites(favoriteData.favorites.map((recipe: { title: string }) => recipe.title));
    if (familyData.members) setMembers(familyData.members);
    if (ratingData.ratings) setRatings(Object.fromEntries(ratingData.ratings.map((rating: { recipe_id: string; quality: number; ease: number }) => [rating.recipe_id, { quality: rating.quality, ease: rating.ease }])));
  }

  function applySavedPlan(cachedPlan: string | Record<string, unknown> | null | undefined) {
    if (!cachedPlan) return;
    try {
      const saved = typeof cachedPlan === "string" ? JSON.parse(cachedPlan) : cachedPlan;
      const savedPlanDays = Number(saved.planDays) || (saved.range === "Day" ? 1 : saved.range === "Month" ? 30 : saved.range === "Week" ? 7 : 0);
      const savedAdults = Number.isFinite(Number(saved.adults)) ? Math.max(0, Math.min(20, Math.round(Number(saved.adults)))) : Math.max(1, Math.min(20, Math.round(Number(saved.people) || 2)));
      const savedKids = Number.isFinite(Number(saved.kids)) ? Math.max(0, Math.min(20, Math.round(Number(saved.kids)))) : 0;
      if (Array.isArray(saved.plannedMeals)) setPlannedMeals(saved.plannedMeals.filter((meal: Meal) => savedKids > 0 || meal.kind !== "School lunch").map((meal: Meal) => ({ ...meal, image: recipeThumbnail(meal) })));
      if (Array.isArray(saved.recipeIdeas)) setRecipeIdeas(saved.recipeIdeas.filter((meal: Meal) => savedKids > 0 || meal.kind !== "School lunch").map((meal: Meal) => ({ ...meal, image: recipeThumbnail(meal) })));
      if (savedPlanDays) setPlanDays(Math.max(1, Math.min(31, Math.round(savedPlanDays))));
      if (saved.planStartDate) setPlanStartDate(saved.planStartDate);
      if (saved.mealType) setMealType(saved.mealType);
      setAdults(savedAdults); setKids(savedKids);
      if (saved.budget) setBudget(saved.budget);
      if (typeof saved.leftovers === "boolean") setLeftovers(saved.leftovers);
      if (typeof saved.reuseIngredients === "boolean") setReuseIngredients(saved.reuseIngredients);
      if (typeof saved.glutenFree === "boolean") setGlutenFree(saved.glutenFree);
      if (typeof saved.lowDairy === "boolean") setLowDairy(saved.lowDairy);
      if (typeof saved.mediterranean === "boolean") setMediterranean(saved.mediterranean);
      if (typeof saved.kidLunches === "boolean") setKidLunches(saved.kidLunches && savedKids > 0);
      if (Array.isArray(saved.schoolLunchSides)) setSchoolLunchSides(saved.schoolLunchSides.filter((side: unknown) => schoolLunchSideOptions.includes(String(side))).map(String));
      if (typeof saved.oneStore === "boolean") setOneStore(saved.oneStore);
      if (saved.selectedStore) setSelectedStore(saved.selectedStore);
      if (saved.household) setHousehold(saved.household);
      if (saved.maxTime) setMaxTime(saved.maxTime);
      if (saved.skill) setSkill(saved.skill);
      if (typeof saved.exclusions === "string") setExclusions(saved.exclusions);
      if (saved.location) { setLocation(saved.location); setLocationQuery(saved.location); }
      if (saved.calendarOrder === "random") setCalendarOrder("random");
      const savedAdjustments = saved.ingredientAdjustments && typeof saved.ingredientAdjustments === "object"
        ? Object.fromEntries(Object.entries(saved.ingredientAdjustments as Record<string, unknown>).filter(([, value]) => String(value).trim().toLowerCase() !== "as needed").map(([key, value]) => [key, String(value)]))
        : {};
      const legacyAsNeeded = saved.ingredientAdjustments && typeof saved.ingredientAdjustments === "object"
        ? Object.entries(saved.ingredientAdjustments as Record<string, unknown>).filter(([, value]) => String(value).trim().toLowerCase() === "as needed").map(([key]) => key)
        : [];
      setIngredientAdjustments(savedAdjustments);
      if (saved.ingredientNameEdits && typeof saved.ingredientNameEdits === "object") setIngredientNameEdits(saved.ingredientNameEdits);
      if (Array.isArray(saved.alreadyHaveIngredients)) setAlreadyHaveIngredients(saved.alreadyHaveIngredients.map(String).slice(0, 500));
      setAsNeededIngredients([...new Set([...(Array.isArray(saved.asNeededIngredients) ? saved.asNeededIngredients.map(String) : []), ...legacyAsNeeded])].slice(0, 500));
      if (typeof saved.confirmedIngredientsSignature === "string") setConfirmedIngredientsSignature(saved.confirmedIngredientsSignature);
      else if (typeof saved.reviewedPlanSignature === "string") setConfirmedIngredientsSignature(saved.reviewedPlanSignature);
      if (typeof saved.reviewedPlanSignature === "string") setReviewedPlanSignature(saved.reviewedPlanSignature);
      if (saved.selfDeliverySelections && typeof saved.selfDeliverySelections === "object") setSelfDeliverySelections(validDeliverySelections(saved.selfDeliverySelections));
      if (Array.isArray(saved.deliveryRecipients)) setDeliveryRecipients(sanitizeDeliveryRecipients(saved.deliveryRecipients));
      else {
        const legacyEmailSelections = new Map<string, DeliverySelections>();
        const legacyRecipeEmails = String(saved.emailRecipients || "").split(/[;,\n]/).map((value) => normalizeDeliveryAddress("email", value)).filter(Boolean);
        const legacyGroceryEmails = String(saved.groceryEmailRecipients || "").split(/[;,\n]/).map((value) => normalizeDeliveryAddress("email", value)).filter(Boolean);
        legacyRecipeEmails.forEach((address) => legacyEmailSelections.set(address, { recipes: true, grocery: legacyGroceryEmails.includes(address), calendar: false }));
        legacyGroceryEmails.forEach((address) => legacyEmailSelections.set(address, { ...(legacyEmailSelections.get(address) || { recipes: false, grocery: false, calendar: false }), grocery: true }));
        const migratedRecipients: DeliveryRecipient[] = [...legacyEmailSelections].map(([address, selections]) => ({ id: crypto.randomUUID(), name: "", channel: "email", address, selections }));
        const legacyText = normalizeDeliveryAddress("text", String(saved.groceryTextRecipient || ""));
        if (legacyText) migratedRecipients.push({ id: crypto.randomUUID(), name: "", channel: "text", address: legacyText, selections: { recipes: false, grocery: true, calendar: false } });
        setDeliveryRecipients(migratedRecipients.slice(0, 10));
      }
      if (saved.deviceActions && typeof saved.deviceActions === "object") {
        const actions = saved.deviceActions as Record<string, unknown>;
        setDeviceActions({ copy: Boolean(actions.copy), notes: Boolean(actions.notes), calendar: Boolean(actions.calendar), instacart: Boolean(actions.instacart) });
      } else if (saved.deliveryActions && typeof saved.deliveryActions === "object") {
        const actions = saved.deliveryActions as Record<string, unknown>;
        const destination = String(saved.groceryDestination || "");
        setDeviceActions({ copy: Boolean(actions.grocery) && destination === "copy", notes: Boolean(actions.grocery) && destination === "notes", calendar: Boolean(actions.calendar), instacart: Boolean(actions.instacart) });
      }
      if (saved.calendarProvider === "apple" || saved.calendarProvider === "google") setCalendarProvider(saved.calendarProvider);
    } catch { /* Ignore a corrupted device cache. */ }
  }

  async function reloadPersonalData() {
    const [profileData, favoriteData, familyData, ratingData] = await Promise.all([
      fetch("/api/profile").then((response) => response.json()),
      fetch("/api/favorites").then((response) => response.json()),
      fetch("/api/family").then((response) => response.json()),
      fetch("/api/ratings").then((response) => response.json()),
    ]);
    applyPersonalData(profileData, favoriteData, familyData, ratingData);
  }

  useEffect(() => {
    let id = window.localStorage.getItem("grocer-eaze-owner");
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem("grocer-eaze-owner", id); }
    const onboardingComplete = window.localStorage.getItem("grocer-eaze-onboarding-complete") === "true";
    void (async () => {
      try {
        const [authData, capabilities] = await Promise.all([
          fetch("/api/auth/me").then((r) => r.json()) as Promise<{ user?: AccountUser | null }>,
          fetch("/api/capabilities").then((r) => r.ok ? r.json() : {}).catch(() => ({})) as Promise<CapabilitiesPayload>,
        ]);
        let profileData: ProfilePayload = {};
        let favoriteData: FavoritesPayload = {};
        let familyData: FamilyPayload = {};
        let ratingData: RatingsPayload = {};
        let cloudPlan: { plan?: Record<string, unknown> | null } = { plan: null };
        if (authData.user) {
          [profileData, favoriteData, familyData, ratingData, cloudPlan] = await Promise.all([
            fetch("/api/profile").then((r) => r.ok ? r.json() : {}),
            fetch("/api/favorites").then((r) => r.ok ? r.json() : {}),
            fetch("/api/family").then((r) => r.ok ? r.json() : {}),
            fetch("/api/ratings").then((r) => r.ok ? r.json() : {}),
            fetch("/api/active-plan").then((r) => r.ok ? r.json() : { plan: null }),
          ]);
        }
        setOwnerId(id);
        applyPersonalData(profileData, favoriteData, familyData, ratingData);
        setInstacartEnabled(Boolean(capabilities.instacartShopping));
        const scopedPlanKey = authData.user ? `grocer-eaze-active-plan:${authData.user.id}` : "";
        let cachedPlan = scopedPlanKey ? window.localStorage.getItem(scopedPlanKey) : null;
        const legacyPlan = window.localStorage.getItem("grocer-eaze-active-plan");
        if (scopedPlanKey && !cachedPlan && legacyPlan) {
          cachedPlan = legacyPlan;
          window.localStorage.setItem(scopedPlanKey, legacyPlan);
        }
        window.localStorage.removeItem("grocer-eaze-active-plan");
        if (authData.user) {
          setUser(authData.user); setEmail(authData.user.email); setPlanStorageOwnerId(authData.user.id);
        }
        const requestedView = window.location.hash.replace("#", "") as View;
        if (["meals", "list", "shopping", "delivery"].includes(requestedView) && !authData.user?.hasAccess) {
          const destination: View = authData.user ? "plans" : "account";
          setView(destination);
          window.history.replaceState(null, "", `#${destination}`);
          setAccountStatus(authData.user ? "Choose a membership to unlock meal planning and exports." : "Sign in before using meal planning tools.");
        }
        setAuthLoaded(true);
        if (cloudPlan.plan) {
          applySavedPlan(cloudPlan.plan);
          setPlanSaveStatus("Plan restored from your account.");
        } else {
          applySavedPlan(cachedPlan);
          if (cachedPlan) setPlanSaveStatus("Device plan restored and ready to sync.");
        }
        setPlanHydrated(true);
        if (!onboardingComplete) setOnboardingStep(0);
      } catch {
        const requestedView = window.location.hash.replace("#", "") as View;
        if (["meals", "list", "shopping", "delivery"].includes(requestedView)) {
          setView("account");
          window.history.replaceState(null, "", "#account");
          setAccountStatus("Sign in before using meal planning tools.");
        }
        setAuthLoaded(true);
        setPlanHydrated(true);
        if (!onboardingComplete) setOnboardingStep(0);
      }
    })();
  }, []);

  useEffect(() => {
    if (!planHydrated || !planStorageOwnerId) return;
    const plan = {
      plannedMeals,
      recipeIdeas: recipeIdeas.slice(0, 90),
      planDays, adults, kids, planStartDate, mealType, budget, leftovers, reuseIngredients, glutenFree, lowDairy, mediterranean,
      kidLunches, schoolLunchSides, oneStore, selectedStore, household, maxTime, skill, exclusions, location, calendarOrder,
      ingredientAdjustments, ingredientNameEdits, alreadyHaveIngredients, asNeededIngredients, confirmedIngredientsSignature, reviewedPlanSignature,
      selfDeliverySelections, deviceActions, calendarProvider,
    };
    try { window.localStorage.setItem(`grocer-eaze-active-plan:${planStorageOwnerId}`, JSON.stringify(plan)); }
    catch { /* The account copy remains authoritative if device storage is unavailable. */ }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/active-plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }), signal: controller.signal });
        setPlanSaveStatus(response.ok ? "Plan saved to your account." : "Plan is saved on this device; account sync will retry.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlanSaveStatus("Plan is saved on this device; account sync will retry.");
      }
    }, 750);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [planHydrated, planStorageOwnerId, plannedMeals, recipeIdeas, planDays, adults, kids, planStartDate, mealType, budget, leftovers, reuseIngredients, glutenFree, lowDairy, mediterranean, kidLunches, schoolLunchSides, oneStore, selectedStore, household, maxTime, skill, exclusions, location, calendarOrder, ingredientAdjustments, ingredientNameEdits, alreadyHaveIngredients, asNeededIngredients, confirmedIngredientsSignature, reviewedPlanSignature, selfDeliverySelections, deviceActions, calendarProvider]);

  useEffect(() => {
    if (!planHydrated || !user) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdName: household, people, location, preferences: profilePreferences }),
        signal: controller.signal,
      }).catch(() => { /* The active-plan save and a later profile edit will retry. */ });
    }, 900);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [planHydrated, user, household, people, location, profilePreferences]);

  useEffect(() => {
    if (!undoAction) return;
    const timer = window.setTimeout(() => setUndoAction(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undoAction]);

  useEffect(() => {
    const validViews: View[] = ["plan", "meals", "list", "shopping", "delivery", "account", "family", "plans", "admin", "accessibility"];
    const syncViewFromUrl = () => {
      let nextView = window.location.hash.replace("#", "") as View;
      if (!validViews.includes(nextView)) return;
      let message = "";
      if (planHydrated && nextView === "shopping" && !ingredientsConfirmed) {
        nextView = "list";
        message = "Confirm your ingredients before reviewing the shopping list.";
      } else if (planHydrated && nextView === "delivery" && !groceryListApproved) {
        nextView = ingredientsConfirmed ? "shopping" : "list";
        message = ingredientsConfirmed
          ? "Approve your shopping list before choosing how to send or save it."
          : "Confirm your ingredients before choosing how to send or save the plan.";
      }
      if (message) {
        setExportStatus(message);
        window.history.replaceState(null, "", `#${nextView}`);
      }
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
  }, [planHydrated, ingredientsConfirmed, groceryListApproved]);

  useEffect(() => {
    const titles: Record<View, string> = {
      plan: "Plan meals",
      meals: "Recipe catalog",
      list: "Confirm ingredients",
      shopping: "Review shopping list",
      delivery: "Send or save",
      account: "Account",
      family: "Family preferences",
      plans: "Membership plans",
      admin: "Admin",
      accessibility: "Accessibility",
    };
    document.title = `${titles[view]} | Grocer-Eaze`;
  }, [view]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollViewportToTop();
    });
    return () => window.cancelAnimationFrame(frame);
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
        if (ingredientReport) setIngredientReport(null);
        else if (recipientDraft) { setRecipientDraft(null); setRecipientError(""); }
        else if (ratingMeal) setRatingMeal(null);
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
  }, [onboardingStep, ratingMeal, recipientDraft, ingredientReport]);

  async function startAuth() {
    setAuthBusy(true); setAccountStatus("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authForm.email.trim())) { setAuthBusy(false); setAccountStatus("Enter a valid email address to continue."); return; }
    if (authStep === "details" && !authForm.name.trim()) { setAuthBusy(false); setAccountStatus("Enter your name to create your account."); return; }
    try {
      const body = authStep === "details" ? { name: authForm.name, email: authForm.email, phone: authForm.phone } : { email: authForm.email };
      const result = await fetch("/api/auth/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await result.json().catch(() => ({ error: "Email delivery is temporarily unavailable." }));
      if (result.status === 409 && data.code === "NAME_REQUIRED") { setAuthStep("details"); setAccountStatus("This email is new. Add your name to finish creating your account."); return; }
      if (!result.ok) { setAccountStatus(data.error || "Could not send a code."); return; }
      setAuthStep("code"); setAccountStatus(`We sent a six-digit code to ${authForm.email}.`);
    } catch {
      setAccountStatus("Email delivery is temporarily unavailable. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyAuth() {
    setAuthBusy(true); setAccountStatus("");
    try {
      const result = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authForm.email, code: authForm.code }) });
      const data = await result.json().catch(() => ({ error: "That code could not be verified." }));
      if (!result.ok) { setAccountStatus(data.error || "That code could not be verified."); return; }
      const me = await fetch("/api/auth/me").then((r) => r.json());
      setUser(me.user); setEmail(me.user.email); setPlanStorageOwnerId(me.user.id); setAuthForm((current) => ({ ...current, name: me.user.name, phone: me.user.phone || "" }));
      const cloudPlan = await fetch("/api/active-plan").then((response) => response.ok ? response.json() : { plan: null });
      if (cloudPlan.plan) applySavedPlan(cloudPlan.plan);
      else applySavedPlan(window.localStorage.getItem(`grocer-eaze-active-plan:${me.user.id}`));
      await reloadPersonalData();
      setAccountStatus(data.returning ? "Welcome back. Your household information has been restored." : "Your secure account is ready. Choose a plan to start your free trial.");
    } catch {
      setAccountStatus("That code could not be verified. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setPlanStorageOwnerId("");
    setUser(null);
    window.location.replace("/#account");
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
      }).filter((ingredient) => isConcreteIngredientName(ingredient.name))
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
      recipeServings: Math.max(1, Number(recipe.servings || 4)),
      ingredients,
      tags: [...new Set(tags)],
    };
  }

  async function generatePlan(queryOverride?: string) {
    if (!requireMembership()) return;
    if (people < 1) { setPlannerNotice("Add at least one adult or child before building a plan."); return; }
    setPlanning(true); setPlannerNotice("");
    const minutes = maxTime.match(/\d+/)?.[0] || "45";
    const proteinPrompt = familyProteins.length ? familyProteins.join(" or ") : "healthy";
    const avoidPrompt = familyAvoids.length ? `without ${familyAvoids.join(", ")}` : "";
    const skillPrompt = skill === "Keep it simple" ? "easy" : skill === "Adventurous" ? "gourmet" : "";
    const batchPrompt = [leftovers ? "meal prep" : "", reuseIngredients ? "shared versatile ingredients" : ""].filter(Boolean).join(" ");
    const dinnerQuery = queryOverride || `${mediterranean ? "Mediterranean " : ""}${skillPrompt} ${batchPrompt} ${proteinPrompt} dinner ${avoidPrompt}`;
    const lunchQuery = `${mediterranean ? "Mediterranean " : ""}${skillPrompt} ${batchPrompt} ${proteinPrompt} lunch ${avoidPrompt}`;
    const schoolQuery = `simple kid friendly lunchbox wrap sandwich bento ${avoidPrompt}`;
    const providerExclusions = [...familyAvoids, ...(lowDairy ? ["cream cheese", "heavy cream"] : [])];
    const resultCount = planDays >= 21 ? "48" : "30";
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
      const previousAdjustments = ingredientAdjustments;
      const previousNameEdits = ingredientNameEdits;
      const previousAlreadyHave = alreadyHaveIngredients;
      const previousAsNeeded = asNeededIngredients;
      const previousIngredientsConfirmation = confirmedIngredientsSignature;
      const previousReview = reviewedPlanSignature;
      if (previousPlan.length) {
        setUndoAction({ message: "Your previous schedule was cleared for the new catalog.", restore: () => { setPlannedMeals(previousPlan); setIngredientAdjustments(previousAdjustments); setIngredientNameEdits(previousNameEdits); setAlreadyHaveIngredients(previousAlreadyHave); setAsNeededIngredients(previousAsNeeded); setConfirmedIngredientsSignature(previousIngredientsConfirmation); setReviewedPlanSignature(previousReview); } });
      }
      setPlannedMeals([]);
      setIngredientAdjustments({});
      setIngredientNameEdits({});
      setAlreadyHaveIngredients([]);
      setAsNeededIngredients([]);
      setConfirmedIngredientsSignature("");
      setReviewedPlanSignature("");
      setRecipeIdeas(uniqueIdeas);
      setRecipeFilters({ ...defaultRecipeFilters });
      setRecipePage(1);
      setVisibleRecipeCount(recipeBatchSize);
      setCatalogBeforeSimilar(null);
      const fallbackActive = payloads.some((data) => data.demo);
      const providers = [...new Set(payloads.flatMap((data) => Array.isArray(data.providers) ? data.providers.map(String) : []))];
      setRecipeNotice(`${uniqueIdeas.length} recipes ready to browse.${providers.length ? ` Sources: ${providers.join(", ")}.` : ""}${fallbackActive ? " Backup recipes fill any remaining gaps." : ""}`);
      if (ownerId) await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", "x-grocer-owner": ownerId }, body: JSON.stringify({ householdName: household, people, location, preferences: profilePreferences }) });
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
    const query = recipeFilters.query.trim() || (kind === "School lunch" ? "simple kid friendly lunchbox wrap sandwich bento" : `${mediterranean ? "Mediterranean " : ""}${skillPrompt} ${leftovers ? "meal prep " : ""}${reuseIngredients ? "shared versatile ingredients " : ""}${proteinPrompt} ${kind.toLowerCase()}`);
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

  function webRecipeSearchUrl() {
    const terms = [
      recipeFilters.query.trim(),
      effectiveGlutenFree && "gluten-free",
      effectiveLowDairy && "low dairy",
      mediterranean && "Mediterranean",
      importKind === "School lunch" ? "simple kid-friendly school lunch" : importKind.toLowerCase(),
      familyProteins.length ? familyProteins.join(" or ") : "",
      familyAvoids.length ? `without ${familyAvoids.join(" or ")}` : "",
      "recipe",
    ].filter(Boolean).join(" ");
    return `https://www.google.com/search?${new URLSearchParams({ q: terms })}`;
  }

  async function importRecipeUrl() {
    if (!requireMembership()) return;
    const value = importUrl.trim();
    if (!/^https?:\/\//i.test(value)) {
      setImportStatus("Paste a complete recipe page link beginning with http:// or https://.");
      return;
    }
    setImportBusy(true); setImportStatus("Importing recipe details…");
    try {
      const response = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That recipe could not be imported.");
      const meal = mapRecipe(data.recipe as Record<string, unknown>, recipeIdeas.length, importKind);
      setRecipeIdeas((current) => [meal, ...current.filter((item) => item.sourceUrl !== meal.sourceUrl)]);
      setVisibleRecipeCount((current) => Math.max(current, recipeBatchSize));
      setImportUrl("");
      setImportStatus(`${meal.title} was added to your recipe catalog.`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "That recipe could not be imported.");
    } finally {
      setImportBusy(false);
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
      setRecipeIdeas([...new Map<string, Meal>(similar.map((item: Meal) => [`${item.kind}:${item.title.toLowerCase()}`, item])).values()]);
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
    const previousAdjustments = ingredientAdjustments;
    const previousNameEdits = ingredientNameEdits;
    const previousAlreadyHave = alreadyHaveIngredients;
    const previousAsNeeded = asNeededIngredients;
    const previousIngredientsConfirmation = confirmedIngredientsSignature;
    const previousReview = reviewedPlanSignature;
    setPlannedMeals([]);
    setIngredientAdjustments({});
    setIngredientNameEdits({});
    setAlreadyHaveIngredients([]);
    setAsNeededIngredients([]);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
    showUndo("All selected meals were cleared.", () => { setPlannedMeals(previous); setIngredientAdjustments(previousAdjustments); setIngredientNameEdits(previousNameEdits); setAlreadyHaveIngredients(previousAlreadyHave); setAsNeededIngredients(previousAsNeeded); setConfirmedIngredientsSignature(previousIngredientsConfirmation); setReviewedPlanSignature(previousReview); });
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
    const nextSchoolLunchTarget = kidLunches && kids > 0 ? weekdaysInPlan(value, planDays) : 0;
    const seen: Record<string, number> = {};
    const targets: Record<string, number> = { Dinner: planDays, Lunch: mealType === "Lunch + dinner" ? planDays : 0, "School lunch": nextSchoolLunchTarget };
    const nextMeals = plannedMeals.filter((meal) => {
      seen[meal.kind] = (seen[meal.kind] || 0) + 1;
      return seen[meal.kind] <= (targets[meal.kind] || 0);
    });
    setPlanStartDate(value);
    if (plannedMeals.length) {
      setPlannedMeals(resequenceMeals(nextMeals, value));
      showUndo("Plan dates were updated.", () => {
        setPlanStartDate(previousDate);
        setPlannedMeals(previousMeals);
      });
    }
  }

  function updateMealSelectionType(value: string) {
    if (value === mealType) return;
    const previousType = mealType;
    const previousMeals = plannedMeals;
    setMealType(value);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
    if (value === "Dinner only" && plannedMeals.some((meal) => meal.kind === "Lunch")) {
      setPlannedMeals((current) => current.filter((meal) => meal.kind !== "Lunch"));
      showUndo("Regular lunches were removed because the plan now includes dinner only.", () => { setMealType(previousType); setPlannedMeals(previousMeals); });
    }
  }

  function updatePlanDays(value: number) {
    const nextDays = Math.max(1, Math.min(31, Math.round(value) || 1));
    if (nextDays === planDays) return;
    const previousDays = planDays;
    const previousMeals = plannedMeals;
    const targets: Record<string, number> = {
      Dinner: nextDays,
      Lunch: mealType === "Lunch + dinner" ? nextDays : 0,
      "School lunch": kidLunches && kids > 0 ? weekdaysInPlan(planStartDate, nextDays) : 0,
    };
    const seen: Record<string, number> = {};
    const nextMeals = plannedMeals.filter((meal) => {
      seen[meal.kind] = (seen[meal.kind] || 0) + 1;
      return seen[meal.kind] <= (targets[meal.kind] || 0);
    });
    setPlanDays(nextDays);
    setPlannedMeals(resequenceMeals(nextMeals));
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
    if (previousMeals.length) showUndo(`Plan updated to ${nextDays} day${nextDays === 1 ? "" : "s"}.`, () => { setPlanDays(previousDays); setPlannedMeals(previousMeals); });
  }

  function updateAdultCount(value: number) {
    const nextAdults = Math.max(0, Math.min(20 - kids, Math.round(value)));
    if (nextAdults === 0 && kids === 0) return;
    setAdults(nextAdults);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
  }

  function updateKidCount(value: number) {
    const nextKids = Math.max(0, Math.min(20 - adults, Math.round(value)));
    if (nextKids === kids) return;
    const previousKids = kids;
    const previousKidLunches = kidLunches;
    const previousMeals = plannedMeals;
    setKids(nextKids);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
    if (nextKids === 0) {
      setKidLunches(false);
      setPlannedMeals((current) => current.filter((meal) => meal.kind !== "School lunch"));
      setRecipeFilters((current) => ({ ...current, kind: current.kind === "School lunch" ? "All meals" : current.kind }));
      if (previousMeals.some((meal) => meal.kind === "School lunch")) showUndo("School lunches were removed because the child count is now zero.", () => { setKids(previousKids); setKidLunches(previousKidLunches); setPlannedMeals(previousMeals); });
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
        const currentIngredients = new Set(next.flatMap((meal) => meal.ingredients || []).map((ingredient) => ingredient.name.trim().toLowerCase()).filter(Boolean));
        for (let index = existingCount; index < target; index++) {
          const rankedPool = [...(preferred.length ? preferred : recipeIdeas)]
            .sort((a, b) => (reuseIngredients ? ingredientOverlapScore(b, currentIngredients) - ingredientOverlapScore(a, currentIngredients) : 0)
              || Number(Boolean(b.tags?.includes("Budget fit"))) - Number(Boolean(a.tags?.includes("Budget fit"))));
          const unusedPool = rankedPool.filter((meal) => !usedTitles.has(meal.title.toLowerCase()));
          const meal = (unusedPool.length ? unusedPool : rankedPool)[0];
          next.push({
            ...meal,
            ...mealDateFor(kind, index, planStartDate),
            id: `${meal.recipeId || meal.id}-${kind}-${crypto.randomUUID()}`,
            recipeId: meal.recipeId || meal.id,
            kind,
            tags: [...new Set([...(meal.tags || []), ...(kind === "School lunch" ? ["Kid-friendly", "Packable"] : [])])],
          });
          usedTitles.add(meal.title.toLowerCase());
          (meal.ingredients || []).forEach((ingredient) => currentIngredients.add(ingredient.name.trim().toLowerCase()));
        }
      });
      return next.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.kind.localeCompare(b.kind));
    });
    setRecipeNotice(`Open meal slots filled with the best available preference and price matches${reuseIngredients ? ", favoring ingredients already in your plan" : ""}. You can still remove or replace any recipe.`);
  }

  function toggleSchoolLunches() {
    if (kids < 1) return;
    if (kidLunches) {
      setPlannedMeals((current) => current.filter((meal) => meal.kind !== "School lunch"));
      setRecipeFilters((current) => ({ ...current, kind: current.kind === "School lunch" ? "All meals" : current.kind }));
      setVisibleRecipeCount(recipeBatchSize);
    }
    setKidLunches(!kidLunches);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
  }

  function toggleSchoolLunchSide(side: string) {
    setSchoolLunchSides((current) => current.includes(side) ? current.filter((item) => item !== side) : [...current, side]);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
  }

  async function locateMe() {
    setLocationStatus("Finding you…");
    if (!navigator.geolocation) { setLocationStatus("Location is not supported by this browser."); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`/api/location/reverse?lat=${coords.latitude}&lon=${coords.longitude}`);
        const data = await response.json(); const result = data.results?.[0];
        if (result) { setLocation(result.label); setLocationQuery(result.label); setLocationCoordinates({ lat: String(result.lat || coords.latitude), lon: String(result.lon || coords.longitude) }); setLocationStatus("Location updated."); }
      } catch { setLocationStatus("We couldn’t identify that location. You can type it instead."); }
    }, () => setLocationStatus("Location access was not granted. You can type it instead."), { enableHighAccuracy: false, timeout: 10000 });
  }

  function clearLocation() {
    setLocation("");
    setLocationQuery("");
    setLocationCoordinates(null);
    setLocationResults([]);
    setNearbyStores([]);
    setLocationStatus("Enter a neighborhood, city, or ZIP, or use your location.");
  }

  async function findNearbyStores() {
    if (!location.trim()) { setStoreSearchStatus("Add a shopping location before finding stores."); return; }
    setStoreSearchBusy(true);
    setStoreSearchStatus("Finding grocery stores near you…");
    try {
      const params = new URLSearchParams({ q: location, radius: String(storeRadius) });
      if (locationCoordinates) { params.set("lat", locationCoordinates.lat); params.set("lon", locationCoordinates.lon); }
      const response = await fetch(`/api/stores/search?${params}`);
      const data = await response.json() as { stores?: StorePreference[]; center?: { lat?: string; lon?: string }; error?: string };
      if (!response.ok) throw new Error(data.error || "Nearby stores could not be loaded.");
      const selectedIds = new Set(preferredStores.map((store) => store.id));
      const selectedNames = new Set(preferredStores.filter((store) => !store.id.startsWith("default-")).map((store) => store.name.toLowerCase()));
      const available = (data.stores || []).filter((store) => !selectedIds.has(store.id) && !selectedNames.has(store.name.toLowerCase()));
      setNearbyStores(available);
      if (data.center?.lat && data.center.lon) setLocationCoordinates({ lat: data.center.lat, lon: data.center.lon });
      setStoreSearchStatus(available.length ? `${available.length} nearby stores found. Add any you want to prioritize.` : "No additional grocery stores were found in this radius.");
    } catch (error) {
      setStoreSearchStatus(error instanceof Error ? error.message : "Nearby stores could not be loaded.");
    } finally {
      setStoreSearchBusy(false);
    }
  }

  function addPreferredStore(store: StorePreference) {
    const defaultMatch = preferredStores.find((item) => item.id.startsWith("default-") && item.name.toLowerCase() === store.name.toLowerCase());
    if (!defaultMatch && preferredStores.length >= 12) { setStoreSearchStatus("You can prioritize up to 12 stores."); return; }
    setPreferredStores((current) => defaultMatch ? current.map((item) => item.id === defaultMatch.id ? store : item) : [...current, store]);
    setNearbyStores((current) => current.filter((item) => item.id !== store.id));
    setStoreSearchStatus(defaultMatch ? `${store.name} updated with its nearby location.` : `${store.name} added to your store priorities.`);
  }

  function removePreferredStore(store: StorePreference) {
    if (preferredStores.length <= 1) { setStoreSearchStatus("Keep at least one preferred store."); return; }
    const next = preferredStores.filter((item) => item.id !== store.id);
    setPreferredStores(next);
    if (selectedStore === store.name) setSelectedStore(next[0].name);
    setStoreSearchStatus(`${store.name} removed from your store priorities.`);
  }

  function movePreferredStore(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= preferredStores.length) return;
    const next = [...preferredStores];
    [next[index], next[target]] = [next[target], next[index]];
    setPreferredStores(next);
    setStoreSearchStatus(`${next[target].name} is now priority ${target + 1}.`);
  }

  function toggleAlreadyHave(key: string) {
    setAlreadyHaveIngredients((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
  }

  function toggleAsNeeded(key: string) {
    setAsNeededIngredients((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
    setConfirmedIngredientsSignature("");
    setReviewedPlanSignature("");
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

  function groceryItemName(entry: { key: string; name: string }) {
    return ingredientNameEdits[entry.key]?.trim() || entry.name;
  }

  function groceryItemQuantity(entry: { key: string; suggestedQuantity: string }) {
    if (asNeededIngredients.includes(entry.key)) return "As needed";
    return ingredientAdjustments[entry.key]?.trim() || entry.suggestedQuantity;
  }

  function groceryDateLabel() {
    const start = new Date(`${planStartDate}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + planDays - 1);
    return planDays === 1
      ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  function groceryListTitle() {
    return `Groceries + ${groceryDateLabel()}`;
  }

  function groceryListText() {
    return `${groceryListTitle()}\n\n${groceryGroups.map((group) => `${group.title}\n${group.items.map((entry) => `☐ ${groceryItemName(entry)} — ${groceryItemQuantity(entry)}`).join("\n")}`).join("\n\n")}`;
  }

  async function shareGroceryList(destination: "copy" | "notes") {
    if (!groceryListApproved) throw new Error("Approve the grocery list before sending it.");
    if (!groceryGroups.length) throw new Error("Every ingredient is marked as already on hand, so there is no shopping list to send.");
    const title = groceryListTitle();
    const text = groceryListText();
    if (destination === "copy") {
      await navigator.clipboard.writeText(text);
      return "Grocery list copied to your clipboard.";
    }
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return "Grocery list shared for Notes or Keep.";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "Note sharing was cancelled; the rest of your selected actions continued.";
      }
    }
    await navigator.clipboard.writeText(text);
    return "The share menu is unavailable, so the grocery list was copied for Notes or Keep.";
  }

  async function shopOnInstacart() {
    if (!groceryListApproved) throw new Error("Approve the grocery list before shopping.");
    const destination = window.open("about:blank", "_blank");
    if (destination) destination.opener = null;
    try {
      const response = await fetch("/api/instacart/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Grocer-Eaze groceries starting ${planStartDate}`,
          items: shoppingEntries.map((entry) => {
            const quantity = groceryItemQuantity(entry);
            const measurement = parseIngredientMeasurement(quantity);
            return { name: groceryItemName(entry), displayText: `${quantity} ${groceryItemName(entry)}`, measurements: measurement ? [measurement] : [] };
          }),
        }),
      });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Instacart could not prepare this list.");
      if (destination) destination.location.href = data.url;
      else window.location.href = data.url;
      return "Instacart opened with your shopping list.";
    } catch (error) {
      destination?.close();
      throw error instanceof Error ? error : new Error("Instacart is temporarily unavailable.");
    }
  }
  async function prepareRecipeReaderLinks() {
    if (!plannedMeals.length) throw new Error("Add recipes to your plan before exporting a calendar.");
    if (!groceryListApproved) throw new Error("Approve the grocery list before exporting a calendar.");
    const readerResponse = await fetch("/api/recipe-readers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meals: plannedMeals.map((meal) => ({
          mealId: meal.id,
          recipeId: meal.recipeId || meal.id,
          title: meal.title,
          sourceName: meal.sourceName,
          sourceUrl: meal.sourceUrl,
          readyInMinutes: meal.readyMinutes,
          servings: meal.recipeServings,
          ingredients: meal.ingredients,
        })),
      }),
    });
    const readerData = await readerResponse.json().catch(() => ({})) as { readers?: Array<{ mealId?: string; url?: string }>; error?: string };
    if (!readerResponse.ok) throw new Error(readerData.error || "Clean recipe links could not be prepared. Please try the calendar export again.");
    const readerLinks = new Map((readerData.readers || []).flatMap((reader) => reader.mealId && reader.url ? [[reader.mealId, reader.url] as const] : []));
    if (readerLinks.size < plannedMeals.length) throw new Error("One or more clean recipe links could not be prepared. Check that each selected recipe has an original source and try again.");
    return readerLinks;
  }

  function calendarDeliveryMeals(readerLinks: Map<string, string>) {
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
    return slots.map((slot, index) => {
      const recipe = recipes[index];
      return {
        id: recipe.recipeId || recipe.id,
        title: recipe.title,
        detail: recipe.detail,
        kind: slot.kind,
        sortOrder: Number(slot.sortOrder),
        sourceUrl: recipe.sourceUrl,
        readerUrl: readerLinks.get(recipe.id) || "",
      };
    });
  }

  function calendarFileText(meals: ReturnType<typeof calendarDeliveryMeals>) {
    const events = meals.map((recipe, index) => {
      const start = new Date(Number(recipe.sortOrder) || Date.now());
      start.setHours(recipe.kind === "Dinner" ? 17 : 12, recipe.kind === "Dinner" ? 30 : 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const recipeLine = `\nClean recipe: ${recipe.readerUrl}${recipe.sourceUrl ? `\nOriginal source: ${recipe.sourceUrl}` : ""}`;
      return `BEGIN:VEVENT\r\nUID:grocer-eaze-${calendarText(String(recipe.id || index))}-${Number(recipe.sortOrder)}@grocer-eaze\r\nDTSTAMP:${calendarStamp(new Date())}\r\nDTSTART:${calendarStamp(start)}\r\nDTEND:${calendarStamp(end)}\r\nSUMMARY:${calendarText(`${recipe.kind}: ${recipe.title}`)}\r\nDESCRIPTION:${calendarText(`${recipe.detail || "Grocer-Eaze meal"}${recipeLine}`)}\r\nURL:${calendarText(recipe.readerUrl)}\r\nEND:VEVENT`;
    }).join("\r\n");
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Grocer-Eaze//Meal Plan//EN\r\n${events}\r\nEND:VCALENDAR`;
  }

  async function downloadCalendar(provider: "google" | "apple" = calendarProvider, preparedLinks?: Map<string, string>, preparedMeals?: ReturnType<typeof calendarDeliveryMeals>) {
    const readerLinks = preparedLinks || await prepareRecipeReaderLinks();
    const calendarMeals = preparedMeals || calendarDeliveryMeals(readerLinks);
    const file = new Blob([calendarFileText(calendarMeals)], { type: "text/calendar" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(file); link.download = "grocer-eaze-meal-plan.ics"; link.click(); URL.revokeObjectURL(link.href);
    return `${provider === "google" ? "Google" : "Apple"} Calendar file downloaded in ${calendarOrder === "random" ? "a shuffled order within each meal category" : "your selected recipe order"}.`;
  }

  async function emailDelivery(recipient: DeliveryRecipient, readerLinks: Map<string, string>, calendarMeals: ReturnType<typeof calendarDeliveryMeals>) {
    const response = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryId: crypto.randomUUID(),
        to: recipient.address,
        recipientName: recipient.name,
        selections: recipient.selections,
        groceryTitle: groceryListTitle(),
        groceryGroups: groceryGroups.map((group) => ({ title: group.title, items: group.items.map((entry) => ({ name: groceryItemName(entry), quantity: groceryItemQuantity(entry) })) })),
        meals: plannedMeals.map(({ id, day, date, kind, title, detail, time, sourceUrl }) => ({ id, day, date, kind, title, detail, time, sourceUrl, readerUrl: readerLinks.get(id) || "" })),
        calendarMeals,
      }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(data.error || `We couldn’t email ${recipient.name || recipient.address}. Please try again.`);
    return `Sent to ${recipient.name || recipient.address}.`;
  }

  function textDeliveryMessage(recipient: DeliveryRecipient, readerLinks: Map<string, string>) {
    const sections: string[] = [`Grocer-Eaze plan · ${groceryDateLabel()}`];
    if (recipient.selections.recipes) {
      sections.push(`Recipes\n${plannedMeals.map((meal) => `${meal.day} ${meal.kind}: ${meal.title}\n${readerLinks.get(meal.id) || meal.sourceUrl || ""}`).join("\n")}`);
    }
    if (recipient.selections.grocery) sections.push(groceryListText());
    const message = sections.join("\n\n");
    if (message.length > 4000) throw new Error(`The text for ${recipient.name || recipient.address} is too long. Choose recipes or groceries—not both—or use email.`);
    return message;
  }

  function openTextDraft(recipient: DeliveryRecipient, readerLinks: Map<string, string>) {
    const message = textDeliveryMessage(recipient, readerLinks);
    window.location.href = `sms:${encodeURIComponent(recipient.address)}?&body=${encodeURIComponent(message)}`;
    return `Text draft opened for ${recipient.name || recipient.address}.`;
  }

  function confirmIngredients() {
    if (!groceryEntries.length) { setExportStatus("Add at least one recipe ingredient before building the shopping list."); return; }
    if (unresolvedAmountEntries.length) { setExportStatus(`Review ${unresolvedAmountEntries.length} missing or invalid amount${unresolvedAmountEntries.length === 1 ? "" : "s"}. Enter a quantity or choose “Use as needed” before continuing.`); return; }
    setConfirmedIngredientsSignature(planSignature);
    setReviewedPlanSignature("");
    setExportStatus("");
    navigateTo("shopping");
  }

  function openIngredientReport(entry: (typeof groceryEntries)[number]) {
    setIngredientReport({
      key: entry.key,
      name: ingredientNameEdits[entry.key]?.trim() || entry.name,
      amount: asNeededIngredients.includes(entry.key) ? "As needed" : ingredientAdjustments[entry.key]?.trim() || entry.suggestedQuantity,
      originals: entry.originals.slice(0, 5),
      sources: entry.sources.slice(0, 5),
    });
    setIngredientReportCategory("Incorrect amount");
    setIngredientReportCorrection("");
    setIngredientReportDetails("");
    setIngredientReportStatus("");
  }

  async function submitIngredientReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ingredientReport) return;
    setIngredientReportBusy(true);
    setIngredientReportStatus("");
    try {
      const response = await fetch("/api/ingredient-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: ingredientReportCategory,
          ingredient: ingredientReport.name,
          observedAmount: ingredientReport.amount,
          correction: ingredientReportCorrection,
          details: ingredientReportDetails,
          originals: ingredientReport.originals,
          sources: ingredientReport.sources,
          plan: { planStartDate, planDays, adults, kids },
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setIngredientReportStatus(data.error || "We couldn’t send this report. Please try again."); return; }
      setIngredientReport(null);
      setExportStatus(`Thanks—your report about ${ingredientReport.name} was sent to the Grocer-Eaze team.`);
    } catch {
      setIngredientReportStatus("We couldn’t send this report. Please try again.");
    } finally {
      setIngredientReportBusy(false);
    }
  }

  function approveGroceryList() {
    if (!ingredientsConfirmed) { setExportStatus("Confirm your ingredients before approving the shopping list."); navigateTo("list"); return; }
    if (!groceryEntries.length) { setExportStatus("Add at least one recipe ingredient before approving the list."); return; }
    setReviewedPlanSignature(planSignature);
    setExportStatus("");
    navigateTo("delivery");
  }

  function openRecipientEditor(recipient?: DeliveryRecipient) {
    if (!recipient && allDeliveryRecipients.length >= 10) { setExportStatus("You can send to up to 10 people at a time."); return; }
    setRecipientError("");
    setRecipientDraft(recipient
      ? { id: recipient.id, name: recipient.name, channel: recipient.channel, address: recipient.address }
      : { id: "", name: "", channel: "email", address: "" });
  }

  function saveRecipient() {
    if (!recipientDraft) return;
    const address = normalizeDeliveryAddress(recipientDraft.channel, recipientDraft.address);
    if (!address) {
      setRecipientError(recipientDraft.channel === "email" ? "Enter a valid email address." : "Enter a valid phone number with 7 to 15 digits.");
      return;
    }
    if (allDeliveryRecipients.some((recipient) => recipient.id !== recipientDraft.id && recipient.channel === recipientDraft.channel && recipient.address === address)) {
      setRecipientError("That recipient is already on this plan.");
      return;
    }
    setDeliveryRecipients((current) => {
      const existing = current.find((recipient) => recipient.id === recipientDraft.id);
      const nextRecipient: DeliveryRecipient = {
        id: existing?.id || crypto.randomUUID(),
        name: recipientDraft.name.trim().slice(0, 80),
        channel: recipientDraft.channel,
        address,
        selections: existing
          ? { ...existing.selections, calendar: recipientDraft.channel === "email" && existing.selections.calendar }
          : { recipes: true, grocery: true, calendar: false },
      };
      return existing ? current.map((recipient) => recipient.id === existing.id ? nextRecipient : recipient) : [...current, nextRecipient].slice(0, 10);
    });
    setRecipientDraft(null);
    setRecipientError("");
    setExportStatus(`${recipientDraft.name.trim() || address} is ready.`);
  }

  function removeRecipient(id: string) {
    setDeliveryRecipients((current) => current.filter((recipient) => recipient.id !== id));
    setPendingTextRecipients((current) => current.filter((recipient) => recipient.id !== id));
    setExportStatus("Recipient removed.");
  }

  function updateRecipientSelection(id: string, key: keyof DeliverySelections, selected: boolean) {
    if (id === "self") {
      setSelfDeliverySelections((current) => ({ ...current, [key]: selected }));
      return;
    }
    setDeliveryRecipients((current) => current.map((recipient) => recipient.id === id
      ? { ...recipient, selections: { ...recipient.selections, [key]: key === "calendar" && recipient.channel === "text" ? false : selected } }
      : recipient));
  }

  function setAllDeliveryActions(selected: boolean) {
    setSelfDeliverySelections({ recipes: selected, grocery: groceryGroups.length > 0 && selected, calendar: selected });
    setDeliveryRecipients((current) => current.map((recipient) => ({ ...recipient, selections: { recipes: selected, grocery: groceryGroups.length > 0 && selected, calendar: recipient.channel === "email" && selected } })));
    setDeviceActions({ copy: groceryGroups.length > 0 && selected, notes: groceryGroups.length > 0 && selected, calendar: selected, instacart: groceryGroups.length > 0 && instacartEnabled && selected });
    setPendingTextRecipients([]);
    setPendingTextReaderLinks({});
    setExportStatus("");
  }

  async function executeDeliveryActions(options?: { selfOnly?: boolean }) {
    const recipients = options?.selfOnly && selfDeliveryRecipient
      ? [{ ...selfDeliveryRecipient, selections: { ...defaultDeliverySelections, grocery: groceryGroups.length > 0 } }]
      : effectiveDeliveryRecipients.filter((recipient) => hasDeliverySelection(recipient.selections));
    const activeDeviceActions = options?.selfOnly ? { copy: false, notes: false, calendar: false, instacart: false } : {
      ...deviceActions,
      copy: groceryGroups.length > 0 && deviceActions.copy,
      notes: groceryGroups.length > 0 && deviceActions.notes,
      instacart: groceryGroups.length > 0 && deviceActions.instacart,
    };
    const deviceActionCount = [activeDeviceActions.copy, activeDeviceActions.notes, activeDeviceActions.calendar, instacartEnabled && activeDeviceActions.instacart].filter(Boolean).length;
    if (!recipients.length && !deviceActionCount) { setExportStatus("Choose at least one item for a recipient or device action."); return; }
    setDeliveryBusy(true);
    setPendingTextRecipients([]);
    setPendingTextReaderLinks({});
    setExportStatus("Preparing your selected deliveries…");
    const completed: string[] = [];
    const failed: string[] = [];
    const immediateTasks: Array<Promise<string>> = [];
    if (activeDeviceActions.instacart && instacartEnabled) immediateTasks.push(shopOnInstacart());
    if (activeDeviceActions.copy) immediateTasks.push(shareGroceryList("copy"));
    if (activeDeviceActions.notes) immediateTasks.push(shareGroceryList("notes"));
    try {
      const needsReaderLinks = activeDeviceActions.calendar || recipients.some((recipient) => recipient.selections.recipes || recipient.selections.calendar);
      const readerLinks = needsReaderLinks ? await prepareRecipeReaderLinks() : new Map<string, string>();
      const calendarMeals = needsReaderLinks ? calendarDeliveryMeals(readerLinks) : [];
      if (activeDeviceActions.calendar) immediateTasks.push(downloadCalendar(calendarProvider, readerLinks, calendarMeals));
      const immediateResults = await Promise.allSettled(immediateTasks);
      completed.push(...immediateResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
      failed.push(...immediateResults.flatMap((result) => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "One device action could not be completed."] : []));
      for (const recipient of recipients.filter((item) => item.channel === "email")) {
        try { completed.push(await emailDelivery(recipient, readerLinks, calendarMeals)); }
        catch (error) { failed.push(error instanceof Error ? error.message : `We couldn’t email ${recipient.name || recipient.address}.`); }
      }
      const textRecipients = recipients.filter((recipient) => recipient.channel === "text");
      for (const recipient of textRecipients) textDeliveryMessage(recipient, readerLinks);
      if (textRecipients.length) {
        const [first, ...remaining] = textRecipients;
        setPendingTextRecipients(remaining);
        setPendingTextReaderLinks(Object.fromEntries(readerLinks));
        completed.push(`Text draft 1 of ${textRecipients.length} is ready. Return here${remaining.length ? " to open the next text" : " after reviewing it"}.`);
        setExportStatus([...completed, ...failed].join(" "));
        openTextDraft(first, readerLinks);
      } else setExportStatus([...completed, ...failed].join(" ") || "Your selected actions are complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "One selected action could not be completed.";
      const immediateResults = await Promise.allSettled(immediateTasks);
      completed.push(...immediateResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
      setExportStatus([...completed, message].join(" "));
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function openNextTextRecipient() {
    const [next, ...remaining] = pendingTextRecipients;
    if (!next) return;
    setPendingTextRecipients(remaining);
    const readerLinks = new Map(Object.entries(pendingTextReaderLinks));
    setExportStatus(`Text draft opened for ${next.name || next.address}.${remaining.length ? ` ${remaining.length} text${remaining.length === 1 ? "" : "s"} remaining.` : " All text drafts have been prepared."}`);
    openTextDraft(next, readerLinks);
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
    if (!authLoaded) { setPlannerNotice("Checking your account access…"); return false; }
    if (!user) { navigateTo("account"); setAccountStatus("Sign in before using meal planning tools."); return false; }
    if (!user.hasAccess) { navigateTo("plans"); setAccountStatus("Choose a membership to unlock meal planning and exports."); return false; }
    return true;
  }

  function navigateTo(nextView: View) {
    if (["meals", "list", "shopping", "delivery"].includes(nextView) && authLoaded) {
      if (!user) { nextView = "account"; setAccountStatus("Sign in before using meal planning tools."); }
      else if (!user.hasAccess) { nextView = "plans"; setAccountStatus("Choose a membership to unlock meal planning and exports."); }
    }
    if (nextView === "family" && authLoaded && !user) { nextView = "account"; setAccountStatus("Sign in before adding family preferences."); }
    setView(nextView);
    const nextHash = `#${nextView}`;
    if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
    scrollViewportToTop();
  }

  function scrollViewportToTop() {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    root.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previousBehavior;
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

  function deliveryRecipientCard(recipient: DeliveryRecipient, isSelf = false) {
    const label = isSelf ? "Myself" : recipient.name || (recipient.channel === "email" ? "Email recipient" : "Text recipient");
    return <article className={`delivery-recipient-card ${hasDeliverySelection(recipient.selections) ? "selected" : ""}`} key={recipient.id}>
      <div className="delivery-recipient-identity">
        <span className="recipient-avatar" aria-hidden="true">{isSelf ? "ME" : (recipient.name || recipient.address).slice(0, 1).toUpperCase()}</span>
        <div><span className="recipient-name-line"><strong>{label}</strong>{isSelf && <em>ACCOUNT</em>}<i>{recipient.channel === "email" ? "EMAIL" : "TEXT"}</i></span><small>{recipient.address}</small></div>
        {!isSelf && <div className="recipient-row-actions"><button type="button" onClick={() => openRecipientEditor(recipient)}>Edit</button><button type="button" onClick={() => removeRecipient(recipient.id)} aria-label={`Remove ${label}`}>Remove</button></div>}
      </div>
      <fieldset className="recipient-content-options">
        <legend>Choose what {isSelf ? "you receive" : `${label} receives`}</legend>
        <label><input type="checkbox" checked={recipient.selections.recipes} onChange={(event) => updateRecipientSelection(recipient.id, "recipes", event.target.checked)} /><span><strong>Recipes</strong><small>Clean recipe links without the extra page clutter</small></span></label>
        <label className={!groceryGroups.length ? "disabled" : ""}><input type="checkbox" disabled={!groceryGroups.length} checked={groceryGroups.length > 0 && recipient.selections.grocery} onChange={(event) => updateRecipientSelection(recipient.id, "grocery", event.target.checked)} /><span><strong>Grocery list</strong><small>{groceryGroups.length ? `${shoppingEntries.length} items; ingredients already on hand stay excluded` : "Nothing to buy; every ingredient is already on hand"}</small></span></label>
        <label className={recipient.channel === "text" ? "disabled" : ""}><input type="checkbox" disabled={recipient.channel === "text"} checked={recipient.channel === "email" && recipient.selections.calendar} onChange={(event) => updateRecipientSelection(recipient.id, "calendar", event.target.checked)} /><span><strong>Calendar invite</strong><small>{recipient.channel === "text" ? "Requires an email recipient" : "Includes the dated meal plan as an .ics attachment"}</small></span></label>
      </fieldset>
    </article>;
  }

  return <div className="app">
    <a className="skip-link" href="#page-content" onClick={focusMainContent}>Skip to main content</a>
    <header>
      <button className="brand" title="Go to Grocer-Eaze home" onClick={() => navigateTo("plan")}><span className="brand-mark" aria-hidden="true"><span>g</span></span><span>Grocer<span>•</span>Eaze</span></button>
      <nav aria-label="Primary navigation">
        <button className={view === "plan" ? "active" : ""} aria-current={view === "plan" ? "page" : undefined} onClick={() => navigateTo("plan")}>Plan</button>
        <button disabled={!authLoaded} className={view === "meals" ? "active" : ""} aria-current={view === "meals" ? "page" : undefined} onClick={() => navigateTo("meals")}>My meals</button>
        <button disabled={!authLoaded} className={["list", "shopping", "delivery"].includes(view) ? "active" : ""} aria-current={["list", "shopping", "delivery"].includes(view) ? "page" : undefined} onClick={() => navigateTo("list")}>Grocery list</button>
        <button disabled={!authLoaded} className={view === "family" ? "active" : ""} aria-current={view === "family" ? "page" : undefined} onClick={() => navigateTo("family")}>Family</button>
        {user?.role === "admin" && <button className={view === "admin" ? "active" : ""} aria-current={view === "admin" ? "page" : undefined} onClick={() => { navigateTo("admin"); loadAdminUsers(); }}>Admin</button>}
      </nav>
      <button className="avatar" aria-label={`${user ? user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "ME"} · Open profile`} aria-current={view === "account" ? "page" : undefined} onClick={() => navigateTo("account")}>{user ? user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "ME"}</button>
    </header>
    <main>

    {view === "plan" && <div className="shell" id="page-content" tabIndex={-1}>
      <section className="hero"><p className="eyebrow">MEAL PLANNING, MADE HUMAN</p><h1><span>Better Food,</span><br /><em>Less Waste.</em></h1><p className="lede">A recipe catalog shaped around every person at your table, so you buy what you need and enjoy what you make.</p><div className="trust-row"><span><b>✓</b> Family preferences included</span><span><b>✓</b> Shop with a smarter list</span><span><b>✓</b> Use more, waste less</span></div></section>
      <section className="planner">
        <div className="planner-top"><div><span>1</span><strong>Build your plan</strong></div><p>About 60 seconds</p></div>
        <div className="field"><label htmlFor="planning-days">Days to plan</label><input id="planning-days" className="text-input day-count-input" type="number" inputMode="numeric" min="1" max="31" value={planDays} onChange={(event) => updatePlanDays(Number(event.target.value))} /><small className="field-help">Choose between 1 and 31 consecutive days.</small></div>
        <div className="field"><label htmlFor="plan-start-date">When should this plan start?</label><input id="plan-start-date" className="text-input" type="date" min={todayInputDate()} value={planStartDate} suppressHydrationWarning onChange={(event) => updatePlanStartDate(event.target.value)} /><small className="field-help">Your schedule, reminders, and calendar exports will use this date.</small></div>
        <div className="field"><label htmlFor="meal-type">Meals to plan</label><select id="meal-type" value={mealType} onChange={(e) => updateMealSelectionType(e.target.value)}><option>Lunch + dinner</option><option>Dinner only</option></select></div>
        <div className="two-col household-counters"><div className="field"><label id="adults-label">Adults</label><div className="stepper" role="group" aria-labelledby="adults-label"><button type="button" disabled={adults <= 0 || (adults === 1 && kids === 0)} aria-label="Decrease adults" onClick={() => updateAdultCount(adults - 1)}>−</button><strong aria-live="polite">{adults}</strong><button type="button" disabled={people >= 20} aria-label="Increase adults" onClick={() => updateAdultCount(adults + 1)}>+</button></div></div><div className="field"><label id="kids-label">Kids</label><div className="stepper" role="group" aria-labelledby="kids-label"><button type="button" disabled={kids <= 0} aria-label="Decrease kids" onClick={() => updateKidCount(kids - 1)}>−</button><strong aria-live="polite">{kids}</strong><button type="button" disabled={people >= 20} aria-label="Increase kids" onClick={() => updateKidCount(kids + 1)}>+</button></div></div></div>
        <p className="serving-equivalent-note">Recipe quantities use {servingEquivalents} serving equivalent{servingEquivalents === 1 ? "" : "s"}: each child counts as half a serving.</p>
        <div className="school-lunch-toggle"><Toggle label="School lunches" checked={kidLunches} disabled={kids === 0} onChange={toggleSchoolLunches} note={kids === 0 ? "Add at least one child to plan school lunches" : `${schoolLunchTarget || weekdaysInPlan(planStartDate, planDays)} extra weekday lunch${schoolLunchTarget === 1 ? "" : "es"} · separate from regular lunches`} /></div>
        {kidLunches && <div className="school-lunch-builder"><div><strong>Make school lunches easy</strong><span>Each school lunch is a simple, packable main plus the sides you choose. These are additional lunches and never reduce your regular lunch count.</span></div><div role="group" aria-label="School lunch sides">{schoolLunchSideOptions.map((side) => <button type="button" key={side} className={schoolLunchSides.includes(side) ? "selected" : ""} aria-pressed={schoolLunchSides.includes(side)} onClick={() => toggleSchoolLunchSide(side)}>{schoolLunchSides.includes(side) ? "✓ " : "+ "}{side}</button>)}</div></div>}
        <div className="field"><label htmlFor="household-name">Household profile</label><input id="household-name" className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /><small className="field-help">{members.length ? `${members.length} family member${members.length === 1 ? "" : "s"} included in preferences.` : "Add individual preferences on the Family page."}</small></div>
        {familyRuleDetails.length ? <details className="family-rule-panel"><summary><span>Family search rules</span><small>{familyRuleDetails.length} active</small></summary><div>{familyRuleDetails.map((item) => <p key={`${item.member}-${item.rule}`}><strong>{item.member}</strong><span>{item.rule}</span></p>)}</div></details> : <button className="family-empty-link" onClick={() => navigateTo("family")}>+ Add family preferences to personalize the search</button>}
        <div className="two-col"><div className="field"><label htmlFor="max-cook-time">Maximum cook time</label><select id="max-cook-time" value={maxTime} onChange={(e) => setMaxTime(e.target.value)}><option>20 minutes</option><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option></select></div><div className="field"><label htmlFor="cooking-comfort">Cooking comfort</label><select id="cooking-comfort" value={skill} onChange={(e) => setSkill(e.target.value)}><option>Keep it simple</option><option>Comfortable</option><option>Adventurous</option></select></div></div>
        <div className="field"><div className="label-line"><label htmlFor="grocery-budget">Grocery budget for this plan</label><strong>{budget >= 500 ? "$500+" : `$${budget}`}</strong></div><input id="grocery-budget" aria-label="Grocery budget for this plan" type="range" min="50" max="500" step="10" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /><div className="range-labels"><span>$50</span><span>$500+</span></div></div>
        <div className="preference-heading"><strong>Plan preferences</strong><span>Choose the options that should shape your recipes and shopping plan.</span></div>
        <div className="option-grid"><Toggle label="Plan for leftovers" checked={leftovers} onChange={() => setLeftovers(!leftovers)} note="Cook once, eat twice" /><Toggle label="Try to reuse ingredients" checked={reuseIngredients} onChange={() => setReuseIngredients(!reuseIngredients)} note="Favor recipes with useful overlap" /><Toggle label="Gluten-free" checked={glutenFree} onChange={() => setGlutenFree(!glutenFree)} note={familyGlutenFree ? "Also required by a family member" : undefined} /><Toggle label="Low dairy" checked={lowDairy} onChange={() => setLowDairy(!lowDairy)} note={familyLowDairy ? "Also preferred by a family member" : undefined} /><Toggle label="Mediterranean" checked={mediterranean} onChange={() => setMediterranean(!mediterranean)} /></div>
        <div className="field"><label htmlFor="ingredient-exclusions">Allergies or ingredients to avoid</label><input id="ingredient-exclusions" className="text-input" placeholder="e.g. shellfish, peanuts, mushrooms" value={exclusions} onChange={(e) => setExclusions(e.target.value)} /></div>
        <div className="location-picker">
          <label htmlFor="shopping-location">Shopping location</label><div className="location-input"><span className="location-mark" aria-hidden="true"><i>⌖</i></span><input id="shopping-location" value={locationQuery} onChange={(e) => { const nextLocation = e.target.value; setLocationQuery(nextLocation); setLocationResults([]); setLocationStatus(nextLocation.trim().length >= 2 ? "Finding location matches…" : nextLocation ? "Type at least 2 characters to search." : "Enter a neighborhood, city, or ZIP, or use your location."); }} placeholder="Neighborhood, city, or ZIP" aria-label="Shopping location" role="combobox" aria-autocomplete="list" aria-controls="location-options" aria-expanded={locationResults.length > 0} /><div className="location-actions">{locationQuery && <button className="location-clear" type="button" onClick={clearLocation} aria-label="Clear shopping location">Clear</button>}<button className="location-use" type="button" onClick={locateMe}><span aria-hidden="true">◎</span>Use my location</button></div></div>
          {locationResults.length > 0 && <div className="location-results" id="location-options" role="listbox" aria-label="Location suggestions">{locationResults.map((result) => <button role="option" aria-selected="false" key={`${result.lat}-${result.lon}`} onClick={() => { setLocation(result.label); setLocationQuery(result.label); setLocationCoordinates(result.lat && result.lon ? { lat: result.lat, lon: result.lon } : null); setLocationResults([]); setNearbyStores([]); setLocationStatus("Location updated. Refresh nearby stores when you’re ready."); }}>{result.label}</button>)}</div>}
          <small aria-live="polite">{locationStatus || `Searching stores near ${location}`}</small>
        </div>
        <details className="store-preferences" open>
          <summary><span>Store priorities</span><small>{preferredStores.length} saved · within {storeRadius} miles</small></summary>
          <div className="store-preferences-body">
            <p>Your first store is your highest priority. These choices are saved to your account and used for grocery comparisons.</p>
            <Toggle label="One store only" checked={oneStore} onChange={() => setOneStore(!oneStore)} note="Build the shopping plan around one selected store" />
            <div className="store-search-controls"><label htmlFor="store-radius">Search radius<select id="store-radius" value={storeRadius} onChange={(event) => { setStoreRadius(Number(event.target.value)); setNearbyStores([]); }}><option value="1">1 mile</option><option value="3">3 miles</option><option value="5">5 miles</option><option value="10">10 miles</option><option value="15">15 miles</option><option value="25">25 miles</option></select></label><button className="outline compact" type="button" disabled={storeSearchBusy || !location.trim()} onClick={findNearbyStores}>{storeSearchBusy ? "Finding stores…" : "Find nearby stores"}</button></div>
            <ol className="preferred-store-list">{preferredStores.map((store, index) => <li key={store.id}><span className="store-priority">{index + 1}</span><div><strong>{store.name}</strong><small>{store.distanceMiles !== undefined ? `${store.distanceMiles} mi · ` : ""}{store.address || "Address unavailable"}</small></div><div className="store-order-actions"><button type="button" disabled={index === 0} onClick={() => movePreferredStore(index, -1)} aria-label={`Move ${store.name} higher`}>↑</button><button type="button" disabled={index === preferredStores.length - 1} onClick={() => movePreferredStore(index, 1)} aria-label={`Move ${store.name} lower`}>↓</button><button type="button" disabled={preferredStores.length === 1} onClick={() => removePreferredStore(store)} aria-label={`Remove ${store.name}`}>Remove</button></div></li>)}</ol>
            {oneStore && <div className="field"><label htmlFor="preferred-store">Only use this store</label><select id="preferred-store" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>{preferredStores.map((store) => <option key={store.id} value={store.name}>{store.name}</option>)}</select></div>}
            {nearbyStores.length > 0 && <div className="nearby-store-results"><span className="mini-label">NEARBY OPTIONS</span>{nearbyStores.map((store) => <button type="button" key={store.id} onClick={() => addPreferredStore(store)}><span><strong>{store.name}</strong><small>{store.distanceMiles !== undefined ? `${store.distanceMiles} mi · ` : ""}{store.address || "Address unavailable"}</small></span><b>+ Add</b></button>)}</div>}
            {storeSearchStatus && <p className="store-search-status" aria-live="polite">{storeSearchStatus}</p>}
            <small className="map-attribution">Nearby store data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</small>
          </div>
        </details>
        <button className="primary" onClick={() => generatePlan()} disabled={planning || !authLoaded}>{!authLoaded ? "Checking your account…" : planning ? "Building your recipe catalog…" : "Browse recipes for my plan"} <span>→</span></button><p className="estimate">Estimated groceries for a full plan: <strong>${planningEstimate.low}–${planningEstimate.high}</strong>{planningEstimate.high > budget && <span> · above your {budget >= 500 ? "$500+" : `$${budget}`} target</span>}</p>{user && planSaveStatus && <p className="cloud-save-status" aria-live="polite">☁ {planSaveStatus}</p>}{plannerNotice && <p className="form-notice error" role="alert">{plannerNotice}</p>}
      </section>
    </div>}

    {view === "meals" && <div className="dashboard catalog-dashboard" id="page-content" tabIndex={-1}>
      <div className="page-heading catalog-heading"><div><p className="eyebrow">{adults} ADULT{adults === 1 ? "" : "S"}{kids ? ` · ${kids} ${kids === 1 ? "CHILD" : "KIDS"}` : ""} · {household.toUpperCase()}</p><h2>{similarTo ? `More like ${similarTo}.` : "Build your plan from the catalog."}</h2><p>Browse, filter, and add each recipe to the meal where it belongs.</p></div><div className="page-heading-actions">{similarTo && catalogBeforeSimilar && <button className="outline" onClick={returnToFullCatalog}>← Full catalog</button>}<button className="outline" onClick={() => navigateTo("plan")}>Adjust full plan</button></div></div>

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
          {reuseIngredients && <span>Ingredient reuse prioritized</span>}
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
        <section className="recipe-import-panel" aria-labelledby="recipe-import-title">
          <div><p className="mini-label">BRING YOUR OWN RECIPE</p><h4 id="recipe-import-title">Found something elsewhere?</h4><p>Search the web, then paste a recipe page link here. We’ll import its title, image, timing, and ingredients when the page provides standard recipe details.</p></div>
          <div className="recipe-import-controls">
            <label htmlFor="recipe-import-kind">Add to catalog as</label>
            <select id="recipe-import-kind" value={importKind} onChange={(event) => setImportKind(event.target.value)}>{activeMealKinds.map((kind) => <option key={kind}>{kind}</option>)}</select>
            <label className="recipe-url-field" htmlFor="recipe-import-url">Recipe page link<input id="recipe-import-url" type="url" placeholder="https://example.com/recipe" value={importUrl} onChange={(event) => { setImportUrl(event.target.value); setImportStatus(""); }} onKeyDown={(event) => { if (event.key === "Enter") void importRecipeUrl(); }} /></label>
            <button className="outline" type="button" disabled={importBusy || !importUrl.trim()} onClick={importRecipeUrl}>{importBusy ? "Importing…" : "Import recipe"}</button>
            <a className="web-recipe-search" href={webRecipeSearchUrl()} target="_blank" rel="noreferrer">Search the web ↗</a>
          </div>
          {importStatus && <p className="recipe-import-status" role="status" aria-live="polite">{importStatus}</p>}
        </section>
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
          <div className={`recipe-thumb ${meal.tone}`}><img src={meal.image || recipeThumbnail(meal)} alt={`${meal.title} recipe`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} /><span hidden aria-hidden="true">{meal.emoji}</span><em>{meal.kind === "School lunch" ? "Kid-friendly lunch" : meal.kind}</em><button className={favorites.includes(meal.title) ? "saved" : ""} onClick={() => toggleFavorite(meal)} aria-label={`${favorites.includes(meal.title) ? "Remove" : "Add"} ${meal.title} ${favorites.includes(meal.title) ? "from" : "to"} favorites`}>{favorites.includes(meal.title) ? "♥" : "♡"}</button></div>
          <div className="recipe-card-copy"><small>{meal.sourceName}</small><h4>{meal.title}</h4><p>{meal.readyMinutes} min · {meal.cost}</p><div className="recipe-tags">{reuseIngredients && ingredientOverlapScore(meal, selectedIngredientNames) > 0 && <span className="reuse-tag">Reuses {ingredientOverlapScore(meal, selectedIngredientNames)} selected ingredient{ingredientOverlapScore(meal, selectedIngredientNames) === 1 ? "" : "s"}</span>}{meal.tags?.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="catalog-secondary-actions">{meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer">Recipe ↗</a>}<button onClick={() => findSimilar(meal)}>Find similar</button><button onClick={() => setRatingMeal(meal)}>Rate</button></div><div className="add-meal-actions">{activeMealKinds.map((kind) => {
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
      <div className="page-heading"><div><p className="eyebrow">GROCERIES · STEP 1 OF 3</p><h2>Confirm what your household needs.</h2><p>Review {groceryEntries.length} combined ingredients for {adults} adult{adults === 1 ? "" : "s"}{kids ? ` and ${kids} ${kids === 1 ? "child" : "kids"}` : ""}. Edit the totals and mark anything you already have before Grocer-Eaze builds your shopping list.</p></div><button className="outline" onClick={() => navigateTo("meals")}>← Back to recipes</button></div>
      {plannedMeals.length ? <div className="grocery-review-layout">
        <section className="grocery-panel grocery-panel-full">
          <div className="store-compare"><span className="mini-label">{oneStore ? "YOUR SELECTED STORE" : "YOUR PRIORITIZED STORES"}</span><div>{visibleStoreEstimates.map((store, index) => <button key={store.id} className={selectedStore === store.name ? "selected-store" : ""} onClick={() => setSelectedStore(store.name)}><strong>{index + 1}. {store.name}</strong><span>${store.price}</span><small>{store.distanceMiles !== undefined ? `${store.distanceMiles} mi · ` : ""}{store.availability}% estimated availability</small></button>)}</div></div>
          <div className="grocery-head"><strong>{selectedStore}</strong><span>{plannedMeals.length} meals · {servingEquivalents} serving equivalent{servingEquivalents === 1 ? "" : "s"} · recipe-derived estimate</span></div>
          <p className="estimate-method"><strong>How this is calculated:</strong> We scale each selected recipe to {adults} adult{adults === 1 ? "" : "s"}{kids ? ` and ${kids} ${kids === 1 ? "child" : "kids"}` : ""}, with each child counted as half a serving, then adjust for typical pricing at {selectedStore}. It is an estimate—not an exact checkout total—and does not subtract ingredients marked “already have.”</p>
          <section className="ingredient-review ingredient-review-screen" aria-labelledby="ingredient-review-heading">
            <div className="ingredient-review-body">
              <div className="ingredient-review-title"><div><span className="mini-label">INGREDIENT REVIEW</span><h3 id="ingredient-review-heading">Edit amounts and check your kitchen</h3></div><small>{alreadyHaveEntries.length} marked already have</small></div>
              <p>Totals are scaled to {servingEquivalents} serving equivalent{servingEquivalents === 1 ? "" : "s"} and merged where recipe ingredient names match. Edit package amounts as needed, then mark anything already in your kitchen so it stays off every shopping export.</p>
              <div className="ingredient-review-columns" aria-hidden="true"><span>Ingredient</span><span>Total needed</span><span>Amount option</span><span>Shopping status</span></div>
              {unresolvedAmountEntries.length > 0 && <p className="ingredient-review-alert" role="alert"><strong>{unresolvedAmountEntries.length} amount{unresolvedAmountEntries.length === 1 ? " needs" : "s need"} review.</strong> Recipe descriptions are never used as quantities. Enter an amount or explicitly choose “Use as needed” before continuing.</p>}
              <div className="ingredient-review-list">{groceryEntries.map((entry) => {
                const amountValue = ingredientAdjustments[entry.key] ?? entry.suggestedQuantity;
                const useAsNeeded = asNeededIngredients.includes(entry.key);
                const alreadyHave = alreadyHaveIngredients.includes(entry.key);
                const amountNeedsReview = !alreadyHave && !useAsNeeded && !isAcceptedIngredientAmount(amountValue);
                return <div className={`ingredient-edit-row ${alreadyHave ? "already-have" : ""} ${useAsNeeded ? "as-needed" : ""} ${amountNeedsReview ? "needs-review" : ""}`} key={entry.key}>
                <label><span>Ingredient name</span><input className="text-input" value={ingredientNameEdits[entry.key] ?? entry.name} onChange={(event) => { setIngredientNameEdits((current) => ({ ...current, [entry.key]: event.target.value })); setConfirmedIngredientsSignature(""); setReviewedPlanSignature(""); }} aria-label={`Ingredient name for ${entry.name}`} /></label>
                <label className="ingredient-amount-control"><span>Total needed</span><input className="text-input" value={useAsNeeded || amountValue === missingIngredientAmount ? "" : amountValue} placeholder={useAsNeeded ? "Not required" : missingIngredientAmount} disabled={useAsNeeded} required={!alreadyHave && !useAsNeeded} aria-invalid={amountNeedsReview} onChange={(event) => { setIngredientAdjustments((current) => ({ ...current, [entry.key]: event.target.value })); setConfirmedIngredientsSignature(""); setReviewedPlanSignature(""); }} aria-label={`Total amount needed for ${entry.name}`} />{amountNeedsReview && <small>Amount unavailable—enter a quantity.</small>}</label>
                <label className={`ingredient-choice-control as-needed-control ${useAsNeeded ? "selected" : ""}`}><input type="checkbox" checked={useAsNeeded} onChange={() => toggleAsNeeded(entry.key)} /><span>Use as needed</span><small>{useAsNeeded ? "Amount not required" : "Use a measured amount"}</small></label>
                <label className={`ingredient-choice-control already-have-control ${alreadyHave ? "selected" : ""}`}><input type="checkbox" checked={alreadyHave} onChange={() => toggleAlreadyHave(entry.key)} /><span>Already have</span><small>{alreadyHave ? "Excluded from shopping" : "Keep on shopping list"}</small></label>
                <small>Combined from {entry.occurrences} recipe use{entry.occurrences === 1 ? "" : "s"}{entry.originals[0] ? ` · source example: ${entry.originals[0]}` : ""}</small>
                <button type="button" className="report-ingredient-button" onClick={() => openIngredientReport(entry)}>Report incorrect value</button>
              </div>})}</div>
            </div>
          </section>
          <div className="grocery-approval-card"><div><span className="mini-label">NEXT · STEP 2</span><h3>Build your final shopping list</h3><p>We’ll remove everything marked “Already have” and organize the remaining items by grocery aisle for one last review.</p></div><button className="primary" disabled={unresolvedAmountEntries.length > 0} onClick={confirmIngredients}>{unresolvedAmountEntries.length ? `Review ${unresolvedAmountEntries.length} amount${unresolvedAmountEntries.length === 1 ? "" : "s"}` : "Confirm ingredients & build shopping list →"}</button></div>
          {exportStatus && <p className="export-status" aria-live="polite">{exportStatus}</p>}
        </section>
      </div> : <section className="empty-journey"><span className="empty-journey-icon icon-centered" aria-hidden="true">🛒</span><h3>Your grocery list starts with a meal.</h3><p>Browse the recipe catalog, add meals to your schedule, and Grocer-Eaze will combine the ingredients here.</p><div><button className="primary compact" onClick={() => navigateTo(recipeIdeas.length ? "meals" : "plan")}>{recipeIdeas.length ? "Choose recipes" : "Build my plan"}</button></div></section>}
    </div>}

    {view === "shopping" && <div className="dashboard" id="page-content" tabIndex={-1}>
      <div className="page-heading"><div><p className="eyebrow">GROCERIES · STEP 2 OF 3</p><h2>Review the list you’ll take shopping.</h2><p>This is your final shopping list—not optional add-ons. It includes only the ingredients you still need, organized by aisle. Review it below, then approve it to choose how you want to send or save it.</p></div><button className="outline" onClick={() => navigateTo("list")}>← Edit ingredients</button></div>
      {plannedMeals.length && ingredientsConfirmed ? <div className="grocery-review-layout">
        <section className="grocery-panel grocery-panel-full">
          <div className="shopping-list-purpose" role="note"><strong>What this screen is for</strong><p>Check that the final list looks right. Ingredient names, amounts, and “Already have” choices come from Step 1; use “Edit ingredients” if anything needs to change.</p></div>
          <div className="grocery-head"><strong>{selectedStore}</strong><span>{shoppingEntries.length} items to buy · {alreadyHaveEntries.length} already on hand</span></div>
          <div className="shopping-checklist-heading"><span className="mini-label">FINAL SHOPPING LIST</span><h3>{shoppingEntries.length} items to buy</h3><p>These are the items Grocer-Eaze will include when you send, save, or open the shopping list.</p></div>
          {groceryGroups.length ? groceryGroups.map((group) => <details open key={group.title}><summary><span>{group.icon} {group.title}</span><small>{group.count} {group.count === 1 ? "item" : "items"}</small></summary><ul className="shopping-list-preview">{group.items.map((entry) => <li key={entry.key}><span>{groceryItemName(entry)}</span><strong>{groceryItemQuantity(entry)}</strong></li>)}</ul></details>) : <p className="empty-state">Everything is marked as already on hand. You can still approve the plan to email recipes or save the meal calendar.</p>}
          {alreadyHaveEntries.length > 0 && <details className="already-have-summary"><summary><span>✓ Already have</span><small>{alreadyHaveEntries.length} excluded from shopping</small></summary><div>{alreadyHaveEntries.map((entry) => <p key={entry.key}><span><strong>{groceryItemName(entry)}</strong><small>{groceryItemQuantity(entry)}</small></span></p>)}</div></details>}
          <div className="grocery-approval-card"><div><span className="mini-label">NEXT · STEP 3</span><h3>Ready to use this list?</h3><p>Nothing will be sent yet. After approval, you’ll choose grocery sharing, email, calendar, Instacart when available, or all of them.</p></div><div className="grocery-approval-actions"><button className="outline" onClick={() => navigateTo("list")}>← Edit ingredients</button><button className="primary" onClick={approveGroceryList}>Approve list & choose how to send or save →</button></div></div>
          {exportStatus && <p className="export-status" aria-live="polite">{exportStatus}</p>}
        </section>
      </div> : <section className="empty-journey"><h3>Confirm your ingredients first.</h3><p>Review combined amounts and mark what you already have before Grocer-Eaze builds the shopping list.</p><div><button className="primary compact" onClick={() => navigateTo("list")}>Confirm ingredients</button></div></section>}
    </div>}

    {view === "delivery" && <div className="dashboard narrow delivery-dashboard" id="page-content" tabIndex={-1}>
      <div className="page-heading"><div><p className="eyebrow">GROCERIES · STEP 3 OF 3</p><h2>Who should receive your plan?</h2><p>Choose each person, then select whether they should receive clean recipe links, the final grocery list, or a calendar invite. Nothing sends until you confirm below.</p></div><button className="outline" onClick={() => navigateTo("shopping")}>← Review shopping list</button></div>
      {plannedMeals.length && groceryListApproved ? <>
        <section className="self-delivery-card" aria-labelledby="self-delivery-heading">
          <div><span className="mini-label">FASTEST OPTION</span><h3 id="self-delivery-heading">Send everything to myself</h3><p>Uses your signed-in email, sends clean recipe links and the grocery list, and attaches the dated meal calendar.</p></div>
          <button type="button" className="primary compact" disabled={deliveryBusy || !selfDeliveryRecipient} onClick={() => executeDeliveryActions({ selfOnly: true })}>{deliveryBusy ? "Preparing…" : "Send all to me →"}</button>
        </section>
        <div className="delivery-toolbar"><div><strong>{selectedRecipientCount} recipient{selectedRecipientCount === 1 ? "" : "s"} · {selectedDeviceActionCount} device action{selectedDeviceActionCount === 1 ? "" : "s"}</strong><small>{plannedMeals.length} meals · {shoppingEntries.length} shopping items</small></div><button type="button" className="outline compact" onClick={() => setAllDeliveryActions(!allDeliveryActionsSelected)}>{allDeliveryActionsSelected ? "Clear all" : "Select everything"}</button></div>
        <section className="delivery-recipient-section" aria-labelledby="delivery-recipients-heading">
          <div className="delivery-section-heading"><div><span className="mini-label">RECIPIENTS</span><h3 id="delivery-recipients-heading">Choose what each person receives</h3><p>Email recipients can receive calendar attachments. Text recipients can receive recipe links and grocery lists as prefilled drafts for you to review. For privacy, added recipient details are kept only for this visit.</p></div><button type="button" className="outline compact" disabled={allDeliveryRecipients.length >= 10} onClick={() => openRecipientEditor()}>+ Add recipient</button></div>
          <div className="delivery-recipient-list">{selfDeliveryRecipient && deliveryRecipientCard(selfDeliveryRecipient, true)}{externalDeliveryRecipients.map((recipient) => deliveryRecipientCard(recipient))}</div>
          {!externalDeliveryRecipients.length && <p className="recipient-empty-note">Add family or friends by email or phone whenever someone else should receive part of the plan.</p>}
        </section>
        <section className="device-action-section" aria-labelledby="device-actions-heading">
          <div className="delivery-section-heading"><div><span className="mini-label">ON THIS DEVICE</span><h3 id="device-actions-heading">Optional ways to save or shop</h3><p>These actions stay on your device and don’t add another recipient.</p></div></div>
          <div className="device-action-grid">
            <label className={`${deviceActions.copy ? "selected" : ""} ${!groceryGroups.length ? "disabled" : ""}`}><input type="checkbox" disabled={!groceryGroups.length} checked={groceryGroups.length > 0 && deviceActions.copy} onChange={(event) => setDeviceActions((current) => ({ ...current, copy: event.target.checked }))} /><span><strong>Copy grocery list</strong><small>{groceryGroups.length ? "Paste it into Reminders or any app" : "Nothing to copy; every ingredient is already on hand"}</small></span></label>
            <label className={`${deviceActions.notes ? "selected" : ""} ${!groceryGroups.length ? "disabled" : ""}`}><input type="checkbox" disabled={!groceryGroups.length} checked={groceryGroups.length > 0 && deviceActions.notes} onChange={(event) => setDeviceActions((current) => ({ ...current, notes: event.target.checked }))} /><span><strong>Share to Notes or Keep</strong><small>{groceryGroups.length ? "Uses your device’s share menu" : "Nothing to share; every ingredient is already on hand"}</small></span></label>
            <label className={deviceActions.calendar ? "selected" : ""}><input type="checkbox" checked={deviceActions.calendar} onChange={(event) => setDeviceActions((current) => ({ ...current, calendar: event.target.checked }))} /><span><strong>Download my calendar</strong><small>Save an import-ready calendar file</small></span></label>
            {instacartEnabled && <label className={`${deviceActions.instacart ? "selected" : ""} ${!groceryGroups.length ? "disabled" : ""}`}><input type="checkbox" disabled={!groceryGroups.length} checked={groceryGroups.length > 0 && deviceActions.instacart} onChange={(event) => setDeviceActions((current) => ({ ...current, instacart: event.target.checked }))} /><span><strong>Open in Instacart</strong><small>{groceryGroups.length ? "Review matched items before checkout" : "Nothing to shop; every ingredient is already on hand"}</small></span></label>}
          </div>
          {deviceActions.calendar && <div className="calendar-device-settings"><label>Calendar<select value={calendarProvider} onChange={(event) => setCalendarProvider(event.target.value as "google" | "apple")}><option value="google">Google Calendar</option><option value="apple">Apple Calendar</option></select></label><label>Recipe order<select value={calendarOrder} onChange={(event) => setCalendarOrder(event.target.value as "plan" | "random")}><option value="plan">Keep my selected order</option><option value="random">Shuffle within each meal type</option></select></label></div>}
        </section>
        {pendingTextRecipients.length > 0 && <div className="pending-text-banner" role="status"><div><strong>{pendingTextRecipients.length} text draft{pendingTextRecipients.length === 1 ? "" : "s"} still to open</strong><small>Each recipient gets a separate private draft.</small></div><button type="button" className="outline compact" onClick={openNextTextRecipient}>Open next text</button></div>}
        <div className="delivery-confirm"><p><strong>Review your choices, then send.</strong> Emails are sent separately so recipients don’t see one another. Texts open as private drafts for your review.</p><button className="primary" disabled={deliveryBusy || selectedDeliveryActionCount === 0} onClick={() => executeDeliveryActions()}>{deliveryBusy ? "Preparing deliveries…" : `Send or save ${selectedDeliveryActionCount || "selected"} choice${selectedDeliveryActionCount === 1 ? "" : "s"} →`}</button></div>
        {exportStatus && <p className="export-status delivery-status" aria-live="polite">{exportStatus}</p>}
      </> : <section className="empty-journey"><h3>Approve your shopping list first.</h3><p>Confirm ingredients, review the final shopping list, and approve it before choosing how to send or save the plan.</p><div><button className="primary compact" onClick={() => navigateTo(ingredientsConfirmed ? "shopping" : "list")}>{ingredientsConfirmed ? "Review shopping list" : "Confirm ingredients"}</button></div></section>}
    </div>}

    {view === "family" && <div className="dashboard narrow" id="page-content"><div className="page-heading"><div><p className="eyebrow">HOUSEHOLD PREFERENCES</p><h2>Your family, thoughtfully fed.</h2><p>Allergies, avoided ingredients, and favorite proteins shape every catalog search.</p></div></div>{familyStatus && <p className="form-notice success" aria-live="polite">{familyStatus}</p>}<div className="family-grid"><section className="settings-card"><h3>Family members</h3>{members.length === 0 && <p className="empty-state">No family members yet. Add the first person below.</p>}{members.map((member) => <article className="member-card" key={member.id}><span className="member-avatar icon-centered">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.role} · {member.allergies || "No listed allergies"}</small><p>{[member.preferences?.glutenFree && "Gluten-free", member.preferences?.lowDairy && "Low dairy", member.preferences?.kidFriendly && "Kid-friendly", member.preferences?.avoidOnions && "Avoid onions", ...(member.preferences?.proteins || []).map((protein) => `${protein} favorite`)].filter(Boolean).join(" · ") || "No preferences yet"}</p></div><div className="member-actions"><button onClick={() => editMember(member)}>Edit</button><button onClick={() => deleteMember(member.id)} aria-label={`Remove ${member.name}`}>Remove</button></div></article>)}</section><section className="settings-card"><h3>{editingMemberId ? "Edit family member" : "Add a family member"}</h3><div className="field"><label htmlFor="family-member-name">Name</label><input id="family-member-name" className="text-input" value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} /></div><div className="field"><label htmlFor="family-member-role">Role</label><select id="family-member-role" value={memberDraft.role} onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value })}><option>Adult</option><option>Teen</option><option>Child</option></select></div><div className="field"><label htmlFor="family-member-allergies">Allergies / avoid</label><input id="family-member-allergies" className="text-input" placeholder="Peanuts, shellfish…" value={memberDraft.allergies} onChange={(e) => setMemberDraft({ ...memberDraft, allergies: e.target.value })} /></div><div className="field"><label>Favorite proteins</label><div className="preference-check-grid" role="group" aria-label="Favorite proteins">{proteinOptions.map((protein) => <button type="button" key={protein} className={memberDraft.proteins.includes(protein) ? "selected" : ""} aria-pressed={memberDraft.proteins.includes(protein)} onClick={() => setMemberDraft({ ...memberDraft, proteins: memberDraft.proteins.includes(protein) ? memberDraft.proteins.filter((item) => item !== protein) : [...memberDraft.proteins, protein] })}>{protein}</button>)}</div></div><Toggle label="Avoid onions" checked={memberDraft.avoidOnions} onChange={() => setMemberDraft({ ...memberDraft, avoidOnions: !memberDraft.avoidOnions })} /><Toggle label="Gluten-free" checked={memberDraft.glutenFree} onChange={() => setMemberDraft({ ...memberDraft, glutenFree: !memberDraft.glutenFree })} /><Toggle label="Low dairy" checked={memberDraft.lowDairy} onChange={() => setMemberDraft({ ...memberDraft, lowDairy: !memberDraft.lowDairy })} /><Toggle label="Kid-friendly" checked={memberDraft.kidFriendly} onChange={() => setMemberDraft({ ...memberDraft, kidFriendly: !memberDraft.kidFriendly })} /><button className="primary" onClick={saveMember}>{editingMemberId ? "Save changes" : "Add family member"}</button>{editingMemberId && <button className="text-button" onClick={() => { setEditingMemberId(""); setMemberDraft({ name: "", role: "Adult", allergies: "", glutenFree: true, lowDairy: false, kidFriendly: false, avoidOnions: false, proteins: [] }); }}>Cancel editing</button>}</section></div></div>}

    {view === "account" && <div className="dashboard narrow" id="page-content">
      <div className="page-heading"><div><p className="eyebrow">PROFILE & SECURITY</p><h2>{user ? `Welcome, ${user.name}.` : "Sign in or create an account"}</h2><p>{user ? "Control your household, privacy, and plan." : "Use your email and a one-time code. Returning households are restored automatically."}</p></div></div>
      {!user ? <section className="settings-card auth-card">
        <div className="auth-trust"><span className="icon-centered" aria-hidden="true">🔒</span><strong>Secure passwordless sign-in</strong><small>Returning users only enter their email. New accounts add a name; phone is optional.</small></div>
        {authStep === "email" ? <>
          <div className="field"><label htmlFor="signup-email">Email</label><input id="signup-email" className="text-input" type="email" autoComplete="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></div>
          <button className="primary" disabled={authBusy || !authForm.email.trim()} onClick={startAuth}>{authBusy ? "Checking email…" : "Continue with email"}</button>
        </> : authStep === "details" ? <>
          <div className="field"><label htmlFor="signup-email-confirmed">Email</label><input id="signup-email-confirmed" className="text-input" type="email" value={authForm.email} disabled /></div>
          <div className="field"><label htmlFor="signup-name">Name</label><input id="signup-name" className="text-input" autoComplete="name" required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="signup-phone">Phone <small>(optional)</small></label><input id="signup-phone" className="text-input" type="tel" autoComplete="tel" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></div>
          <button className="primary" disabled={authBusy || !authForm.name.trim()} onClick={startAuth}>{authBusy ? "Sending code…" : "Create account and send code"}</button>
          <button className="text-button" onClick={() => { setAuthStep("email"); setAccountStatus(""); }}>Use a different email</button>
        </> : <>
          <div className="field"><label htmlFor="verification-code">Six-digit verification code</label><input id="verification-code" className="text-input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={authForm.code} onChange={(e) => setAuthForm({ ...authForm, code: e.target.value.replace(/\D/g, "") })} /></div>
          <button className="primary" disabled={authBusy || authForm.code.length !== 6} onClick={verifyAuth}>{authBusy ? "Verifying…" : "Verify and sign in"}</button>
          <button className="text-button" onClick={() => { setAuthStep("email"); setAccountStatus(""); }}>Use a different email</button>
        </>}
        {accountStatus && <p className="checkout-note" role="status">{accountStatus}</p>}
      </section> : <div className="settings-stack">
        <section className="settings-card">
          <h3>Profile</h3>
          <div className="account-identity"><span className="member-avatar icon-centered">{user.name[0].toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}{user.phone ? ` · ${user.phone}` : ""}</small></div><em>{user.role}</em></div>
          <div className="two-col"><div className="field"><label htmlFor="profile-household">Household name</label><input id="profile-household" className="text-input" value={household} onChange={(e) => setHousehold(e.target.value)} /></div><div className="field"><label htmlFor="profile-email">Default recipe email</label><input id="profile-email" className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
          <button className="outline" onClick={async () => { await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ householdName: household, people, location, preferences: profilePreferences }) }); setAccountStatus("Profile saved."); }}>Save profile</button>{accountStatus && <span className="success-note" role="status">{accountStatus}</span>}
        </section>
        <section className="settings-card security-card"><div className="icon-centered" aria-hidden="true">🔒</div><div><h3>Security</h3><p>Your email is verified. Your session is stored in a secure, HTTP-only cookie, protected data is checked on the server, and sensitive service keys never reach your browser.</p></div></section>
        <section className="settings-card plan-row">
          <div>
            <span className="mini-label">ACCESS STATUS</span>
            <h3>{user.subscriptionStatus === "active" ? "Active membership" : user.subscriptionStatus === "trialing" ? "30-day free trial" : user.role === "admin" ? "Administrator access" : user.billingExempt ? "Billing exempt" : user.accessStatus === "complimentary" ? "Complimentary account" : "Plan required"}</h3>
            <p>{user.subscriptionEndsAt ? `Current period ends ${new Date(user.subscriptionEndsAt).toLocaleDateString()}` : user.complimentaryUntil ? `Complimentary through ${user.complimentaryUntil}` : user.role === "admin" ? "Your administrator account does not require billing." : user.hasAccess ? "Your Grocer-Eaze tools are unlocked." : "Choose monthly or yearly billing to start your 30-day trial."}</p>
          </div>
          {user.subscriptionStatus ? <button className="primary compact" disabled={billingBusy} onClick={() => openBilling("portal")}>Manage billing</button> : user.role === "admin" ? null : <button className="primary compact" onClick={() => navigateTo("plans")}>View plans</button>}
        </section>
        <section className="settings-card danger-zone"><h3>Account controls</h3><button className="outline" onClick={signOut}>Sign out</button></section>
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

    {recipientDraft && <div className="modal-backdrop" onClick={() => { setRecipientDraft(null); setRecipientError(""); }}><section className="email-recipient-modal recipient-modal" role="dialog" aria-modal="true" aria-labelledby="recipient-modal-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}><button className="modal-close icon-centered" aria-label="Close recipient editor" onClick={() => { setRecipientDraft(null); setRecipientError(""); }}>×</button><span className="mini-label">{recipientDraft.id ? "EDIT RECIPIENT" : "ADD RECIPIENT"}</span><h3 id="recipient-modal-title">{recipientDraft.id ? "Update this person" : "Who else should receive the plan?"}</h3><p>Add one email address or phone number. After saving, choose exactly what this person should receive.</p><div className="field"><label htmlFor="recipient-name">Name <small>(optional)</small></label><input id="recipient-name" className="text-input" autoComplete="name" maxLength={80} value={recipientDraft.name} onChange={(event) => { setRecipientDraft({ ...recipientDraft, name: event.target.value }); setRecipientError(""); }} placeholder="e.g. Alex" /></div><div className="field"><label htmlFor="recipient-channel">Send by</label><select id="recipient-channel" value={recipientDraft.channel} onChange={(event) => { setRecipientDraft({ ...recipientDraft, channel: event.target.value as "email" | "text", address: "" }); setRecipientError(""); }}><option value="email">Email</option><option value="text">Text message</option></select></div><div className="field"><label htmlFor="recipient-address">{recipientDraft.channel === "email" ? "Email address" : "Phone number"}</label><input id="recipient-address" className="text-input" type={recipientDraft.channel === "email" ? "email" : "tel"} inputMode={recipientDraft.channel === "email" ? "email" : "tel"} autoComplete={recipientDraft.channel === "email" ? "email" : "tel"} maxLength={recipientDraft.channel === "email" ? 254 : 40} value={recipientDraft.address} onChange={(event) => { setRecipientDraft({ ...recipientDraft, address: event.target.value }); setRecipientError(""); }} placeholder={recipientDraft.channel === "email" ? "alex@example.com" : "(312) 555-0123"} /></div>{recipientError && <p className="form-notice error" role="alert">{recipientError}</p>}<div className="modal-actions"><button className="outline" type="button" onClick={() => { setRecipientDraft(null); setRecipientError(""); }}>Cancel</button><button className="primary compact" type="button" onClick={saveRecipient}>Save recipient</button></div></section></div>}

    {ingredientReport && <div className="modal-backdrop" onClick={() => setIngredientReport(null)}><section className="ingredient-report-modal" role="dialog" aria-modal="true" aria-labelledby="ingredient-report-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}><button className="modal-close icon-centered" aria-label="Close ingredient report" onClick={() => setIngredientReport(null)}>×</button><span className="mini-label">REPORT A LIST ISSUE</span><h3 id="ingredient-report-title">Help us correct {ingredientReport.name}</h3><p>We’ll include the recipe source and returned value automatically. Your report goes securely to the Grocer-Eaze team.</p><form onSubmit={submitIngredientReport}><label htmlFor="ingredient-report-category">What looks wrong?</label><select id="ingredient-report-category" value={ingredientReportCategory} onChange={(event) => setIngredientReportCategory(event.target.value)}><option>Incorrect amount</option><option>Incorrect ingredient</option><option>Duplicate ingredient</option><option>Other</option></select><label htmlFor="ingredient-report-correction">Correct amount or value <small>(optional)</small></label><input id="ingredient-report-correction" className="text-input" value={ingredientReportCorrection} onChange={(event) => setIngredientReportCorrection(event.target.value)} maxLength={200} placeholder="e.g. 2 cups" /><label htmlFor="ingredient-report-details">Anything else? <small>(optional)</small></label><textarea id="ingredient-report-details" value={ingredientReportDetails} onChange={(event) => setIngredientReportDetails(event.target.value)} maxLength={1000} placeholder="Tell us what you expected to see." />{ingredientReportStatus && <p className="form-notice error" role="alert">{ingredientReportStatus}</p>}<div className="modal-actions"><button className="outline" type="button" onClick={() => setIngredientReport(null)}>Cancel</button><button className="primary compact" type="submit" disabled={ingredientReportBusy}>{ingredientReportBusy ? "Sending report…" : "Send report"}</button></div></form></section></div>}

    {onboardingStep !== null && <div className="onboarding-backdrop"><section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" tabIndex={-1}>
      <button className="modal-close icon-centered" aria-label="Skip introduction" onClick={finishOnboarding}>×</button>
      <span className="mini-label">{onboardingSteps[onboardingStep].eyebrow}</span>
      <h2 id="onboarding-title">{onboardingSteps[onboardingStep].title}</h2>
      <p>{onboardingSteps[onboardingStep].body}</p>
      <div className="onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={onboardingSteps.length} aria-valuenow={onboardingStep + 1} aria-label={`Introduction step ${onboardingStep + 1} of ${onboardingSteps.length}`}>{onboardingSteps.map((step, index) => <i key={step.title} className={index <= onboardingStep ? "active" : ""} />)}</div>
      <div className="onboarding-actions"><button className="text-button" onClick={finishOnboarding}>Skip</button><div>{onboardingStep > 0 && <button className="outline compact" onClick={() => setOnboardingStep(onboardingStep - 1)}>Back</button>}<button className="primary compact" onClick={() => onboardingStep === onboardingSteps.length - 1 ? finishOnboarding() : setOnboardingStep(onboardingStep + 1)}>{onboardingStep === onboardingSteps.length - 1 ? "Start planning" : "Next"}</button></div></div>
    </section></div>}

    {undoAction && <div className="undo-toast" role="status"><span>{undoAction.message}</span><button onClick={() => { undoAction.restore(); setUndoAction(null); }}>Undo</button><button className="undo-dismiss" onClick={() => setUndoAction(null)} aria-label="Dismiss notification">×</button></div>}

    <footer className="site-footer"><span>Grocer•Eaze</span><p>Better food. Less waste.</p><div><button onClick={startOnboarding}>How it works</button><button onClick={() => navigateTo("plans")}>Plans</button><button onClick={() => navigateTo("account")}>Privacy & security</button><button aria-current={view === "accessibility" ? "page" : undefined} onClick={() => navigateTo("accessibility")}>Accessibility</button></div></footer>
  </div>;
}
