CREATE TABLE `bookmark_tag_paths` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookmark_id` integer NOT NULL,
	`tag_path` text NOT NULL,
	`leaf_tag_id` integer NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leaf_tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_path_idx` ON `bookmark_tag_paths` (`bookmark_id`,`tag_path`);--> statement-breakpoint
CREATE INDEX `leaf_tag_idx` ON `bookmark_tag_paths` (`leaf_tag_id`);--> statement-breakpoint
CREATE TABLE `bookmark_tags` (
	`bookmark_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`bookmark_id`, `tag_id`),
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`url` text NOT NULL,
	`description` text,
	`favicon` text,
	`screenshot` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `url_idx` ON `bookmarks` (`url`);--> statement-breakpoint
CREATE INDEX `title_idx` ON `bookmarks` (`title`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`level` integer DEFAULT 1 NOT NULL,
	`path` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `path_unique` ON `tags` (`path`);--> statement-breakpoint
CREATE INDEX `parent_idx` ON `tags` (`parent_id`);--> statement-breakpoint
CREATE INDEX `level_idx` ON `tags` (`level`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE INDEX `key_idx` ON `settings` (`key`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `settings` (`category`);