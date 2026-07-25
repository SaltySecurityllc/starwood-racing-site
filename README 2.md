# Starwood Racing — Custom Storefront

A lightweight Stripe + Netlify replacement for the Shopify store. No monthly
platform fee, no per-app subscriptions — you pay Stripe's standard processing
fee (2.9% + 30¢) and Netlify hosting (free tier covers this site's traffic).

## What's here

```
public/                 the actual site (HTML/CSS/JS) — this is what Netlify serves
  index.html            homepage with tier comparison + Buy Now buttons
  css/style.css         design system (colors, type, layout)
  js/main.js            loads products.json, calls Stripe Checkout
  data/products.json    (symlinked/copied from /data at build — see note below)
netlify/functions/
  create-checkout-session.js   creates a Stripe Checkout session for a price
  stripe-webhook.js            listens for completed payments
data/products.json      your product catalog — single source of truth
scripts/sync-products-to-stripe.js   pushes products.json into Stripe as Products/Prices
```

**Note:** copy or symlink `data/products.json` into `public/data/products.json`
before deploying, since only the `public` folder is served. Easiest fix:

```bash
mkdir -p public/data
cp data/products.json public/data/products.json
```

Re-run that copy step any time you edit prices, or fold it into a `postbuild`
npm script.

## First-time setup

1. **Create a Stripe account** (if you don't have one) and grab your secret
   key from Dashboard → Developers → API keys.

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Product data is already loaded** from your Shopify export into
   `data/products.json` (26 core products: 4 suits, gloves, boots, jacket,
   sliders, apparel) and `data/addons.json` (11 suit add-ons: airbag systems,
   CE armor, leather upgrades, liners). Review both files — a couple of
   things need your call:
   - **CE Level upgrade** was priced at both $50 and $75 depending on which
     suit it was attached to in Shopify. I defaulted to $75 (the more recent
     value) — change `data/addons.json` if you want $50 instead.
   - Add-ons currently apply store-wide rather than per-suit. If certain
     add-ons should only show for certain suits (e.g. Airbag System only for
     Custom), let me know and I'll wire that logic into the product page.

4. **Push products to Stripe:**
   ```bash
   STRIPE_SECRET_KEY=sk_live_xxx npm run sync-products
   ```
   This writes `stripe_product_id` and `stripe_price_id` back into
   `products.json` — commit that change.

5. **Push the repo to GitHub**, then connect it in Netlify:
   Netlify → Add new site → Import from Git.

6. **Set environment variables in Netlify** (Site settings → Environment variables):
   - `STRIPE_SECRET_KEY`
   - `SITE_URL` (e.g. `https://starwoodracing.us`)
   - `STRIPE_WEBHOOK_SECRET` (see next step)

7. **Create the webhook in Stripe:** Dashboard → Developers → Webhooks →
   Add endpoint → `https://starwoodracing.us/.netlify/functions/stripe-webhook`,
   listening for `checkout.session.completed`. Copy the signing secret into
   Netlify's `STRIPE_WEBHOOK_SECRET`.

8. **Point your domain** (starwoodracing.us) at Netlify — Domain settings →
   Add custom domain, then update your DNS records at your registrar.

## Local testing

```bash
npm install -g netlify-cli
netlify dev
```

This runs the static site and the functions together on `localhost:8888`,
using Stripe test mode keys (`sk_test_...`).

## Recent changes (this pass)

- **Pricing corrected** to your real numbers: Custom Suit $1000, Replica $850,
  Visionary $750, Speed Suit $700, Jacket $350, SWR Street Glove $140, SWR
  Race Glove $160, SWR Blade V1 $175, SWR Blade V2 $200, Supersonic Boots
  $480, Warp Speed Boots $350, Sliders $25.
- **CE Level 2 Armor Upgrade** confirmed at $75.
- **Airbag System add-on** renamed to generic tiers (Standard $500 / Advanced
  $750 / Pro $1050) instead of brand names (Klim, Tech-Air), so you're not
  locked into sourcing from one manufacturer.
- **Removed 14 Printify/dropship items** (t-shirts, tank tops, hoodie, polo,
  slides, socks, phone case, decal, AirPods case, water bottle) from the live
  catalog. They're preserved in `data/merch-archive-for-later.json` so
  nothing's lost — once you pick a MFG/dropship source for merch, I can turn
  that file back into real listings.
- Since every product's price changed, `stripe_price_id` was cleared on all
  of them — the next sync run will create fresh Stripe Prices at the correct
  amounts (old ones get archived, not deleted, so nothing breaks if a past
  Stripe Price is referenced elsewhere).

## Still to build (next phases)

- `size-guide.html` — the measurement guide page (highest-priority conversion fix)
- `order-confirmed.html` / `checkout-canceled.html` — post-checkout pages
- A branded order-confirmation email (replaces the Gmail workflow) — can be
  added to `stripe-webhook.js` using Resend or Postmark
- Order logging to Airtable/Supabase so you have a searchable order history
  outside the Stripe Dashboard
- Reviews/social proof section
- Blog for SEO

Send over your Shopify product CSV export and I'll wire up the real catalog
and start on the size guide page next.
