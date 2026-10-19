"use client";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Gift,
  Heart,
  LayoutGrid,
  LogOut,
  Package,
  Settings,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { usePageSnap } from "@/components/usePageSnap";
import { shopProducts } from "@/lib/catalog";
import { DEFAULT_REWARDS, type RewardRules } from "@/lib/club/policy";

type Order = {
  orderNumber: string;
  totalCents: number;
  createdAt: string;
  productionStatus: string;
  paymentStatus: string;
  shippingStatus: string;
  previewImage: string | null;
  previewName: string;
  itemCount: number;
  trackingUrl?: string | null;
};
export type ClubData = {
  profile: {
    name: string;
    email: string;
    joined_at: string;
    order_emails: number;
  } | null;
  balance: number;
  rules: RewardRules;
  redemptionEnabled: boolean;
  ledger: {
    id: string;
    delta: number;
    kind: string;
    note: string;
    created_at: string;
    order_id: string | null;
  }[];
  wishlist: string[];
  orders: Order[];
  redemptions: {
    id: string;
    points: number;
    value_cents: number;
    minimum_cents: number;
    order_id: string | null;
    state: string;
  }[];
  newsletter: {
    status: string;
    preferences: {
      products: boolean;
      deals: boolean;
      youtube: boolean;
      instagram: boolean;
      news: boolean;
      frequency: string;
    };
  };
};
const tabs = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "orders", label: "My orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "rewards", label: "My rewards", icon: Gift },
  { id: "settings", label: "Settings", icon: Settings },
];
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const label = (value: string) => value.replaceAll("_", " ");

