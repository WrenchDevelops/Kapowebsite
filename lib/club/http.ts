import { authenticateShopRequest, requireSameOrigin } from "../auth/server.ts";
import { clubEnabled } from "./server.ts";
import { ClubRuleError } from "./policy.ts";
export async function clubIdentity(request: Request, mutation = false) {
  if (mutation) {
    try {
      requireSameOrigin(request);
    } catch {
      throw new ClubHttpError("Invalid request origin.", 403);
    }
  }
  const user = await authenticateShopRequest(request);
  if (!user)
    throw new ClubHttpError("Verify your email and sign in to KAPO Club.", 401);
  if (!clubEnabled())
    throw new ClubHttpError(
      "KAPO Club is getting ready. Your account is secure; Club features will open after verification.",
      503,
    );
  return user;
}
export class ClubHttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function clubError(error: unknown) {
  if (error instanceof ClubHttpError)
    return Response.json({ message: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (/insufficient_points/.test(message))
    return Response.json(
      { message: "You do not have enough available points." },
      { status: 409 },
    );
  if (error instanceof ClubRuleError)
    return Response.json({ message: error.message }, { status: 400 });
  if (/D1|no such table|SQLITE|constraint|database|UNIQUE/i.test(message))
    return Response.json(
      {
        message:
          "KAPO Club could not save this change. Please try again, or contact support.",
      },
      { status: 503 },
    );
  return Response.json(
    { message: "That Club request could not be completed. Please try again." },
    { status: 500 },
  );
}
