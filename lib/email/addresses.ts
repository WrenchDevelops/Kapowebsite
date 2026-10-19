export const EMAIL = {
  hello: "hello@shopkapo.com",
  orders: "orders@shopkapo.com",
  support: "support@shopkapo.com",
  news: "news@shopkapo.com",
} as const;

const NAMES = {
  hello: "KAPO",
  orders: "KAPO Orders",
  support: "KAPO Support",
  news: "KAPO News",
} as const;

export type SenderKind = keyof typeof EMAIL;

export function sender(kind: SenderKind) {
  return `${NAMES[kind]} <${EMAIL[kind]}>`;
}

export function publicSiteUrl(configured?: string) {
  const value = (configured ?? "https://shopkapo.com").trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(value) && !/^http:\/\/localhost(:\d+)?$/i.test(value)) {
    return "https://shopkapo.com";
  }
  return value;
}

export function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}
