import type {
  ClubDatabase,
  ClubIdentity,
  LedgerRow,
  Redemption,
} from "./database.ts";
import {
  ClubRuleError,
  DEFAULT_REWARDS,
  assertRedemption,
  rewardValue,
  type RewardRules,
} from "./policy.ts";

export class ClubStore {
  db: ClubDatabase;
  rules: RewardRules;
  constructor(db: ClubDatabase, rules = DEFAULT_REWARDS) {
    this.db = db;
    this.rules = rules;
  }
  statement(sql: string, ...values: unknown[]) {
    return this.db.prepare(sql).bind(...values);
  }

  async ensureProfile(user: ClubIdentity) {
    const now = new Date().toISOString();
    await this.db.batch([
      this.statement(
        "INSERT INTO club_profiles(id,email,name,joined_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,updated_at=excluded.updated_at",
        user.userId,
        user.email,
        user.displayName,
        now,
        now,
      ),
      this.statement(
        "INSERT OR IGNORE INTO club_wallets(user_id,balance) VALUES (?,0)",
        user.userId,
      ),
      this.statement(
        "INSERT OR IGNORE INTO club_ledger(id,user_id,delta,kind,event_ref,note,actor,created_at) VALUES (?,?,?,'signup',?,'Verified account welcome','system',?)",
        `signup:${user.userId}`,
        user.userId,
        this.rules.signupBonus,
        `signup:${user.userId}`,
        now,
      ),
    ]);
  }

  async snapshot(user: ClubIdentity) {
    const [profile, wallet, ledger, wishlist, rewards] = await Promise.all([
      this.statement(
        "SELECT name,email,joined_at,order_emails FROM club_profiles WHERE id=?",
        user.userId,
      ).first<{
        name: string;
        email: string;
        joined_at: string;
        order_emails: number;
      }>(),
      this.statement(
        "SELECT balance FROM club_wallets WHERE user_id=?",
        user.userId,
      ).first<{ balance: number }>(),
      this.statement(
        "SELECT id,delta,kind,note,created_at,order_id FROM club_ledger WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
        user.userId,
      ).all<LedgerRow>(),
      this.statement(
        "SELECT product_id FROM club_wishlist WHERE user_id=? ORDER BY created_at DESC",
        user.userId,
      ).all<{ product_id: string }>(),
      this.statement(
        "SELECT * FROM club_redemptions WHERE user_id=? AND state='held' ORDER BY created_at DESC",
        user.userId,
      ).all<Redemption>(),
    ]);
    return {
      profile,
      balance: wallet?.balance ?? 0,
      ledger: ledger.results,
      wishlist: wishlist.results.map((r) => r.product_id),
      redemptions: rewards.results,
      rules: this.rules,
    };
  }

  async saveProfile(userId: string, name: string, orderEmails: boolean) {
    const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (cleaned.length < 2)
      throw new ClubRuleError("Enter a name with at least two characters.");
    await this.statement(
      "UPDATE club_profiles SET name=?,order_emails=?,updated_at=? WHERE id=?",
      cleaned,
      orderEmails ? 1 : 0,
      new Date().toISOString(),
      userId,
    ).run();
  }
  async wishlist(userId: string, productId: string, saved: boolean) {
    if (saved)
      await this.statement(
        "INSERT OR IGNORE INTO club_wishlist(id,user_id,product_id,created_at) VALUES (?,?,?,?)",
        crypto.randomUUID(),
        userId,
        productId,
        new Date().toISOString(),
      ).run();
    else
      await this.statement(
        "DELETE FROM club_wishlist WHERE user_id=? AND product_id=?",
        userId,
        productId,
      ).run();
  }

