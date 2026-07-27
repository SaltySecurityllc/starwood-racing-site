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

// Rough Google product category per internal category — refine in Merchant
// Center itself, which will suggest more precise categories on review.
const CATEGORY_MAP = {
  Suits: "Apparel & Accessories > Clothing > Outerwear",
  Jackets: "Apparel & Accessories > Clothing > Outerwear",
  Gloves: "Apparel & Accessories > Clothing Accessories > Gloves & Mittens",
  Boots: "Apparel & Accessories > Shoes",
  Protection: "Vehicles & Parts > Vehicle Parts & Accessories",
};

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
  ];

  const rows = products
    .filter((p) => p.price_usd != null) // skip anything without a real price yet
    .map((p) => {
      const image = p.image || (p.images && p.images[0]) || "";
      return [
        p.id,
        p.name,
        (p.description || p.name).replace(/\s+/g, " ").trim().slice(0, 5000),
        `${SITE_URL}/#product-${p.id}`,
        image ? `${SITE_URL}${image}` : "",
        "in stock",
        `${p.price_usd.toFixed(2)} USD`,
        "new",
        "Starwood Racing",
        "no", // no GTIN/MPN for these custom/made-to-order items
        CATEGORY_MAP[p.category] || "Apparel & Accessories",
      ];
    });

  const lines = [headers.join(",")].concat(
    rows.map((row) => row.map(csvEscape).join(","))
  );

  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"));
  console.log(`Wrote ${rows.length} products to ${OUTPUT_PATH}`);
}

main();
