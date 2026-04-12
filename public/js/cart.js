let cart = [];
let productsDetails = [];
let subtotal = 0;
let discountAmount = 0;
let pointsReduction = 0;
let appliedDiscountId = null;
let userPoints = 0;
let usePoints = false;

function normalizeCart(rawCart) {
  const quantityMap = new Map();
  if (!Array.isArray(rawCart)) return [];
  rawCart.forEach(item => {
    if (typeof item === 'string') {
      quantityMap.set(item, (quantityMap.get(item) || 0) + 1);
    } else if (item && typeof item === 'object' && item.productId) {
      const qty = Number(item.quantity) || 1;
      quantityMap.set(item.productId, (quantityMap.get(item.productId) || 0) + qty);
    }
  });
  return Array.from(quantityMap.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

async function loadCart() {
  try {
    const rawCart = JSON.parse(localStorage.getItem('cart')) || [];
    console.log('Cart raw data:', rawCart);

    cart = normalizeCart(rawCart);

    if (cart.length === 0) {
    document.getElementById('cartItems').innerHTML = `<p>${window.translations?.cartEmpty || 'Cart is empty'}</p>`;
      return;
    }

    productsDetails = [];
    let cleanedCart = Array.isArray(rawCart) ? [...rawCart] : [];
    let cartChanged = false;

    for (let item of cart) {
      const res = await fetch(`/api/product/${item.productId}`);
      if (!res.ok) {
        console.warn(`Product ${item.productId} not found, removing from cart`);
        cleanedCart = cleanedCart.filter(entry => {
          return typeof entry === 'string'
            ? entry !== item.productId
            : entry.productId !== item.productId;
        });
        cartChanged = true;
        continue;
      }

      const p = await res.json();
      if (!p || !p._id) {
        console.warn(`Product ${item.productId} returned invalid payload, removing from cart`);
        cleanedCart = cleanedCart.filter(entry => {
          return typeof entry === 'string'
            ? entry !== item.productId
            : entry.productId !== item.productId;
        });
        cartChanged = true;
        continue;
      }

      productsDetails.push({ ...p, cartQuantity: item.quantity });
    }

    if (cartChanged) {
      localStorage.setItem('cart', JSON.stringify(cleanedCart));
      if (typeof updateCartCount === 'function') updateCartCount();
    }

    if (productsDetails.length === 0) {
      document.getElementById('cartItems').innerHTML = `<p>${window.translations?.cartEmpty || 'Cart is empty'} (invalid items removed)</p>`;
      resetTotals();
      return;
    }

    renderCart();
    await fetchUserPoints();
    calculateTotals();
  } catch (err) {
    console.error('loadCart error:', err);
    document.getElementById('cartItems').innerHTML = `<p>${window.translations?.errorLoadingCart || 'Error loading cart. Please refresh.'}</p>`;
  }
}

function renderCart() {
  let html = '<div class="cart-items-list">';
  productsDetails.forEach(p => {
    html += `
      <div class="cart-item">
        <div><strong>${escapeHtml(p.name)}</strong> - $${p.price.toFixed(2)}</div>
        <div>
          <button class="qty-btn" data-id="${p._id}" data-delta="-1">-</button>
          <span id="qty-${p._id}">${p.cartQuantity}</span>
          <button class="qty-btn" data-id="${p._id}" data-delta="1">+</button>
          <button class="remove-btn" data-id="${p._id}">🗑️</button>
        </div>
      </div>
    `;
  });
  html += `<button id="clearCartBtn" style="margin-top: 1rem; background: #dc2626; color: white; border: none; padding: 0.75rem 1rem; cursor: pointer;">🗑️ Clear Entire Cart</button>`;
  html += '</div>';
  document.getElementById('cartItems').innerHTML = html;

  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = btn.dataset.id;
      const delta = parseInt(btn.dataset.delta, 10);
      changeQuantity(productId, delta);
    });
  });

  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = btn.dataset.id;
      removeItem(productId);
    });
  });

  const clearBtn = document.getElementById('clearCartBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Remove all items from cart?')) {
        localStorage.setItem('cart', JSON.stringify([]));
        loadCart();
        if (typeof updateCartCount === 'function') updateCartCount();
      }
    });
  }
}

function changeQuantity(productId, delta) {
  const rawCart = JSON.parse(localStorage.getItem('cart')) || [];
  const objectCart = Array.isArray(rawCart) && rawCart.every(item => item && typeof item === 'object' && item.productId);

  if (objectCart) {
    const updated = normalizeCart(rawCart).map(item => ({ ...item }));
    const entry = updated.find(item => item.productId === productId);
    if (delta === 1) {
      if (entry) entry.quantity += 1;
      else updated.push({ productId, quantity: 1 });
    } else if (delta === -1 && entry) {
      entry.quantity = Math.max(0, entry.quantity - 1);
      if (entry.quantity === 0) {
        const index = updated.findIndex(item => item.productId === productId);
        if (index !== -1) updated.splice(index, 1);
      }
    }
    localStorage.setItem('cart', JSON.stringify(updated));
  } else {
    let cartArray = rawCart.filter(id => typeof id === 'string');
    if (delta === 1) {
      cartArray.push(productId);
    } else if (delta === -1) {
      const index = cartArray.lastIndexOf(productId);
      if (index !== -1) cartArray.splice(index, 1);
    }
    localStorage.setItem('cart', JSON.stringify(cartArray));
  }

  loadCart();
  if (typeof updateCartCount === 'function') updateCartCount();
}

