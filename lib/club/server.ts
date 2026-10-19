import { env } from "../workers-env.ts";
import { readEnv } from "../commerce/env.ts";
import { ClubStore } from "./store.ts";
import { rewardRules } from "./policy.ts";
import type { ClubDatabase } from "./database.ts";
export function clubEnabled() {
  return readEnv("KAPO_CLUB_ENABLED") === "true";
}
export function redemptionEnabled() {
  return clubEnabled() && readEnv("KAPO_REWARDS_REDEMPTION_ENABLED") === "true";
}
export function clubStore() {
  const db = env.DB as unknown as ClubDatabase | undefined;
  if (!db || !db.batch)
    throw new Error("KAPO Club requires the migrated Cloudflare D1 database.");
  const names = [
    "KAPO_REWARD_EARN_RATE",
    "KAPO_REWARD_VALUE_RATE",
    "KAPO_REWARD_MINIMUM_POINTS",
    "KAPO_REWARD_SIGNUP_BONUS",
    "KAPO_REWARD_FIRST_ORDER_BONUS",
    "KAPO_REWARD_MINIMUM_MERCHANDISE_CENTS",
  ];
  return new ClubStore(
    db,
    rewardRules(Object.fromEntries(names.map((key) => [key, readEnv(key)]))),
  );
}
export async function syncClubOrder(orderId: string) {
  if (clubEnabled()) await clubStore().syncOrder(orderId);
}
