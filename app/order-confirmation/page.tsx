import Link from "next/link";
import { ClearCartOnConfirmed } from "@/components/ClearCartOnConfirmed";
import { pageMetadata } from "@/lib/page-meta";

export const metadata = pageMetadata(
  "Order confirmation",
  "KAPO order status after Stripe confirms payment.",
  "/order-confirmation",
  false,
);
import { formatCents } from "@/lib/commerce/money";
import { PRODUCTION_LABELS, type ProductionStatus } from "@/lib/commerce/status";
import { getOrderBySession } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string; redirect_status?: string }> }) {
  const params = await searchParams;
  const failed = params.redirect_status === "failed";
  const order = failed || !params.session_id ? null : await loadOrder(params.session_id);
  const confirmed = order?.paymentStatus === "paid" || order?.paymentStatus === "partially_refunded";
  return (
    <main id="main-content" className="inner-page confirmation-page">
      <ClearCartOnConfirmed confirmed={confirmed} />
      <section className="confirmation-panel editorial-width">
        <p className="eyebrow">Order confirmation</p>
        <h1>{confirmed ? "You’re in the crew." : failed ? "Payment did not go through." : "Waiting for Stripe."}</h1>
        <p>{confirmed ? "Stripe confirmed this payment and the order is waiting for production." : failed ? "No charge was completed. You can return to checkout and try another payment method." : "This page does not mark an order paid from the redirect. It updates when Stripe’s webhook confirms the payment."}</p>
        <dl>
          <div><dt>Order number</dt><dd>{order?.orderNumber ?? "Pending confirmation"}</dd></div>
          <div><dt>Items</dt><dd>{order ? order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") : "Not confirmed"}</dd></div>
          <div><dt>Shipping</dt><dd>{order ? `${order.carrier ?? "Carrier"} ${order.serviceName ?? ""}`.trim() : "Selected at checkout"}</dd></div>
          <div><dt>Total</dt><dd>{order ? formatCents(order.totalCents, order.currency) : "Confirmed by webhook"}</dd></div>
          <div><dt>Status</dt><dd>{order ? `${paymentLabel(order.paymentStatus)} · ${PRODUCTION_LABELS[order.productionStatus as ProductionStatus] ?? order.productionStatus}` : failed ? "Not paid" : "Waiting for webhook"}</dd></div>
        </dl>
        {order?.trackingUrl ? <p><a href={order.trackingUrl}>Track shipment {order.trackingNumber}</a></p> : order?.trackingNumber ? <p>Tracking number {order.trackingNumber}</p> : confirmed ? <p>Tracking appears after KAPO hands the parcel to the carrier.</p> : null}
        <Link className="button button-dark" href={confirmed ? "/account" : "/checkout"}>{confirmed ? "View your order" : "Return to checkout"}</Link>
      </section>
    </main>
  );
}

async function loadOrder(sessionId: string) {
  try {
    return await getOrderBySession(sessionId);
  } catch {
    return null;
  }
}

function paymentLabel(status: string) {
  if (status === "paid") return "Payment received";
  if (status === "review") return "Payment received, needs review";
  if (status === "failed") return "Payment failed";
  if (status === "refunded") return "Refunded";
  return "Payment pending";
}
