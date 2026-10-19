import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const clubProfiles = sqliteTable(
  "club_profiles",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    orderEmails: integer("order_emails").notNull().default(1),
    joinedAt: text("joined_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("club_profiles_email").on(t.email)],
);
export const clubWallets = sqliteTable("club_wallets", {
  userId: text("user_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
});
export const clubLedger = sqliteTable(
  "club_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    delta: integer("delta").notNull(),
    kind: text("kind").notNull(),
    eventRef: text("event_ref").notNull(),
    orderId: text("order_id"),
    redemptionId: text("redemption_id"),
    note: text("note").notNull(),
    actor: text("actor").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("club_ledger_event").on(t.eventRef)],
);
export const clubRedemptions = sqliteTable(
  "club_redemptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    points: integer("points").notNull(),
    valueCents: integer("value_cents").notNull(),
    minimumCents: integer("minimum_cents").notNull(),
    state: text("state").notNull(),
    orderId: text("order_id"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("club_redemption_order").on(t.orderId)],
);
export const clubOrderRewards = sqliteTable("club_order_rewards", {
  orderId: text("order_id").primaryKey(),
  userId: text("user_id").notNull(),
  eligibleCents: integer("eligible_cents").notNull(),
  earnRate: integer("earn_rate").notNull(),
  earnedPoints: integer("earned_points").notNull(),
  firstBonus: integer("first_bonus").notNull(),
  createdAt: text("created_at").notNull(),
});
export const clubWishlist = sqliteTable(
  "club_wishlist",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("club_wishlist_product").on(t.userId, t.productId)],
);
export const clubCheckoutLeases = sqliteTable("club_checkout_leases", {
  quoteId: text("quote_id").primaryKey(),
  token: text("token").notNull(),
  expiresAt: text("expires_at").notNull(),
});
