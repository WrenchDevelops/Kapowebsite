import { PreferenceCenter } from "@/components/PreferenceCenter";
import { preferenceView } from "@/lib/email/engine";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Email preferences" };

export default async function PreferencesPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.trim() ?? "";
  const view = token ? await preferenceView(token).catch(() => null) : null;
  return (
    <main id="main-content" className="inner-page">
      <header className="page-intro preference-intro editorial-width">
        <p className="eyebrow">KAPO</p>
        <h1>Make your inbox yours.</h1>
        <p>Choose the kinds of updates you'd like to receive.</p>
      </header>
      <section className="editorial-width preference-panel">
        <PreferenceCenter token={token} status={view?.status ?? null} preferences={view?.preferences ?? null} />
      </section>
    </main>
  );
}
