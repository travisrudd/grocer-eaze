ALTER TABLE `recipe_readers` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `recipe_readers` ADD `revoked_at` text;--> statement-breakpoint
UPDATE `recipe_readers` SET `expires_at` = datetime('now', '+90 days') WHERE `expires_at` IS NULL;
