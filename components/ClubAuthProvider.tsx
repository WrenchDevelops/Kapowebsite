"use client";
import { ClerkProvider } from "@clerk/react";
export function ClubAuthProvider({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: React.ReactNode;
}) {
  if (!publishableKey) return children;
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/account"
      appearance={{
        variables: {
          colorPrimary: "#18251f",
          fontFamily: "Fredoka, sans-serif",
          borderRadius: "12px",
        },
        options: {
          unsafe_disableDevelopmentModeWarnings: true,
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
