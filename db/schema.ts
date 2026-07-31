import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  ownerId: text("owner_id").primaryKey(),
  householdName: text("household_name").notNull(),
  people: integer("people").notNull().default(4),
  location: text("location").notNull().default("Uptown, Chicago, IL"),
  preferencesJson: text("preferences_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});

export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  recipeId: text("recipe_id").notNull(),
  recipeJson: text("recipe_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const familyMembers = sqliteTable("family_members", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  preferencesJson: text("preferences_json").notNull().default("{}"),
  allergies: text("allergies").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const recipeRatings = sqliteTable("recipe_ratings", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  recipeId: text("recipe_id").notNull(),
  quality: integer("quality").notNull(),
  ease: integer("ease").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull().default("user"),
  accessStatus: text("access_status").notNull().default("pending"),
  trialEndsAt: text("trial_ends_at"),
  complimentaryUntil: text("complimentary_until"),
  billingExempt: integer("billing_exempt").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  subscriptionEndsAt: text("subscription_ends_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authCodes = sqliteTable("auth_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id").notNull(),
  targetUserId: text("target_user_id").notNull(),
  action: text("action").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});
