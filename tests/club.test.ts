import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep, join } from "node:path";
import { Worker } from "node:worker_threads";
import { ClubStore } from "../lib/club/store.ts";
import type { ClubDatabase } from "../lib/club/database.ts";
import {
  assertRedemption,
  earnedPoints,
  rewardValue,
} from "../lib/club/policy.ts";
import { verifiedIdentity, safeAccountReturn } from "../lib/auth/policy.ts";
import { customerCanViewOrder } from "../lib/commerce/authz.ts";

function adapter(raw: DatabaseSync): ClubDatabase {
  return {
    prepare(sql: string) {
      let values: (string | number | null)[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args as typeof values;
          return statement;
        },
        async run() {
          const result = raw.prepare(sql).run(...values);
          return { meta: { changes: Number(result.changes) } };
        },
        async first<T>() {
          return (raw.prepare(sql).get(...values) ?? null) as T | null;
        },
        async all<T>() {
          return { results: raw.prepare(sql).all(...values) as T[] };
        },
      };
      return statement;
    },
    async batch(statements) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
const migrations = [
  "0000_commerce.sql",
  "0001_support.sql",
  "0002_email.sql",
  "0003_label_safeguards.sql",
  "0004_marketing.sql",
  "0005_exotic_true_believers.sql",
  "0006_familiar_secret_warriors.sql",
];
function database(file = ":memory:") {
  const raw = new DatabaseSync(file);
  for (const name of migrations)
    for (const sql of readFileSync(
      new URL(`../drizzle/${name}`, import.meta.url),
      "utf8",
    )
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      raw.exec(sql);
  return { raw, store: new ClubStore(adapter(raw)) };
}
const alice = {
  userId: "user_alice",
  email: "alice@example.invalid",
  displayName: "Alice",
};
const bob = {
  userId: "user_bob",
  email: "bob@example.invalid",
  displayName: "Bob",
};
function order(
  raw: DatabaseSync,
  id: string,
  user = alice.userId,
  values: Record<string, unknown> = {},
) {
  const record: Record<string, unknown> = {
    id,
    order_number: `TEST-${id}`,
    quote_id: `quote-${id}`,
    customer_user_id: user,
    customer_email: alice.email,
    customer_name: "Alice",
    currency: "usd",
    merchandise_subtotal_cents: 2000,
    discount_cents: 0,
    discount_code: null,
    shipping_cents: 500,
    handling_fee_cents: 0,
    carrier_cents: 500,
    tax_cents: 100,
    total_cents: 2600,
    refunded_cents: 0,
    payment_status: "paid",
    production_status: "shipped",
    shipping_status: "shipped",
    ship_name: "Alice",
    ship_phone: "",
    ship_line1: "Synthetic",
    ship_line2: "",
    ship_city: "Synthetic",
    ship_state: "PA",
    ship_postal_code: "00000",
    ship_country: "US",
    parcel_json: "{}",
    production_days_min: 5,
    production_days_max: 10,
    created_at: new Date(Date.now() + 1000).toISOString(),
    updated_at: new Date().toISOString(),
    ...values,
  };
  raw
    .prepare(
      `INSERT INTO orders (${Object.keys(record).join(",")}) VALUES (${Object.keys(
        record,
      )
        .map(() => "?")
        .join(",")})`,
    )
    .run(...(Object.values(record) as (string | number | null)[]));
}

test("identity requires an active unexpired session and authoritative verified primary email", () => {
  const subject = { userId: "user_test", sessionId: "sess_test" };
  const session = { userId: subject.userId, status: "active", expireAt: 2000 };
  const user = {
    id: subject.userId,
    primaryEmailAddressId: "email_1",
    emailAddresses: [
      {
        id: "email_1",
        emailAddress: "Verified@Example.invalid",
        verification: { status: "verified" },
      },
    ],
    firstName: "Alex",
    lastName: null,
  };
  assert.equal(
    verifiedIdentity(subject, session, user, 1000)?.email,
    "verified@example.invalid",
  );
  assert.equal(
    verifiedIdentity(subject, { ...session, status: "revoked" }, user, 1000),
    null,
  );
  assert.equal(verifiedIdentity(subject, session, user, 3000), null);
  assert.equal(
    verifiedIdentity(
      subject,
      session,
      {
        ...user,
        emailAddresses: [
          { ...user.emailAddresses[0], verification: { status: "unverified" } },
        ],
      },
      1000,
    ),
    null,
  );
  assert.equal(
    verifiedIdentity(subject, { ...session, userId: "other" }, user, 1000),
    null,
  );
  assert.equal(
    verifiedIdentity(subject, session, { ...user, banned: true }, 1000),
    null,
  );
  assert.equal(
    customerCanViewOrder(
      { customerUserId: "other", customerEmail: alice.email },
      alice,
    ),
    false,
  );
  assert.equal(
    customerCanViewOrder(
      { customerUserId: null, customerEmail: alice.email },
      alice,
    ),
    false,
  );
  assert.equal(safeAccountReturn("//attacker.invalid"), "/account");
  assert.equal(safeAccountReturn("/\\attacker.invalid"), "/account");
});
test("reward arithmetic excludes fractional points and enforces minimum increments", () => {
  assert.equal(earnedPoints(699), 69);
  assert.equal(rewardValue(300), 300);
  for (const value of [-1, 299, 300.5, 301, Number.NaN])
    assert.throws(() => rewardValue(value));
  assert.throws(() =>
    assertRedemption({
      owner: "alice",
      userId: "bob",
      state: "held",
      expiresAt: "2099-01-01",
      orderId: null,
      expectedOrderId: "o",
      subtotal: 1000,
      minimum: 1000,
      value: 300,
    }),
  );
});
test("migration is additive, signup is once, ledger cannot be edited, wallet matches ledger", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  await store.ensureProfile(alice);
  assert.equal((await store.snapshot(alice)).balance, 50);
  assert.throws(
    () => raw.exec("UPDATE club_ledger SET delta=999"),
    /immutable/,
  );
  assert.throws(() => raw.exec("DELETE FROM club_ledger"), /immutable/);
  assert.equal(
    raw.prepare("SELECT sum(delta) n FROM club_ledger").get()?.n,
    50,
  );
  raw.close();
});
test("unpaid/unfulfilled orders earn nothing; retries and order edits never award twice", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  order(raw, "one", alice.userId, {
    payment_status: "pending",
    shipping_status: "quoted",
  });
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.exec("UPDATE orders SET payment_status='paid'");
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.exec("UPDATE orders SET shipping_status='shipped'");
  await store.syncOrder("one");
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 350);
  raw.exec("UPDATE orders SET merchandise_subtotal_cents=999999");
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 350);
  order(raw, "two");
  await store.syncOrder("two");
  assert.equal((await store.snapshot(alice)).balance, 550);
  raw.close();
});
test("partial/full refund reversal is cumulative and monotonic; first-order bonus reverses once", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  order(raw, "one");
  await store.syncOrder("one");
  raw.exec(
    "UPDATE orders SET refunded_cents=500,payment_status='partially_refunded'",
  );
  await store.syncOrder("one");
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 300);
  raw.exec("UPDATE orders SET refunded_cents=2600,payment_status='refunded'");
  await store.syncOrder("one");
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.exec("UPDATE orders SET refunded_cents=100");
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.close();
});
test("redemption debit and reservation roll back together, are account-bound and idempotent", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  await store.ensureProfile(bob);
  await assert.rejects(
    store.reserve(alice.userId, 300, "request-zero"),
    /insufficient_points/,
  );
  assert.equal(
    raw.prepare("SELECT count(*) n FROM club_redemptions").get()?.n,
    0,
  );
  await store.adjust(
    alice.userId,
    500,
    "Synthetic test credit",
    "admin",
    "grant-one",
  );
  const reward = await store.reserve(alice.userId, 300, "request-one");
  await store.reserve(alice.userId, 300, "request-one");
  assert.equal((await store.snapshot(alice)).balance, 250);
  await assert.rejects(
    store.bindRedemption(reward.id, bob.userId, "one", 2000),
  );
  await assert.rejects(
    store.bindRedemption(reward.id, alice.userId, "one", 500),
  );
  await store.bindRedemption(reward.id, alice.userId, "one", 2000);
  await assert.rejects(
    store.bindRedemption(reward.id, alice.userId, "two", 2000),
  );
  await assert.rejects(store.cancelUnbound(alice.userId, reward.id));
  await store.releaseOrder("one");
  await store.releaseOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 550);
  raw.close();
});
test("refunds restore spent redemption points proportionally; spent points can cause reward debt", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  order(raw, "one");
  await store.syncOrder("one");
  const reward = await store.reserve(alice.userId, 300, "spend-request");
  await store.bindRedemption(reward.id, alice.userId, "two", 2000);
  order(raw, "two", alice.userId, {
    shipping_status: "quoted",
    total_cents: 2300,
    discount_cents: 300,
  });
  await store.syncOrder("two");
  raw.exec(
    "UPDATE orders SET refunded_cents=2600,payment_status='refunded' WHERE id='one'",
  );
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, -250);
  raw.exec(
    "UPDATE orders SET refunded_cents=1150,payment_status='partially_refunded' WHERE id='two'",
  );
  await store.syncOrder("two");
  await store.syncOrder("two");
  assert.equal((await store.snapshot(alice)).balance, -100);
  raw.exec(
    "UPDATE orders SET refunded_cents=2300,payment_status='refunded' WHERE id='two'",
  );
  await store.syncOrder("two");
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.close();
});
test("expired unbound rewards release once; a payable bound reward never expires by wall clock", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  await store.adjust(
    alice.userId,
    600,
    "Synthetic test credit",
    "admin",
    "grant-one",
  );
  const unbound = await store.reserve(alice.userId, 300, "unused-request");
  const bound = await store.reserve(alice.userId, 300, "bound-request");
  await store.bindRedemption(bound.id, alice.userId, "one", 2000);
  raw.exec("UPDATE club_redemptions SET expires_at='2000-01-01'");
  await store.releaseUnused(alice.userId);
  await store.releaseUnused(alice.userId);
  assert.equal((await store.redemption(unbound.id))?.state, "released");
  assert.equal((await store.redemption(bound.id))?.state, "held");
  assert.equal((await store.snapshot(alice)).balance, 350);
  raw.close();
});
test("wishlist/profile/guest claim are account-owned; previous orders do not backfill points", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  await store.ensureProfile(bob);
  await store.wishlist(alice.userId, "spore-flat", true);
  await store.wishlist(alice.userId, "spore-flat", true);
  assert.deepEqual((await store.snapshot(alice)).wishlist, ["spore-flat"]);
  assert.deepEqual((await store.snapshot(bob)).wishlist, []);
  await store.saveProfile(alice.userId, "New Name", false);
  assert.equal((await store.snapshot(alice)).profile?.name, "New Name");
  order(raw, "guest", undefined, {
    customer_user_id: null,
    created_at: "2000-01-01",
  });
  order(raw, "owned", bob.userId);
  assert.equal(await store.claimGuestOrders(alice), 1);
  assert.equal(
    raw.prepare("SELECT customer_user_id FROM orders WHERE id='owned'").get()
      ?.customer_user_id,
    bob.userId,
  );
  await store.syncOrder("guest");
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.close();
});
test("administrator adjustments require bounded amounts/reasons and replay consistently", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  await assert.rejects(
    store.adjust(alice.userId, 100, "short", "admin", "request-one"),
  );
  await store.adjust(
    alice.userId,
    100,
    "Customer service credit",
    "admin",
    "request-one",
  );
  await store.adjust(
    alice.userId,
    100,
    "Customer service credit",
    "admin",
    "request-one",
  );
  assert.equal((await store.snapshot(alice)).balance, 150);
  await assert.rejects(
    store.adjust(
      alice.userId,
      999,
      "Customer service credit",
      "admin",
      "request-one",
    ),
  );
  await assert.rejects(
    store.adjust(
      alice.userId,
      -151,
      "Customer service debit",
      "admin",
      "request-two",
    ),
    /insufficient/,
  );
  raw.close();
});
test("checkout lease excludes simultaneous session creation and releases after failure", async () => {
  const { raw, store } = database();
  let unlock!: () => void;
  const pending = store.withCheckoutLease(
    "quote-one",
    () =>
      new Promise<void>((resolve) => {
        unlock = resolve;
      }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  await assert.rejects(
    store.withCheckoutLease("quote-one", async () => 1),
    /already being prepared/,
  );
  unlock();
  await pending;
  await assert.rejects(
    store.withCheckoutLease("quote-one", async () => {
      throw new Error("provider timeout");
    }),
    /provider timeout/,
  );
  assert.equal(await store.withCheckoutLease("quote-one", async () => 42), 42);
  raw.close();
});
test("refunding all merchandise reverses the first-order bonus even when shipping is retained", async () => {
  const { raw, store } = database();
  await store.ensureProfile(alice);
  order(raw, "one");
  await store.syncOrder("one");
  raw.exec(
    "UPDATE orders SET refunded_cents=2000,payment_status='partially_refunded'",
  );
  await store.syncOrder("one");
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.close();
});

test("independent database connections serialize redemption, duplicate fulfillment and refunds", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "kapo-club-test-"));
  t.after(() => {
    const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir()) + sep))
      throw Error("Unsafe test cleanup path");
    rmSync(target, { recursive: true, force: true });
  });
  const file = join(directory, "club.sqlite");
  const { raw, store } = database(file);
  raw.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  await store.ensureProfile(alice);
  await store.adjust(
    alice.userId,
    300,
    "Synthetic test credit",
    "admin",
    "grant-one",
  );
  const signal = new SharedArrayBuffer(4);
  const workerSource = `const { parentPort, workerData }=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');
    (async()=>{ const {ClubStore}=await import(workerData.module); const raw=new DatabaseSync(workerData.file);raw.exec('PRAGMA busy_timeout=5000');
    const adapter={prepare(sql){let a=[];const s={bind(...v){a=v;return s},async run(){return {meta:{changes:Number(raw.prepare(sql).run(...a).changes)}}},async first(){return raw.prepare(sql).get(...a)||null},async all(){return {results:raw.prepare(sql).all(...a)}}};return s},async batch(ss){raw.exec('BEGIN IMMEDIATE');try{const r=[];for(const s of ss)r.push(await s.run());raw.exec('COMMIT');return r}catch(e){raw.exec('ROLLBACK');throw e}}};
    const club=new ClubStore(adapter);parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(workerData.signal),0,0);try{if(workerData.action==='sync')await club.syncOrder('concurrent-order');else await club.reserve('user_alice',300,workerData.key);parentPort.postMessage({ok:true})}catch(e){parentPort.postMessage({ok:false,error:e.message})}finally{raw.close()}})();`;
  async function race(action: string) {
    Atomics.store(new Int32Array(signal), 0, 0);
    const workers = ["concurrent-one", "concurrent-two"].map(
      (key) =>
        new Worker(workerSource, {
          eval: true,
          workerData: {
            file,
            module: new URL("../lib/club/store.ts", import.meta.url).href,
            key,
            signal,
            action,
          },
        }),
    );
    const exits = workers.map(
      (worker) =>
        new Promise<void>((resolve) => worker.once("exit", () => resolve())),
    );
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((resolve, reject) => {
            worker.once("message", () => resolve());
            worker.once("error", reject);
          }),
      ),
    );
    const outcomes = workers.map(
      (worker) =>
        new Promise<{ ok: boolean }>((resolve, reject) => {
          worker.once("message", resolve);
          worker.once("error", reject);
        }),
    );
    Atomics.store(new Int32Array(signal), 0, 1);
    Atomics.notify(new Int32Array(signal), 0);
    const result = await Promise.all(outcomes);
    await Promise.all(exits);
    return result;
  }
  const result = await race("reserve");
  assert.equal(result.filter((r) => r.ok).length, 1);
  assert.equal((await store.snapshot(alice)).balance, 50);
  assert.equal(
    raw.prepare("SELECT count(*) n FROM club_redemptions").get()?.n,
    1,
  );
  order(raw, "concurrent-order");
  assert.equal((await race("sync")).filter((r) => r.ok).length, 2);
  assert.equal((await store.snapshot(alice)).balance, 350);
  assert.equal(
    raw
      .prepare("SELECT count(*) n FROM club_ledger WHERE kind='purchase'")
      .get()?.n,
    1,
  );
  raw.exec("UPDATE orders SET refunded_cents=2600,payment_status='refunded'");
  assert.equal((await race("sync")).filter((r) => r.ok).length, 2);
  assert.equal((await store.snapshot(alice)).balance, 50);
  raw.close();
});
