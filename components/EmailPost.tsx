"use client";

import { useState } from "react";

export function EmailPost({
  action,
  label,
  fields = {},
  children,
  confirm,
  compact = false,
  endpoint = "/api/admin/email",
}: {
  action: string;
  label: string;
  fields?: Record<string, string>;
  children?: React.ReactNode;
  confirm?: string;
  compact?: boolean;
  endpoint?: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className={compact ? "email-admin-form is-compact" : "email-admin-form"}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(event.currentTarget);
        const body: Record<string, string> = { action, ...fields };
        for (const [key, value] of data.entries()) body[key] = String(value);
        setPending(true);
        setMessage("");
        void fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).then(async (response) => {
          const payload = await response.json() as { message?: string; ok?: boolean; status?: string };
          setMessage(payload.message ?? (response.ok ? "Done." : "KAPO could not complete that."));
          setPending(false);
          if (response.ok && !payload.message) window.location.reload();
        }).catch(() => {
          setMessage("KAPO could not complete that.");
          setPending(false);
        });
      }}
    >
      {children}
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Working…" : label}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
