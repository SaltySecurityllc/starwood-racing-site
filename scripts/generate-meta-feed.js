/**
 * Generates the Meta Commerce Manager catalog/variants feed (CSV) from
 * data/products.json. Hosted at /data/meta-catalog-feed.csv on the live site
 * so Meta can auto-refresh it on a schedule.
 *
 * Usage: node scripts/generate-meta-feed.js
 */

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://starwoodracing.us";
const PRODUCTS_PATH = path.join(__dirname, "..", "data", "products.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "meta-catalog-feed.csv");

const FEED_DESC = {
  "custom-race-suit": "Fully bespoke leather race suit built from your own measurements. Your panel layout, colors, and leather grade. Add-ons available: airbag, CE armor, liner.",
  "standard-race-suit": "Recreates a specific rider or team livery to your spec. Note your rider/details at checkout. Add-ons available: airbag, CE armor, liner.",
  "speed-suit": "Pre-designed leather race suit, upgraded leather grade and protection, faster turnaround than full custom. CE-rated armor pockets included.",
  "the-visionary": "Pre-designed cowhide leather race suit, ready to order without a full custom design process. CE-rated inner protection included.",
  "custom-leather-jacket": "Standalone custom leather jacket, made to measure. Pairs with matching Custom Leather Pants for a full combo look.",
  "custom-leather-pants": "Standalone custom leather pants, made to measure. Pairs with matching Custom Leather Jacket for a full combo look.",
  "swr-street-glove": "Leather street glove with TPU knuckle/finger protection and palm padding. Quick, easy securing mechanism.",
  "swr-race-glove-double-cuff-strap": "Double cuff race glove, leather with TPU knuckle/finger protection and palm padding. Built for track use.",
  "swr-race-glove-single-cuff-strap": "Single cuff race glove (Blade V1), leather with TPU knuckle/finger protection and palm padding. Quick-secure closure.",
  "swr-blade-v2-race-glove": "Blade V2 race glove, leather with TPU knuckle/finger protection and palm padding. Quick-secure closure.",
  "supersonic-boots": "Breathable race boot with perforated upper/side panels and a snug ankle fit for added crash protection.",
  "race-boots": "CE certified race boot with Axial Distortion Control ankle system, nylon heel inserts, and perforated upper.",
  sliders: "Durable proprietary-blend knee sliders for wet or dry track use. Built for first-time track day riders and pros alike.",
};
const COLOR_MAP = {
  "custom-race-suit": "Multi-color", "standard-race-suit": "Multi-color",
  "speed-suit": "Black/Red/White", "the-visionary": "Black/Red/White",
  "custom-leather-jacket": "Black", "custom-leather-pants": "Black",
  "swr-street-glove": "Black", "swr-race-glove-double-cuff-strap": "Black/Blue/Yellow",
  "swr-race-glove-single-cuff-strap": "Blue/Red", "swr-blade-v2-race-glove": "Pink/Yellow",
  "supersonic-boots": "Pink/Yellow", "race-boots": "Black/Yellow/Pink",
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
  const headers = ["id","title","description","availability","condition","price","link",
    "image_link","brand","item_group_id","color","size","gender","age_group","inventory"];

  const rows = [];
  products.filter((p) => p.price_usd != null).forEach((p) => {
    const image = p.image || (p.images && p.images[0]) || "";
    const base = {
      title: p.name,
      description: (FEED_DESC[p.id] || p.description || "").slice(0, 200),
      availability: "in stock",
      condition: "new",
      price: `${p.price_usd.toFixed(2)} USD`,
      link: `${SITE_URL}/#product-${p.id}`,
      image_link: image ? `${SITE_URL}${image}` : "",
      brand: "Starwood Racing",
      gender: "unisex",
      age_group: "adult",
      // Made-to-order items aren't stock-limited in the traditional sense,
      // but Meta requires an explicit quantity > 0 for items marked in stock.
      inventory: 999,
    };

    if (p.id === "sliders" && p.colors && p.colors.length) {
      p.colors.forEach((c, idx) => {
        const colImage = (p.images && p.images[idx]) || image;
        rows.push({
          ...base,
          id: `sliders-${c.toLowerCase()}`,
          title: `Sliders (${c})`,
          image_link: `${SITE_URL}${colImage}`,
          item_group_id: "sliders",
          color: c,
          size: "One Size",
        });
      });
    } else {
      rows.push({
        ...base,
        id: p.id,
        item_group_id: "",
        color: COLOR_MAP[p.id] || "Multi-color",
        size: p.sizes && p.sizes.length ? "Custom / See size chart" : "One Size",
      });
    }
  });

  const lines = [headers.join(",")].concat(
    rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))
  );
  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"));
  console.log(`Wrote ${rows.length} rows to ${OUTPUT_PATH}`);
}

main();
