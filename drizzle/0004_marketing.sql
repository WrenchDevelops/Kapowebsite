ALTER TABLE `subscribers` ADD COLUMN `preferences_json` text;
--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `kind` text NOT NULL DEFAULT 'news';
--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `topic` text NOT NULL DEFAULT 'news';
--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `audience` text NOT NULL DEFAULT 'all';
--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `topics_json` text;
--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `blocks_json` text;
--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `event_key` text;
--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `skipped_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `announcement_events` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`kind` text NOT NULL,
	`topic` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`image_url` text,
	`link_url` text NOT NULL,
	`price_label` text,
	`status` text NOT NULL,
	`campaign_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `announcement_events_dedupe` ON `announcement_events` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `announcement_events_status` ON `announcement_events` (`status`);
--> statement-breakpoint
CREATE TABLE `marketing_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`config_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketing_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`campaign_id` text NOT NULL,
	`topic` text NOT NULL,
	`routine` integer NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_sends_once` ON `marketing_sends` (`campaign_id`,`email`);
--> statement-breakpoint
CREATE INDEX `marketing_sends_email_time` ON `marketing_sends` (`email`,`sent_at`);
