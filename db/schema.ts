import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const shippingQuotes = sqliteTable("shipping_quotes", {
  id: text("id").primaryKey(),
  cartHash: text("cart_hash").notNull(),
  customerUserId: text("customer_user_id"),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  addressJson: text("address_json").notNull(),
  linesJson: text("lines_json").notNull(),
  parcelJson: text("parcel_json").notNull(),
  ratesJson: text("rates_json").notNull(),
  shippoShipmentId: text("shippo_shipment_id").notNull(),
  merchandiseSubtotalCents: integer("merchandise_subtotal_cents").notNull(),
  handlingFeeCents: integer("handling_fee_cents").notNull(),
  currency: text("currency").notNull(),
  productionDaysMin: integer("production_days_min").notNull(),
  productionDaysMax: integer("production_days_max").notNull(),
  ipHash: text("ip_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("shipping_quotes_ip_created").on(table.ipHash, table.createdAt),
]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  quoteId: text("quote_id").notNull(),
  customerUserId: text("customer_user_id"),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  currency: text("currency").notNull(),
  merchandiseSubtotalCents: integer("merchandise_subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull(),
  discountCode: text("discount_code"),
  shippingCents: integer("shipping_cents").notNull(),
  handlingFeeCents: integer("handling_fee_cents").notNull(),
  carrierCents: integer("carrier_cents").notNull(),
  taxCents: integer("tax_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  refundedCents: integer("refunded_cents").notNull(),
  paymentStatus: text("payment_status").notNull(),
  productionStatus: text("production_status").notNull(),
  shippingStatus: text("shipping_status").notNull(),
  shipName: text("ship_name").notNull(),
  shipPhone: text("ship_phone").notNull(),
  smsOptIn: integer("sms_opt_in").notNull().default(0),
  shipLine1: text("ship_line1").notNull(),
  shipLine2: text("ship_line2").notNull(),
  shipCity: text("ship_city").notNull(),
  shipState: text("ship_state").notNull(),
  shipPostalCode: text("ship_postal_code").notNull(),
  shipCountry: text("ship_country").notNull(),
  carrier: text("carrier"),
  serviceName: text("service_name"),
  serviceToken: text("service_token"),
  shippoRateId: text("shippo_rate_id"),
  shippoShipmentId: text("shippo_shipment_id"),
  parcelJson: text("parcel_json").notNull(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeTaxCalculationId: text("stripe_tax_calculation_id"),
  stripeTaxTransactionId: text("stripe_tax_transaction_id"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  carrierTransitDays: integer("carrier_transit_days"),
  durationTerms: text("duration_terms"),
  productionDaysMin: integer("production_days_min").notNull(),
  productionDaysMax: integer("production_days_max").notNull(),
  reviewReason: text("review_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("orders_number").on(table.orderNumber),
  uniqueIndex("orders_quote").on(table.quoteId),
  uniqueIndex("orders_checkout_session").on(table.stripeCheckoutSessionId),
  uniqueIndex("orders_payment_intent").on(table.stripePaymentIntentId),
  index("orders_email").on(table.customerEmail),
  index("orders_user").on(table.customerUserId),
]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  style: text("style").notNull(),
  image: text("image").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
}, (table) => [
  index("order_items_order").on(table.orderId),
]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  amountCents: integer("amount_cents").notNull(),
  refundedCents: integer("refunded_cents").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("payments_checkout_session").on(table.stripeCheckoutSessionId),
  uniqueIndex("payments_payment_intent").on(table.stripePaymentIntentId),
  index("payments_order").on(table.orderId),
]);

export const shipments = sqliteTable("shipments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  shippoShipmentId: text("shippo_shipment_id"),
  parcelJson: text("parcel_json").notNull(),
  ratesJson: text("rates_json").notNull(),
  refreshedAt: text("refreshed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("shipments_order").on(table.orderId),
]);

export const shippingLabels = sqliteTable("shipping_labels", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  shipmentId: text("shipment_id"),
  shippoTransactionId: text("shippo_transaction_id"),
  shippoRateId: text("shippo_rate_id").notNull(),
  status: text("status").notNull(),
  carrier: text("carrier"),
  serviceName: text("service_name"),
  amountCents: integer("amount_cents"),
  labelUrl: text("label_url"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("shipping_labels_transaction").on(table.shippoTransactionId),
  index("shipping_labels_order").on(table.orderId),
]);

export const trackingEvents = sqliteTable("tracking_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  trackingNumber: text("tracking_number").notNull(),
  status: text("status").notNull(),
  statusDetails: text("status_details").notNull(),
  occurredAt: text("occurred_at").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("tracking_events_dedupe").on(table.dedupeKey),
  index("tracking_events_order").on(table.orderId),
]);

export const fulfillmentEvents = sqliteTable("fulfillment_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  kind: text("kind").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  actor: text("actor").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("fulfillment_events_order").on(table.orderId),
]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  template: text("template").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  provider: text("provider"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("notifications_dedupe").on(table.dedupeKey),
  index("notifications_order").on(table.orderId),
]);

export const productSettings = sqliteTable("product_settings", {
  id: text("id").primaryKey(),
  published: integer("published").notNull(),
  forSale: integer("for_sale").notNull(),
  priceCents: integer("price_cents"),
  inventory: integer("inventory"),
  updatedAt: text("updated_at").notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("webhook_events_provider_event").on(table.provider, table.eventId),
]);
