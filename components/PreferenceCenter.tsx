"use client";

import { useState } from "react";
import { TOPICS, type Preferences } from "@/lib/email/topics";

export function PreferenceCenter({
  token,
  status,
  preferences,
}: {
  token: string;
  status: string | null;
  preferences: Preferences | null;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>, payload: Record<string, unknown>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    void fetch("/api/newsletter/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        email: String(data.get("email") ?? ""),
        company: String(data.get("company") ?? ""),
      }),
    }).then(async (response) => {
      const result = await response.json() as { message?: string };
      setMessage(result.message ?? "Those preferences could not be saved.");
      setPending(false);
    }).catch(() => {
      setMessage("Those preferences could not be saved.");
      setPending(false);
    });
  }
  const [topics, setTopics] = useState<Preferences>(preferences ?? {
    products: true,
    deals: true,
    youtube: true,
    instagram: true,
    news: true,
    frequency: "weekly",
  });

  if (!token) {
    return (
      <form className="preference-form" onSubmit={(event) => submit(event, { token: "" })}>
        <p>Open the manage-preferences link in a KAPO email, or ask for a new one.</p>
        <label htmlFor="preference-email">Email</label>
        <input id="preference-email" name="email" type="email" autoComplete="email" required />
        <input className="support-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" name="company" defaultValue="" />
        <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a link"}</button>
        {message ? <p role="status">{message}</p> : null}
      </form>
    );
  }

  if (status !== "confirmed" || !preferences) {
    return <p>{status === "pending" ? "Confirm the KAPO email first, then choose what you want." : "This preferences link is not valid. Sign up from the site if you want KAPO news."}</p>;
  }

  return (
    <form className="preference-form" onSubmit={(event) => submit(event, { token, ...topics })}>
      <ul className="preference-topics">
        {TOPICS.map((topic) => (
          <li key={topic.id}>
            <label>
              <input
                type="checkbox"
                checked={topics[topic.id]}
                onChange={(event) => setTopics((current) => ({ ...current, [topic.id]: event.target.checked }))}
              />
              <span>
                <strong>{topic.label}</strong>
                <small>{topic.detail}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <fieldset>
        <legend>How often</legend>
        <label>
          <input type="radio" name="frequency" value="weekly" checked={topics.frequency === "weekly"} onChange={() => setTopics((current) => ({ ...current, frequency: "weekly" }))} />
          Weekly digest
        </label>
        <label>
          <input type="radio" name="frequency" value="immediate" checked={topics.frequency === "immediate"} onChange={() => setTopics((current) => ({ ...current, frequency: "immediate" }))} />
          Every announcement
        </label>
        <p>Weekly digest groups YouTube, Instagram, and studio notes. Product launches still arrive on their own. Every announcement sends those social posts as they go up.</p>
      </fieldset>
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</button>
      {message ? <p role="status">{message}</p> : null}
      <p><a href={`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`}>Unsubscribe from everything</a></p>
    </form>
  );
}
