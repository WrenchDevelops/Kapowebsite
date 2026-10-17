import { chatGPTSignInPath, getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/commerce/authz";
import { commerceEnv } from "@/lib/commerce/env";

export { chatGPTSignInPath };

export async function getAdminUser(): Promise<ChatGPTUser | null> {
  const settings = commerceEnv();
  if (settings.adminDevBypass) {
    return {
      userId: "dev-admin",
      email: "dev-admin@localhost",
      displayName: "Local admin",
      fullName: "Local admin",
    };
  }
  const user = await getChatGPTUser();
  if (!user || !isAdminEmail(user.email, settings.adminEmails)) return null;
  return user;
}
