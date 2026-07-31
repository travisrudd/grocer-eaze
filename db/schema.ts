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
