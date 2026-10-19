import { clubIdentity, clubError, ClubHttpError } from "@/lib/club/http";
import { clubStore, redemptionEnabled } from "@/lib/club/server";
import { readJson } from "@/lib/commerce/http";
import { listCustomerOrders } from "@/lib/commerce/store";
import { shopProducts } from "@/lib/catalog";
import { subscribeEmail, unsubscribeToken } from "@/lib/email/newsletter";
import { savePreferenceSelection } from "@/lib/email/engine";
import { parsePreferences } from "@/lib/email/topics";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await clubIdentity(request);
    const store = clubStore();
    await store.ensureProfile(user);
    await store.releaseUnused(user.userId);
    const [data, orders, subscriber] = await Promise.all([
      store.snapshot(user),
      listCustomerOrders(user),
      store
        .statement(
          "SELECT status,preferences_json FROM subscribers WHERE email=?",
          user.email,
        )
        .first<{ status: string; preferences_json: string | null }>(),
    ]);
    return Response.json(
      {
        ...data,
        orders,
        newsletter: {
          status: subscriber?.status ?? "none",
          preferences: parsePreferences(subscriber?.preferences_json),
        },
        redemptionEnabled: redemptionEnabled(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return clubError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await clubIdentity(request, true);
    const body = (await readJson(request)) as Record<string, unknown>;
    const store = clubStore();
    await store.ensureProfile(user);
    switch (body.action) {
      case "profile":
        await store.saveProfile(
          user.userId,
          String(body.name ?? ""),
          body.orderEmails !== false,
        );
        break;
      case "wishlist": {
        const productId = String(body.productId ?? "");
        if (
          !shopProducts.some(
            (p) => p.id === productId && p.category !== "macropads",
          )
        )
          throw new ClubHttpError("Choose an existing character and style.");
        await store.wishlist(user.userId, productId, body.saved === true);
        break;
      }
      case "claim_orders": {
        const claimed = await store.claimGuestOrders(user);
        return Response.json({ ok: true, claimed });
      }
      case "redeem": {
        if (!redemptionEnabled())
          throw new ClubHttpError("Reward redemption is not open yet.", 409);
        return Response.json({
          ok: true,
          redemption: await store.reserve(
            user.userId,
            Number(body.points),
            String(body.requestId ?? ""),
          ),
        });
      }
      case "cancel_reward":
        await store.cancelUnbound(user.userId, String(body.id ?? ""));
        break;
      case "newsletter": {
        if (body.subscribe === true) {
          const result = await subscribeEmail({
            email: user.email,
            consent: body.consent === true,
            source: "kapo-club",
          });
          if (!result.ok) throw new ClubHttpError(result.message);
        } else {
          const row = await store
            .statement(
              "SELECT unsubscribe_token FROM subscribers WHERE email=?",
              user.email,
            )
            .first<{ unsubscribe_token: string }>();
          if (row) await unsubscribeToken(row.unsubscribe_token);
        }
        break;
      }
      case "preferences": {
        const row = await store
          .statement(
            "SELECT unsubscribe_token FROM subscribers WHERE email=?",
            user.email,
          )
          .first<{ unsubscribe_token: string }>();
        if (!row)
          throw new ClubHttpError(
            "Subscribe and confirm your newsletter email first.",
          );
        const result = await savePreferenceSelection(
          row.unsubscribe_token,
          body,
        );
        if (!result.ok) throw new ClubHttpError(result.message);
        break;
      }
      default:
        throw new ClubHttpError("Unknown Club action.");
    }
    return Response.json({ ok: true });
  } catch (error) {
    return clubError(error);
  }
}
