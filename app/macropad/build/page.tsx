import { MacropadBuilder } from "@/components/MacropadBuilder";
import { macropadPurchasable } from "@/lib/catalog";
import { getMacropadLaunch } from "@/lib/commerce/launch";
import { pageMetadata } from "@/lib/page-meta";

export async function generateMetadata() {
  const launch = await getMacropadLaunch();
  const purchasable = macropadPurchasable(launch);
  return pageMetadata(
    "KAPO Pad preview",
    purchasable
      ? "Choose a base and a character for each of the six KAPO Pad keys."
      : "Preview a six-key KAPO Pad layout. Coming soon. Price TBD. This page does not take a preorder.",
    "/macropad/build",
  );
}

export default async function MacropadBuilderPage() {
  const launch = await getMacropadLaunch();
  const purchasable = macropadPurchasable(launch);
  return (
    <main id="main-content" className="inner-page builder-page">
      <header className="page-intro editorial-width"><p className="eyebrow">{purchasable ? "KAPO Pad configurator" : "Coming soon"}</p><h1>Build your six.</h1><p>{purchasable ? "Choose a base, then give each of the six switch positions its own character—or leave it open." : "Preview a six-key layout. The KAPO Pad is not for sale yet, and this page does not take a preorder."}</p></header>
      <MacropadBuilder purchasable={purchasable} priceCents={launch.priceCents} />
    </main>
  );
}
