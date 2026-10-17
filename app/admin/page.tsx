import Link from "next/link";
import { chatGPTSignInPath, getAdminUser } from "@/app/admin-auth";
import { AdminOrderEditor } from "@/components/AdminOrderEditor";
import { formatCents } from "@/lib/commerce/money";
import { PRODUCTION_LABELS, type ProductionStatus } from "@/lib/commerce/status";
import { AdminMacropadForm } from "@/components/AdminMacropadForm";
import { getMacropadLaunch } from "@/lib/commerce/launch";
import { dashboard, getAdminOrder } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const VIEWS = ["all", "payment", "printing", "shipping", "delivered"] as const;
type View = (typeof VIEWS)[number];

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partial refund",
  review: "In review",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ order?: string; view?: string; q?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <main id="main-content" className="inner-page">
        <header className="page-intro editorial-width">
          <p className="eyebrow">Orders</p>
          <h1>Admins only.</h1>
          <p>Sign in with an email listed in KAPO_ADMIN_EMAILS.</p>
          <Link className="button button-dark" href={chatGPTSignInPath("/admin")}>Sign in</Link>
        </header>
      </main>
    );
  }

  const query = await searchParams;
  const view = VIEWS.includes(query.view as View) ? (query.view as View) : "all";
  const q = query.q?.trim() ?? "";
  const data = await loadDashboard();
  const macropad = await getMacropadLaunch();
  const matched = (data?.orders ?? []).filter((order) => matchesQuery(order, q));
  const visible = matched.filter((order) => matchesView(order, view));
  const selectedId = visible.find((order) => order.id === query.order)?.id ?? matched.find((order) => order.id === query.order)?.id ?? visible[0]?.id;
  const selected = selectedId ? await loadOrder(selectedId) : null;
  const counts = {
    all: matched.length,
    payment: matched.filter((order) => matchesView(order, "payment")).length,
    printing: matched.filter((order) => matchesView(order, "printing")).length,
    shipping: matched.filter((order) => matchesView(order, "shipping")).length,
    delivered: matched.filter((order) => matchesView(order, "delivered")).length,
  };

  return (
    <main id="main-content" className="admin-shell">
      <aside className="admin-side">
        <p className="eyebrow">Admin</p>
        <Link className="admin-nav is-current" href={adminHref("all", q)}><span>Orders</span><b>{data?.finance.orderCount ?? 0}</b></Link>
        <Link className="admin-nav" href="/">View store</Link>
        {data && (
          <dl className="admin-stats">
            <div className="admin-stats-title"><dt>Sales</dt><dd /></div>
            <div><dt>Gross sales</dt><dd>{formatCents(data.finance.grossSalesCents)}</dd></div>
            <div><dt>Net revenue</dt><dd>{formatCents(data.finance.netRevenueCents)}</dd></div>
            <div><dt>Profit</dt><dd>{formatCents(data.finance.profitCents)}</dd></div>
            <div><dt>Unfulfilled</dt><dd>{data.finance.unfulfilledCount}</dd></div>
            <div><dt>Ready to ship</dt><dd>{data.finance.awaitingShipmentCount}</dd></div>
            <div><dt>Label cost</dt><dd>{formatCents(data.finance.labelCostCents)}</dd></div>
            <div><dt>Queued email</dt><dd>{data.queuedEmails}</dd></div>
          </dl>
        )}
        <p>Profit is paid sales minus refunds, tax, and labels.</p>
        <AdminMacropadForm launch={macropad} />
      </aside>

      <section className="admin-list" aria-label="Orders">
        <header>
          <h2>Orders <span>{visible.length}</span></h2>
          <form action="/admin">
            {view !== "all" && <input type="hidden" name="view" value={view} />}
            {selectedId && <input type="hidden" name="order" value={selectedId} />}
            <input name="q" defaultValue={q} placeholder="Search orders, names, or emails" />
          </form>
          <nav>
            {VIEWS.map((item) => (
              <Link key={item} className={item === view ? "is-current" : ""} href={adminHref(item, q, selectedId)}>{viewLabel(item)} {counts[item]}</Link>
            ))}
          </nav>
        </header>
        {!data && <p className="admin-empty">The order database is not ready.</p>}
        {data && visible.length === 0 && <p className="admin-empty">No orders in this view.</p>}
        {visible.map((order) => (
          <Link key={order.id} className={order.id === selectedId ? "admin-row is-selected" : "admin-row"} href={adminHref(view, q, order.id)}>
            {order.previewImage ? <img src={order.previewImage} alt="" /> : <span className="admin-thumb" />}
            <span>
              <strong>{order.orderNumber}</strong>
              <small>{order.customerName}</small>
              <small>{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</small>
            </span>
            <span>
              <em>{PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}</em>
              <small>{formatWhen(order.createdAt)}</small>
              <b>{formatCents(order.totalCents, order.currency)}</b>
            </span>
          </Link>
        ))}
      </section>

      <section className="admin-pane" aria-label="Order detail">
        {!selected && <p className="admin-empty">Select an order.</p>}
        {selected && (
          <>
            <header className="admin-pane-head">
              <div>
                <h2>{selected.orderNumber}</h2>
                <p>{formatWhen(selected.createdAt, true)}</p>
              </div>
              <span>{PAYMENT_LABELS[selected.paymentStatus] ?? selected.paymentStatus}</span>
            </header>
            <div className="admin-detail-grid">
              <section>
                <h3>Customer</h3>
                <p>{selected.customerName}</p>
                <p>{selected.customerEmail}</p>
              </section>
              <section>
                <h3>Shipping address</h3>
                <p>{selected.shipName}</p>
                <p>{selected.shipLine1}{selected.shipLine2 ? `, ${selected.shipLine2}` : ""}</p>
                <p>{selected.shipCity}, {selected.shipState} {selected.shipPostalCode}</p>
              </section>
              <section>
                <h3>Items ({selected.items.length})</h3>
                <ul className="admin-lines">
                  {selected.items.map((item) => (
                    <li key={item.id}>
                      {item.image ? <img src={item.image} alt="" /> : <span className="admin-thumb" />}
                      <span><strong>{item.name}</strong><small>Qty {item.quantity}</small></span>
                      <b>{formatCents(item.lineTotalCents, selected.currency)}</b>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Order totals</h3>
                <dl className="admin-facts">
                  <div><dt>Subtotal</dt><dd>{formatCents(selected.merchandiseSubtotalCents, selected.currency)}</dd></div>
                  <div><dt>Discount</dt><dd>{formatCents(selected.discountCents, selected.currency)}</dd></div>
                  <div><dt>Shipping</dt><dd>{formatCents(selected.shippingCents, selected.currency)}{selected.serviceName ? ` · ${selected.carrier} ${selected.serviceName}` : ""}</dd></div>
                  <div><dt>Tax</dt><dd>{formatCents(selected.taxCents, selected.currency)}</dd></div>
                  <div className="order-total"><dt>Total</dt><dd>{formatCents(selected.totalCents, selected.currency)}</dd></div>
                </dl>
              </section>
              <section>
                <h3>Status</h3>
                <ol className="admin-progress">
                  {progress(selected).map((step) => (
                    <li key={step.name} className={step.state}><i /><span><strong>{step.name}</strong><small>{step.note}</small></span></li>
                  ))}
                </ol>
              </section>
              <section>
                <h3>Tracking</h3>
                <p>{selected.trackingNumber ? selected.trackingUrl ? <a href={selected.trackingUrl}>{selected.trackingNumber}</a> : selected.trackingNumber : "Not shipped yet"}</p>
                <p>{selected.trackingNumber ? "Carrier updates land here." : "Tracking will appear once the order ships."}</p>
              </section>
              <section className="admin-tech">
                <h3>Technical details</h3>
                <dl className="admin-facts">
                  <div><dt>Stripe Checkout</dt><dd title={selected.stripeCheckoutSessionId ?? ""}>{shortId(selected.stripeCheckoutSessionId)}</dd></div>
                  <div><dt>Stripe payment</dt><dd title={selected.stripePaymentIntentId ?? ""}>{shortId(selected.stripePaymentIntentId)}</dd></div>
                  <div><dt>Shippo shipment</dt><dd title={selected.shippoShipmentId ?? ""}>{shortId(selected.shippoShipmentId)}</dd></div>
                  <div><dt>Production</dt><dd>{PRODUCTION_LABELS[selected.productionStatus as ProductionStatus] ?? selected.productionStatus}</dd></div>
                </dl>
              </section>
            </div>
            <AdminOrderEditor order={selected} dense />
          </>
        )}
      </section>
    </main>
  );
}

function adminHref(view: View, q: string, orderId?: string) {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (q) params.set("q", q);
  if (orderId) params.set("order", orderId);
  const value = params.toString();
  return value ? `/admin?${value}` : "/admin";
}

function viewLabel(view: View) {
  if (view === "all") return "All";
  if (view === "payment") return "Payment";
  if (view === "printing") return "Printing";
  if (view === "shipping") return "Shipping";
  return "Delivered";
}

function matchesQuery(order: { orderNumber: string; customerName: string; customerEmail: string }, q: string) {
  if (!q) return true;
  const haystack = `${order.orderNumber} ${order.customerName} ${order.customerEmail}`.toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function matchesView(order: { paymentStatus: string; productionStatus: string; shippingStatus: string }, view: View) {
  if (view === "payment") return ["pending", "failed", "review"].includes(order.paymentStatus);
  if (view === "printing") return ["awaiting_production", "printing", "quality_control", "packaging"].includes(order.productionStatus);
  if (view === "shipping") return ["ready_to_ship", "shipped"].includes(order.productionStatus) || ["label_purchased", "shipped", "in_transit"].includes(order.shippingStatus);
  if (view === "delivered") return order.productionStatus === "delivered" || order.shippingStatus === "delivered";
  return true;
}

function progress(order: { paymentStatus: string; productionStatus: string; shippingStatus: string }) {
  const paid = ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus);
  const delivered = order.productionStatus === "delivered" || order.shippingStatus === "delivered";
  const shipped = delivered || order.productionStatus === "shipped" || ["shipped", "in_transit"].includes(order.shippingStatus);
  const packaging = shipped || ["packaging", "ready_to_ship"].includes(order.productionStatus);
  const printing = packaging || ["printing", "quality_control", "awaiting_production"].includes(order.productionStatus);
  const steps = [
    { name: "Payment", on: paid, note: paid ? "Paid" : "Waiting for Stripe" },
    { name: "Printing", on: printing, note: packaging ? "Printed" : printing ? "In production" : "Not started" },
    { name: "Packaging", on: packaging, note: shipped ? "Packed" : packaging ? "Packing" : "Not started" },
    { name: "Shipped", on: shipped, note: delivered ? "Shipped" : shipped ? "With the carrier" : "Not shipped" },
    { name: "Delivered", on: delivered, note: delivered ? "Delivered" : "Not delivered" },
  ];
  const current = steps.findIndex((step) => !step.on);
  return steps.map((step, index) => ({
    name: step.name,
    note: step.note,
    state: step.on ? "is-done" : index === current ? "is-current" : "",
  }));
}

function formatWhen(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortId(value: string | null) {
  if (!value) return "—";
  return value.length > 22 ? `${value.slice(0, 18)}…` : value;
}

async function loadDashboard() {
  try {
    return await dashboard();
  } catch {
    return null;
  }
}

async function loadOrder(orderId: string) {
  try {
    return await getAdminOrder(orderId);
  } catch {
    return null;
  }
}
