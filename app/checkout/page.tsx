import { CheckoutExperience } from "@/components/CheckoutExperience";
import { pageMetadata } from "@/lib/page-meta";

export const metadata = pageMetadata(
  "Checkout",
  "Pay for a KAPO order with Stripe. Shipping is calculated for U.S. addresses.",
  "/checkout",
  false,
);

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ canceled?: string }> }) {
  const params = await searchParams;
  return (
    <main id="main-content" className="inner-page">
      <CheckoutExperience canceled={params.canceled === "1"} />
    </main>
  );
}
