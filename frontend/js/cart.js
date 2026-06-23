document.addEventListener('DOMContentLoaded', async () => {
  // Render shared layouts
  renderSharedLayout();

  // Route protection
  const token = localStorage.getItem('token');
  if (!token) {
    API.showToast('Please login to view your cart & wishlist.', true);
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 1500);
    return;
  }

  // Load datasets
  await loadCart();
  await loadWishlist();

  // Coupon Application
  document.getElementById('btn-apply-coupon').addEventListener('click', () => {
    applyCouponLocally();
  });

  // Handle Checkout submission
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleCheckout();
  });
});

let cartItemsList = [];
let cartTotalVal = 0;
let appliedCouponCode = '';
let discountPercent = 0;

async function loadCart() {
  try {
    const res = await API.get('/cart');
    cartItemsList = res.data.items || [];
    cartTotalVal = res.data.cartTotal || 0;
    renderCart();
  } catch (err) {
    console.error('Failed to load cart:', err);
    document.getElementById('cart-items-container').innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger">Failed to load cart items.</td>
      </tr>
    `;
  }
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  if (cartItemsList.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">
          <i class="bi bi-cart-x fs-2 d-block mb-2"></i> Your shopping cart is empty.
        </td>
      </tr>
    `;
    updateCheckoutTotals();
    return;
  }

  container.innerHTML = cartItemsList.map(item => {
    const imageUrl = item.image_url ? `http://localhost:5000/${item.image_url}` : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
    const total = item.price * item.quantity;
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-3">
            <img src="${imageUrl}" class="rounded border" style="width: 50px; height: 50px; object-fit: cover;">
            <span class="fw-bold">${item.name}</span>
          </div>
        </td>
        <td><span class="badge bg-light text-dark">${item.category}</span></td>
        <td>₹${item.price.toFixed(2)}</td>
        <td>
          <div class="input-group input-group-sm">
            <button class="btn btn-outline-secondary" type="button" onclick="changeQty(${item.product_id}, ${item.quantity - 1})">-</button>
            <input type="text" class="form-control text-center bg-white" value="${item.quantity}" readonly style="max-width: 45px;">
            <button class="btn btn-outline-secondary" type="button" onclick="changeQty(${item.product_id}, ${item.quantity + 1})">+</button>
          </div>
        </td>
        <td>₹${total.toFixed(2)}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="removeCartItem(${item.product_id})">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateCheckoutTotals();
}

function updateCheckoutTotals() {
  const discountVal = (cartTotalVal * discountPercent) / 100;
  const finalTotalVal = cartTotalVal - discountVal;

  document.getElementById('checkout-subtotal').innerText = `₹${cartTotalVal.toFixed(2)}`;
  document.getElementById('checkout-discount').innerText = `-₹${discountVal.toFixed(2)}`;
  document.getElementById('checkout-total').innerText = `₹${Math.max(0, finalTotalVal).toFixed(2)}`;
}

window.changeQty = async (productId, newQty) => {
  if (newQty <= 0) {
    await removeCartItem(productId);
    return;
  }
  try {
    const res = await API.put(`/cart/${productId}`, { quantity: newQty });
    if (res.success) {
      API.showToast('Quantity updated.');
      await loadCart();
    }
  } catch (err) {
    API.showToast(err.message || 'Failed to update quantity.', true);
  }
};

window.removeCartItem = async (productId) => {
  try {
    const res = await API.delete(`/cart/${productId}`);
    if (res.success) {
      API.showToast('Item removed from cart.');
      await loadCart();
    }
  } catch (err) {
    API.showToast('Failed to remove item.', true);
  }
};

function applyCouponLocally() {
  const code = document.getElementById('couponCodeInput').value.trim().toUpperCase();
  const successEl = document.getElementById('couponSuccessMessage');
  const errorEl = document.getElementById('couponErrorMessage');

  successEl.classList.add('d-none');
  errorEl.classList.add('d-none');

  if (!code) {
    discountPercent = 0;
    appliedCouponCode = '';
    updateCheckoutTotals();
    return;
  }

  // Pre-approved list for local UI validation
  if (code === 'SAVE10') {
    discountPercent = 10;
    appliedCouponCode = code;
    successEl.innerText = 'Coupon SAVE10 applied! 10% discount.';
    successEl.classList.remove('d-none');
  } else if (code === 'WELCOME20') {
    discountPercent = 20;
    appliedCouponCode = code;
    successEl.innerText = 'Coupon WELCOME20 applied! 20% discount.';
    successEl.classList.remove('d-none');
  } else if (code === 'SUPERDEAL50') {
    discountPercent = 50;
    appliedCouponCode = code;
    successEl.innerText = 'Coupon SUPERDEAL50 applied! 50% discount.';
    successEl.classList.remove('d-none');
  } else if (code === 'VERIFY10') {
    discountPercent = 10;
    appliedCouponCode = code;
    successEl.innerText = 'Coupon VERIFY10 applied! 10% discount.';
    successEl.classList.remove('d-none');
  } else {
    // Treat other coupons as tentative (verified by backend on place order)
    discountPercent = 0;
    appliedCouponCode = code;
    successEl.innerText = `Coupon '${code}' stored. Validity will be checked at checkout.`;
    successEl.classList.remove('d-none');
  }

  updateCheckoutTotals();
}

async function handleCheckout() {
  if (cartItemsList.length === 0) {
    API.showToast('Your cart is empty.', true);
    return;
  }

  const payload = {
    coupon_code: appliedCouponCode || null,
    shipping_method: document.getElementById('shippingMethod').value,
    payment_method: document.getElementById('paymentMethod').value,
    recipient_name: document.getElementById('shippingName').value.trim(),
    delivery_address: document.getElementById('shippingAddress').value.trim(),
    recipient_phone: document.getElementById('shippingPhone').value.trim(),
  };

  try {
    const res = await API.post('/orders', payload);
    if (res.success) {
      API.showToast(`Order Placed Successfully! Final total: ₹${res.data.finalPrice.toFixed(2)}`, false);
      
      // Reset checkout details
      document.getElementById('checkout-form').reset();
      document.getElementById('couponCodeInput').value = '';
      document.getElementById('couponSuccessMessage').classList.add('d-none');
      appliedCouponCode = '';
      discountPercent = 0;

      // Reload lists
      await loadCart();

      // Redirect to Customer Dashboard so user can see shipping status
      setTimeout(() => {
        window.location.href = 'customer.html';
      }, 1500);
    }
  } catch (err) {
    API.showToast(err.message || 'Checkout failed. Please check stock levels or wallet balance.', true);
  }
}

// ========================
// WISHLIST LOGIC
// ========================

async function loadWishlist() {
  try {
    const res = await API.get('/wishlist');
    renderWishlist(res.data || []);
  } catch (err) {
    console.error('Failed to load wishlist:', err);
    document.getElementById('wishlist-items-container').innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger">Failed to load wishlist.</td>
      </tr>
    `;
  }
}

function renderWishlist(items) {
  const container = document.getElementById('wishlist-items-container');
  if (items.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          <i class="bi bi-heart fs-3 d-block mb-2"></i> Your wishlist is empty.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const imageUrl = item.image_url ? `http://localhost:5000/${item.image_url}` : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
    const stockBadge = item.stock > 0 ? `<span class="badge bg-success">In Stock (${item.stock})</span>` : '<span class="badge bg-danger">Out of Stock</span>';
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-3">
            <img src="${imageUrl}" class="rounded border" style="width: 50px; height: 50px; object-fit: cover;">
            <span class="fw-bold">${item.name}</span>
          </div>
        </td>
        <td><span class="badge bg-light text-dark">${item.category}</span></td>
        <td>₹${item.price.toFixed(2)}</td>
        <td>${stockBadge}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-premium-primary" onclick="moveWishlistToCart(${item.product_id})">
              Add to Cart
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="removeWishlistItem(${item.product_id})">
              <i class="bi bi-heartbreak"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.moveWishlistToCart = async (productId) => {
  try {
    // Add to cart
    const cartRes = await API.post('/cart', { product_id: productId, quantity: 1 });
    if (cartRes.success) {
      // Remove from wishlist
      await API.delete(`/wishlist/${productId}`);
      API.showToast('Moved to cart!');
      await loadCart();
      await loadWishlist();
    }
  } catch (err) {
    API.showToast(err.message || 'Failed to move to cart.', true);
  }
};

window.removeWishlistItem = async (productId) => {
  try {
    const res = await API.delete(`/wishlist/${productId}`);
    if (res.success) {
      API.showToast('Removed from wishlist.');
      await loadWishlist();
    }
  } catch (err) {
    API.showToast('Failed to remove item.', true);
  }
};
