import Link from "next/link";
import { headers } from "next/headers";
import { chatGPTSignInPath, getAdminUser } from "@/app/admin-auth";
import { EmailPost } from "@/components/EmailPost";
import { renderEmail, templateOrder } from "@/lib/commerce/email-template";
import { EMAIL_TEMPLATES } from "@/lib/commerce/status";
import { renderBackInStockEmail, renderLaunchEmail, renderSignInEmail, renderSupportAck } from "@/lib/email/messages";
import { renderMarketingEmail } from "@/lib/email/marketing";
import { emailOverview } from "@/lib/email/newsletter";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Email" };

const VIEWS = ["activity", "campaigns", "templates", "support"] as const;
type View = (typeof VIEWS)[number];

const TEMPLATE_LABELS: Record<string, string> = {
  payment_confirmation: "Payment received",
  order_confirmation: "Order confirmation",
  production_started: "Preparing order",
  order_ready_to_ship: "Packed",
  shipment_confirmation: "Shipped",
  out_for_delivery: "Out for delivery",
  tracking_update: "Tracking update",
  delivery_exception: "Delivery problem",
  returned_shipment: "Returned shipment",
  delivery_confirmation: "Delivered",
  refund_confirmation: "Refund",
  payment_failed: "Payment failed",
  order_canceled: "Canceled",
};

const TEMPLATE_NOTES: Record<string, string> = {
  payment_confirmation: "Spore",
  order_confirmation: "Spore",
  production_started: "Gloop",
  order_ready_to_ship: "Gloop",
  shipment_confirmation: "Orbit",
  out_for_delivery: "Brine",
  tracking_update: "Text only",
  delivery_exception: "Text only",
  returned_shipment: "Text only",
  delivery_confirmation: "Rango",
  refund_confirmation: "Text only",
  payment_failed: "Text only",
  order_canceled: "Text only",
};

const BRAND_MESSAGES = [
  { id: "welcome", label: "Welcome", note: "Kobi" },
  { id: "confirm", label: "Newsletter confirm", note: "Kobi" },
  { id: "launch", label: "Character launch", note: "Kobi and Orbit" },
  { id: "stock", label: "Back in stock", note: "Spore" },
  { id: "signin", label: "Sign-in code", note: "Bitz" },
  { id: "support-ack", label: "Support received", note: "Rivet" },
] as const;

type BrandId = (typeof BRAND_MESSAGES)[number]["id"];

const VIEW_LABELS: Record<View, string> = {
  activity: "Activity",
  campaigns: "Campaigns",
  templates: "Templates",
  support: "Support",
};

export default async function EmailAdminPage({ searchParams }: { searchParams: Promise<{ view?: string; id?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <main id="main-content" className="admin-login">
        <header className="page-intro editorial-width">
          <p className="eyebrow">Email</p>
          <h1>Admins only.</h1>
          <Link className="button button-dark" href={chatGPTSignInPath("/admin/email")}>Sign in</Link>
        </header>
      </main>
    );
  }

  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "templates";
  const data = await loadEmail();
  const origin = await previewOrigin();
  const templateData = templateOrder(origin);

  return (
    <main id="main-content" className="admin-email">
      <details className="email-health"><summary>Delivery & subscriber health</summary>
        {data && (
          <dl className="admin-stats">
            <div className="admin-stats-title"><dt>Mail</dt><dd /></div>
            <div><dt>Sent</dt><dd>{data.sent}</dd></div>
            <div><dt>Delivered</dt><dd>{data.delivered}</dd></div>
            <div><dt>Bounced</dt><dd>{data.bounced}</dd></div>
            <div><dt>Complaints</dt><dd>{data.complaints}</dd></div>
            <div><dt>Failed</dt><dd>{data.failed}</dd></div>
            <div className="admin-stats-title"><dt>List</dt><dd /></div>
            <div><dt>Confirmed</dt><dd>{data.subscribers.confirmed}</dd></div>
            <div><dt>Waiting</dt><dd>{data.subscribers.pending}</dd></div>
            <div><dt>Unsubscribed</dt><dd>{data.subscribers.unsubscribed}</dd></div>
          </dl>
        )}
        <p className="email-side-note">
          {data?.webhookConfigured ? "Delivery counts come from the Resend webhook." : "Set RESEND_WEBHOOK_SECRET to update delivered, bounced, and complaint counts."}
          {data?.mailingAddressConfigured ? "" : " Set KAPO_MAILING_ADDRESS before a campaign can send."}
        </p>
      </details>

      {!data && <section className="admin-pane"><p className="admin-empty">Email data is unavailable. Check the database connection.</p></section>}
      {data && (
        <>
          <section className="admin-list" aria-label={VIEW_LABELS[view]}>
            <header>
              <h2>{VIEW_LABELS[view]}</h2>
              <nav>
                {VIEWS.map((item) => (
                  <Link key={item} className={item === view ? "is-current" : ""} href={emailHref(item)}>{VIEW_LABELS[item]}</Link>
                ))}
              </nav>
            </header>
            {view === "activity" && <ActivityList rows={data.recent} selectedId={query.id} />}
            {view === "campaigns" && <CampaignList campaigns={data.campaigns} selectedId={query.id} />}
            {view === "templates" && <TemplateList selectedId={query.id} />}
            {view === "support" && <SupportList requests={data.requests} selectedId={query.id} />}
          </section>
          <section className="admin-pane email-stage-pane">
            {view === "activity" && <ActivityDetail rows={data.recent} selectedId={query.id} />}
            {view === "campaigns" && <CampaignDetail campaigns={data.campaigns} selectedId={query.id} audienceConfigured={data.audienceConfigured} />}
            {view === "templates" && <TemplateDetail selectedId={query.id} origin={origin} data={templateData} />}
            {view === "support" && <SupportDetail requests={data.requests} selectedId={query.id} />}
          </section>
        </>
      )}
    </main>
  );
}

