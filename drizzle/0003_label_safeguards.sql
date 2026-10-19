CREATE TABLE IF NOT EXISTS `label_spend_days` (
	`day` text PRIMARY KEY NOT NULL,
	`held_cents` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `label_purchase_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`rate_id` text,
	`carrier` text,
	`service_name` text,
	`amount_cents` integer,
	`test_mode` integer NOT NULL,
	`shippo_transaction_id` text,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `label_purchase_audit_order` ON `label_purchase_audit` (`order_id`,`created_at`);
--> statement-breakpoint
ALTER TABLE `shipping_labels` ADD `spend_day` text;
--> statement-breakpoint
DROP INDEX IF EXISTS `shipping_labels_one_active`;
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_labels_one_active` ON `shipping_labels` (`order_id`) WHERE `status` IN ('pending', 'succeeded', 'uncertain', 'void_requested');
