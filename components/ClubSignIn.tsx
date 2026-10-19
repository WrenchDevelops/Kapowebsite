"use client";
import Link from "next/link";
import { SignIn, SignUp } from "@clerk/react";
export function ClubSignIn({
  configured,
  signup,
  returnTo,
}: {
  configured: boolean;
  signup: boolean;
  returnTo: string;
}) {
  return (
    <main id="main-content" className="club-auth-page">
      <section className="club-auth-story">
        <Link href="/account" className="club-wordmark">
          KAPO <span>CLUB</span>
        </Link>
        <p className="eyebrow">A little more character.</p>
        <h1>
          Your crew.
          <br />
          Your collection.
          <br />
          <em>Your Club.</em>
        </h1>
        <p>
          Save the ones you love, follow every order, and make your next keycap
          a little more rewarding.
        </p>
        <img
          src="/products/spore-artisan.png"
          alt="Spore, the KAPO forest wanderer"
        />
      </section>
      <section className="club-auth-form">
        {!configured ? (
          <>
            <h2>We’re getting the Club ready.</h2>
            <p>
              Secure sign-in is being connected. You can still browse the
              collection and check out as a guest.
            </p>
            <Link className="button button-dark" href="/shop">
              Explore the crew
            </Link>
          </>
        ) : signup ? (
          <SignUp
            routing="hash"
            signInUrl="/sign-in"
            forceRedirectUrl={returnTo}
          />
        ) : (
          <SignIn
            routing="hash"
            signUpUrl="/sign-up"
            forceRedirectUrl={returnTo}
          />
        )}
      </section>
    </main>
  );
}
