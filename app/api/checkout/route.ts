export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({
    message: "Choose shipping on the checkout page before payment.",
    checkoutPath: "/checkout",
    code: "use_checkout_page",
  }, { status: 409 });
}
