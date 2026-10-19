export const dynamic = "force-dynamic";
export async function POST() {
  return Response.json({ message: "Verify your email with KAPO Club to sign in.", signInUrl: "/sign-in" }, { status: 410 });
}
