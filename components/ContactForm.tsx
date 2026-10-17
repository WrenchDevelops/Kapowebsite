"use client";

import { useState } from "react";

export function ContactForm({ supportEmail }: { supportEmail: string }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <form className="contact-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setPending(true);
      setStatus("");
      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            email: form.get("email"),
            order: form.get("order"),
            message: form.get("message"),
          }),
        });
        const payload = await response.json() as { message?: string };
        setStatus(payload.message ?? `Email ${supportEmail} and KAPO will reply.`);
        if (response.ok) event.currentTarget.reset();
      } catch {
        setStatus(`The form could not send. Email ${supportEmail} and KAPO will reply.`);
      } finally {
        setPending(false);
      }
    }}>
      <label>Name<input name="name" autoComplete="name" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Order number <span>optional</span><input name="order" /></label>
      <label>Message<textarea name="message" rows={7} required minLength={4} /></label>
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
      {status && <p className="form-status" role="status">{status}</p>}
    </form>
  );
}
