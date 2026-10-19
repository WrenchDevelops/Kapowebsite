import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleDollarSign, Clock3, Inbox, Package, Search, Settings2, Truck } from "lucide-react";
import { chatGPTSignInPath, getAdminUser } from "@/app/admin-auth";
import { AdminOrderEditor } from "@/components/AdminOrderEditor";
import { formatCents } from "@/lib/commerce/money";
import { PRODUCTION_LABELS, type ProductionStatus } from "@/lib/commerce/status";
import { AdminMacropadForm } from "@/components/AdminMacropadForm";
import { getMacropadLaunch } from "@/lib/commerce/launch";
import { dashboard, getAdminOrder } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders · Admin", robots: { index: false, follow: false } };

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
      <main id="main-content" className="admin-login">
        <header className="page-intro editorial-width">
          <p className="eyebrow">Orders</p>
          <h1>Admins only.</h1>
          <p>Your store, behind the scenes. Sign in with your administrator account to manage orders and fulfillment.</p>
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
  const selectedId = visible.find((order) => order.id === query.order)?.id ?? visible[0]?.id;
  const selected = selectedId ? await loadOrder(selectedId) : null;
  const counts = {
    all: matched.length,
    payment: matched.filter((order) => matchesView(order, "payment")).length,
    printing: matched.filter((order) => matchesView(order, "printing")).length,
    shipping: matched.filter((order) => matchesView(order, "shipping")).length,
    delivered: matched.filter((order) => matchesView(order, "delivered")).length,
  };

  return (
    <main id="main-content" className="orders-dashboard">
      <header className="dashboard-heading">
        <div><p className="workspace-eyebrow">YOUR STORE, AT A GLANCE</p><h1>Let’s get things moving<span>.</span></h1><p>Every order, from first click to doorstep.</p></div>
        <Link className="workspace-button" href="/admin/email">Open email studio <ArrowUpRight size={16} /></Link>
      </header>
      <section className="dashboard-metrics" aria-label="Store performance">
        <article><div><span>Gross sales</span><CircleDollarSign size={18} /></div><strong>{data ? formatCents(data.finance.grossSalesCents) : "—"}</strong><small>All-time paid sales</small></article>
        <article><div><span>Net revenue</span><ArrowUpRight size={18} /></div><strong>{data ? formatCents(data.finance.netRevenueCents) : "—"}</strong><small>After refunds and tax</small></article>
        <article><div><span>Unfulfilled orders</span><Package size={18} /></div><strong>{data?.finance.unfulfilledCount ?? "—"}</strong><small>Still a little work to do</small></article>
        <article className="metric-highlight"><div><span>Ready to ship</span><Truck size={18} /></div><strong>{data?.finance.awaitingShipmentCount ?? "—"}</strong><Link href={adminHref("shipping", "")}>View shipping queue <ArrowRight size={14} /></Link></article>
      </section>
      <div className="dashboard-section-heading"><div><h2>Order workspace</h2><span>{data?.finance.orderCount ?? 0} total orders</span></div><span><Clock3 size={14} /> All time</span></div>
      <div className="orders-workbench">
      <section className="admin-list" aria-label="Orders">
        <header>
          <div className="order-list-heading"><h2>Orders <span>{visible.length}</span></h2><Package size={17} /></div>
          <form action="/admin" className="order-search">
            <Search size={16} aria-hidden="true" />
            {view !== "all" && <input type="hidden" name="view" value={view} />}
            {selectedId && <input type="hidden" name="order" value={selectedId} />}
            <input name="q" aria-label="Search orders, names, or emails" defaultValue={q} placeholder="Search orders, names, emails…" />
            <button type="submit" aria-label="Search orders"><ArrowRight size={16} /></button>
          </form>
          <nav aria-label="Filter orders">
            {VIEWS.map((item) => (
              <Link key={item} className={item === view ? "is-current" : ""} aria-current={item === view ? "page" : undefined} href={adminHref(item, q, selectedId)}>{viewLabel(item)} <span>{counts[item]}</span></Link>
            ))}
          </nav>
        </header>
        {!data && <div className="workspace-empty"><Inbox size={30} /><h3>Orders are unavailable</h3><p>The order database could not be reached. Refresh to try again.</p><Link className="workspace-button" href={adminHref(view, q)}>Try again <ArrowRight size={14} /></Link></div>}
        {data && visible.length === 0 && <div className="workspace-empty"><Inbox size={30} /><h3>{q ? "No matching orders" : "You’re all caught up"}</h3><p>{q ? "Try another name, email, or order number." : view === "all" ? "Your first order will appear here. Good things are on the way." : "No orders in this queue right now."}</p>{(q || view !== "all") && <Link className="workspace-button" href="/admin">View all orders <ArrowRight size={14} /></Link>}</div>}
        {visible.map((order) => (
          <Link key={order.id} className={order.id === selectedId ? "admin-row is-selected" : "admin-row"} aria-current={order.id === selectedId ? "true" : undefined} href={adminHref(view, q, order.id)}>
            {order.previewImage ? <img src={order.previewImage} alt="" /> : <span className="admin-thumb" />}
            <span>
              <strong>{order.orderNumber}</strong>
              <small>{order.customerName}</small>
              <small>{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</small>
            </span>
            <span>
              <em className={`payment-badge payment-${order.paymentStatus}`}>{PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}</em>
              <small>{formatWhen(order.createdAt)}</small>
              <b>{formatCents(order.totalCents, order.currency)}</b>
            </span>
          </Link>
        ))}
      </section>

      <section className="admin-pane" aria-label="Order detail">
        {!selected && <div className="workspace-empty order-detail-empty"><div className="empty-package"><Package size={38} strokeWidth={1.3} /></div><p className="workspace-eyebrow">A LITTLE ORDER, A LOT OF CHARACTER</p><h2>Every detail, right here.</h2><p>Select an order to see its items, manage production,<br className="desktop-break" /> and get it on its way.</p><span className="empty-detail-hint"><ArrowDownRight size={15} /> Your fulfillment space</span></div>}
        {selected && (
          <>
            <header className="admin-pane-head">
              <div>
                <p className="workspace-eyebrow">ORDER DETAILS</p><h2>{selected.orderNumber}</h2>
                <p>{formatWhen(selected.createdAt, true)}</p>
              </div>
              <span className={`payment-badge payment-${selected.paymentStatus}`}>{PAYMENT_LABELS[selected.paymentStatus] ?? selected.paymentStatus}</span>
            </header>
            <div className="admin-detail-grid">
              <section>
                <h3>Customer</h3>
                <p>{selected.customerName}</p>
                <p><a href={`mailto:${selected.customerEmail}`}>{selected.customerEmail}</a></p>
              </section>
              <section>
                <h3>Shipping address</h3>
                <p>{selected.shipName}</p>
                <p>{selected.shipLine1}{selected.shipLine2 ? `, ${selected.shipLine2}` : ""}</p>
                <p>{selected.shipCity}, {selected.shipState} {selected.shipPostalCode}</p><p>{selected.shipCountry}</p>
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
                  <div><dt>Shipping</dt><dd>{formatCents(selected.shippingCents, selected.currency)}{selected.serviceName ? ` Â· ${selected.carrier} ${selected.serviceName}` : ""}</dd></div>
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
              <details className="admin-tech">
                <summary>Technical details</summary>
                <dl className="admin-facts">
                  <div><dt>Stripe Checkout</dt><dd title={selected.stripeCheckoutSessionId ?? ""}>{shortId(selected.stripeCheckoutSessionId)}</dd></div>
                  <div><dt>Stripe payment</dt><dd title={selected.stripePaymentIntentId ?? ""}>{shortId(selected.stripePaymentIntentId)}</dd></div>
                  <div><dt>Shippo shipment</dt><dd title={selected.shippoShipmentId ?? ""}>{shortId(selected.shippoShipmentId)}</dd></div>
                  <div><dt>Production</dt><dd>{PRODUCTION_LABELS[selected.productionStatus as ProductionStatus] ?? selected.productionStatus}</dd></div>
                </dl>
              </details>
            </div>
            <AdminOrderEditor key={selected.id} order={selected} dense />
          </>
        )}
      </section>
      </div>
      <section className="dashboard-bottom" aria-label="Store settings and costs">
        <div className="store-cost-card"><div className="card-heading"><div><p className="workspace-eyebrow">THE NUMBERS BEHIND THE ORDERS</p><h2>Store snapshot</h2></div><CircleDollarSign size={21} /></div><dl><div><dt>Profit</dt><dd>{data ? formatCents(data.finance.profitCents) : "—"}</dd></div><div><dt>Shipping label costs</dt><dd>{data ? formatCents(data.finance.labelCostCents) : "—"}</dd></div><div><dt>Emails in queue</dt><dd>{data?.queuedEmails ?? "—"}</dd></div></dl><p>Profit is paid sales minus refunds, tax, and shipping labels.</p></div>
        <details className="launch-settings"><summary><span className="launch-product"><img src="/products/macropad-white-bare.png" alt="" width="68" height="68" /><span><small>PRODUCT CONTROLS</small><strong>KAPO Pad</strong><span>Price, inventory & launch settings</span></span></span><Settings2 size={20} /></summary><AdminMacropadForm launch={macropad} /></details>
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
  if (!value) return "â€”";
  return value.length > 22 ? `${value.slice(0, 18)}â€¦` : value;
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
