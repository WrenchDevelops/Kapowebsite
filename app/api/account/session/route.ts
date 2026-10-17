import { cookies } from "next/headers";
import { accountCookieOptions, sealLocalUser } from "@/lib/commerce/local-session";
import { readJson } from "@/lib/commerce/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request) as { name?: string; email?: string };
  const sealed = await sealLocalUser({ name: body.name ?? "", email: body.email ?? "" });
  if (!sealed) {
    return Response.json({ message: "Enter your name and a valid email." }, { status: 400 });
  }
  const secure = new URL(request.url).protocol === "https:";
  (await cookies()).set("kapo-account", sealed.token, accountCookieOptions(secure));
  return Response.json({ email: sealed.user.email, name: sealed.user.displayName });
}