function ActivityList({ rows, selectedId }: { rows: ActivityRow[]; selectedId?: string }) {
  const selected = rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id;
  if (!rows.length) return <p className="admin-empty">No order emails yet.</p>;
  return rows.map((row) => (
    <Link key={row.id} className={row.id === selected ? "email-pick is-selected" : "email-pick"} href={emailHref("activity", row.id)}>
      <strong>{TEMPLATE_LABELS[row.template] ?? row.template}</strong>
      <small>{row.toEmail}</small>
      <small>{formatWhen(row.createdAt)}</small>
    </Link>
  ));
}

function ActivityDetail({ rows, selectedId }: { rows: ActivityRow[]; selectedId?: string }) {
  const row = rows.find((item) => item.id === selectedId) ?? rows[0];
  if (!row) return <p className="admin-empty">No order emails yet.</p>;
  return (
    <>
      <header className="email-stage-head">
        <div>
          <h2>{TEMPLATE_LABELS[row.template] ?? row.template}</h2>
          <p>{row.toEmail}</p>
        </div>
        <em className={row.status === "failed" || row.status === "queued" ? "email-status is-bad" : "email-status"}>{labelize(row.status)}</em>
      </header>
      <div className="email-stage-body">
        <dl className="email-facts">
          <div><dt>Subject</dt><dd>{row.subject}</dd></div>
          <div><dt>Sent</dt><dd>{formatWhen(row.createdAt)}</dd></div>
          {row.error ? <div><dt>Error</dt><dd>{row.error}</dd></div> : null}
        </dl>
        {(row.status === "failed" || row.status === "queued") && (
          <EmailPost compact action="retry" label="Retry" fields={{ notificationId: row.id }} />
        )}
      </div>
    </>
  );
}

function CampaignList({ campaigns, selectedId }: { campaigns: CampaignRow[]; selectedId?: string }) {
  const selected = selectedId === "new" || campaigns.some((campaign) => campaign.id === selectedId) ? selectedId : "new";
  return (
    <>
      <Link className={selected === "new" ? "email-pick is-selected" : "email-pick"} href={emailHref("campaigns", "new")}>
        <strong>New campaign</strong>
        <small>Write a message for confirmed subscribers</small>
      </Link>
      {campaigns.map((campaign) => (
        <Link key={campaign.id} className={campaign.id === selected ? "email-pick is-selected" : "email-pick"} href={emailHref("campaigns", campaign.id)}>
          <strong>{campaign.subject}</strong>
          <small>{labelize(campaign.status)}{campaign.scheduledAt ? ` · ${formatWhen(campaign.scheduledAt)}` : ""}</small>
        </Link>
      ))}
    </>
  );
}

function CampaignDetail({ campaigns, selectedId, audienceConfigured }: { campaigns: CampaignRow[]; selectedId?: string; audienceConfigured: boolean }) {
  const campaign = campaigns.find((item) => item.id === selectedId);
  if (!campaign || selectedId === "new") {
    return (
      <>
        <header className="email-stage-head">
          <div>
            <h2>New campaign</h2>
            <p>{audienceConfigured ? "This sends as a Resend broadcast." : "This sends one email to each confirmed subscriber."}</p>
          </div>
        </header>
        <div className="email-stage-body">
          <CampaignForm />
          <div className="email-actions">
            <EmailPost compact action="send_due" label="Send scheduled campaigns" />
          </div>
        </div>
      </>
    );
  }
  const locked = campaign.status === "sent" || campaign.status === "sending";
  return (
    <>
      <header className="email-stage-head">
        <div>
          <h2>{campaign.subject}</h2>
          <p>{campaign.preheader || "No preheader"}</p>
        </div>
        <em className="email-status">{labelize(campaign.status)}</em>
      </header>
      <div className="email-stage-body">
        {locked ? <p className="email-copy">{campaign.bodyText}</p> : (
          <CampaignForm campaign={campaign} />
        )}
        {campaign.resendBroadcastId ? <p className="email-side-note">Broadcast {campaign.resendBroadcastId}</p> : null}
        {!locked && (
          <div className="email-actions">
            <EmailPost compact action="send_campaign" label="Send to subscribers" fields={{ id: campaign.id }} confirm="Send this campaign to every confirmed subscriber?" />
          </div>
        )}
      </div>
    </>
  );
}

