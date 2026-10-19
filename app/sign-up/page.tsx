import { ClubSignIn } from "@/components/ClubSignIn";
import { authSettings } from "@/lib/auth/server";
import { pageMetadata } from "@/lib/page-meta";
export const metadata = pageMetadata(
  "Join KAPO Club",
  "A home for your KAPO collection.",
  "/sign-up",
  false,
);
export default function SignUpPage() {
  return (
    <ClubSignIn
      configured={Boolean(authSettings().publishableKey)}
      signup
      returnTo="/account"
    />
  );
}
