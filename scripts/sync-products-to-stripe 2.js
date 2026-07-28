/**
 * Syncs data/products.json to Stripe Products + Prices.
 *
 * Run this any time you add/edit a product in products.json.
 * It's safe to run repeatedly (idempotent-ish): if a product already
 * has a stripe_product_id, it updates it instead of creating a duplicate.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx node scripts/sync-products-to-stripe.js
 *
 * Or add STRIPE_SECRET_KEY to a local .env and use `dotenv` (not included
 * by default to keep dependencies minimal).
 */

const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");

const PRODUCTS_PATH = path.join(__dirname, "..", "data", "products.json");
const ADDONS_PATH = path.join(__dirname, "..", "data", "addons.json");

async function syncCatalog(stripe, filePath, label) {
  const products = JSON.parse(fs.readFileSync(filePath, "utf8"));

  for (const product of products) {
    if (product.price_usd == null) {
      console.log(`Skipping "${product.name}" — no price set yet.`);
      continue;
    }
    const priceInCents = Math.round(product.price_usd * 100);
    const description =
      product.description && product.description.trim()
        ? product.description
        : `${product.name} — Starwood Racing add-on.`;

    let stripeProduct;
    if (product.stripe_product_id) {
      stripeProduct = await stripe.products.update(product.stripe_product_id, {
        name: product.name,
        description,
      });
      console.log(`Updated product: ${product.name}`);
    } else {
      stripeProduct = await stripe.products.create({
        name: product.name,
        description,
        metadata: { internal_id: product.id || "", tier: product.tier || product.category || "" },
      });
      product.stripe_product_id = stripeProduct.id;
      console.log(`Created product: ${product.name} (${stripeProduct.id})`);
    }

    // Stripe prices are immutable once created, so if the price changed we
    // create a new Price object and archive the old one rather than editing it.
    let needsNewPrice = true;
    if (product.stripe_price_id) {
      const existingPrice = await stripe.prices.retrieve(product.stripe_price_id);
      if (existingPrice.unit_amount === priceInCents && existingPrice.active) {
        needsNewPrice = false;
      } else {
        await stripe.prices.update(product.stripe_price_id, { active: false });
      }
    }

    if (needsNewPrice) {
      const newPrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: priceInCents,
        currency: "usd",
      });
      product.stripe_price_id = newPrice.id;
      console.log(`  -> new price: $${product.price_usd} (${newPrice.id})`);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
  console.log(`Done with ${label}.\n`);
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Missing STRIPE_SECRET_KEY environment variable.");
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  await syncCatalog(stripe, PRODUCTS_PATH, "products.json");
  await syncCatalog(stripe, ADDONS_PATH, "addons.json");

  console.log("All catalogs synced. Remember to copy data/*.json into public/data/ before deploying.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
