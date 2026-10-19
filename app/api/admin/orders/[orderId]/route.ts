import { requireSameOrigin } from "@/lib/auth/server";
import { getAdminUser } from "@/app/admin-auth";
import { jsonError, readJson } from "@/lib/commerce/http";
import { LABEL_PURCHASE_SOURCE } from "@/lib/commerce/label-guards";
import {
  clearLabelAttempt,
  markShipped,
  purchaseLabel,
  refundOrder,
  refreshLabelRates,
  updateProduction,
  voidLabel,
} from "@/lib/commerce/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try { requireSameOrigin(request); } catch { return Response.json({ message: "Invalid request origin." }, { status: 403 }); }
  const admin = await getAdminUser();
  if (!admin) return Response.json({ message: "Admin access is required." }, { status: 403 });
  const { orderId } = await context.params;
  try {
    const body = await readJson(request) as {
      action?: string;
      status?: string;
      rateId?: string;
      confirmed?: boolean;
      amountCents?: number;
      carrier?: string;
      serviceName?: string;
      orderNumber?: string;
      lengthIn?: number;
      widthIn?: number;
      heightIn?: number;
      weightOz?: number;
    };
    switch (body.action) {
      case "production":
        return Response.json(await updateProduction(orderId, body.status ?? "", admin.email));
      case "refresh_rates":
        return Response.json(await refreshLabelRates(orderId, body));
      case "purchase_label":
        return Response.json(await purchaseLabel(orderId, {
          rateId: body.rateId ?? "",
          confirmed: body.confirmed === true,
          amountCents: body.amountCents ?? Number.NaN,
          carrier: body.carrier ?? "",
          serviceName: body.serviceName ?? "",
        }, admin.email, LABEL_PURCHASE_SOURCE));
      case "clear_label_attempt":
        return Response.json(await clearLabelAttempt(orderId, {
          confirmed: body.confirmed === true,
          orderNumber: body.orderNumber ?? "",
        }, admin.email, LABEL_PURCHASE_SOURCE));
      case "mark_shipped":
        return Response.json(await markShipped(orderId, admin.email));
      case "void_label":
        return Response.json(await voidLabel(orderId, admin.email, LABEL_PURCHASE_SOURCE));
      case "refund":
        return Response.json(await refundOrder(orderId, admin.email, body.amountCents));
      default:
        return Response.json({ message: "Unknown admin action." }, { status: 400 });
    }
  } catch (error) {
    return jsonError(error);
  }
}
