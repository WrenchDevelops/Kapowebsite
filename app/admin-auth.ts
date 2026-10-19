import { chatGPTSignInPath, getShopUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/commerce/authz";
import { commerceEnv } from "@/lib/commerce/env";
export { chatGPTSignInPath };
export async function getAdminUser() {
  const user = await getShopUser();
  return user && isAdminEmail(user.email, commerceEnv().adminEmails) ? user : null;
}