function removeItem(productId) {
  const rawCart = JSON.parse(localStorage.getItem('cart')) || [];
  const objectCart = Array.isArray(rawCart) && rawCart.every(item => item && typeof item === 'object' && item.productId);

  if (objectCart) {
    const updated = rawCart.filter(entry => entry.productId !== productId);
    localStorage.setItem('cart', JSON.stringify(updated));
  } else {
    const updated = rawCart.filter(id => id !== productId);
    localStorage.setItem('cart', JSON.stringify(updated));
  }

  loadCart();
  if (typeof updateCartCount === 'function') updateCartCount();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

async function fetchUserPoints() {
  try {
    const res = await fetch('/api/user-points');
    const data = await res.json();
    userPoints = data.points || 0;
    const userPointsElem = document.getElementById('userPoints');
    if (userPointsElem) userPointsElem.innerText = userPoints;
    const usePointsCheckbox = document.getElementById('usePoints');
    if (usePointsCheckbox) usePointsCheckbox.checked = false;
    usePoints = false;
  } catch (err) {
    console.error('Failed to fetch points:', err);
    userPoints = 0;
  }
}

function calculateTotals() {
  subtotal = productsDetails.reduce((sum, p) => sum + (p.price * p.cartQuantity), 0);
  const subtotalElem = document.getElementById('orderSubtotal');
  if (subtotalElem) subtotalElem.innerText = `$${subtotal.toFixed(2)}`;

  const discountElem = document.getElementById('orderDiscount');
  if (discountElem) discountElem.innerText = `$${discountAmount.toFixed(2)}`;

  if (usePoints) {
    const maxPointsRedeemable = Math.floor(userPoints / 100);
    const remainingAfterDiscount = Math.max(0, subtotal - discountAmount);
    pointsReduction = Math.min(maxPointsRedeemable, remainingAfterDiscount);
  } else {
    pointsReduction = 0;
  }

  const pointsElem = document.getElementById('orderPoints');
  if (pointsElem) pointsElem.innerText = `$${pointsReduction.toFixed(2)}`;

  const totalElem = document.getElementById('orderTotal');
  if (totalElem) totalElem.innerText = `$${(subtotal - discountAmount - pointsReduction).toFixed(2)}`;
}

function resetTotals() {
  subtotal = 0;
  discountAmount = 0;
  pointsReduction = 0;
  const subtotalElem = document.getElementById('orderSubtotal');
  if (subtotalElem) subtotalElem.innerText = '$0.00';
  const discountElem = document.getElementById('orderDiscount');
  if (discountElem) discountElem.innerText = '$0.00';
  const pointsElem = document.getElementById('orderPoints');
  if (pointsElem) pointsElem.innerText = '$0.00';
  const totalElem = document.getElementById('orderTotal');
  if (totalElem) totalElem.innerText = '$0.00';
}

async function applyDiscount() {
  const code = document.getElementById('discountCode')?.value;
  if (!code) return;
  const res = await fetch('/api/validate-discount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal })
  });
  const data = await res.json();
  const message = document.getElementById('discountMessage');
  if (data.valid) {
    discountAmount = data.discountAmount;
    appliedDiscountId = data.discountId || null;
    if (message) message.innerHTML = `<span style="color:green;">${data.message}</span>`;
  } else {
    discountAmount = 0;
    appliedDiscountId = null;
    if (message) message.innerHTML = `<span style="color:red;">${data.message}</span>`;
  }
  calculateTotals();
}

function updateOrderTotal() {
  calculateTotals();
}

function getPhoneValue() {
  return document.getElementById('phone')?.value || document.getElementById('phoneNumber')?.value;
}

document.getElementById('applyDiscount')?.addEventListener('click', applyDiscount);
document.getElementById('usePoints')?.addEventListener('change', (e) => {
  usePoints = e.target.checked;
  if (usePoints && userPoints < 100) {
    alert(window.translations?.pointsInsufficient || 'You need at least 100 points to redeem.');
    e.target.checked = false;
    usePoints = false;
  }
  calculateTotals();
});

document.getElementById('placeOrder')?.addEventListener('click', async () => {
  const pickupTime = document.getElementById('pickupTime')?.value;
  const phone = getPhoneValue();
  if (!pickupTime) { alert(window.translations?.pickupTimeRequired || 'Please select pickup time'); return; }
  if (!phone) { alert(window.translations?.phoneRequired || 'Please enter phone number'); return; }

  const items = cart.map(item => ({ productId: item.productId, quantity: item.quantity }));
  const pointsRedeemed = usePoints ? Math.round(pointsReduction * 100) : 0;

  const res = await fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, pickupTime, phone, discountId: appliedDiscountId, pointsRedeemed })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.removeItem('cart');
    if (typeof updateCartCount === 'function') updateCartCount();
    document.getElementById('message').innerHTML = `<span style="color:green;">Order placed! Tracking code: ${data.trackingCode}</span>`;
    appliedDiscountId = null;
    discountAmount = 0;
    pointsReduction = 0;
    loadCart();
  } else {
    alert('Error: ' + data.error);
  }
});

loadCart();
