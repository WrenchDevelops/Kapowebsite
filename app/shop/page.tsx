import { ShopGrid } from "@/components/ShopGrid";
import { getMacropadLaunch } from "@/lib/commerce/launch";
import { pageMetadata } from "@/lib/page-meta";

export const metadata = pageMetadata(
  "Shop",
  "Shop eight KAPO characters as Flat keycaps at $6.99 or Artisan keycaps at $11.99. The KAPO Pad is coming soon and is not for sale.",
  "/shop",
);

export default async function ShopPage() {
  const launch = await getMacropadLaunch();
  return (
    <main id="main-content" className="inner-page">
      <header className="page-intro editorial-width"><p className="eyebrow">The full collection</p><h1>Shop KAPO.</h1><p>Eight characters in Flat and Artisan. The KAPO Pad is coming soon and is not for sale.</p></header>
      <section className="editorial-width shop-section" aria-label="KAPO products"><ShopGrid launch={launch} /></section>
    </main>
  );
}
