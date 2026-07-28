/**
 * Generates a Google Merchant Center product feed (CSV) from data/products.json.
 *
 * Usage: node scripts/generate-google-feed.js
 * Output: data/google-shopping-feed.csv
 *
 * Re-run this any time products.json changes, then re-upload the CSV to
 * Merchant Center (or point Merchant Center at the file's URL for auto-refresh
 * — see README for the recommended approach).
 */

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://starwoodracing.us";
const PRODUCTS_PATH = path.join(__dirname, "..", "data", "products.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "google-shopping-feed.csv");

// Correct, specific (leaf-level) Google product taxonomy paths per internal category.
// Google wants the deepest accurate node, not a broad parent — "Outerwear" alone
// is too shallow and can trigger a category-mismatch/requirements error.
const CATEGORY_MAP = {
  Suits: "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
  Jackets: "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
  Gloves: "Apparel & Accessories > Clothing Accessories > Gloves & Mittens",
  Boots: "Apparel & Accessories > Shoes",
  Protection: "Vehicles & Parts > Vehicle Parts & Accessories",
};

// A best-guess primary color per product, based on the photographed sample.
// These are custom/made-to-order items where the customer actually picks
// color at checkout — this field just needs *a* reasonable value to satisfy
// Google's apparel requirement, not a locked-in spec.
const COLOR_MAP = {
  "custom-race-suit": "Multi-color",
  "standard-race-suit": "Multi-color",
  "speed-suit": "Black/Red/White",
  "the-visionary": "Black/Red/White",
  "custom-leather-jacket": "Black",
  "custom-leather-pants": "Black",
  "swr-street-glove": "Black",
  "swr-race-glove-double-cuff-strap": "Black/Blue/Yellow",
  "swr-race-glove-single-cuff-strap": "Blue/Red",
  "swr-blade-v2-race-glove": "Pink/Yellow",
  "supersonic-boots": "Pink/Yellow",
  "race-boots": "Black/Yellow/Pink",
  sliders: "Black",
};

// Estimated shipping weight per product — required by Merchant Center when
// shipping settings are weight-based.
const WEIGHT_MAP = {
  "custom-race-suit": "6 lb",
  "standard-race-suit": "6 lb",
  "speed-suit": "5.5 lb",
  "the-visionary": "5.5 lb",
  "custom-leather-jacket": "3.5 lb",
  "custom-leather-pants": "3 lb",
  "swr-street-glove": "1 lb",
  "swr-race-glove-double-cuff-strap": "1 lb",
  "swr-race-glove-single-cuff-strap": "1 lb",
  "swr-blade-v2-race-glove": "1 lb",
  "supersonic-boots": "4 lb",
  "race-boots": "4 lb",
};
const SLIDER_WEIGHT = "0.3 lb";

function csvEscape(value) {
  const str = String(value == null ? "" : value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"));

  const headers = [
    "id", "title", "description", "link", "image_link",
    "availability", "price", "condition", "brand",
    "identifier_exists", "google_product_category",
    "color", "size", "gender", "age_group", "shipping_weight",
  ];

  const rows = [];

  products
    .filter((p) => p.price_usd != null)
    .forEach((p) => {
      const image = p.image || (p.images && p.images[0]) || "";
      const baseRow = {
        id: p.id,
        title: p.name,
        description: (p.description || p.name).replace(/\s+/g, " ").trim().slice(0, 5000),
        link: `${SITE_URL}/#product-${p.id}`,
        image_link: image ? `${SITE_URL}${image}` : "",
        availability: "in stock",
        price: `${p.price_usd.toFixed(2)} USD`,
        condition: "new",
        brand: "Starwood Racing",
        identifier_exists: "no",
        google_product_category: CATEGORY_MAP[p.category] || "Apparel & Accessories",
        gender: "unisex",
        age_group: "adult",
      };

      // Sliders come in real, distinct color variants — submit one feed row
      // per color so each is a separate, correctly-attributed listing.
      if (p.id === "sliders" && p.colors && p.colors.length) {
        p.colors.forEach((color, idx) => {
          const colorImage = (p.images && p.images[idx]) || image;
          rows.push({
            ...baseRow,
            id: `${p.id}-${color.toLowerCase()}`,
            title: `${p.name} (${color})`,
            image_link: colorImage ? `${SITE_URL}${colorImage}` : "",
            color,
            size: "One Size",
            shipping_weight: SLIDER_WEIGHT,
          });
        });
        return;
      }

      rows.push({
        ...baseRow,
        color: COLOR_MAP[p.id] || "Multi-color",
        size: p.sizes && p.sizes.length ? "Custom / See size chart" : "One Size",
        shipping_weight: WEIGHT_MAP[p.id] || "3 lb",
      });
    });

  const lines = [headers.join(",")].concat(
    rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))
  );

  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"));
  console.log(`Wrote ${rows.length} product rows to ${OUTPUT_PATH}`);
}

main();
