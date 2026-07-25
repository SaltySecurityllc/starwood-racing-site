const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Domain used for success/cancel redirects. Set this in Netlify's
// environment variables once you have the site live (e.g. https://starwoodracing.us)
const SITE_URL = process.env.SITE_URL || "http://localhost:8888";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { priceId, items, quantity = 1, customerEmail, notes } = JSON.parse(event.body);

    // Support either a single priceId (legacy) or an array of {priceId, quantity} items
    const lineItems = items && items.length
      ? items.map((i) => ({ price: i.priceId, quantity: i.quantity || 1 }))
      : [{ price: priceId, quantity }];

    if (!lineItems.length || !lineItems[0].price) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing priceId or items" }) };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      automatic_payment_methods: { enabled: true },
      line_items: lineItems,
      customer_email: customerEmail || undefined,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      success_url: `${SITE_URL}/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout-canceled.html`,
      // For custom suits you'll likely want to collect measurements before
      // or after checkout. One simple approach: use Stripe's custom_fields
      // to grab a note here, and follow up by email for full measurements.
      custom_fields: [
        {
          key: "notes",
          label: { type: "custom", custom: "Notes (colors, sizing, custom requests)" },
          type: "text",
          optional: true,
          text: {
            maximum_length: 255,
            default_value: notes ? String(notes).slice(0, 250) : undefined,
          },
        },
      ],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
