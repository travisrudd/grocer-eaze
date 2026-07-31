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
