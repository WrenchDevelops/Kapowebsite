import { redirect } from "next/navigation";
import Link from "next/link";
import { chatGPTSignInPath, getAdminUser } from "@/app/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <main id="main-content" className="admin-login">
        <header className="page-intro editorial-width">
          <p className="eyebrow">Orders</p>
          <h1>Admins only.</h1>
          <Link className="button button-dark" href={chatGPTSignInPath("/admin")}>Sign in</Link>
        </header>
      </main>
    );
  }
  const { orderId } = await params;
  redirect(`/admin?order=${orderId}`);
}
