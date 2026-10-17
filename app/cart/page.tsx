import { CartView } from "@/components/CartView";
import { pageMetadata } from "@/lib/page-meta";

export const metadata = pageMetadata(
  "Cart",
  "Review KAPO keycaps in your cart before checkout. Shipping and tax are calculated at checkout.",
  "/cart",
  false,
);

export default function CartPage() {
  return <main id="main-content" className="inner-page cart-page"><CartView /></main>;
}
