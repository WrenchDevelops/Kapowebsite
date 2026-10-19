"use client";
import { useState } from "react";
export function AdminRewardAdjustment({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState("");
  return (
    <form
      className="club-settings-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const id = requestId || crypto.randomUUID();
        setRequestId(id);
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/admin/rewards", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "adjust",
              userId,
              delta: Number(data.get("delta")),
              reason: data.get("reason"),
              requestId: id,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          window.location.reload();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Adjustment could not be saved.",
          );
          setBusy(false);
        }
      }}
    >
      <h2>Audited points adjustment</h2>
      <p>
        This writes an immutable ledger entry with your administrator ID. Refund
        corrections must use the order refund flow.
      </p>
      <label>
        Points to add or remove
        <input
          name="delta"
          type="number"
          required
          min={-100000}
          max={100000}
          step={1}
          onChange={() => setRequestId("")}
        />
      </label>
      <label>
        Reason
        <input
          name="reason"
          required
          minLength={10}
          maxLength={500}
          onChange={() => setRequestId("")}
        />
      </label>
      <label className="club-check">
        <input type="checkbox" required /> I have checked the customer and
        points history.
      </label>
      <button className="club-primary" disabled={busy}>
        {busy ? "Saving…" : "Record adjustment"}
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