export function ClubAccount({
  configured,
  preview,
  initialView = "overview",
}: {
  configured: boolean;
  preview: boolean;
  initialView?: string;
}) {
  if (preview)
    return (
      <ClubDashboard
        data={previewData}
        initialView={initialView}
        preview
        onAction={async () => ({})}
        onSignOut={async () => {}}
        onManageIdentity={() => {}}
      />
    );
  if (!configured) return <ClubInvitation configured={false} />;
  return <ConnectedClub initialView={initialView} />;
}
function ConnectedClub({ initialView }: { initialView: string }) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const clerk = useClerk();
  const [data, setData] = useState<ClubData | null>(null);
  const [dataOwner, setDataOwner] = useState<string | null>(null);
  const generation = useRef(0);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const requestGeneration = ++generation.current;
    const token = await getToken();
    const response = await fetch("/api/club", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.message ?? "Your account could not be loaded.");
    if (generation.current !== requestGeneration) return;
    setData(body);
    setDataOwner(userId ?? null);
    setError("");
  }, [getToken, userId]);
  useEffect(() => {
    if (isSignedIn)
      void Promise.resolve()
        .then(load)
        .catch((e) => setError(e.message));
    return () => { generation.current += 1; };
  }, [isSignedIn, load]);
  if (!isLoaded)
    return (
      <main id="main-content" className="club-loading" aria-busy="true">
        Opening your Club…
      </main>
    );
  if (!isSignedIn) return <ClubInvitation configured />;
  if (!data || dataOwner !== userId)
    return (
      <main id="main-content" className="club-loading">
        <Sparkles />
        <h1>Your KAPO Club</h1>
        <p role="status">{error || "Getting your collection ready…"}</p>
        {error && (
          <button
            className="button button-dark"
            onClick={() => void load().catch((e) => setError(e.message))}
          >
            Try again
          </button>
        )}
        <button
          className="club-text-button"
          onClick={() => void clerk.signOut({ redirectUrl: "/account" })}
        >
          Sign out
        </button>
      </main>
    );
  return (
    <ClubDashboard
      data={data}
      initialView={initialView}
      onSignOut={async () => {
        await clerk.signOut({ redirectUrl: "/account" });
      }}
      onManageIdentity={() => clerk.openUserProfile()}
      onAction={async (body) => {
        const token = await getToken();
        const response = await fetch("/api/club", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message ?? "That change could not be saved.");
        await load();
        return result;
      }}
    />
  );
}
function ClubInvitation({ configured }: { configured: boolean }) {
  usePageSnap(".club-invitation");
  return (
    <main id="main-content" className="club-invitation">
      <section>
        <p className="club-wordmark">
          KAPO <span>CLUB</span>
        </p>
        <p className="eyebrow">For your kind of character.</p>
        <h1>
          A little keycap.
          <br />A whole <em>Club.</em>
        </h1>
        <p>
          Your favorites, your orders, and a few well-earned perks.
          <br />
          One happy home for your growing KAPO collection.
        </p>
        <div className="club-join-actions">
          <Link
            className="club-primary"
            href={configured ? "/sign-up" : "/shop"}
          >
            {configured ? "Join the Club" : "Explore the crew"}
            <ArrowRight size={18} />
          </Link>
          {configured && (
            <Link className="club-text-button" href="/sign-in">
              Already a member? Sign in <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
        <p className="club-fine">
          {configured
            ? "Free to join. Verify your email to make it yours. Guest checkout is always welcome."
            : "Secure membership is being prepared. Guest checkout remains available."}
        </p>
      </section>
      <div className="club-invitation-art">
        <span className="club-orbit orbit-one" />
        <span className="club-orbit orbit-two" />
        <img
          src="/products/spore-artisan.png"
          alt="Spore, a KAPO character keycap"
        />
        <span className="club-sticker">
          <Star size={16} fill="currentColor" /> More character. More you.
        </span>
      </div>
      <div className="club-perk-strip">
        <article>
          <Heart />
          <h2>Keep your favorites close</h2>
          <p>A wishlist for your next little desk companion.</p>
        </article>
        <article>
          <Package />
          <h2>Follow your collection</h2>
          <p>Orders and tracking, together in one place.</p>
        </article>
        <article>
          <Gift />
          <h2>Something to look forward to</h2>
          <p>
            Earn points on qualifying fulfilled purchases when rewards open.
          </p>
        </article>
      </div>
    </main>
  );
}

function ClubDashboard({
  data,
  initialView,
  preview = false,
  onAction,
  onSignOut,
  onManageIdentity,
}: {
  data: ClubData;
  initialView: string;
  preview?: boolean;
  onAction: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onSignOut: () => Promise<void>;
  onManageIdentity: () => void;
}) {
  const [view, setView] = useState(
    tabs.some((t) => t.id === initialView) ? initialView : "overview",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [points, setPoints] = useState(data.rules.minimumPoints);
  const name = data.profile?.name.split(" ")[0] || "collector";
  const available = Math.max(0, data.balance);
  const remaining = Math.max(0, data.rules.minimumPoints - available);
  const progress = Math.min(100, (available / data.rules.minimumPoints) * 100);
  const saved = shopProducts.filter((product) =>
    data.wishlist.includes(product.id),
  );
  const act = async (body: Record<string, unknown>, success: string) => {
    if (preview) {
      setMessage(
        "Illustrative preview. No account records or balances can be changed here.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await onAction(body);
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const orderCards = (rows: Order[]) =>
    rows.length ? (
      <div className="club-order-list">
        {rows.map((order) => (
          <article className="club-order" key={order.orderNumber}>
            <img src={order.previewImage || "/kapo-mascot.png"} alt="" />
            <div>
              <span className="club-order-number">{order.orderNumber}</span>
              <h3>
                {order.previewName}
                {order.itemCount > 1 ? ` + ${order.itemCount - 1} more` : ""}
              </h3>
              <p>
                {new Date(order.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · {money(order.totalCents)}
              </p>
            </div>
            <div className="club-order-end">
              <span
                className={`club-status ${order.shippingStatus === "delivered" ? "is-delivered" : ""}`}
              >
                <span />
                {label(
                  order.shippingStatus === "quoted"
                    ? order.productionStatus
                    : order.shippingStatus,
                )}
              </span>
              {preview ? (
                <span className="club-text-button">
                  Order details <ChevronRight size={15} />
                </span>
              ) : (
                <Link
                  className="club-text-button"
                  href={`/account/orders/${order.orderNumber}`}
                >
                  Order details <ChevronRight size={15} />
                </Link>
              )}
              {order.trackingUrl && !preview && (
                <a href={order.trackingUrl} rel="noreferrer">
                  Track package
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="club-empty">
        <Package />
        <h3>Your next little adventure starts here.</h3>
        <p>
          Your purchases appear here after checkout. Previously checked out as a
          guest?
        </p>
        <button
          className="club-text-button"
          disabled={busy}
          onClick={() =>
            void act(
              { action: "claim_orders" },
              "Orders with your verified email have been linked. No past points were automatically awarded.",
            )
          }
        >
          Find orders with my verified email <ArrowRight size={16} />
        </button>
        <Link className="club-primary" href="/shop">
          Meet the crew <ArrowRight size={16} />
        </Link>
      </div>
    );
  const wishlistCards = (limit = 100) =>
    saved.length ? (
      <div className="club-wishlist-grid">
        {saved.slice(0, limit).map((product) => (
          <article key={product.id}>
            <Link href={product.href}>
              <div className="club-product-image">
                <img
                  src={product.image}
                  alt={`${product.name} ${product.style}`}
                />
              </div>
              <h3>{product.name}</h3>
            </Link>
            <p>
              {product.style}{" "}
              <span>
                {product.price === null
                  ? "Coming soon"
                  : money(Math.round(product.price * 100))}
              </span>
            </p>
            <button
              className="club-remove"
              aria-label={`Remove ${product.name} ${product.style} from wishlist`}
              disabled={busy}
              onClick={() =>
                void act(
                  { action: "wishlist", productId: product.id, saved: false },
                  "Removed from your wishlist.",
                )
              }
            >
              <Heart size={17} fill="currentColor" />
            </button>
          </article>
        ))}
      </div>
    ) : (
      <div className="club-empty">
        <Heart />
        <h3>Make room for a favorite.</h3>
        <p>Tap the heart on a character page to keep them here.</p>
        <Link className="club-text-button" href="/shop">
          Find your character <ArrowRight size={16} />
        </Link>
      </div>
    );
  return (
    <main id="main-content" className="club-shell">
      {preview && (
        <div className="club-preview-note">
          DESIGN PREVIEW · Fictional account data · No sign-in or account access
          granted
        </div>
      )}
      <aside className="club-sidebar">
        <Link className="club-wordmark" href="/account">
          KAPO <span>CLUB</span>
        </Link>
        <p className="club-side-caption">A home for your collection.</p>
        <nav aria-label="KAPO Club">
          {tabs.map(({ id, label: text, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "is-active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => {
                setView(id);
                setMessage("");
              }}
            >
              <Icon size={19} />
              {text}
              {view === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="club-side-bottom">
          <span className="club-avatar">{name.charAt(0)}</span>
          <div>
            <strong>{data.profile?.name}</strong>
            <small>Club member</small>
          </div>
          <button
            aria-label="Sign out of KAPO Club"
            onClick={() => void onSignOut()}
            disabled={preview}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="club-content">
        <header className="club-page-top">
          <span>
            Your account /{" "}
            <strong>{tabs.find((t) => t.id === view)?.label}</strong>
          </span>
          <Link href="/shop">
            Back to the shop <ArrowUpRight size={15} />
          </Link>
        </header>
        {message && (
          <p className="club-notice" role="status">
            {message}
          </p>
        )}
        {view === "overview" && (
          <>
            <section className="club-welcome">
              <div>
                <p className="eyebrow">GOOD TO SEE YOU AGAIN</p>
                <h1>
                  Hey, {name}
                  <span>✳</span>
                </h1>
                <p>A little more character for your everyday.</p>
                <span className="club-member-pill">
                  <Star size={13} /> Your collection is growing.
                </span>
              </div>
              <div className="club-welcome-art">
                <img
                  src="/products/spore-artisan.png"
                  alt="Spore welcomes you to KAPO Club"
                />
              </div>
            </section>
            <div className="club-overview-grid">
              <section className="club-points-card">
                <div className="club-points-heading">
                  <span>YOUR KAPO POINTS</span>
                  <Sparkles size={21} />
                </div>
                <strong>
                  {data.balance.toLocaleString()}
                  <small>pts</small>
                </strong>
                <p>
                  {remaining
                    ? `${remaining} points to your next little reward.`
                    : "Your next reward is ready to explore."}
                </p>
                <div
                  className="club-progress"
                  role="progressbar"
                  aria-label="Progress to your first reward"
                  aria-valuemin={0}
                  aria-valuemax={data.rules.minimumPoints}
                  aria-valuenow={Math.min(available, data.rules.minimumPoints)}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="club-progress-caption">
                  <span>
                    {available} / {data.rules.minimumPoints} pts
                  </span>
                  <span>
                    {money(
                      (data.rules.minimumPoints * 100) / data.rules.valueRate,
                    )}{" "}
                    reward
                  </span>
                </div>
                <button onClick={() => setView("rewards")}>
                  Explore your rewards <ArrowRight size={17} />
                </button>
              </section>
              <section className="club-next-character">
                <div>
                  <span className="eyebrow">YOUR NEXT DESK COMPANION</span>
                  <h2>
                    A little mischief.
                    <br />A lot of Gloop.
                  </h2>
                  <Link href="/characters/gloop">
                    Meet Gloop <ArrowRight size={17} />
                  </Link>
                </div>
                <img
                  src="/products/gloop-artisan.png"
                  alt="Gloop artisan keycap"
                />
              </section>
            </div>
            <section className="club-section">
              <header>
                <h2>
                  Your latest orders <span>{data.orders.length}</span>
                </h2>
                <button onClick={() => setView("orders")}>
                  View all orders <ArrowRight size={16} />
                </button>
              </header>
              {orderCards(data.orders.slice(0, 2))}
            </section>
            <section className="club-section">
              <header>
                <h2>
                  On your wishlist <Heart size={19} />
                </h2>
                <button onClick={() => setView("wishlist")}>
                  View wishlist <ArrowRight size={16} />
                </button>
              </header>
              {wishlistCards(3)}
            </section>
          </>
        )}
        {view === "orders" && (
          <>
            <div className="club-section-title">
              <p className="eyebrow">FROM OUR DESK TO YOURS</p>
              <h1>My orders.</h1>
              <p>Every little character, every step of the way.</p>
            </div>
            {orderCards(data.orders)}
            <button
              className="club-text-button"
              disabled={busy}
              onClick={() =>
                void act(
                  { action: "claim_orders" },
                  "Matching guest orders are linked to your verified account.",
                )
              }
            >
              Link guest orders with my verified email <ArrowRight size={16} />
            </button>
          </>
        )}
        {view === "wishlist" && (
          <>
            <div className="club-section-title">
              <p className="eyebrow">THE ONES YOU LOVE</p>
              <h1>Saved for later.</h1>
              <p>A little lineup of future desk companions.</p>
            </div>
            {wishlistCards()}
            <Link className="club-text-button" href="/shop">
              Keep exploring <ArrowRight size={16} />
            </Link>
          </>
        )}
        {view === "rewards" && (
          <>
            <div className="club-section-title">
              <p className="eyebrow">A LITTLE THANK YOU</p>
              <h1>Good things add up.</h1>
              <p>
                Earn {data.rules.earnRate} points per eligible merchandise
                dollar after fulfillment. No points on shipping or tax.
              </p>
            </div>
            <div className="club-rewards-grid">
              <section className="club-points-card">
                <span>AVAILABLE POINTS</span>
                <strong>
                  {data.balance.toLocaleString()}
                  <small>pts</small>
                </strong>
                <p>
                  {data.balance < 0
                    ? "A refund reversed points already used. New earnings will bring your balance back up."
                    : "Your next character could come with a little perk."}
                </p>
                <Link href="/shop">
                  Find your next favorite <ArrowRight size={17} />
                </Link>
              </section>
              <section className="club-redeem-card">
                <Gift size={28} />
                <h2>Your points. Your next character.</h2>
                <p>
                  {data.rules.valueRate} points = $1 off. Start at{" "}
                  {data.rules.minimumPoints} points, with a{" "}
                  {money(data.rules.minimumCents)} merchandise minimum. No cash
                  value or promo-code stacking.
                </p>
                <label>
                  Points to use
                  <input
                    type="number"
                    min={data.rules.minimumPoints}
                    step={data.rules.valueRate}
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                  />
                </label>
                <button
                  className="club-primary"
                  disabled={
                    busy ||
                    !data.redemptionEnabled ||
                    available < points ||
                    preview
                  }
                  onClick={() =>
                    void act(
                      {
                        action: "redeem",
                        points,
                        requestId: crypto.randomUUID(),
                      },
                      "Your reward is reserved. Use the checkout link below within 30 minutes.",
                    )
                  }
                >
                  {data.redemptionEnabled
                    ? "Reserve my reward"
                    : "Redemption opens after launch checks"}
                  <ArrowRight size={16} />
                </button>
              </section>
            </div>
            {data.redemptions.map((reward) => (
              <div className="club-held-reward" key={reward.id}>
                <Gift size={23} />
                <div>
                  <strong>
                    {money(reward.value_cents)} off your next eligible order
                  </strong>
                  <p>
                    {reward.points} points reserved ·{" "}
                    {reward.order_id
                      ? "Attached to your checkout"
                      : "Use at checkout within 30 minutes"}
                  </p>
                </div>
                {!preview && (
                  <Link
                    href={`/checkout?reward=${encodeURIComponent(reward.id)}`}
                  >
                    Use at checkout <ArrowRight size={16} />
                  </Link>
                )}
                {!reward.order_id && (
                  <button
                    disabled={busy || preview}
                    onClick={() =>
                      void act(
                        { action: "cancel_reward", id: reward.id },
                        "Unused reward released. Your points are available again.",
                      )
                    }
                  >
                    Release points
                  </button>
                )}
              </div>
            ))}
            <section className="club-section">
              <header>
                <h2>Your point story</h2>
              </header>
              {data.ledger.length ? (
                <ul className="club-ledger">
                  {data.ledger.map((entry) => (
                    <li key={entry.id}>
                      <span className="club-ledger-icon">
                        {entry.delta > 0 ? (
                          <Star size={17} />
                        ) : (
                          <Gift size={17} />
                        )}
                      </span>
                      <div>
                        <strong>{entry.note}</strong>
                        <small>
                          {new Date(entry.created_at).toLocaleDateString(
                            "en-US",
                          )}
                        </small>
                      </div>
                      <b className={entry.delta < 0 ? "is-negative" : ""}>
                        {entry.delta > 0 ? "+" : ""}
                        {entry.delta} pts
                      </b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Your point history will appear here.</p>
              )}
            </section>
            <div className="club-earning-notes">
              <span>
                <Check size={16} /> {data.rules.signupBonus} points for a
                verified account
              </span>
              <span>
                <Check size={16} /> {data.rules.firstOrderBonus} bonus on your
                first fulfilled order
              </span>
              <span>
                <Truck size={16} /> Refunds reverse earned points
              </span>
            </div>
          </>
        )}
        {view === "settings" && (
          <>
            <div className="club-section-title">
              <p className="eyebrow">MAKE YOURSELF AT HOME</p>
              <h1>Your little details.</h1>
              <p>Manage your profile, sign-in and what lands in your inbox.</p>
            </div>
            <form
              className="club-settings-card"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void act(
                  {
                    action: "profile",
                    name: form.get("name"),
                    orderEmails: form.get("orderEmails") === "on",
                  },
                  "Profile preferences saved.",
                );
              }}
            >
              <h2>Profile & order updates</h2>
              <label>
                Name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={data.profile?.name}
                />
              </label>
              <label>
                Verified email
                <input value={data.profile?.email ?? ""} readOnly />
              </label>
              <p className="club-fine">
                Change your email and manage sign-in methods through your secure
                account settings.
              </p>
              <label className="club-check">
                <input
                  type="checkbox"
                  name="orderEmails"
                  defaultChecked={data.profile?.order_emails === 1}
                />{" "}
                Email me optional production and tracking progress. Essential
                order and refund receipts are always sent.
              </label>
              <div className="club-settings-actions">
                <button
                  type="submit"
                  className="club-primary"
                  disabled={busy || preview}
                >
                  Save details <Check size={16} />
                </button>
                <button
                  className="club-text-button"
                  type="button"
                  onClick={onManageIdentity}
                  disabled={preview}
                >
                  Security & sign-in <ArrowUpRight size={16} />
                </button>
                <button
                  type="button"
                  className="club-text-button"
                  onClick={() => void onSignOut()}
                  disabled={preview}
                >
                  Sign out <LogOut size={16} />
                </button>
              </div>
            </form>
            <section className="club-settings-card">
              <h2>A note from the crew</h2>
              <p>
                Newsletter: <strong>{label(data.newsletter.status)}</strong>.
                Membership never subscribes you automatically.
              </p>
              {data.newsletter.status !== "confirmed" ? (
                <>
                  <p>
                    Choose to receive KAPO product news and offers. We’ll send
                    an email asking you to confirm; you can unsubscribe anytime.
                  </p>
                  <button
                    className="club-primary"
                    disabled={busy || preview}
                    onClick={() =>
                      void act(
                        {
                          action: "newsletter",
                          subscribe: true,
                          consent: true,
                        },
                        "Check your inbox to confirm KAPO news.",
                      )
                    }
                  >
                    Yes, email me KAPO news <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act(
                      {
                        action: "preferences",
                        ...Object.fromEntries(
                          [
                            "products",
                            "deals",
                            "youtube",
                            "instagram",
                            "news",
                          ].map((key) => [key, f.get(key) === "on"]),
                        ),
                        frequency: f.get("frequency"),
                      },
                      "Newsletter preferences saved.",
                    );
                  }}
                >
                  <div className="club-topic-grid">
                    {(
                      [
                        "products",
                        "deals",
                        "youtube",
                        "instagram",
                        "news",
                      ] as const
                    ).map((topic) => (
                      <label className="club-check" key={topic}>
                        <input
                          type="checkbox"
                          name={topic}
                          defaultChecked={data.newsletter.preferences[topic]}
                        />
                        {label(topic)}
                      </label>
                    ))}
                  </div>
                  <label>
                    Frequency
                    <select
                      name="frequency"
                      defaultValue={data.newsletter.preferences.frequency}
                    >
                      <option value="weekly">A weekly note</option>
                      <option value="immediate">Each eligible update</option>
                    </select>
                  </label>
                  <button className="club-primary" disabled={busy || preview}>
                    Save newsletter preferences
                  </button>
                  <button
                    type="button"
                    className="club-text-button"
                    disabled={busy || preview}
                    onClick={() =>
                      void act(
                        { action: "newsletter", subscribe: false },
                        "Unsubscribed from marketing. Your Club account stays open.",
                      )
                    }
                  >
                    Unsubscribe from all marketing
                  </button>
                </form>
              )}
            </section>
          </>
        )}
        <footer className="club-footer">
          <span>Small keys. Big character.</span>
          <span>✳ Made for your everyday.</span>
        </footer>
      </div>
    </main>
  );
}
const previewData: ClubData = {
  profile: {
    name: "Alex Morgan",
    email: "alex@example.invalid",
    joined_at: "2026-10-01T00:00:00Z",
    order_emails: 1,
  },
  balance: 245,
  rules: DEFAULT_REWARDS,
  redemptionEnabled: false,
  ledger: [
    {
      id: "sample-1",
      delta: 50,
      kind: "signup",
      note: "Verified account welcome",
      created_at: "2026-10-01T00:00:00Z",
      order_id: null,
    },
    {
      id: "sample-2",
      delta: 195,
      kind: "purchase",
      note: "Illustrative fulfilled purchase",
      created_at: "2026-10-10T00:00:00Z",
      order_id: "sample",
    },
  ],
  wishlist: ["gloop-artisan", "orbit-flat", "rango-artisan"],
  redemptions: [],
  newsletter: {
    status: "none",
    preferences: {
      products: true,
      deals: true,
      youtube: false,
      instagram: false,
      news: true,
      frequency: "weekly",
    },
  },
  orders: [
    {
      orderNumber: "SAMPLE-ORDER",
      totalCents: 1898,
      createdAt: "2026-10-10T00:00:00Z",
      productionStatus: "shipped",
      paymentStatus: "paid",
      shippingStatus: "in_transit",
      previewImage: "/products/spore-artisan.png",
      previewName: "Spore Artisan Keycap",
      itemCount: 2,
    },
  ],
};