function CampaignForm({ campaign }: { campaign?: CampaignRow }) {
  return (
    <div className="email-composer">
      <EmailPost action="save_campaign" label={campaign ? "Save changes" : "Save campaign"} fields={campaign ? { id: campaign.id } : {}}>
        <div className="email-fields">
          <label>Subject<input name="subject" required maxLength={140} defaultValue={campaign?.subject ?? ""} /></label>
          <label>Preheader<input name="preheader" maxLength={180} defaultValue={campaign?.preheader ?? ""} /></label>
          <label>Message<textarea name="body" required rows={8} defaultValue={campaign?.bodyText ?? ""} placeholder="Write in paragraphs. A blank line starts a new paragraph." /></label>
          <label>Schedule<input name="scheduledAt" type="datetime-local" defaultValue={localDateTime(campaign?.scheduledAt)} /></label>
        </div>
      </EmailPost>
    </div>
  );
}

function TemplateList({ selectedId }: { selectedId?: string }) {
  const known = (EMAIL_TEMPLATES as readonly string[]).includes(selectedId ?? "") || BRAND_MESSAGES.some((item) => item.id === selectedId);
  const selected = known ? selectedId : "order_confirmation";
  return (
    <>
      <p className="email-group">Orders</p>
      {EMAIL_TEMPLATES.map((template) => (
        <Link key={template} className={template === selected ? "email-pick is-selected" : "email-pick"} href={emailHref("templates", template)}>
          <strong>{TEMPLATE_LABELS[template] ?? template}</strong>
          <small>{TEMPLATE_NOTES[template]}</small>
        </Link>
      ))}
      <p className="email-group">Brand</p>
      {BRAND_MESSAGES.map((item) => (
        <Link key={item.id} className={item.id === selected ? "email-pick is-selected" : "email-pick"} href={emailHref("templates", item.id)}>
          <strong>{item.label}</strong>
          <small>{item.note}</small>
        </Link>
      ))}
    </>
  );
}

function TemplateDetail({ selectedId, origin, data }: { selectedId?: string; origin: string; data: ReturnType<typeof templateOrder> }) {
  const brand = BRAND_MESSAGES.find((item) => item.id === selectedId);
  const template = EMAIL_TEMPLATES.find((item) => item === selectedId) ?? (brand ? null : "order_confirmation");
  const label = brand?.label ?? TEMPLATE_LABELS[template ?? ""] ?? "Email";
  const html = brand ? brandHtml(brand.id, origin) : renderEmail(template ?? "order_confirmation", { ...data, refundedCents: template === "refund_confirmation" ? data.totalCents : 0 }, "Carrier exception details.").html;
  return (
    <>
      <header className="email-stage-head">
        <div>
          <h2>{label}</h2>
          <p>{brand ? "Brand message template." : "Live transactional email template."}</p>
        </div>
      </header>
      <div className="email-canvas">
        <iframe title={`${label} preview`} sandbox="allow-same-origin" srcDoc={html} />
      </div>
    </>
  );
}

function SupportList({ requests, selectedId }: { requests: SupportRow[]; selectedId?: string }) {
  const selected = requests.some((request) => request.id === selectedId) ? selectedId : requests[0]?.id;
  if (!requests.length) return <p className="admin-empty">No support requests yet.</p>;
  return requests.map((request) => (
    <Link key={request.id} className={request.id === selected ? "email-pick is-selected" : "email-pick"} href={emailHref("support", request.id)}>
      <strong>{request.email}</strong>
      <small>{labelize(request.resolution)} · {formatWhen(request.createdAt)}</small>
    </Link>
  ));
}