  async reserve(userId: string, points: number, requestId: string) {
    const value = rewardValue(points, this.rules);
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))
      throw new ClubRuleError("Invalid reward request.");
    const id = `${userId}:${requestId}`;
    const now = new Date();
    await this.releaseUnused(userId);
    await this.db.batch([
      this.statement(
        "INSERT OR IGNORE INTO club_redemptions(id,user_id,points,value_cents,minimum_cents,state,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,'held',?,?,?)",
        id,
        userId,
        points,
        value,
        this.rules.minimumCents,
        new Date(now.getTime() + 30 * 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      ),
      this.statement(
        "INSERT INTO club_ledger(id,user_id,delta,kind,event_ref,redemption_id,note,actor,created_at) SELECT ?,?,-?,'redeem_hold',?,?,'Points reserved for checkout','customer',? WHERE NOT EXISTS (SELECT 1 FROM club_ledger WHERE event_ref=?)",
        `hold:${id}`,
        userId,
        points,
        `hold:${id}`,
        id,
        now.toISOString(),
        `hold:${id}`,
      ),
    ]);
    const row = await this.redemption(id);
    if (
      !row ||
      row.user_id !== userId ||
      row.points !== points ||
      row.state !== "held"
    )
      throw new ClubRuleError("This reward request was already used.");
    return row;
  }
  redemption(id: string) {
    return this.statement(
      "SELECT * FROM club_redemptions WHERE id=?",
      id,
    ).first<Redemption>();
  }
  async releaseUnused(userId: string) {
    const now = new Date().toISOString();
    await this.statement(
      "UPDATE club_redemptions SET state='released',updated_at=? WHERE user_id=? AND state='held' AND order_id IS NULL AND expires_at<=?",
      now,
      userId,
      now,
    ).run();
  }
  async cancelUnbound(userId: string, id: string) {
    const result = await this.statement(
      "UPDATE club_redemptions SET state='released',updated_at=? WHERE id=? AND user_id=? AND state='held' AND order_id IS NULL",
      new Date().toISOString(),
      id,
      userId,
    ).run();
    if (!result.meta?.changes)
      throw new ClubRuleError(
        "A reward attached to a payment must be resolved through that checkout.",
      );
  }
  async bindRedemption(
    id: string,
    userId: string,
    orderId: string,
    subtotal: number,
  ) {
    const row = await this.redemption(id);
    if (!row) throw new ClubRuleError("Reward not found.");
    assertRedemption({
      owner: row.user_id,
      userId,
      state: row.state,
      expiresAt: row.expires_at,
      orderId: row.order_id,
      expectedOrderId: orderId,
      subtotal,
      minimum: row.minimum_cents,
      value: row.value_cents,
    });
    const result = await this.statement(
      "UPDATE club_redemptions SET order_id=?,updated_at=? WHERE id=? AND user_id=? AND state='held' AND ((order_id IS NULL AND expires_at>?) OR order_id=?)",
      orderId,
      new Date().toISOString(),
      id,
      userId,
      new Date().toISOString(),
      orderId,
    ).run();
    if (!result.meta?.changes)
      throw new ClubRuleError("This reward was used by another checkout.");
    return row;
  }
  // Only called after a verified Stripe event for the current stored session.
  async releaseOrder(orderId: string) {
    await this.statement(
      "UPDATE club_redemptions SET state='released',updated_at=? WHERE order_id=? AND state='held'",
      new Date().toISOString(),
      orderId,
    ).run();
  }

  async claimGuestOrders(user: ClubIdentity) {
    // Only unowned/legacy anonymous-cookie orders with the newly verified email.
    const result = await this.statement(
      "UPDATE orders SET customer_user_id=?,updated_at=? WHERE lower(customer_email)=? AND (customer_user_id IS NULL OR customer_user_id LIKE 'local:%')",
      user.userId,
      new Date().toISOString(),
      user.email,
    ).run();
    return result.meta?.changes ?? 0;
  }

  async syncOrder(orderId: string) {
    const now = new Date().toISOString();
    const r = this.rules;
    // Each statement computes against authoritative rows inside one D1 transaction.
    await this.db.batch([
      this.statement(
        "UPDATE club_redemptions SET state='spent',updated_at=? WHERE order_id=? AND state='held' AND EXISTS (SELECT 1 FROM orders o WHERE o.id=? AND o.customer_user_id=club_redemptions.user_id AND o.payment_status IN ('paid','partially_refunded','refunded'))",
        now,
        orderId,
        orderId,
      ),
      this.statement(
        "INSERT OR IGNORE INTO club_order_rewards(order_id,user_id,eligible_cents,earn_rate,earned_points,first_bonus,created_at) SELECT o.id,o.customer_user_id,max(0,o.merchandise_subtotal_cents-o.discount_cents),?,CAST(max(0,o.merchandise_subtotal_cents-o.discount_cents)*?/100 AS INTEGER),?,? FROM orders o JOIN club_profiles p ON p.id=o.customer_user_id WHERE o.id=? AND o.created_at>=p.joined_at AND o.currency='usd' AND o.payment_status IN ('paid','partially_refunded') AND o.shipping_status IN ('shipped','in_transit','delivered') AND o.refunded_cents<o.total_cents",
        r.earnRate,
        r.earnRate,
        r.firstOrderBonus,
        now,
        orderId,
      ),
      this.statement(
        "INSERT OR IGNORE INTO club_ledger(id,user_id,delta,kind,event_ref,order_id,note,actor,created_at) SELECT 'earn:'||order_id,user_id,earned_points,'purchase','earn:'||order_id,order_id,'Fulfilled merchandise purchase','system',? FROM club_order_rewards WHERE order_id=? AND earned_points>0",
        now,
        orderId,
      ),
      this.statement(
        "INSERT OR IGNORE INTO club_ledger(id,user_id,delta,kind,event_ref,order_id,note,actor,created_at) SELECT 'first:'||b.user_id,b.user_id,b.first_bonus,'first_order','first:'||b.user_id,b.order_id,'First fulfilled order','system',? FROM club_order_rewards b JOIN orders o ON o.id=b.order_id WHERE b.order_id=? AND b.eligible_cents>0 AND o.refunded_cents<b.eligible_cents",
        now,
        orderId,
      ),
      this.statement(
        `INSERT OR IGNORE INTO club_ledger(id,user_id,delta,kind,event_ref,order_id,note,actor,created_at)
        SELECT 'reverse:'||o.id||':'||o.refunded_cents,b.user_id,
        CAST(max(0,b.eligible_cents-o.refunded_cents)*b.earn_rate/100 AS INTEGER)-(SELECT coalesce(sum(delta),0) FROM club_ledger WHERE order_id=o.id AND kind IN ('purchase','refund_reversal')),
        'refund_reversal','reverse:'||o.id||':'||o.refunded_cents,o.id,'Refunded merchandise points reversed','system',?
        FROM club_order_rewards b JOIN orders o ON o.id=b.order_id WHERE o.id=? AND
        CAST(max(0,b.eligible_cents-o.refunded_cents)*b.earn_rate/100 AS INTEGER)<(SELECT coalesce(sum(delta),0) FROM club_ledger WHERE order_id=o.id AND kind IN ('purchase','refund_reversal'))`,
        now,
        orderId,
      ),
      this.statement(
        "INSERT OR IGNORE INTO club_ledger(id,user_id,delta,kind,event_ref,order_id,note,actor,created_at) SELECT 'reverse-first:'||l.user_id,l.user_id,-l.delta,'bonus_reversal','reverse-first:'||l.user_id,o.id,'First-order bonus reversed after merchandise refund','system',? FROM club_ledger l JOIN orders o ON o.id=l.order_id JOIN club_order_rewards b ON b.order_id=o.id WHERE o.id=? AND l.kind='first_order' AND o.refunded_cents>=b.eligible_cents",
        now,
        orderId,
      ),
      this.statement(
        `INSERT OR IGNORE INTO club_ledger(id,user_id,delta,kind,event_ref,order_id,redemption_id,note,actor,created_at)
        SELECT 'restore:'||o.id||':'||o.refunded_cents,x.user_id,
        min(x.points,CAST(x.points*o.refunded_cents/o.total_cents AS INTEGER))-(SELECT coalesce(sum(delta),0) FROM club_ledger WHERE redemption_id=x.id AND kind='redeem_refund'),
        'redeem_refund','restore:'||o.id||':'||o.refunded_cents,o.id,x.id,'Redeemed points restored for refund','system',?
        FROM club_redemptions x JOIN orders o ON o.id=x.order_id WHERE o.id=? AND x.state='spent' AND o.total_cents>0 AND o.refunded_cents>0 AND
        min(x.points,CAST(x.points*o.refunded_cents/o.total_cents AS INTEGER))>(SELECT coalesce(sum(delta),0) FROM club_ledger WHERE redemption_id=x.id AND kind='redeem_refund')`,
        now,
        orderId,
      ),
    ]);
  }

  async adjust(
    userId: string,
    delta: number,
    reason: string,
    actor: string,
    requestId: string,
  ) {
    if (
      !Number.isSafeInteger(delta) ||
      delta === 0 ||
      Math.abs(delta) > 100_000 ||
      reason.trim().length < 10 ||
      reason.trim().length > 500 ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)
    )
      throw new ClubRuleError(
        "Supply an integer adjustment, a detailed reason and a unique request ID.",
      );
    const event = `admin:${actor}:${requestId}`;
    const existing = await this.statement(
      "SELECT user_id,delta,note FROM club_ledger WHERE event_ref=?",
      event,
    ).first<{ user_id: string; delta: number; note: string }>();
    if (
      existing &&
      (existing.user_id !== userId ||
        existing.delta !== delta ||
        existing.note !== reason.trim())
    )
      throw new ClubRuleError("Adjustment request ID already used.");
    await this.statement(
      "INSERT OR IGNORE INTO club_ledger(id,user_id,delta,kind,event_ref,note,actor,created_at) VALUES (?,?,?,'admin_adjustment',?,?,?,?)",
      event,
      userId,
      delta,
      event,
      reason.trim().slice(0, 500),
      actor,
      new Date().toISOString(),
    ).run();
    const saved = await this.statement(
      "SELECT user_id,delta,note FROM club_ledger WHERE event_ref=?",
      event,
    ).first<{ user_id: string; delta: number; note: string }>();
    if (
      !saved ||
      saved.user_id !== userId ||
      saved.delta !== delta ||
      saved.note !== reason.trim()
    )
      throw new ClubRuleError("Adjustment request ID already used.");
  }
  async withCheckoutLease<T>(
    quoteId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const token = crypto.randomUUID();
    const now = new Date();
    const lease = await this.statement(
      "INSERT INTO club_checkout_leases(quote_id,token,expires_at) VALUES (?,?,?) ON CONFLICT(quote_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE club_checkout_leases.expires_at<=?",
      quoteId,
      token,
      new Date(now.getTime() + 300_000).toISOString(),
      now.toISOString(),
    ).run();
    if (!lease.meta?.changes)
      throw new ClubRuleError(
        "This checkout is already being prepared. Wait a moment and try again.",
      );
    try {
      return await work();
    } finally {
      await this.statement(
        "DELETE FROM club_checkout_leases WHERE quote_id=? AND token=?",
        quoteId,
        token,
      ).run();
    }
  }
}
