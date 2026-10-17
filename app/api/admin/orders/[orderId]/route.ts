import { getAdminUser } from "@/app/admin-auth";
import { jsonError, readJson } from "@/lib/commerce/http";
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
        return Response.json(await purchaseLabel(orderId, body.rateId ?? "", admin.email, body.confirmed === true));
      case "clear_label_attempt":
        return Response.json(await clearLabelAttempt(orderId, body.confirmed === true));
      case "mark_shipped":
        return Response.json(await markShipped(orderId, admin.email));
      case "void_label":
        return Response.json(await voidLabel(orderId, admin.email));
      case "refund":
        return Response.json(await refundOrder(orderId, admin.email, body.amountCents));
      default:
        return Response.json({ message: "Unknown admin action." }, { status: 400 });
    }
  } catch (error) {
    return jsonError(error);
  }
}
