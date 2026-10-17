import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  (await cookies()).delete("kapo-account");
  return NextResponse.redirect(new URL("/account", request.url), 303);
}
