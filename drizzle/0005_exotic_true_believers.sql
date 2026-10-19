CREATE TABLE `club_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`event_ref` text NOT NULL,
	`order_id` text,
	`redemption_id` text,
	`note` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_ledger_event` ON `club_ledger` (`event_ref`);
--> statement-breakpoint
CREATE TABLE `club_order_rewards` (
	`order_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`eligible_cents` integer NOT NULL,
	`earn_rate` integer NOT NULL,
	`earned_points` integer NOT NULL,
	`first_bonus` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `club_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`order_emails` integer DEFAULT 1 NOT NULL,
	`joined_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_profiles_email` ON `club_profiles` (`email`);
--> statement-breakpoint
CREATE TABLE `club_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`points` integer NOT NULL,
	`value_cents` integer NOT NULL,
	`minimum_cents` integer NOT NULL,
	`state` text NOT NULL,
	`order_id` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_redemption_order` ON `club_redemptions` (`order_id`);
--> statement-breakpoint
CREATE TABLE `club_wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `club_wishlist` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_wishlist_product` ON `club_wishlist` (`user_id`,`product_id`);
--> statement-breakpoint
CREATE TRIGGER club_ledger_validate BEFORE INSERT ON club_ledger BEGIN
  SELECT CASE WHEN typeof(NEW.delta) != 'integer' OR abs(NEW.delta) > 100000000 OR NOT EXISTS (SELECT 1 FROM club_wallets WHERE user_id=NEW.user_id) THEN RAISE(ABORT, 'invalid_reward_entry') END;
  SELECT CASE WHEN NEW.kind IN ('redeem_hold','admin_adjustment') AND NEW.delta < 0 AND (SELECT balance FROM club_wallets WHERE user_id=NEW.user_id) + NEW.delta < 0 THEN RAISE(ABORT, 'insufficient_points') END;
END;
--> statement-breakpoint
CREATE TRIGGER club_ledger_balance AFTER INSERT ON club_ledger BEGIN
  UPDATE club_wallets SET balance=balance+NEW.delta WHERE user_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER club_ledger_immutable_update BEFORE UPDATE ON club_ledger BEGIN SELECT RAISE(ABORT, 'immutable_reward_ledger'); END;
--> statement-breakpoint
CREATE TRIGGER club_ledger_immutable_delete BEFORE DELETE ON club_ledger BEGIN SELECT RAISE(ABORT, 'immutable_reward_ledger'); END;
--> statement-breakpoint
CREATE TRIGGER club_redemption_release AFTER UPDATE OF state ON club_redemptions WHEN OLD.state='held' AND NEW.state='released' BEGIN
  INSERT INTO club_ledger(id,user_id,delta,kind,event_ref,order_id,redemption_id,note,actor,created_at)
  VALUES ('release:'||NEW.id,NEW.user_id,NEW.points,'redeem_release','release:'||NEW.id,NEW.order_id,NEW.id,'Unused reward released','system',NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER club_redemption_state BEFORE UPDATE OF state ON club_redemptions WHEN OLD.state != NEW.state AND NOT (OLD.state='held' AND NEW.state IN ('spent','released')) BEGIN SELECT RAISE(ABORT, 'invalid_redemption_transition'); END;
