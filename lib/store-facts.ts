export const SUPPORT_EMAIL = "support@shopkapo.com";
export const PRODUCTION_DAYS_MIN = 5;
export const PRODUCTION_DAYS_MAX = 10;
export const RETURN_WINDOW_DAYS = 14;

export const INSTAGRAM_URL = "https://www.instagram.com/shopkapokb/";
export const YOUTUBE_URL = "https://www.youtube.com/@kapokeycaps";

export const SOCIAL_LINKS = [
  { id: "instagram", label: "Instagram", href: INSTAGRAM_URL, icon: "/social/instagram.png" },
  { id: "youtube", label: "YouTube", href: YOUTUBE_URL, icon: "/social/youtube.png" },
] as const;

export function socialPlainText() {
  return SOCIAL_LINKS.map((link) => `${link.label}: ${link.href}`).join("\n");
}

export const productionWindow = `${PRODUCTION_DAYS_MIN} to ${PRODUCTION_DAYS_MAX} business days`;
