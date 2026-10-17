import Link from "next/link";
import { getShopUser } from "@/app/chatgpt-auth";
import { getAdminUser } from "@/app/admin-auth";
import { AccountSignIn } from "@/components/AccountSignIn";
import { formatCents } from "@/lib/commerce/money";
import { PRODUCTION_LABELS, type ProductionStatus } from "@/lib/commerce/status";
import { listCustomerOrders } from "@/lib/commerce/store";
import { pageMetadata } from "@/lib/page-meta";
import { SUPPORT_EMAIL } from "@/lib/store-facts";

export const metadata = pageMetadata(
  "Account",
  "Sign in with the email from checkout to see KAPO orders and tracking.",
  "/account",
  false,
);

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getShopUser();
  const admin = await getAdminUser();
  if (!user) {
    return (
      <main id="main-content" className="account-stage">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Your orders, in one place.</h1>
          <p>Sign in with the same email you use at checkout. Tracking shows up after KAPO hands the parcel to the carrier.</p>
        </div>
        <AccountSignIn />
      </main>
    );
  }

  const orders = await loadOrders(user);
  const firstName = user.fullName?.split(" ")[0] || user.displayName;
  return (
    <main id="main-content" className="account-home">
      <aside className="account-identity">
        <p className="eyebrow">Account</p>
        <h1>{firstName}</h1>
        <p className="account-email">{user.email}</p>
        <div className="account-actions">
          <Link className="button button-dark" href="/shop">Shop</Link>
          {admin && <Link className="button" href="/admin">Order dashboard</Link>}
          <form action="/api/account/signout" method="post"><button className="button" type="submit">Sign out</button></form>
        </div>
      </aside>
      <section className="account-orders">
        <header>
          <p className="eyebrow">Orders</p>
          <h2>{orders === null ? "Orders" : orders.length === 0 ? "No orders yet" : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}</h2>
        </header>
        {orders === null && <p className="account-note">Orders cannot be loaded right now. Try again in a moment, or email {SUPPORT_EMAIL} with the order number from your confirmation.</p>}
        {orders?.length === 0 && <p className="account-note">Orders checked out with {user.email} show up here after payment is confirmed.</p>}
        {orders && orders.length > 0 && (
          <ul className="account-order-list">
            {orders.map((order) => (
              <li key={order.orderNumber}>
                <Link href={`/account/orders/${order.orderNumber}`}>
                  {order.previewImage ? <img src={order.previewImage} alt="" /> : <span className="account-order-blank" />}
                  <span>
                    <strong>{order.orderNumber}</strong>
                    <small>{order.previewName}{order.itemCount > 1 ? ` · ${order.itemCount} pieces` : ""}</small>
                    <small>{new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {PRODUCTION_LABELS[order.productionStatus as ProductionStatus] ?? order.productionStatus}</small>
                  </span>
                  <b>{formatCents(order.totalCents, order.currency)}</b>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

async function loadOrders(user: { userId: string; email: string }) {
  try {
    return await listCustomerOrders(user);
  } catch {
    return null;
  }
}
