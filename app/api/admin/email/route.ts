import { requireSameOrigin } from "@/lib/auth/server";
import { getAdminUser } from "@/app/admin-auth";
import { retryFailedEmail } from "@/lib/commerce/store";
import { saveCampaign, sendCampaign, sendDueCampaigns, setSupportResolution } from "@/lib/email/newsletter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch { return Response.json({ message: "Invalid request origin." }, { status: 403 }); }
  const admin = await getAdminUser();
  if (!admin) return Response.json({ message: "Admin access is required." }, { status: 403 });
  const body = await request.json() as {
    action?: string;
    notificationId?: string;
    id?: string;
    subject?: string;
    preheader?: string;
    body?: string;
    scheduledAt?: string;
    resolution?: string;
  };
  switch (body.action) {
    case "retry": {
      const result = await retryFailedEmail(String(body.notificationId ?? ""));
      return Response.json(result);
    }
    case "save_campaign": {
      const saved = await saveCampaign({
        id: body.id,
        subject: String(body.subject ?? ""),
        preheader: String(body.preheader ?? ""),
        body: String(body.body ?? ""),
        scheduledAt: body.scheduledAt,
      });
      return Response.json(saved, { status: saved.ok ? 200 : 400 });
    }
    case "send_campaign": {
      const result = await sendCampaign(String(body.id ?? ""));
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }
    case "send_due": {
      const sent = await sendDueCampaigns();
      return Response.json({ sent });
    }
    case "support": {
      const resolution = body.resolution === "resolved" ? "resolved" : "open";
      await setSupportResolution(String(body.id ?? ""), resolution);
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ message: "Unknown action." }, { status: 400 });
  }
}
