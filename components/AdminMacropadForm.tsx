"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MacropadLaunchState } from "@/lib/catalog";

export function AdminMacropadForm({ launch }: { launch: MacropadLaunchState }) {
  const router = useRouter();
  const [price, setPrice] = useState(launch.priceCents === null ? "" : (launch.priceCents / 100).toFixed(2));
  const [inventory, setInventory] = useState(launch.inventory === null ? "" : String(launch.inventory));
  const [published, setPublished] = useState(launch.published);
  const [forSale, setForSale] = useState(launch.forSale);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form className="admin-launch" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      setMessage("");
      const response = await fetch("/api/admin/products/macropad", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ published, forSale, price, inventory }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      setPending(false);
      if (!response.ok) {
        setMessage(body.message ?? "Could not save.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    }}>
      <p>KAPO Pad</p>
      <label>Price USD<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="Price TBD" /></label>
      <label>Inventory<input value={inventory} onChange={(event) => setInventory(event.target.value)} inputMode="numeric" placeholder="Open" /></label>
      <label className="admin-check"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Published</label>
      <label className="admin-check"><input type="checkbox" checked={forSale} onChange={(event) => setForSale(event.target.checked)} /> Sales on</label>
      <button type="submit" disabled={pending}>{pending ? "Saving" : "Save launch"}</button>
      {message && <small>{message}</small>}
    </form>
  );
}
