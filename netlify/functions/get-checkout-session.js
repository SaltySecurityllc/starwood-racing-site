const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Returns the real order total for a completed Checkout Session, used to fire
// an accurate Meta Pixel Purchase event on the confirmation page.
exports.handler = async (event) => {
  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing session_id" }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      statusCode: 200,
      body: JSON.stringify({
        amount_total: session.amount_total ? session.amount_total / 100 : null,
        currency: session.currency ? session.currency.toUpperCase() : "USD",
        payment_status: session.payment_status,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
