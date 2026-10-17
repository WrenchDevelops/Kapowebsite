export function formatCents(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function priceToCents(price: number) {
  if (!Number.isFinite(price) || price < 0) return null;
  return Math.round(price * 100);
}

/** Converts a Shippo decimal string such as "7.89" into integer cents. */
export function moneyStringToCents(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  const roundUp = Number(fraction[2] ?? "0") >= 5;
  const rounded = cents + (roundUp ? 1 : 0);
  return Number.isSafeInteger(rounded) ? rounded : null;
}
