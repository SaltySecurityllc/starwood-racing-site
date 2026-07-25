async function loadProducts() {
  const grid = document.getElementById("tier-grid");
  if (!grid) return;

  try {
    const res = await fetch("/data/products.json");
    const allProducts = await res.json();
    const products = allProducts.filter((p) => p.category === "Suits");

    grid.innerHTML = products
      .map(
        (p) => `
      <article class="tier-card">
        <span class="tier-label">${p.tier}</span>
        <h3>${p.name}</h3>
        <p class="desc">${p.description}</p>
        <span class="price">$${p.price_usd.toFixed(2)}</span>
        <button class="btn btn-primary" data-price-id="${p.stripe_price_id}" ${
          p.stripe_price_id ? "" : "disabled title=\"Not yet synced to Stripe\""
        }>
          Buy now
        </button>
      </article>
    `
      )
      .join("");

    grid.querySelectorAll("button[data-price-id]").forEach((btn) => {
      btn.addEventListener("click", () => startCheckout(btn.dataset.priceId));
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:#9ba1a6">Could not load products. Check that data/products.json exists.</p>`;
    console.error(err);
  }
}

async function startCheckout(priceId) {
  if (!priceId) {
    alert("This product hasn't been synced to Stripe yet. Run `npm run sync-products` first.");
    return;
  }

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, quantity: 1 }),
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

loadProducts();
