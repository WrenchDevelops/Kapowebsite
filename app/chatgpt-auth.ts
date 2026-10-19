import { redirect } from "next/navigation";
import { currentShopUser } from "@/lib/auth/server";
import { safeAccountReturn, type VerifiedIdentity } from "@/lib/auth/policy";
// Compatibility names; identity now comes exclusively from verified Clerk sessions.
export type ChatGPTUser = VerifiedIdentity;
export const getChatGPTUser = currentShopUser;
export const getShopUser = currentShopUser;
export async function requireChatGPTUser(returnTo: string) {
  const user = await currentShopUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo: string) { return `/sign-in?return_to=${encodeURIComponent(safeAccountReturn(returnTo))}`; }
export function chatGPTSignOutPath() { return "/account"; }
