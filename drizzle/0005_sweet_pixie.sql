CREATE TABLE `auth_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL
);
