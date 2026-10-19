import { CommerceError } from "./errors.ts";

type ShippoAddress = {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  validation_results?: { is_valid?: boolean; messages?: { text?: string }[] };
};

export type ShippoRateResponse = {
  object_id?: string;
  amount?: string;
  currency?: string;
  provider?: string;
  estimated_days?: number | null;
  duration_terms?: string;
  attributes?: string[];
  servicelevel?: { name?: string; token?: string };
};

type ShipmentResponse = {
  object_id?: string;
  status?: string;
  rates?: ShippoRateResponse[];
  messages?: { text?: string; code?: string }[];
};

export class ShippoClient {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async validateAddress(address: { name: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; email: string; phone: string }) {
    const body = await this.request<ShippoAddress>("/addresses/", {
      method: "POST",
      body: JSON.stringify({
        name: address.name,
        street1: address.line1,
        street2: address.line2 || undefined,
        city: address.city,
        state: address.state,
        zip: address.postalCode,
        country: address.country,
        email: address.email,
        phone: address.phone || undefined,
        validate: true,
      }),
    });
    if (body.validation_results && body.validation_results.is_valid === false) {
      const message = body.validation_results.messages?.map((entry) => entry.text).filter(Boolean).join(" ") || "Shippo could not validate that address.";
      throw new CommerceError(message, 400, "invalid_address");
    }
    return body;
  }

  async createShipment(input: {
    from: { name: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; email: string; phone: string };
    to: { name: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; email: string; phone: string };
    parcel: { lengthIn: number; widthIn: number; heightIn: number; weightOz: number };
  }) {
    const shipment = await this.request<ShipmentResponse>("/shipments/", {
      method: "POST",
      body: JSON.stringify({
        address_from: toShippoAddress(input.from),
        address_to: toShippoAddress(input.to),
        parcels: [{
          length: String(input.parcel.lengthIn),
          width: String(input.parcel.widthIn),
          height: String(input.parcel.heightIn),
          distance_unit: "in",
          weight: String(input.parcel.weightOz),
          mass_unit: "oz",
        }],
        async: false,
      }),
    });
    if (!shipment.object_id || shipment.status === "ERROR") {
      throw shipmentError(shipment.messages);
    }
    return shipment;
  }

  async purchaseLabel(rateId: string, orderNumber: string, idempotencyKey: string) {
    return this.request<ShippoTransaction>("/transactions", {
      method: "POST",
      body: JSON.stringify({
        rate: rateId,
        async: false,
        label_file_type: "PDF_4x6",
        metadata: orderNumber,
      }),
      idempotencyKey,
    });
  }

  async voidLabel(transactionId: string) {
    return this.request<{ object_id?: string; status?: string }>("/refunds", {
      method: "POST",
      body: JSON.stringify({ transaction: transactionId, async: false }),
    });
  }

  private async request<T>(path: string, init: RequestInit & { idempotencyKey?: string }): Promise<T> {
    const { idempotencyKey, ...requestInit } = init;
    let response: Response;
    try {
      response = await this.fetchImpl(`https://api.goshippo.com${path}`, {
        ...requestInit,
        headers: {
          Authorization: `ShippoToken ${this.token}`,
          "Content-Type": "application/json",
          "SHIPPO-API-VERSION": "2018-02-08",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new CommerceError("The carrier rate service timed out. Please try again.", 504, "carrier_timeout");
    }
    const text = await response.text();
    const body = text ? JSON.parse(text) as T & { detail?: string; messages?: { text?: string; code?: string }[] } : {} as T & { detail?: string; messages?: { text?: string; code?: string }[] };
    if (!response.ok) throw shipmentError(body.messages, body.detail);
    return body;
  }
}

export type ShippoTransaction = {
  object_id?: string;
  status?: string;
  label_url?: string;
  tracking_number?: string;
  tracking_url_provider?: string;
  rate?: { amount?: string; provider?: string; servicelevel_name?: string };
  messages?: { text?: string; code?: string }[];
};

function toShippoAddress(address: { name: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; email: string; phone: string }) {
  return {
    name: address.name,
    street1: address.line1,
    street2: address.line2 || undefined,
    city: address.city,
    state: address.state,
    zip: address.postalCode,
    country: address.country,
    email: address.email || undefined,
    phone: address.phone || undefined,
  };
}

function shipmentError(messages?: { text?: string; code?: string }[], detail?: string) {
  const text = messages?.map((message) => message.text).filter(Boolean).join(" ") || detail || "";
  if (/timeout/i.test(text)) return new CommerceError("A carrier did not respond in time. Please try again.", 504, "carrier_timeout");
  if (/address/i.test(text)) return new CommerceError(text, 400, "invalid_address");
  return new CommerceError("Shipping rates are unavailable right now. Please try again.", 502, "shipping_unavailable");
}
