const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Set this in Netlify env vars once you create the webhook endpoint in the
// Stripe Dashboard (Developers -> Webhooks -> Add endpoint).
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object;
      // This is where you'd:
      // 1. Log the order somewhere durable (Airtable/Supabase/Google Sheet via API)
      // 2. Send yourself a notification (email/Slack) so custom orders get
      //    routed to your build queue instead of falling through the cracks
      //    the way the old Gmail workflow did.
      // 3. Trigger a branded confirmation email to the customer (e.g. via
      //    Resend or Postmark) instead of relying on Stripe's default receipt.
      console.log("Checkout completed:", session.id, session.customer_email);
      break;
    }
    default:
      console.log(`Unhandled event type: ${stripeEvent.type}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
