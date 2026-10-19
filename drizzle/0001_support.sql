CREATE TABLE `support_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_conversations_email` ON `support_conversations` (`email`);
--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_messages_conversation` ON `support_messages` (`conversation_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`transcript_json` text NOT NULL,
	`status` text NOT NULL,
	`resend_id` text,
	`error` text,
	`ack_status` text,
	`ack_error` text,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_requests_idempotency` ON `support_requests` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `support_requests_email_created` ON `support_requests` (`email`,`created_at`);
