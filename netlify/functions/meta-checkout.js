const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SITE_URL = process.env.SITE_URL || "https://starwoodracing.us";

// Statically required (not read via fs at runtime) so Netlify's function
// bundler reliably packages this JSON file with the deployed function.
function loadCatalog() {
  // eslint-disable-next-line global-require
  return require("../../data/products.json");
}

// Sliders are split into 6 color "products" in the Meta feed for display
// purposes, but they're all one actual Stripe price. Strip the color suffix
// to resolve back to the real underlying product.
function resolveProduct(feedId, products) {
  if (feedId.startsWith("sliders-")) {
    return products.find((p) => p.id === "sliders");
  }
  return products.find((p) => p.id === feedId);
}

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const productsParam = params.products || "";
    const couponParam = params.coupon || null;

    if (!productsParam) {
      return {
        statusCode: 302,
        headers: { Location: `${SITE_URL}/` },
      };
    }

    const catalog = loadCatalog();

    // Format: "id1:qty1,id2:qty2" — commas/colons in IDs are RFC 3986-escaped
    // by Meta, so decode each piece before splitting.
    const entries = decodeURIComponent(productsParam)
      .split(",")
      .map((entry) => entry.split(":"))
      .filter((pair) => pair.length === 2);

    const lineItems = [];
    for (const [feedId, qtyStr] of entries) {
      const product = resolveProduct(feedId.trim(), catalog);
      const quantity = Math.max(1, parseInt(qtyStr, 10) || 1);
      if (product && product.stripe_price_id) {
        lineItems.push({ price: product.stripe_price_id, quantity });
      }
    }

    if (lineItems.length === 0) {
      return { statusCode: 302, headers: { Location: `${SITE_URL}/` } };
    }

    const sessionParams = {
      mode: "payment",
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      success_url: `${SITE_URL}/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout-canceled.html`,
      custom_fields: [
        {
          key: "notes",
          label: { type: "custom", custom: "Notes (colors, sizing, custom requests)" },
          type: "text",
          optional: true,
          text: { maximum_length: 255 },
        },
      ],
    };

    // Only attach a discount if a coupon/promo code was actually passed and
    // is valid — never let a bad code break checkout entirely.
    if (couponParam) {
      try {
        const promo = await stripe.promotionCodes.list({ code: couponParam, active: true, limit: 1 });
        if (promo.data.length > 0) {
          sessionParams.discounts = [{ promotion_code: promo.data[0].id }];
        }
      } catch (err) {
        console.warn("Coupon lookup failed, proceeding without discount:", err.message);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 302,
      headers: { Location: session.url },
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}/checkout-canceled.html` },
    };
  }
};
