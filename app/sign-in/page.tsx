import { ClubSignIn } from "@/components/ClubSignIn";
import { authSettings } from "@/lib/auth/server";
import { safeAccountReturn } from "@/lib/auth/policy";
import { pageMetadata } from "@/lib/page-meta";
export const metadata = pageMetadata(
  "Sign in to KAPO Club",
  "Your collection, orders and rewards.",
  "/sign-in",
  false,
);
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  return (
    <ClubSignIn
      configured={Boolean(authSettings().publishableKey)}
      signup={false}
      returnTo={safeAccountReturn((await searchParams).return_to ?? "/account")}
    />
  );
}