function SupportDetail({ requests, selectedId }: { requests: SupportRow[]; selectedId?: string }) {
  const request = requests.find((item) => item.id === selectedId) ?? requests[0];
  if (!request) return <p className="admin-empty">No support requests yet.</p>;
  const transcript = readTranscript(request.transcriptJson);
  const resolved = request.resolution === "resolved";
  return (
    <>
      <header className="email-stage-head">
        <div>
          <h2>{request.email}</h2>
          <p>{formatWhen(request.createdAt)}</p>
        </div>
        <em className={resolved ? "email-status" : "email-status is-bad"}>{labelize(request.resolution)}</em>
      </header>
      <div className="email-stage-body">
        <p className="email-copy">{request.message}</p>
        {transcript.length > 0 && (
          <div className="email-transcript">
            {transcript.map((line, index) => <p key={index}><b>{line.role}</b>{line.content}</p>)}
          </div>
        )}
        <div className="email-actions">
          <a className="button" href={`mailto:${request.email}?subject=${encodeURIComponent("Re: KAPO support request")}`}>Reply</a>
          <EmailPost compact action="support" label={resolved ? "Mark open" : "Mark resolved"} fields={{ id: request.id, resolution: resolved ? "open" : "resolved" }} />
        </div>
      </div>
    </>
  );
}

function brandHtml(id: BrandId, origin: string) {
  const unsubscribeUrl = `${origin}/newsletter/unsubscribe?token=sample`;
  const preferencesUrl = `${origin}/newsletter/preferences?token=sample`;
  const mailingAddress = "KAPO, Philadelphia, PA";
  if (id === "welcome") {
    return renderMarketingEmail({
      subject: "Welcome to KAPO",
      headline: "You're on the list",
      eyebrow: "Welcome",
      preheader: "You're confirmed for KAPO news.",
      paragraphs: [
        "You're confirmed. Product launches and promotions go out when they happen. YouTube, Instagram, and studio notes wait for the weekly digest unless you ask for every post.",
        "Orders and support replies stay off this list. You can change this any time.",
      ],
      ctaLabel: "Choose what you get",
      ctaUrl: preferencesUrl,
      preferencesUrl,
      unsubscribeUrl,
      mailingAddress,
      logoUrl: `${origin}/kapo-wordmark.png`,
      character: "kobi",
      characterMode: "hero",
    }).html;
  }
  if (id === "confirm") {
    return renderMarketingEmail({
      subject: "Confirm your KAPO newsletter",
      headline: "Confirm your email",
      preheader: "Confirm that you want email from KAPO.",
      paragraphs: ["Confirm your email to receive KAPO news about new characters, collections, and the shop."],
      ctaLabel: "Confirm KAPO news",
      ctaUrl: `${origin}/newsletter/confirm?token=sample`,
      unsubscribeUrl,
      mailingAddress,
      logoUrl: `${origin}/kapo-wordmark.png`,
      character: "kobi",
      characterMode: "compact",
    }).html;
  }
  if (id === "launch") {
    return renderLaunchEmail({
      origin,
      character: "orbit",
      headline: "Meet the newest KAPO character",
      paragraphs: ["Orbit just landed in the shop. Same crew, new signal scout."],
      productUrl: `${origin}/characters/orbit`,
      unsubscribeUrl,
      mailingAddress,
    }).html;
  }
  if (id === "stock") {
    return renderBackInStockEmail({
      origin,
      character: "spore",
      productName: "Spore — Artisan Keycap",
      productUrl: `${origin}/characters/spore?style=artisan`,
      unsubscribeUrl,
      mailingAddress,
    }).html;
  }
  if (id === "signin") return renderSignInEmail({ origin, code: "482913", signInUrl: `${origin}/account`, expiresMinutes: 15 }).html;
  return renderSupportAck({ origin, email: "ada@example.com", message: "The keycap arrived cracked.", reference: "A1B2C3D4" }).html;
}

function emailHref(view: View, id?: string) {
  const params = new URLSearchParams({ view });
  if (id) params.set("id", id);
  return `/admin/email?${params.toString()}`;
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function readTranscript(value: string) {
  try {
    const parsed = JSON.parse(value) as { role?: string; content?: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((line) => ({ role: line.role === "assistant" ? "Kapo" : "Customer", content: String(line.content ?? "") }));
  } catch {
    return [];
  }
}

type ActivityRow = {
  id: string;
  template: string;
  toEmail: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type CampaignRow = {
  id: string;
  subject: string;
  preheader: string;
  bodyText: string;
  status: string;
  scheduledAt: string | null;
  resendBroadcastId: string | null;
};

type SupportRow = {
  id: string;
  email: string;
  message: string;
  transcriptJson: string;
  resolution: string;
  createdAt: string;
};

async function previewOrigin() {
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "").split(",")[0]?.trim();
  if (!host) return "https://shopkapo.com";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return safePreviewOrigin(`${proto}://${host}`);
}

function safePreviewOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
  } catch {
    return "https://shopkapo.com";
  }
  return "https://shopkapo.com";
}

async function loadEmail() {
  try {
    return await emailOverview();
  } catch {
    return null;
  }
}
