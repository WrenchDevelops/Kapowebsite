import Link from "next/link";
import { getAdminUser, chatGPTSignInPath } from "@/app/admin-auth";
import { clubStore, clubEnabled } from "@/lib/club/server";
import { AdminRewardAdjustment } from "@/components/AdminRewardAdjustment";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "KAPO Club rewards",
  robots: { index: false, follow: false },
};
export default async function AdminRewards({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin)
    return (
      <main id="main-content" className="admin-login">
        <h1>Verified administrators only.</h1>
        <Link href={chatGPTSignInPath("/admin/rewards")}>Sign in securely</Link>
      </main>
    );
  if (!clubEnabled())
    return (
      <main id="main-content" className="club-content">
        <h1>KAPO Club is disabled.</h1>
        <p>
          Complete staging verification and migrations before enabling
          membership.
        </p>
      </main>
    );
  const query = ((await searchParams).q ?? "").trim().slice(0, 120);
  let people: { id: string; email: string; name: string; balance: number }[] =
    [];
  let history: {
    delta: number;
    note: string;
    actor: string;
    created_at: string;
    kind: string;
  }[] = [];
  let error = false;
  try {
    const store = clubStore();
    people = (
      await store
        .statement(
          "SELECT p.id,p.name,p.email,w.balance FROM club_profiles p JOIN club_wallets w ON w.user_id=p.id WHERE (?='' OR p.email=? OR p.id=?) ORDER BY p.joined_at DESC LIMIT 30",
          query,
          query.toLowerCase(),
          query,
        )
        .all<(typeof people)[number]>()
    ).results;
    if (people.length === 1)
      history = (
        await store
          .statement(
            "SELECT delta,note,actor,created_at,kind FROM club_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
            people[0].id,
          )
          .all<(typeof history)[number]>()
      ).results;
  } catch {
    error = true;
  }
  return (
    <main id="main-content" className="club-content">
      <div className="club-section-title">
        <p className="eyebrow">KAPO CLUB / ADMIN</p>
        <h1>Every point has a story.</h1>
        <p>
          Find a verified customer to inspect their ledger and record a reasoned
          adjustment.
        </p>
      </div>
      <form className="club-settings-card">
        <label>
          Exact customer email or account ID
          <input name="q" defaultValue={query} maxLength={120} />
        </label>
        <button className="club-primary">Find member</button>
      </form>
      {error ? (
        <p role="alert">
          The Club database is unavailable. No balance can be changed.
        </p>
      ) : (
        <ul className="club-ledger">
          {people.map((p) => (
            <li key={p.id}>
              <div>
                <Link href={`/admin/rewards?q=${encodeURIComponent(p.id)}`}>
                  {p.name}
                </Link>
                <small>{p.email}</small>
              </div>
              <b>{p.balance} pts</b>
            </li>
          ))}
        </ul>
      )}
      {people.length === 1 && (
        <>
          <section className="club-section">
            <h2>Points history</h2>
            <ul className="club-ledger">
              {history.map((entry, index) => (
                <li key={index}>
                  <div>
                    <strong>{entry.note}</strong>
                    <small>
                      {entry.created_at} · {entry.actor} · {entry.kind}
                    </small>
                  </div>
                  <b>
                    {entry.delta > 0 ? "+" : ""}
                    {entry.delta} pts
                  </b>
                </li>
              ))}
            </ul>
          </section>
          <AdminRewardAdjustment userId={people[0].id} />
        </>
      )}
    </main>
  );
}
