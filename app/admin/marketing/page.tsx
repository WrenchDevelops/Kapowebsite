import Link from "next/link";
import { chatGPTSignInPath, getAdminUser } from "@/app/admin-auth";
import { EmailPost } from "@/components/EmailPost";
import { shopProducts } from "@/lib/catalog";
import { commerceEnv } from "@/lib/commerce/env";
import { publicSiteUrl } from "@/lib/email/addresses";
import { readAnnouncement, renderAnnouncementEmail } from "@/lib/email/announcement";
import { marketingOverview } from "@/lib/email/engine";
import { marketingLinks } from "@/lib/email/marketing";
import { AUTOMATIONS } from "@/lib/email/topics";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Newsletter" };

const MODES = [
  ["draft", "Prepare draft — requires my approval"],
  ["digest", "Add to weekly digest"],
  ["auto", "Send automatically"],
] as const;

export default async function MarketingPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <main id="main-content" className="admin-login">
        <header className="page-intro editorial-width">
          <p className="eyebrow">Newsletter</p>
          <h1>Admins only.</h1>
          <Link className="button button-dark" href={chatGPTSignInPath("/admin/marketing")}>Sign in</Link>
        </header>
      </main>
    );
  }

  const data = await marketingOverview().catch(() => null);
  const origin = publicSiteUrl(commerceEnv().publicSiteUrl);
  return (
    <main id="main-content" className="inner-page email-admin">
      <header className="page-intro editorial-width">
        <p className="eyebrow">Marketing</p>
        <h1>Newsletter.</h1>
        <p>Launches and promotions wait for your approval. YouTube, Instagram, and studio notes collect into one weekly email. <Link href="/admin">Orders</Link> · <Link href="/admin/email">Transactional email</Link></p>
      </header>
      {!data && <p className="editorial-width">Newsletter data is unavailable. Check the database connection.</p>}
      {data && (
        <div className="editorial-width email-admin-stack">
          <section id="overview">
            <h2>Overview</h2>
            <dl className="admin-facts">
              <div><dt>Confirmed</dt><dd>{data.subscribers.confirmed}</dd></div>
              <div><dt>Pending</dt><dd>{data.subscribers.pending}</dd></div>
              <div><dt>Unsubscribed</dt><dd>{data.subscribers.unsubscribed}</dd></div>
              <div><dt>Weekly digest</dt><dd>{data.subscribers.weekly}</dd></div>
              <div><dt>Every post</dt><dd>{data.subscribers.immediate}</dd></div>
              <div><dt>Delivered</dt><dd>{data.delivered}</dd></div>
              <div><dt>Opened</dt><dd>{data.opened}</dd></div>
              <div><dt>Clicked</dt><dd>{data.clicked}</dd></div>
              <div><dt>Bounced</dt><dd>{data.bounced}</dd></div>
              <div><dt>Complaints</dt><dd>{data.complaints}</dd></div>
            </dl>
            <p>Opens, clicks, bounces, and complaints come from Resend webhooks. KAPO does not invent them.</p>
            <p>{data.mailingAddressConfigured ? "Mailing address is set." : "Set KAPO_MAILING_ADDRESS before a campaign can send."}</p>
            <p>{data.topicsConfigured ? "Resend topic ids are set, so a full-topic announcement can send as a broadcast." : "Topic ids are not set. Matching subscribers get their own email, with a personal preferences link. Set KAPO_RESEND_TOPIC_PRODUCTS and the other topic ids to use broadcasts."}</p>
            <p>Routine marketing stops at two emails in seven days. A product launch does not count. People who chose every announcement can receive social posts as they go up.</p>
            <p>Buying a product or leaving an email in support does not subscribe anyone.</p>
          </section>

          <section id="automations">
            <h2>Automations</h2>
            <p>Publishing a product creates one launch draft, and only after it is actually for sale. Editing the description or saving it again does not send another email. A price cut is announced only when it is at least 10%. A price increase is never a promotion.</p>
            <EmailPost action="save_automations" label="Save automations" endpoint="/api/admin/marketing">
              {AUTOMATIONS.map((item) => (
                <label key={item.id}>
                  {item.label}
                  <select name={item.id} defaultValue={data.automations[item.id]}>
                    {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <span>Suggested: {item.suggestion}</span>
                </label>
              ))}
            </EmailPost>
            <EmailPost action="reset_automations" label="Use suggested settings" endpoint="/api/admin/marketing" confirm="Replace the automation settings with the suggested launch setup?" />
          </section>

          <section id="announce">
            <h2>Add an announcement</h2>
            <p>Instagram stays manual until a Meta professional account is connected. YouTube can subscribe itself when the channel id is set, and you can also paste a video.</p>
            <p>{data.youtubeConfigured ? "YouTube channel id is set." : "KAPO_YOUTUBE_CHANNEL_ID is not set."}</p>
            <EmailPost action="youtube_subscribe" label="Connect YouTube notifications" endpoint="/api/admin/marketing" />
            <EmailPost action="announce" label="Create announcement" endpoint="/api/admin/marketing">
              <label>Kind
                <select name="kind" defaultValue="product_published">
                  <option value="product_published">New product</option>
                  <option value="product_restocked">Restock</option>
                  <option value="promotion">Promotion</option>
                  <option value="youtube">YouTube video or Short</option>
                  <option value="instagram">Instagram post or Reel</option>
                  <option value="news">KAPO news</option>
                </select>
              </label>
              <label>Product
                <select name="productId" defaultValue={shopProducts[0]?.id ?? ""}>
                  {shopProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.name} · {product.style}</option>
                  ))}
                </select>
              </label>
              <label>Title<input name="title" maxLength={140} /></label>
              <label>Description<textarea name="summary" rows={4} /></label>
              <label>Link<input name="url" placeholder="https:// or /shop" /></label>
              <label>Image<input name="image" placeholder="/products/spore-artisan.png" /></label>
              <label>Price or code<input name="priceLabel" maxLength={40} /></label>
              <label>Delivery
                <select name="delivery" defaultValue="default">
                  <option value="default">Follow automation settings</option>
                  <option value="draft">Special announcement — approval draft</option>
                  <option value="digest">Add to weekly digest</option>
                </select>
              </label>
            </EmailPost>
            <h3>Waiting for the digest</h3>
            <ul className="email-admin-list">
              {data.queued.map((event) => (
                <li key={event.id}>
                  <strong>{event.title}</strong>
                  <span>{event.kind}</span>
                  <span>{event.createdAt}</span>
                </li>
              ))}
              {data.queued.length === 0 && <li>Nothing is queued.</li>}
            </ul>
            <EmailPost action="run_digest" label="Prepare this week's digest" endpoint="/api/admin/marketing" confirm="Build the weekly digest from everything queued?" />
          </section>

          <section id="builder">
            <h2>Campaign builder</h2>
            <p>Save a campaign draft, review it, then approve it for delivery to the selected subscribers.</p>
            <EmailPost action="save_announcement" label="Save draft" endpoint="/api/admin/marketing">
              <label>Kind
                <select name="kind" defaultValue="news">
                  <option value="product_published">Product</option>
                  <option value="promotion">Promotion</option>
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="news">KAPO news</option>
                </select>
              </label>
              <label>Subject<input name="subject" required maxLength={140} /></label>
              <label>Preheader<input name="preheader" maxLength={180} /></label>
              <label>Edition line<input name="kicker" placeholder="NEW FROM KAPO" maxLength={40} /></label>
              <label>Headline<input name="headline" required maxLength={140} /></label>
              <label>Intro<textarea name="intro" rows={3} /></label>
              <label>Block title<input name="blockTitle" /></label>
              <label>Block text<textarea name="blockBody" required rows={4} /></label>
              <label>Block image<input name="blockImage" placeholder="/products/spore-artisan.png" /></label>
              <label>Button<input name="blockCta" placeholder="Shop Now" /></label>
              <label>Button link<input name="blockUrl" placeholder="/shop" /></label>
              <label>Price<input name="blockPrice" /></label>
            </EmailPost>
          </section>

          <section id="history">
            <h2>Campaign history</h2>
            <ul className="email-admin-list">
              {data.campaigns.map((campaign) => {
                const html = previewHtml(campaign.blocksJson, origin);
                return (
                  <li key={campaign.id}>
                    <strong>{campaign.subject}</strong>
                    <span>{campaign.status} · {campaign.kind} · {campaign.audience}</span>
                    {campaign.sentAt ? <span>Sent {campaign.sentAt}</span> : null}
                    {campaign.skippedCount > 0 ? <span>{campaign.skippedCount} held by the weekly cap</span> : null}
                    {campaign.resendBroadcastId ? <span>Broadcast {campaign.resendBroadcastId}</span> : null}
                    {html ? (
                      <details>
                        <summary>Preview</summary>
                        <iframe title={`${campaign.subject} preview`} sandbox="" srcDoc={html} />
                      </details>
                    ) : (
                      <details>
                        <summary>Preview</summary>
                        <pre>{campaign.bodyText}</pre>
                      </details>
                    )}
                    {campaign.status !== "sent" && campaign.status !== "sending" && <EmailPost action="send_campaign" label="Approve & send" endpoint="/api/admin/marketing" fields={{ id: campaign.id }} confirm="Send this announcement to subscribers who opted into it?" />}
                  </li>
                );
              })}
              {data.campaigns.length === 0 && <li>No campaigns yet.</li>}
            </ul>
          </section>

          <section id="subscribers">
            <h2>Subscribers</h2>
            <p>Products {data.topics.products} · Deals {data.topics.deals} · YouTube {data.topics.youtube} · Instagram {data.topics.instagram} · News {data.topics.news}</p>
            <ul className="email-admin-list">
              {data.people.map((person) => (
                <li key={person.id}>
                  <strong>{person.email}</strong>
                  <span>{person.status} · {person.preferences.frequency} · {person.source}</span>
                  <span>{topicSummary(person.preferences)}</span>
                </li>
              ))}
              {data.people.length === 0 && <li>No subscribers yet.</li>}
            </ul>
          </section>

        </div>
      )}
    </main>
  );
}

function previewHtml(blocksJson: string | null, origin: string) {
  const content = readAnnouncement(blocksJson);
  if (!content) return "";
  return renderAnnouncementEmail(content, previewLinks(origin)).html;
}

function previewLinks(origin: string) {
  const links = marketingLinks(origin, "preview");
  return {
    unsubscribeUrl: links.unsubscribeUrl,
    preferencesUrl: links.preferencesUrl,
    mailingAddress: commerceEnv().mailingAddress || "KAPO mailing address",
    shopUrl: links.shopUrl,
  };
}

function topicSummary(preferences: { products: boolean; deals: boolean; youtube: boolean; instagram: boolean; news: boolean }) {
  return [
    preferences.products ? "products" : "",
    preferences.deals ? "deals" : "",
    preferences.youtube ? "youtube" : "",
    preferences.instagram ? "instagram" : "",
    preferences.news ? "news" : "",
  ].filter(Boolean).join(", ") || "no topics";
}
