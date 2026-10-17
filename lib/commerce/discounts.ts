export type DiscountCode = {
  code: string;
  type: "percent" | "amount";
  value: number;
};

export function parseDiscountCodes(raw: string | undefined): DiscountCode[] {
  if (!raw?.trim()) return [];
  const codes: DiscountCode[] = [];
  for (const entry of raw.split(",")) {
    const [code, type, value] = entry.trim().split(":");
    if (!code || (type !== "percent" && type !== "amount")) continue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) continue;
    if (type === "percent" && parsed > 100) continue;
    codes.push({ code: code.toUpperCase(), type, value: parsed });
  }
  return codes;
}

export function applyDiscount(subtotalCents: number, rawCode: string | undefined, codes: DiscountCode[]) {
  const code = rawCode?.trim().toUpperCase() ?? "";
  if (!code) return { ok: true as const, code: null, discountCents: 0 };
  if (code.length > 40) return { ok: false as const, message: "That discount code is not valid." };
  const match = codes.find((entry) => entry.code === code);
  if (!match) return { ok: false as const, message: "That discount code is not valid." };
  const discountCents = match.type === "percent"
    ? Math.floor(subtotalCents * match.value / 100)
    : Math.min(match.value, subtotalCents);
  return { ok: true as const, code: match.code, discountCents };
}

export function allocateDiscount(lineTotals: number[], discountCents: number) {
  const subtotal = lineTotals.reduce((total, value) => total + value, 0);
  if (discountCents <= 0 || subtotal <= 0) return lineTotals.map(() => 0);
  const capped = Math.min(discountCents, subtotal);
  const allocations = lineTotals.map((total) => Math.floor(capped * total / subtotal));
  let remainder = capped - allocations.reduce((total, value) => total + value, 0);
  const order = lineTotals.map((total, index) => ({ total, index })).sort((a, b) => b.total - a.total);
  for (const entry of order) {
    if (remainder <= 0) break;
    allocations[entry.index] += 1;
    remainder -= 1;
  }
  return allocations;
}
