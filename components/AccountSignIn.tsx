"use client";

import { useState } from "react";

export function AccountSignIn() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form className="account-signin" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setPending(true);
      setMessage("");
      try {
        const response = await fetch("/api/account/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: form.get("name"), email: form.get("email") }),
        });
        const payload = await response.json() as { message?: string };
        if (!response.ok) {
          setMessage(payload.message ?? "Sign-in did not go through.");
          setPending(false);
          return;
        }
        window.location.assign("/account");
      } catch {
        setMessage("Sign-in could not be reached. Please try again.");
        setPending(false);
      }
    }}>
      <p className="eyebrow">Sign in</p>
      <h2>Use the email from checkout.</h2>
      <label>Name<input name="name" autoComplete="name" required minLength={2} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Signing in…" : "Continue"}</button>
      {message && <p className="checkout-message" role="alert">{message}</p>}
      <p className="stripe-note">Orders placed with this email show up here. Guest checkout still works without an account.</p>
    </form>
  );
}
