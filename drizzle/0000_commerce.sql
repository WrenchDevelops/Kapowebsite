CREATE TABLE `fulfillment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`note` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fulfillment_events_order` ON `fulfillment_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`template` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`provider` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_order` ON `notifications` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`style` text NOT NULL,
	`image` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total_cents` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`quote_id` text NOT NULL,
	`customer_user_id` text,
	`customer_email` text NOT NULL,
	`customer_name` text NOT NULL,
	`currency` text NOT NULL,
	`merchandise_subtotal_cents` integer NOT NULL,
	`discount_cents` integer NOT NULL,
	`discount_code` text,
	`shipping_cents` integer NOT NULL,
	`handling_fee_cents` integer NOT NULL,
	`carrier_cents` integer NOT NULL,
	`tax_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`refunded_cents` integer NOT NULL,
	`payment_status` text NOT NULL,
	`production_status` text NOT NULL,
	`shipping_status` text NOT NULL,
	`ship_name` text NOT NULL,
	`ship_phone` text NOT NULL,
	`ship_line1` text NOT NULL,
	`ship_line2` text NOT NULL,
	`ship_city` text NOT NULL,
	`ship_state` text NOT NULL,
	`ship_postal_code` text NOT NULL,
	`ship_country` text NOT NULL,
	`carrier` text,
	`service_name` text,
	`service_token` text,
	`shippo_rate_id` text,
	`shippo_shipment_id` text,
	`parcel_json` text NOT NULL,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`stripe_tax_calculation_id` text,
	`stripe_tax_transaction_id` text,
	`tracking_number` text,
	`tracking_url` text,
	`carrier_transit_days` integer,
	`duration_terms` text,
	`production_days_min` integer NOT NULL,
	`production_days_max` integer NOT NULL,
	`review_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_quote` ON `orders` (`quote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_checkout_session` ON `orders` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_intent` ON `orders` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `orders_email` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE INDEX `orders_user` ON `orders` (`customer_user_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`stripe_charge_id` text,
	`amount_cents` integer NOT NULL,
	`refunded_cents` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_checkout_session` ON `payments` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_payment_intent` ON `payments` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `payments_order` ON `payments` (`order_id`);--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`shippo_shipment_id` text,
	`parcel_json` text NOT NULL,
	`rates_json` text NOT NULL,
	`refreshed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_order` ON `shipments` (`order_id`);--> statement-breakpoint
CREATE TABLE `shipping_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`shipment_id` text,
	`shippo_transaction_id` text,
	`shippo_rate_id` text NOT NULL,
	`status` text NOT NULL,
	`carrier` text,
	`service_name` text,
	`amount_cents` integer,
	`label_url` text,
	`tracking_number` text,
	`tracking_url` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_labels_transaction` ON `shipping_labels` (`shippo_transaction_id`);--> statement-breakpoint
CREATE INDEX `shipping_labels_order` ON `shipping_labels` (`order_id`);--> statement-breakpoint
CREATE TABLE `shipping_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_hash` text NOT NULL,
	`customer_user_id` text,
	`customer_email` text NOT NULL,
	`customer_name` text NOT NULL,
	`address_json` text NOT NULL,
	`lines_json` text NOT NULL,
	`parcel_json` text NOT NULL,
	`rates_json` text NOT NULL,
	`shippo_shipment_id` text NOT NULL,
	`merchandise_subtotal_cents` integer NOT NULL,
	`handling_fee_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`production_days_min` integer NOT NULL,
	`production_days_max` integer NOT NULL,
	`ip_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shipping_quotes_ip_created` ON `shipping_quotes` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `tracking_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`tracking_number` text NOT NULL,
	`status` text NOT NULL,
	`status_details` text NOT NULL,
	`occurred_at` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_events_dedupe` ON `tracking_events` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `tracking_events_order` ON `tracking_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_provider_event` ON `webhook_events` (`provider`,`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_labels_one_active` ON `shipping_labels` (`order_id`) WHERE `status` IN ('pending', 'succeeded');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `product_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`published` integer NOT NULL,
	`for_sale` integer NOT NULL,
	`price_cents` integer,
	`inventory` integer,
	`updated_at` text NOT NULL
);--> statement-breakpoint
INSERT OR IGNORE INTO `product_settings` (`id`, `published`, `for_sale`, `price_cents`, `inventory`, `updated_at`) VALUES ('macropad', 1, 0, NULL, NULL, '2026-10-16T00:00:00.000Z');--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `sms_opt_in` integer NOT NULL DEFAULT 0;