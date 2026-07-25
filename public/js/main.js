let PRODUCTS = [];
let ADDONS = [];

async function init() {
  try {
    const [prodRes, addonRes] = await Promise.all([
      fetch("/data/products.json"),
      fetch("/data/addons.json"),
    ]);
    PRODUCTS = await prodRes.json();
    ADDONS = await addonRes.json();
  } catch (err) {
    console.error("Could not load catalog", err);
    return;
  }

  renderGrid("suit-grid", PRODUCTS.filter((p) => p.category === "Suits"), true);
  renderGrid("glove-grid", PRODUCTS.filter((p) => p.category === "Gloves"));
  renderGrid("boot-grid", PRODUCTS.filter((p) => p.category === "Boots"));
  renderGrid(
    "other-grid",
    PRODUCTS.filter((p) => ["Jackets", "Protection"].includes(p.category))
  );
}

function renderGrid(elementId, products, showAddons) {
  const grid = document.getElementById(elementId);
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `<p style="color:#9ba1a6">Nothing here yet.</p>`;
    return;
  }

  grid.innerHTML = products.map((p) => cardHTML(p, showAddons)).join("");

  // Color select swaps the thumbnail image if a matching image exists at the same index
  grid.querySelectorAll(".color-select").forEach((select) => {
    select.addEventListener("change", () => {
      const images = JSON.parse(select.dataset.images || "[]");
      const idx = select.selectedIndex;
      const card = select.closest(".tier-card");
      const thumb = card ? card.querySelector(".product-thumb") : null;
      if (thumb && images[idx]) thumb.src = images[idx];
    });
  });

  // Wire up buy buttons
  grid.querySelectorAll("button[data-price-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".tier-card");
      const sizeSelect = card ? card.querySelector(".size-select") : null;
      const colorSelect = card ? card.querySelector(".color-select") : null;
      const addonBoxes = card ? card.querySelectorAll(".addon-check:checked") : [];

      const parts = [];
      if (sizeSelect) parts.push(`Size: ${sizeSelect.value}`);
      if (colorSelect) parts.push(`Color: ${colorSelect.value}`);

      const items = [{ priceId: btn.dataset.priceId, quantity: 1 }];
      addonBoxes.forEach((box) => {
        items.push({ priceId: box.dataset.priceId, quantity: 1 });
        parts.push(`+ ${box.dataset.name}`);
      });

      startCheckout(items, parts.length ? parts.join(", ") : null);
    });
  });
}

function cardHTML(p, showAddons) {
  const img = p.image || (p.images && p.images[0]) || "";
  const priceLabel = p.price_max_usd
    ? `$${p.price_usd.toFixed(0)}\u2013$${p.price_max_usd.toFixed(0)}`
    : `$${p.price_usd.toFixed(2)}`;

  const sizeField = p.sizes
    ? `
      <div>
        <span class="field-label">Size</span>
        <select class="size-select">
          ${p.sizes.map((s) => `<option value="${s}">${s}</option>`).join("")}
        </select>
      </div>`
    : p.requires_measurements
    ? `<p class="measure-note">Fully custom fit — see the <a href="/size-guide.html">size guide</a> before ordering.</p>`
    : "";

  const colorField =
    p.colors && p.colors.length
      ? `
      <div>
        <span class="field-label">Color</span>
        <select class="color-select" data-images='${JSON.stringify(p.images || [])}'>
          ${p.colors.map((c) => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>`
      : "";

  const addonsField =
    showAddons && ADDONS.length
      ? `
      <details class="addons-panel">
        <summary>+ Add extras</summary>
        <div class="addons-list">
          ${ADDONS.map(
            (a) => `
            <label class="addon-row">
              <input type="checkbox" class="addon-check" data-price-id="${a.stripe_price_id}" data-name="${a.name}" ${
              a.stripe_price_id ? "" : "disabled"
            } />
              <span>${a.name}</span>
              <span class="addon-price">+$${a.price_usd.toFixed(0)}</span>
            </label>`
          ).join("")}
        </div>
      </details>`
      : "";

  return `
    <article class="tier-card">
      ${img ? `<img class="product-thumb" src="${img}" alt="${p.name}" loading="lazy" />` : ""}
      ${p.tier ? `<span class="tier-label">${p.tier}</span>` : ""}
      <h3>${p.name}</h3>
      <p class="desc">${p.description || ""}</p>
      ${sizeField}
      ${colorField}
      ${addonsField}
      <span class="price">${priceLabel}</span>
      <button class="btn btn-primary" data-price-id="${p.stripe_price_id}" ${
        p.stripe_price_id ? "" : 'disabled title="Not yet synced to Stripe"'
      }>
        Buy now
      </button>
    </article>
  `;
}

async function startCheckout(items, notes) {
  if (!items || !items.length || !items[0].priceId) {
    alert("This product hasn't been synced to Stripe yet.");
    return;
  }

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, notes }),
    });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Something went wrong starting checkout. Please try again.");
      console.error(data);
    }
  } catch (err) {
    console.error(err);
    alert("Something went wrong starting checkout. Please try again.");
  }
}

init();
