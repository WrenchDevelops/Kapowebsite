ALTER TABLE `notifications` ADD COLUMN `resend_id` text;
--> statement-breakpoint
ALTER TABLE `support_requests` ADD COLUMN `resolution` text NOT NULL DEFAULT 'open';
--> statement-breakpoint
CREATE TABLE `email_events` (
	`id` text PRIMARY KEY NOT NULL,
	`resend_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_events_resend_type` ON `email_events` (`resend_id`,`type`);
--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`consent_at` text,
	`confirmed_at` text,
	`unsubscribed_at` text,
	`welcome_sent_at` text,
	`confirm_token_hash` text NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email` ON `subscribers` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_confirm` ON `subscribers` (`confirm_token_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_unsubscribe` ON `subscribers` (`unsubscribe_token`);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`preheader` text NOT NULL,
	`body_text` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_at` text,
	`sent_at` text,
	`resend_broadcast_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaign_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`email` text NOT NULL,
	`status` text NOT NULL,
	`resend_id` text,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_recipients_once` ON `campaign_recipients` (`campaign_id`,`email`);
--> statement-breakpoint
CREATE INDEX `campaign_recipients_campaign` ON `campaign_recipients` (`campaign_id`);
