export type VerifiedIdentity = {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string;
  fullName: string | null;
};
export function verifiedIdentity(
  subject: { userId: string; sessionId: string },
  session: { userId: string; status: string; expireAt: number },
  user: {
    id: string;
    banned?: boolean;
    locked?: boolean;
    primaryEmailAddressId: string | null;
    emailAddresses: {
      id: string;
      emailAddress: string;
      verification: { status: string } | null;
    }[];
    firstName: string | null;
    lastName: string | null;
  },
  now = Date.now(),
): VerifiedIdentity | null {
  if (
    session.userId !== subject.userId ||
    user.id !== subject.userId ||
    session.status !== "active" ||
    !Number.isFinite(session.expireAt) ||
    session.expireAt <= now ||
    user.banned ||
    user.locked
  )
    return null;
  const email = user.emailAddresses.find(
    (entry) =>
      entry.id === user.primaryEmailAddressId &&
      entry.verification?.status === "verified",
  );
  if (!email) return null;
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
  return {
    ...subject,
    email: email.emailAddress.trim().toLowerCase(),
    displayName: fullName ?? email.emailAddress,
    fullName,
  };
}
export function safeAccountReturn(value: string) {
  try {
    const url = new URL(value, "https://kapo.invalid");
    return value.startsWith("/") &&
      !value.startsWith("//") &&
      url.origin === "https://kapo.invalid" &&
      !url.pathname.startsWith("/sign-")
      ? `${url.pathname}${url.search}`
      : "/account";
  } catch {
    return "/account";
  }
}
