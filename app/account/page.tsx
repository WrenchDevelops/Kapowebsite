import { ClubAccount } from "@/components/ClubAccount";
import { authSettings } from "@/lib/auth/server";
import { pageMetadata } from "@/lib/page-meta";
export const metadata = pageMetadata(
  "KAPO Club",
  "Your collection, orders, wishlist and rewards. A little more character for your everyday.",
  "/account",
  false,
);
export const dynamic = "force-dynamic";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; preview?: string }>;
}) {
  const params = await searchParams;
  return (
    <ClubAccount
      configured={Boolean(authSettings().publishableKey)}
      preview={process.env.NODE_ENV !== "production" && params.preview === "1"}
      initialView={params.view}
    />
  );
}
