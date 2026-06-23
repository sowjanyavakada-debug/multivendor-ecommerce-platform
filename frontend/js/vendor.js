document.addEventListener('DOMContentLoaded', async () => {
  renderSharedLayout();

  // Route protection
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'vendor') {
    API.showToast('Access denied. Vendor login required.', true);
    setTimeout(() => { window.location.href = 'auth.html'; }, 1500);
    return;
  }

  // Load dashboard panels
  await refreshDashboard();

  // Bind forms
  setupFormBindings();
});

async function refreshDashboard() {
  await loadStats();
  await loadVendorProducts();
  await loadVendorOrders();
  await loadStoreProfile();
  await loadVendorCoupons();
  await loadRefundRequests();
  await loadChatThreads();
  await loadVendorReviews();
  await loadVendorReports();
}

// Stats & warning display
async function loadStats() {
  try {
    const res = await API.get('/vendor/stats');
    const stats = res.data;

    document.getElementById('stat-total-products').innerText = stats.totalProducts;
    document.getElementById('stat-total-orders').innerText = stats.totalOrders;
    document.getElementById('stat-total-revenue').innerText = `₹${stats.totalRevenue.toFixed(2)}`;
    document.getElementById('stat-low-stock').innerText = stats.lowStockCount;

    const banner = document.getElementById('low-stock-banner');
    const details = document.getElementById('low-stock-details');
    if (stats.lowStockCount > 0) {
      banner.classList.remove('d-none');
      const listStr = stats.lowStockProducts.map(p => `${p.name} (Stock: ${p.stock})`).join(', ');
      details.innerHTML = `<strong>Low Stock Alert:</strong> ${listStr}`;
    } else {
      banner.classList.add('d-none');
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Vendor products catalog
async function loadVendorProducts() {
  try {
    const res = await API.get('/vendor/products');
    renderVendorProducts(res.data || []);
  } catch (err) {
    document.getElementById('vendor-products-container').innerHTML = `
      <tr><td colspan="6" class="text-center text-danger">Failed to load product catalog.</td></tr>
    `;
  }
}

function renderVendorProducts(products) {
  const container = document.getElementById('vendor-products-container');
  if (products.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No products created yet.</td></tr>`;
    return;
  }

  container.innerHTML = products.map(prod => {
    const img = prod.image_url ? (prod.image_url.startsWith('http') ? prod.image_url : `http://localhost:5000/${prod.image_url}`) : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
    let statusClass = 'pending';
    if (prod.status === 'Approved') statusClass = 'approved';
    if (prod.status === 'Rejected') statusClass = 'blocked';

    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-3">
            <img src="${img}" class="rounded border" style="width: 45px; height: 45px; object-fit: cover;">
            <span class="fw-bold text-dark">${prod.name}</span>
          </div>
        </td>
        <td><span class="badge bg-light text-dark border">${prod.category}</span></td>
        <td>₹${parseFloat(prod.price).toFixed(2)}</td>
        <td><span class="fw-semibold ${prod.stock <= 5 ? 'text-danger' : ''}">${prod.stock} units</span></td>
        <td><span class="custom-badge ${statusClass}">${prod.status || 'Approved'}</span></td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary px-2" onclick="editProduct(${JSON.stringify(prod).replace(/"/g, '&quot;')})">Edit</button>
            <button class="btn btn-sm btn-outline-danger px-2" onclick="deleteProduct(${prod.id})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Vendor orders queue
async function loadVendorOrders() {
  try {
    const res = await API.get('/vendor/orders');
    renderVendorOrders(res.data || []);
  } catch (err) {
    document.getElementById('vendor-orders-container').innerHTML = `
      <tr><td colspan="6" class="text-center text-danger">Failed to load incoming orders.</td></tr>
    `;
  }
}

function renderVendorOrders(orders) {
  const container = document.getElementById('vendor-orders-container');
  if (orders.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No incoming orders yet.</td></tr>`;
    return;
  }

  container.innerHTML = orders.map(ord => {
    const itemsListHtml = ord.items.map(i => `
      <div class="small fw-semibold text-truncate" style="max-width: 250px;">
        • ${i.product_name} <span class="text-muted">(x${i.quantity})</span>
      </div>
    `).join('');

    const formattedDate = new Date(ord.order_date).toLocaleString();
    let statusClass = 'custom-badge pending';
    if (ord.status === 'Processing') statusClass = 'custom-badge pending text-primary bg-primary-subtle';
    if (ord.status === 'Shipped') statusClass = 'custom-badge pending text-info bg-info-subtle';
    if (ord.status === 'Delivered') statusClass = 'custom-badge approved';
    if (ord.status === 'Cancelled') statusClass = 'custom-badge blocked';

    const disabled = ord.status === 'Cancelled' || ord.status === 'Delivered' ? 'disabled' : '';

    return `
      <tr>
        <td class="fw-bold text-dark">#${ord.id}</td>
        <td>
          <div class="fw-semibold text-dark">${ord.customer_name}</div>
          <small class="text-muted">${ord.customer_email}</small>
        </td>
        <td>${itemsListHtml}</td>
        <td class="fw-bold text-success">₹${ord.vendorSubtotal.toFixed(2)}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="${statusClass}">${ord.status}</span>
            <select class="form-select form-select-sm" style="max-width: 130px;" ${disabled} onchange="handleStatusChange(${ord.id}, this.value)">
              <option value="Pending" ${ord.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Processing" ${ord.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${ord.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${ord.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${ord.status === 'Cancelled' ? 'selected' : ''}>Cancel Order</option>
            </select>
          </div>
        </td>
        <td class="small text-muted">${formattedDate}</td>
      </tr>
    `;
  }).join('');
}

window.handleStatusChange = async (orderId, newStatus) => {
  if (newStatus === 'Shipped') {
    document.getElementById('shipping-order-id').value = orderId;
    document.getElementById('shippingTracking').value = '';
    
    try {
      const res = await API.get('/orders/delivery-partners');
      const partners = res.data || [];
      const carrierSelect = document.getElementById('shippingCarrier');
      carrierSelect.innerHTML = partners.map(p => `<option value="${p.id}">${p.name} (${p.phone})</option>`).join('');
      
      const modal = new bootstrap.Modal(document.getElementById('shippingModal'));
      modal.show();
    } catch (err) {
      API.showToast('Failed to load delivery partners', true);
      await loadVendorOrders();
    }
  } else {
    try {
      await API.put(`/orders/${orderId}/status`, { status: newStatus });
      API.showToast(`Order status updated to ${newStatus}.`);
      await refreshDashboard();
    } catch (err) {
      API.showToast(err.message, true);
      await loadVendorOrders();
    }
  }
};

// Edit Product helper
window.editProduct = (prod) => {
  document.getElementById('formModalTitle').innerText = 'Edit Product';
  document.getElementById('crudProductId').value = prod.id;
  document.getElementById('prodName').value = prod.name;
  document.getElementById('prodCategory').value = prod.category;
  document.getElementById('prodPrice').value = prod.price;
  document.getElementById('prodStock').value = prod.stock;
  document.getElementById('prodDesc').value = prod.description || '';
  document.getElementById('prodImage').value = prod.image_url || '';
  document.getElementById('prodFeatured').checked = prod.is_featured === 1;

  const modal = new bootstrap.Modal(document.getElementById('productFormModal'));
  modal.show();
};

window.deleteProduct = async (productId) => {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await API.delete(`/products/${productId}`);
    API.showToast('Product deleted successfully.');
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Store Profile management
async function loadStoreProfile() {
  try {
    const res = await API.get('/vendor/store');
    const store = res.data;
    if (store) {
      document.getElementById('storeName').value = store.store_name || '';
      document.getElementById('storeLogo').value = store.store_logo || '';
      document.getElementById('storeBanner').value = store.store_banner || '';
      document.getElementById('storeDesc').value = store.store_description || '';
      document.getElementById('store-commission-lbl').innerText = `${parseFloat(store.commission_rate).toFixed(2)}%`;
    }
  } catch (err) {
    console.error('Failed to load store profile:', err);
  }
}

// Coupons Management
async function loadVendorCoupons() {
  const container = document.getElementById('vendor-coupons-container');
  try {
    const res = await API.get('/vendor/coupons');
    const coupons = res.data || [];
    if (coupons.length === 0) {
      container.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No active coupons.</td></tr>`;
      return;
    }

    container.innerHTML = coupons.map(c => `
      <tr>
        <td class="fw-bold">#${c.id}</td>
        <td class="fw-bold text-primary">${c.code}</td>
        <td class="fw-semibold">${c.discount_percentage}% OFF</td>
        <td>${c.expiry_date}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger px-2" onclick="deleteCoupon(${c.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load coupons.</td></tr>`;
  }
}

window.deleteCoupon = async (id) => {
  try {
    await API.delete(`/vendor/coupons/${id}`);
    API.showToast('Coupon deleted.');
    await loadVendorCoupons();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Refund Requests Moderation
async function loadRefundRequests() {
  const container = document.getElementById('vendor-refunds-container');
  try {
    const res = await API.get('/refunds/vendor');
    const refunds = res.data || [];
    if (refunds.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No pending refund requests.</td></tr>`;
      return;
    }

    container.innerHTML = refunds.map(r => {
      let statusClass = 'pending';
      if (r.status === 'Approved') statusClass = 'approved';
      if (r.status === 'Rejected') statusClass = 'blocked';

      const actions = r.status === 'Pending' 
        ? `<div class="d-flex gap-2">
             <button class="btn btn-success btn-sm" onclick="resolveRefund(${r.id}, 'Approved')">Accept</button>
             <button class="btn btn-danger btn-sm" onclick="resolveRefund(${r.id}, 'Rejected')">Reject</button>
           </div>`
        : `<span class="text-muted small">Resolved</span>`;

      return `
        <tr>
          <td><span class="fw-bold text-dark">#${r.order_id}</span></td>
          <td>${r.customer_name}</td>
          <td><small class="text-muted">${r.reason}</small></td>
          <td class="fw-bold text-danger">₹${parseFloat(r.amount).toFixed(2)}</td>
          <td><span class="custom-badge ${statusClass}">${r.status}</span></td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load refund requests.</td></tr>`;
  }
}

window.resolveRefund = async (refundId, status) => {
  try {
    await API.put(`/refunds/${refundId}/status`, { status });
    API.showToast(`Refund request set to ${status}.`);
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Messaging logic
let activeChatOtherId = null;
let activeChatOtherRole = null;

async function loadChatThreads() {
  const container = document.getElementById('chat-sidebar-threads');
  try {
    const res = await API.get('/messages/chats');
    const chats = res.data || [];
    if (chats.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted small">No active chats inbox</div>`;
      return;
    }

    container.innerHTML = chats.map(chat => {
      const activeClass = (activeChatOtherId === chat.other_id && activeChatOtherRole === chat.other_role) ? 'active' : '';
      const time = chat.lastTimestamp ? new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="chat-sidebar-item ${activeClass}" onclick="openChatThread(${chat.other_id}, '${chat.other_role}', '${chat.other_name}')">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fw-bold small text-dark">${chat.other_name}</span>
            <small class="text-muted" style="font-size: 0.7rem;">${time}</small>
          </div>
          <div class="small text-muted text-truncate" style="max-width: 210px;">${chat.lastMessage || 'Open thread'}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load vendor threads:', err);
  }
}

window.openChatThread = async (otherId, role, name) => {
  activeChatOtherId = otherId;
  activeChatOtherRole = role;

  document.getElementById('chat-active-name').innerText = name;
  document.getElementById('chat-active-role').innerText = 'Client Customer';

  await loadChatThreads();
  await loadMessages();

  document.getElementById('chat-send-form').classList.remove('d-none');
};

async function loadMessages() {
  if (!activeChatOtherId || !activeChatOtherRole) return;
  const container = document.getElementById('chat-messages-container');
  try {
    const res = await API.get(`/messages/history?other_id=${activeChatOtherId}&other_role=${activeChatOtherRole}`);
    const messages = res.data || [];
    if (messages.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted">No messages yet.</div>`;
      return;
    }

    container.innerHTML = messages.map(msg => {
      const isSelf = msg.sender_role === 'vendor';
      const bubbleClass = isSelf ? 'self' : 'other';
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="chat-bubble ${bubbleClass}">
          <div>${msg.message}</div>
          <span class="chat-time">${time}</span>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.error('Failed to load chat messages:', err);
  }
}

// Bind vendor forms
function setupFormBindings() {
  // Product Save/Update Form
  const prodForm = document.getElementById('product-crud-form');
  if (prodForm) {
    prodForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('crudProductId').value;
      const payload = {
        name: document.getElementById('prodName').value.trim(),
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        stock: parseInt(document.getElementById('prodStock').value),
        description: document.getElementById('prodDesc').value.trim(),
        image_url: document.getElementById('prodImage').value.trim(),
        is_featured: document.getElementById('prodFeatured').checked ? 1 : 0
      };

      try {
        if (id) {
          await API.put(`/products/${id}`, payload);
          API.showToast('Product updated successfully.');
        } else {
          await API.post('/products', payload);
          API.showToast('Product created successfully.');
        }

        const modalEl = document.getElementById('productFormModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        await refreshDashboard();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Store Profile updates Form
  const storeForm = document.getElementById('store-profile-form');
  if (storeForm) {
    storeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        store_name: document.getElementById('storeName').value.trim(),
        store_logo: document.getElementById('storeLogo').value.trim(),
        store_banner: document.getElementById('storeBanner').value.trim(),
        store_description: document.getElementById('storeDesc').value.trim()
      };

      try {
        await API.put('/vendor/store', payload);
        API.showToast('Store branding details updated successfully.');
        await refreshDashboard();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Coupon Creation Form
  const couponForm = document.getElementById('vendor-create-coupon-form');
  if (couponForm) {
    couponForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        code: document.getElementById('vendorCouponCode').value.toUpperCase().trim(),
        discount_percentage: parseFloat(document.getElementById('vendorCouponDiscount').value),
        expiry_date: document.getElementById('vendorCouponExpiry').value
      };

      try {
        await API.post('/vendor/coupons', payload);
        API.showToast('Shop Coupon created successfully.');
        couponForm.reset();
        await loadVendorCoupons();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Bulk Upload Form
  const bulkForm = document.getElementById('bulk-upload-form');
  if (bulkForm) {
    bulkForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('bulkData').value.trim();

      try {
        const productsList = JSON.parse(text);
        await API.post('/vendor/products/bulk', { products: productsList });
        API.showToast('Bulk catalog items uploaded.');
        
        const modalEl = document.getElementById('bulkUploadModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        bulkForm.reset();

        await refreshDashboard();
      } catch (err) {
        API.showToast('Invalid JSON format or upload error. Make sure it matches required structure.', true);
      }
    });
  }

  // Payout request Form
  const payoutForm = document.getElementById('payout-form');
  if (payoutForm) {
    payoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('payout-amount').value;

      try {
        await API.post('/vendor/payout', { amount });
        API.showToast(`Transfer request of ₹${parseFloat(amount).toFixed(2)} completed.`);
        
        const modalEl = document.getElementById('payoutModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        payoutForm.reset();

        await refreshDashboard();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Chat send form
  const chatForm = document.getElementById('chat-send-form');
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input-text');
      const message = input.value.trim();

      if (!message || !activeChatOtherId || !activeChatOtherRole) return;

      try {
        await API.post('/messages/send', {
          receiver_id: activeChatOtherId,
          receiver_role: activeChatOtherRole,
          message
        });
        input.value = '';
        await loadMessages();
        await loadChatThreads();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Shipping details form submission
  const shippingForm = document.getElementById('shipping-details-form');
  if (shippingForm) {
    shippingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = document.getElementById('shipping-order-id').value;
      const delivery_partner_id = parseInt(document.getElementById('shippingCarrier').value);
      const tracking_number = document.getElementById('shippingTracking').value.trim();

      try {
        await API.put(`/orders/${orderId}/status`, {
          status: 'Shipped',
          tracking_number,
          delivery_partner_id
        });
        API.showToast('Order status updated to Shipped with tracking info.');

        const modalEl = document.getElementById('shippingModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        if (modal) modal.hide();
        shippingForm.reset();
        await refreshDashboard();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Reset order list on shipping modal close/dismiss to clean select visually
  const shippingModalEl = document.getElementById('shippingModal');
  if (shippingModalEl) {
    shippingModalEl.addEventListener('hidden.bs.modal', async () => {
      await loadVendorOrders();
    });
  }
}

// Load sales & reports details
async function loadVendorReports() {
  const container = document.getElementById('vendor-reports-container');
  if (!container) return;

  try {
    const res = await API.get('/vendor/orders');
    const orders = res.data || [];
    
    // Filter non-cancelled orders for reports calculation
    const completedOrders = orders.filter(o => o.status !== 'Cancelled');
    
    const itemsSold = [];
    completedOrders.forEach(ord => {
      const date = new Date(ord.order_date).toLocaleDateString('en-IN');
      ord.items.forEach(item => {
        const gross = item.price * item.quantity;
        const comm = gross * 0.10; // platform commission
        const net = gross - comm;
        itemsSold.push({
          orderId: ord.id,
          productName: item.product_name,
          quantity: item.quantity,
          gross,
          commission: comm,
          net,
          date
        });
      });
    });

    if (itemsSold.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No sales completed yet.</td></tr>`;
      return;
    }

    container.innerHTML = itemsSold.map(item => `
      <tr>
        <td class="fw-bold">#${item.orderId}</td>
        <td class="fw-semibold text-dark">${item.productName}</td>
        <td>${item.quantity} units</td>
        <td class="fw-semibold">₹${item.gross.toFixed(2)}</td>
        <td class="text-danger">-₹${item.commission.toFixed(2)}</td>
        <td class="fw-bold text-success">₹${item.net.toFixed(2)}</td>
        <td class="small text-muted">${item.date}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load sales report:', err);
    container.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load reports.</td></tr>`;
  }
}

// Load customer product reviews
async function loadVendorReviews() {
  const container = document.getElementById('vendor-reviews-container');
  if (!container) return;

  try {
    const res = await API.get('/vendor/reviews');
    const reviews = res.data || [];
    if (reviews.length === 0) {
      container.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No customer reviews yet.</td></tr>`;
      return;
    }

    container.innerHTML = reviews.map(r => {
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        starsHtml += i <= r.rating ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-warning"></i>';
      }
      return `
        <tr>
          <td class="fw-semibold text-dark">${r.product_name}</td>
          <td>${r.reviewer_name}</td>
          <td>${starsHtml}</td>
          <td><small class="text-muted text-wrap">${r.review}</small></td>
          <td>
            <button class="btn btn-outline-danger btn-sm px-2" onclick="deleteReview(${r.id})"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load reviews:', err);
    container.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load reviews.</td></tr>`;
  }
}

window.deleteReview = async (id) => {
  if (!confirm('Are you sure you want to delete this customer review?')) return;
  try {
    await API.delete(`/vendor/reviews/${id}`);
    API.showToast('Customer review deleted.');
    await loadVendorReviews();
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};
