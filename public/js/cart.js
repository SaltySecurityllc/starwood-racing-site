/**
 * Simple localStorage-backed shopping cart.
 * Cart items: { key, productId, name, image, unitPrice, priceId, quantity,
 *               size, color, addons: [{name, priceId, price}] }
 */

const CART_KEY = "starwood_cart";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function cartItemKey(productId, size, color, addonIds) {
  return [productId, size || "", color || "", (addonIds || []).sort().join(",")].join("|");
}

function addToCart(item) {
  const cart = getCart();
  const addonIds = (item.addons || []).map((a) => a.priceId);
  const key = cartItemKey(item.productId, item.size, item.color, addonIds);
  const existing = cart.find((c) => c.key === key);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, key, quantity: 1 });
  }
  saveCart(cart);
  openCart();
}

function removeFromCart(key) {
  const cart = getCart().filter((c) => c.key !== key);
  saveCart(cart);
  renderCart();
}

function changeQuantity(key, delta) {
  const cart = getCart();
  const item = cart.find((c) => c.key === key);
  if (!item) return;
  item.quantity = Math.max(1, item.quantity + delta);
  saveCart(cart);
  renderCart();
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => {
    const addonsTotal = (item.addons || []).reduce((s, a) => s + a.price, 0);
    return sum + (item.unitPrice + addonsTotal) * item.quantity;
  }, 0);
}

function updateCartBadge() {
  const count = getCart().reduce((n, item) => n + item.quantity, 0);
  document.querySelectorAll(".cart-badge").forEach((el) => {
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}

function openCart() {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (!drawer) {
    // Not on a page with the cart drawer (e.g. FAQ/size guide) — go to homepage cart
    window.location.href = "/#cart";
    return;
  }
  renderCart();
  drawer.classList.add("cart-open");
  if (overlay) overlay.classList.add("cart-open");
}

function closeCart() {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (drawer) drawer.classList.remove("cart-open");
  if (overlay) overlay.classList.remove("cart-open");
}

function renderCart() {
  const body = document.getElementById("cart-body");
  const footer = document.getElementById("cart-footer");
  if (!body) return;

  const cart = getCart();

  if (cart.length === 0) {
    body.innerHTML = `<p style="color:var(--chrome); padding:24px;">Your cart is empty.</p>`;
    if (footer) footer.style.display = "none";
    return;
  }

  body.innerHTML = cart
    .map((item) => {
      const addonsTotal = (item.addons || []).reduce((s, a) => s + a.price, 0);
      const lineTotal = (item.unitPrice + addonsTotal) * item.quantity;
      const details = [];
      if (item.size) details.push(`Size: ${item.size}`);
      if (item.color) details.push(`Color: ${item.color}`);
      const addonNames = (item.addons || []).map((a) => a.name);

      return `
        <div class="cart-row">
          ${item.image ? `<img src="${item.image}" alt="${item.name}" />` : ""}
          <div class="cart-row-info">
            <strong>${item.name}</strong>
            ${details.length ? `<span class="cart-row-meta">${details.join(" \u00b7 ")}</span>` : ""}
            ${addonNames.length ? `<span class="cart-row-meta">+ ${addonNames.join(", ")}</span>` : ""}
            <div class="cart-qty">
              <button class="qty-btn" data-key="${item.key}" data-delta="-1">&minus;</button>
              <span>${item.quantity}</span>
              <button class="qty-btn" data-key="${item.key}" data-delta="1">+</button>
            </div>
          </div>
          <div class="cart-row-right">
            <span class="cart-row-price">$${lineTotal.toFixed(2)}</span>
            <button class="cart-remove" data-key="${item.key}">Remove</button>
          </div>
        </div>`;
    })
    .join("");

  if (footer) {
    footer.style.display = "block";
    document.getElementById("cart-total").textContent = `$${cartTotal(cart).toFixed(2)}`;
  }

  body.querySelectorAll(".qty-btn").forEach((btn) => {
    btn.addEventListener("click", () => changeQuantity(btn.dataset.key, parseInt(btn.dataset.delta, 10)));
  });
  body.querySelectorAll(".cart-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeFromCart(btn.dataset.key));
  });
}

async function checkoutCart() {
  const cart = getCart();
  if (cart.length === 0) return;

  const items = [];
  const noteParts = [];

  cart.forEach((item) => {
    items.push({ priceId: item.priceId, quantity: item.quantity });
    const details = [];
    if (item.size) details.push(`Size ${item.size}`);
    if (item.color) details.push(`Color ${item.color}`);
    const addonNames = (item.addons || []).map((a) => a.name);
    (item.addons || []).forEach((a) => items.push({ priceId: a.priceId, quantity: item.quantity }));
    let line = item.name;
    if (details.length) line += ` (${details.join(", ")})`;
    if (addonNames.length) line += ` + ${addonNames.join(", ")}`;
    noteParts.push(line);
  });

  const notes = noteParts.join("; ").slice(0, 250);

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

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();

  document.querySelectorAll(".cart-toggle").forEach((btn) => {
    btn.addEventListener("click", openCart);
  });
  const closeBtn = document.getElementById("cart-close");
  if (closeBtn) closeBtn.addEventListener("click", closeCart);
  const overlay = document.getElementById("cart-overlay");
  if (overlay) overlay.addEventListener("click", closeCart);
  const checkoutBtn = document.getElementById("cart-checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", checkoutCart);

  if (window.location.hash === "#cart") openCart();
});
