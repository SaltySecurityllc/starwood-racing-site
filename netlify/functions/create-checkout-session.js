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
    const { priceId, quantity = 1, customerEmail } = JSON.parse(event.body);

    if (!priceId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing priceId" }) };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity }],
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
          label: { type: "custom", custom: "Notes for your custom order (optional)" },
          type: "text",
          optional: true,
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
