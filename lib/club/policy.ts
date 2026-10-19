export const DEFAULT_REWARDS = {
  earnRate: 10,
  valueRate: 100,
  minimumPoints: 300,
  signupBonus: 50,
  firstOrderBonus: 100,
  minimumCents: 1000,
};
export class ClubRuleError extends Error {}
export type RewardRules = typeof DEFAULT_REWARDS;
export function rewardRules(
  env: Record<string, string | undefined> = {},
): RewardRules {
  const names = {
    earnRate: "KAPO_REWARD_EARN_RATE",
    valueRate: "KAPO_REWARD_VALUE_RATE",
    minimumPoints: "KAPO_REWARD_MINIMUM_POINTS",
    signupBonus: "KAPO_REWARD_SIGNUP_BONUS",
    firstOrderBonus: "KAPO_REWARD_FIRST_ORDER_BONUS",
    minimumCents: "KAPO_REWARD_MINIMUM_MERCHANDISE_CENTS",
  };
  const result = { ...DEFAULT_REWARDS };
  for (const key of Object.keys(names) as (keyof RewardRules)[]) {
    const raw = env[names[key]];
    const n = Number(raw);
    if (
      raw &&
      Number.isSafeInteger(n) &&
      (n > 0 ||
        ((key === "signupBonus" || key === "firstOrderBonus") && n === 0)) &&
      n <= 100_000
    )
      result[key] = n;
  }
  result.minimumPoints =
    Math.ceil(result.minimumPoints / result.valueRate) * result.valueRate;
  return result;
}
export function earnedPoints(eligibleCents: number, rate = 10) {
  if (
    !Number.isSafeInteger(eligibleCents) ||
    eligibleCents < 0 ||
    !Number.isSafeInteger(rate) ||
    rate < 1
  )
    throw new ClubRuleError("Invalid reward basis.");
  return Math.floor((eligibleCents * rate) / 100);
}
export function rewardValue(points: number, rules = DEFAULT_REWARDS) {
  if (
    !Number.isSafeInteger(points) ||
    points < rules.minimumPoints ||
    points > 1_000_000 ||
    points % rules.valueRate !== 0
  )
    throw new ClubRuleError(
      `Redeem at least ${rules.minimumPoints} points in ${rules.valueRate}-point increments.`,
    );
  return Math.floor((points * 100) / rules.valueRate);
}
export function assertRedemption(
  input: {
    owner: string;
    userId: string;
    state: string;
    expiresAt: string;
    orderId: string | null;
    expectedOrderId: string;
    subtotal: number;
    minimum: number;
    value: number;
  },
  now = new Date(),
) {
  if (
    input.owner !== input.userId ||
    input.state !== "held" ||
    (input.orderId && input.orderId !== input.expectedOrderId) ||
    (!input.orderId && Date.parse(input.expiresAt) <= now.getTime())
  )
    throw new ClubRuleError(
      "This reward is not available for this account/order.",
    );
  if (
    !Number.isSafeInteger(input.subtotal) ||
    input.subtotal < input.minimum ||
    input.value > input.subtotal
  )
    throw new ClubRuleError(
      "This order does not meet the reward's merchandise minimum.",
    );
}
