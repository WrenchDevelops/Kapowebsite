export type ShippingAddress = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  smsUpdates?: boolean;
};

export const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const STATE_CODES = new Set<string>(US_STATES.map(([code]) => code));

export function shipToCountries(raw: string | undefined) {
  const countries = (raw ?? "US").split(",").map((country) => country.trim().toUpperCase()).filter(Boolean);
  return countries.length ? countries : ["US"];
}

export function parseOrigin(raw: string | undefined): ShippingAddress | null {
  if (!raw?.trim()) return null;
  try {
    const value = JSON.parse(raw) as Partial<ShippingAddress> & { street1?: string; zip?: string };
    const origin = normalizeAddress({
      name: value.name ?? "",
      email: value.email ?? "",
      phone: value.phone ?? "",
      line1: value.line1 ?? value.street1 ?? "",
      line2: value.line2 ?? "",
      city: value.city ?? "",
      state: value.state ?? "",
      postalCode: value.postalCode ?? value.zip ?? "",
      country: value.country ?? "",
    });
    return origin.ok ? origin.address : null;
  } catch {
    return null;
  }
}

export function normalizeAddress(input: Partial<ShippingAddress>) {
  const address: ShippingAddress = {
    name: clean(input.name, 80),
    email: clean(input.email, 120).toLowerCase(),
    phone: clean(input.phone, 30),
    line1: clean(input.line1, 120),
    line2: clean(input.line2, 120),
    city: clean(input.city, 80),
    state: clean(input.state, 2).toUpperCase(),
    postalCode: clean(input.postalCode, 10).toUpperCase(),
    country: clean(input.country, 2).toUpperCase() || "US",
  };
  if (!address.name) return { ok: false as const, message: "Enter the recipient name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) return { ok: false as const, message: "Enter a valid email address." };
  if (address.line1.length < 3) return { ok: false as const, message: "Enter a street address." };
  if (address.city.length < 2) return { ok: false as const, message: "Enter a city." };
  if (!STATE_CODES.has(address.state)) return { ok: false as const, message: "Choose a U.S. state." };
  if (!/^\d{5}(-\d{4})?$/.test(address.postalCode)) return { ok: false as const, message: "Enter a 5-digit ZIP code." };
  if (address.country !== "US") {
    return { ok: false as const, message: "KAPO currently ships within the United States. International shipping is not available yet." };
  }
  return { ok: true as const, address };
}

export function addressesMatch(left: Pick<ShippingAddress, "line1" | "city" | "state" | "postalCode" | "country">, right: Pick<ShippingAddress, "line1" | "city" | "state" | "postalCode" | "country">) {
  return compact(left.line1) === compact(right.line1)
    && compact(left.city) === compact(right.city)
    && left.state.trim().toUpperCase() === right.state.trim().toUpperCase()
    && left.postalCode.replace(/\s/g, "").slice(0, 5) === right.postalCode.replace(/\s/g, "").slice(0, 5)
    && left.country.trim().toUpperCase() === right.country.trim().toUpperCase();
}

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function compact(value: string) {
  return value.toLowerCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
}
