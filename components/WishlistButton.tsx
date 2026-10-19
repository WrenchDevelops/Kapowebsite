"use client";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
export function WishlistButton({ productId }: { productId: string }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch(
      `/api/club/wishlist?productId=${encodeURIComponent(productId)}`,
      { signal: abort.signal },
    )
      .then(async (response) => {
        if (response.ok) setSaved(Boolean((await response.json()).saved));
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [productId]);
  return (
    <div className="club-save-wrap">
      <button
        type="button"
        className="club-save-product"
        disabled={busy}
        aria-pressed={saved}
        onClick={async () => {
          setBusy(true);
          try {
            const response = await fetch("/api/club", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "wishlist",
                productId,
                saved: !saved,
              }),
            });
            const data = await response.json();
            if (response.status === 401) {
              window.location.assign(
                `/sign-in?return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`,
              );
              return;
            }
            if (!response.ok) throw new Error(data.message);
            setSaved(!saved);
            setMessage(
              !saved
                ? "Saved to your KAPO Club wishlist."
                : "Removed from your wishlist.",
            );
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
        {saved ? "Saved to your wishlist" : "Save to my wishlist"}
      </button>
      {message && (
        <p role="status" className="club-fine">
          {message}
        </p>
      )}
    </div>
  );
}
