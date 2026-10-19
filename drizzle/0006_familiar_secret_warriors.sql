CREATE TABLE `club_checkout_leases` (
	`quote_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL
);
