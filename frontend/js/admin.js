document.addEventListener('DOMContentLoaded', async () => {
  renderSharedLayout();

  // Route protection
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'admin') {
    API.showToast('Access denied. Administrator login required.', true);
    setTimeout(() => { window.location.href = 'auth.html'; }, 1500);
    return;
  }

  // Load datasets
  await refreshDashboard();

  // Bind forms
  setupFormBindings();
});

async function refreshDashboard() {
  await loadStats();
  await loadVendors();
  await loadCoupons();
  await loadProductsForModeration();
  await loadRefundQueue();
  await loadSystemSettings();
  await loadDeliveryPartners();
  await loadUsersRegistry();
  await loadChatThreads();
  await loadCategories();
  await loadOrders();
  await loadPayoutRequests();
  await loadReportsAndAnalytics();
}

async function loadStats() {
  try {
    const res = await API.get('/admin/stats');
    const stats = res.data;

    document.getElementById('stat-users').innerText = stats.totalUsers;
    document.getElementById('stat-vendors').innerText = stats.totalVendors;
    document.getElementById('stat-products').innerText = stats.totalProducts;
    document.getElementById('stat-orders').innerText = stats.totalOrders;
    document.getElementById('stat-revenue').innerText = `₹${stats.totalRevenue.toFixed(2)}`;
    document.getElementById('stat-pending-approvals').innerText = stats.pendingVendorsCount;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Vendor management
async function loadVendors() {
  try {
    const res = await API.get('/admin/vendors');
    renderVendors(res.data || []);
  } catch (err) {
    document.getElementById('admin-vendors-container').innerHTML = `
      <tr><td colspan="7" class="text-center text-danger">Failed to load vendor applications list.</td></tr>
    `;
  }
}

function renderVendors(vendors) {
  const container = document.getElementById('admin-vendors-container');
  if (vendors.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No vendor accounts registered.</td></tr>`;
    return;
  }

  container.innerHTML = vendors.map(v => {
    const formattedDate = new Date(v.created_at).toLocaleDateString();
    let badgeClass = 'custom-badge pending';
    if (v.status === 'approved') badgeClass = 'custom-badge approved';
    if (v.status === 'blocked') badgeClass = 'custom-badge blocked';
    if (v.status === 'rejected') badgeClass = 'custom-badge blocked bg-danger-subtle text-danger';

    const isApproved = v.status === 'approved';
    const isBlocked = v.status === 'blocked';
    const isRejected = v.status === 'rejected';

    return `
      <tr>
        <td class="fw-bold">#${v.id}</td>
        <td class="fw-semibold text-dark">${v.vendor_name}</td>
        <td>${v.email}</td>
        <td class="fw-semibold">${parseFloat(v.commission_rate || 10).toFixed(2)}%</td>
        <td><span class="${badgeClass}">${v.status}</span></td>
        <td>${formattedDate}</td>
        <td>
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-xs btn-success py-1 px-2 fs-6" onclick="approveVendor(${v.id})" ${isApproved ? 'disabled' : ''} style="font-size: 0.75rem;">Approve</button>
            <button class="btn btn-xs btn-danger py-1 px-2 fs-6" onclick="rejectVendor(${v.id})" ${isRejected ? 'disabled' : ''} style="font-size: 0.75rem;">Reject</button>
            <button class="btn btn-xs btn-secondary py-1 px-2 fs-6" onclick="blockVendor(${v.id})" ${isBlocked ? 'disabled' : ''} style="font-size: 0.75rem;">Block</button>
            <button class="btn btn-xs btn-outline-primary py-1 px-2 fs-6" onclick="updateCommission(${v.id}, ${v.commission_rate || 10.00})" style="font-size: 0.75rem;"><i class="bi bi-percent"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.approveVendor = async (id) => {
  try {
    await API.put(`/admin/vendors/${id}/approve`);
    API.showToast('Vendor approved successfully.');
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

window.rejectVendor = async (id) => {
  if (!confirm('Are you sure you want to reject this vendor application?')) return;
  try {
    await API.put(`/admin/vendors/${id}/reject`);
    API.showToast('Vendor application rejected.');
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

window.blockVendor = async (id) => {
  try {
    await API.put(`/admin/vendors/${id}/block`);
    API.showToast('Vendor blocked successfully.');
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

window.updateCommission = async (id, currentRate) => {
  const newRateStr = prompt(`Set custom commission rate for this vendor store (Current: ${currentRate}%):`, currentRate);
  if (newRateStr === null) return;
  const newRate = parseFloat(newRateStr);
  if (isNaN(newRate) || newRate < 0 || newRate > 100) {
    API.showToast('Please enter a valid rate between 0 and 100.', true);
    return;
  }
  try {
    await API.put(`/admin/vendors/${id}/commission`, { commission_rate: newRate });
    API.showToast('Commission rate updated successfully.');
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Coupon Codes
async function loadCoupons() {
  try {
    const res = await API.get('/admin/coupons');
    renderCoupons(res.data || []);
  } catch (err) {
    document.getElementById('admin-coupons-container').innerHTML = `
      <tr><td colspan="5" class="text-center text-danger">Failed to load coupons.</td></tr>
    `;
  }
}

function renderCoupons(coupons) {
  const container = document.getElementById('admin-coupons-container');
  if (coupons.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No active global coupon codes.</td></tr>`;
    return;
  }

  container.innerHTML = coupons.map(c => `
    <tr>
      <td class="fw-bold">#${c.id}</td>
      <td class="fw-bold text-primary">${c.code}</td>
      <td class="fw-semibold text-success">${c.discount_percentage}% Off</td>
      <td><code>${c.expiry_date}</code></td>
      <td>
        <button class="btn btn-sm btn-outline-danger px-2" onclick="deleteCoupon(${c.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

window.deleteCoupon = async (id) => {
  if (!confirm('Are you sure you want to delete this coupon?')) return;
  try {
    await API.delete(`/admin/coupons/${id}`);
    API.showToast('Coupon deleted successfully.');
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Product Moderation
async function loadProductsForModeration() {
  const container = document.getElementById('admin-moderation-container');
  try {
    const res = await API.get('/admin/products');
    const products = res.data || [];
    if (products.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No products listed in catalog.</td></tr>`;
      return;
    }

    container.innerHTML = products.map(p => {
      const img = p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `http://localhost:5000/${p.image_url}`) : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
      let badgeClass = 'pending';
      if (p.status === 'Approved') badgeClass = 'approved';
      if (p.status === 'Rejected') badgeClass = 'blocked';

      const isApproved = p.status === 'Approved';
      const isRejected = p.status === 'Rejected';

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-3">
              <img src="${img}" class="rounded border" style="width: 40px; height: 40px; object-fit: cover;">
              <span class="fw-bold text-dark">${p.name}</span>
            </div>
          </td>
          <td><span class="badge bg-light text-dark border">${p.vendor_name || 'Vendor'}</span></td>
          <td>${p.category}</td>
          <td>₹${parseFloat(p.price).toFixed(2)}</td>
          <td><span class="custom-badge ${badgeClass}">${p.status || 'Approved'}</span></td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-success px-2" onclick="moderateProduct(${p.id}, 'Approved')" ${isApproved ? 'disabled' : ''}>Approve</button>
              <button class="btn btn-sm btn-danger px-2" onclick="moderateProduct(${p.id}, 'Rejected')" ${isRejected ? 'disabled' : ''}>Reject</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load moderation queue.</td></tr>`;
  }
}

window.moderateProduct = async (id, status) => {
  try {
    await API.put(`/admin/products/${id}/moderation`, { status });
    API.showToast(`Product set to ${status}.`);
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Global Refund Requests Queue
async function loadRefundQueue() {
  const container = document.getElementById('admin-refunds-container');
  try {
    const res = await API.get('/refunds/admin');
    const refunds = res.data || [];
    if (refunds.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No global refund requests logs.</td></tr>`;
      return;
    }

    container.innerHTML = refunds.map(r => {
      let statusClass = 'pending';
      if (r.status === 'Approved') statusClass = 'approved';
      if (r.status === 'Rejected') statusClass = 'blocked';

      const actions = r.status === 'Pending'
        ? `<div class="d-flex gap-2">
             <button class="btn btn-success btn-sm" onclick="resolveRefund(${r.id}, 'Approved')">Approve</button>
             <button class="btn btn-danger btn-sm" onclick="resolveRefund(${r.id}, 'Rejected')">Reject</button>
           </div>`
        : `<span class="text-muted small">Resolved</span>`;

      return `
        <tr>
          <td><span class="fw-bold text-dark">#${r.order_id}</span></td>
          <td>${r.customer_name}</td>
          <td>${r.vendor_name}</td>
          <td><small class="text-muted">${r.reason}</small></td>
          <td class="fw-bold text-danger">₹${parseFloat(r.amount).toFixed(2)}</td>
          <td><span class="custom-badge ${statusClass}">${r.status}</span></td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load refunds queue.</td></tr>`;
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

// System config settings loading
async function loadSystemSettings() {
  try {
    const res = await API.get('/admin/settings');
    const config = res.data;
    if (config) {
      document.getElementById('commissionRate').value = parseFloat(config.global_commission_percentage).toFixed(2);
      document.getElementById('taxRate').value = parseFloat(config.tax_percentage).toFixed(2);
      document.getElementById('shippingRate').value = parseFloat(config.shipping_fee_flat).toFixed(2);
      document.getElementById('bannerText').value = config.cms_banner_text || '';
      document.getElementById('bannerImage').value = config.cms_banner_image || '';
    }
  } catch (err) {
    console.error('Failed to load system settings:', err);
  }
}

// Delivery partners CRUD
async function loadDeliveryPartners() {
  const container = document.getElementById('delivery-partners-container');
  try {
    const res = await API.get('/admin/delivery-partners');
    const partners = res.data || [];
    if (partners.length === 0) {
      container.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No delivery partners registered.</td></tr>`;
      return;
    }

    container.innerHTML = partners.map(p => `
      <tr>
        <td class="fw-bold text-dark">${p.name}</td>
        <td>${p.phone}</td>
        <td><span class="badge bg-success-subtle text-success">${p.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="removeDeliveryPartner(${p.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to load delivery partners.</td></tr>`;
  }
}

window.removeDeliveryPartner = async (id) => {
  try {
    await API.delete(`/admin/delivery-partners/${id}`);
    API.showToast('Delivery logistics partner removed.');
    await loadDeliveryPartners();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Users Accounts Registry
async function loadUsersRegistry() {
  const container = document.getElementById('admin-users-container');
  try {
    const res = await API.get('/admin/users');
    const users = res.data || [];
    if (users.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No user profiles registered.</td></tr>`;
      return;
    }

    container.innerHTML = users.map(u => {
      const date = new Date(u.created_at).toLocaleDateString();
      // Mock some user balances if empty
      const balance = u.wallet_balance !== undefined ? u.wallet_balance : 1000.00;
      return `
        <tr>
          <td class="fw-bold">#${u.id}</td>
          <td class="fw-semibold text-dark">${u.name}</td>
          <td>${u.email}</td>
          <td class="fw-bold text-success">₹${parseFloat(balance).toFixed(2)}</td>
          <td>${date}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger px-2" onclick="deleteUser(${u.id})"><i class="bi bi-trash"></i> Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load user registry.</td></tr>`;
  }
}

window.deleteUser = async (id) => {
  if (!confirm('Are you sure you want to delete this user profile?')) return;
  try {
    await API.delete(`/admin/users/${id}`);
    API.showToast('User deleted successfully.');
    await refreshDashboard();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Live support chat ticket inbox
let activeChatOtherId = null;
let activeChatOtherRole = null;

async function loadChatThreads() {
  const container = document.getElementById('chat-sidebar-threads');
  try {
    const res = await API.get('/messages/chats');
    const chats = res.data || [];
    if (chats.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted small">No active support tickets</div>`;
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
          <div class="small text-muted text-truncate" style="max-width: 210px;">${chat.lastMessage || 'Open ticket'}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load support threads:', err);
  }
}

window.openChatThread = async (otherId, role, name) => {
  activeChatOtherId = otherId;
  activeChatOtherRole = role;

  document.getElementById('chat-active-name').innerText = name;
  document.getElementById('chat-active-role').innerText = 'Client Help Request';

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
      container.innerHTML = `<div class="text-center py-4 text-muted">No message logs.</div>`;
      return;
    }

    container.innerHTML = messages.map(msg => {
      const isSelf = msg.sender_role === 'admin';
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

// Bind admin forms
function setupFormBindings() {
  // Global settings form
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        global_commission_percentage: parseFloat(document.getElementById('commissionRate').value),
        tax_percentage: parseFloat(document.getElementById('taxRate').value),
        shipping_fee_flat: parseFloat(document.getElementById('shippingRate').value)
      };

      try {
        await API.put('/admin/settings', payload);
        API.showToast('Platform fees configurations updated.');
        await loadSystemSettings();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // CMS configuration form
  const cmsForm = document.getElementById('cms-form');
  if (cmsForm) {
    cmsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        cms_banner_text: document.getElementById('bannerText').value.trim(),
        cms_banner_image: document.getElementById('bannerImage').value.trim()
      };

      try {
        await API.put('/admin/settings', payload); // shares same table update API
        API.showToast('CMS banner settings updated successfully.');
        await loadSystemSettings();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Delivery logistics partner add Form
  const dpForm = document.getElementById('delivery-partner-form');
  if (dpForm) {
    dpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('dpName').value.trim(),
        phone: document.getElementById('dpPhone').value.trim()
      };

      try {
        await API.post('/admin/delivery-partners', payload);
        API.showToast('New logistics delivery partner registered.');
        dpForm.reset();
        await loadDeliveryPartners();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Global Coupons Form (re-use exists)
  const couponForm = document.getElementById('create-coupon-form');
  if (couponForm) {
    couponForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('couponCode').value.toUpperCase().trim();
      const discount = document.getElementById('couponDiscount').value;
      const expiry = document.getElementById('couponExpiry').value;

      try {
        await API.post('/admin/coupons', {
          code,
          discount_percentage: discount,
          expiry_date: expiry
        });
        API.showToast('Global coupon code created successfully.');
        couponForm.reset();
        await loadCoupons();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Category Form
  const categoryForm = document.getElementById('create-category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('categoryName').value.trim();
      const description = document.getElementById('categoryDesc').value.trim();

      try {
        await API.post('/admin/categories', { name, description });
        API.showToast('Category created successfully.');
        categoryForm.reset();
        await loadCategories();
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
}

// Categories
async function loadCategories() {
  const container = document.getElementById('admin-categories-container');
  if (!container) return;
  try {
    const res = await API.get('/admin/categories');
    const categories = res.data || [];
    if (categories.length === 0) {
      container.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No categories found.</td></tr>`;
      return;
    }
    container.innerHTML = categories.map(c => `
      <tr>
        <td class="fw-bold">#${c.id}</td>
        <td class="fw-semibold text-dark">${c.name}</td>
        <td>${c.description || '<span class="text-muted">No description</span>'}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger px-2" onclick="deleteCategory(${c.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to load categories.</td></tr>`;
  }
}

window.deleteCategory = async (id) => {
  if (!confirm('Are you sure you want to delete this category?')) return;
  try {
    await API.delete(`/admin/categories/${id}`);
    API.showToast('Category deleted successfully.');
    await loadCategories();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Orders
async function loadOrders() {
  const container = document.getElementById('admin-orders-container');
  if (!container) return;
  try {
    const res = await API.get('/admin/orders');
    const orders = res.data || [];
    if (orders.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No customer orders found.</td></tr>`;
      return;
    }
    container.innerHTML = orders.map(o => {
      const date = new Date(o.order_date).toLocaleDateString();
      let statusClass = 'pending';
      if (o.status === 'Completed' || o.status === 'Delivered') statusClass = 'approved';
      if (o.status === 'Cancelled' || o.status === 'Returned') statusClass = 'blocked';
      if (o.status === 'Processing' || o.status === 'Shipped') statusClass = 'pending';

      return `
        <tr>
          <td class="fw-bold">#${o.id}</td>
          <td>${o.customer_name || `User #${o.user_id}`}</td>
          <td class="fw-bold text-dark">₹${parseFloat(o.total_price).toFixed(2)}</td>
          <td class="text-danger fw-semibold">₹${parseFloat(o.discount_amount || 0).toFixed(2)}</td>
          <td>${o.coupon_code ? `<span class="badge bg-light text-primary border">${o.coupon_code}</span>` : '<span class="text-muted">-</span>'}</td>
          <td><span class="custom-badge ${statusClass}">${o.status}</span></td>
          <td>${date}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load orders registry.</td></tr>`;
  }
}

// Payouts
async function loadPayoutRequests() {
  const container = document.getElementById('admin-payouts-container');
  if (!container) return;
  try {
    const res = await API.get('/admin/payouts');
    const payouts = res.data || [];
    if (payouts.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No payout requests found.</td></tr>`;
      return;
    }
    container.innerHTML = payouts.map(p => {
      const date = new Date(p.created_at).toLocaleDateString();
      let statusClass = 'pending';
      if (p.status === 'Approved') statusClass = 'approved';
      if (p.status === 'Rejected') statusClass = 'blocked';

      const isPending = p.status === 'Pending';
      const actions = isPending
        ? `<div class="d-flex gap-1">
             <button class="btn btn-sm btn-success px-2 py-1" onclick="approvePayout(${p.id})">Approve</button>
             <button class="btn btn-sm btn-danger px-2 py-1" onclick="rejectPayout(${p.id})">Reject</button>
           </div>`
        : `<span class="text-muted small">Resolved</span>`;

      return `
        <tr>
          <td class="fw-bold">#${p.id}</td>
          <td class="fw-semibold text-dark">${p.vendor_name}</td>
          <td>${p.vendor_email}</td>
          <td class="fw-bold text-success">₹${parseFloat(p.amount).toFixed(2)}</td>
          <td><span class="custom-badge ${statusClass}">${p.status}</span></td>
          <td>${date}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load payout queue.</td></tr>`;
  }
}

window.approvePayout = async (id) => {
  if (!confirm('Are you sure you want to approve this payout request?')) return;
  try {
    await API.put(`/admin/payouts/${id}/approve`);
    API.showToast('Payout request approved.');
    await loadPayoutRequests();
    await loadReportsAndAnalytics();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

window.rejectPayout = async (id) => {
  if (!confirm('Are you sure you want to reject this payout request and refund the balance?')) return;
  try {
    await API.put(`/admin/payouts/${id}/reject`);
    API.showToast('Payout request rejected. Wallet balance refunded to vendor.');
    await loadPayoutRequests();
    await loadReportsAndAnalytics();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Reports and Analytics
async function loadReportsAndAnalytics() {
  const grossSalesEl = document.getElementById('analytics-gross-sales');
  const commissionEl = document.getElementById('analytics-commission');
  const netPayoutsEl = document.getElementById('analytics-net-payouts');
  const topSellersContainer = document.getElementById('analytics-top-sellers-container');
  const vendorPerformanceContainer = document.getElementById('analytics-vendor-performance-container');

  try {
    const res = await API.get('/admin/reports/analytics');
    const { metrics, top_selling_products, vendor_performance } = res.data;

    if (grossSalesEl) grossSalesEl.innerText = `₹${parseFloat(metrics.gross_sales).toFixed(2)}`;
    if (commissionEl) commissionEl.innerText = `₹${parseFloat(metrics.platform_commission).toFixed(2)}`;
    if (netPayoutsEl) netPayoutsEl.innerText = `₹${parseFloat(metrics.net_payouts).toFixed(2)}`;

    if (topSellersContainer) {
      if (top_selling_products.length === 0) {
        topSellersContainer.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No sales registry recorded.</td></tr>`;
      } else {
        topSellersContainer.innerHTML = top_selling_products.map(p => `
          <tr>
            <td>
              <span class="fw-semibold text-dark">${p.name}</span>
              <span class="text-muted small d-block">ID: #${p.id}</span>
            </td>
            <td><span class="badge bg-light text-dark border">${p.category}</span></td>
            <td class="fw-bold">${p.total_qty_sold} units</td>
            <td class="fw-bold text-success">₹${parseFloat(p.total_revenue).toFixed(2)}</td>
          </tr>
        `).join('');
      }
    }

    if (vendorPerformanceContainer) {
      if (vendor_performance.length === 0) {
        vendorPerformanceContainer.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No vendor registrations.</td></tr>`;
      } else {
        vendorPerformanceContainer.innerHTML = vendor_performance.map(v => `
          <tr>
            <td>
              <span class="fw-semibold text-dark">${v.vendor_name}</span>
              <span class="text-muted small d-block">ID: #${v.vendor_id}</span>
            </td>
            <td class="fw-bold">${v.total_items_sold} sold</td>
            <td class="fw-semibold text-dark">₹${parseFloat(v.gross_revenue).toFixed(2)}</td>
            <td class="fw-bold text-danger">₹${parseFloat(v.commission_earned).toFixed(2)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load reports and analytics:', err);
  }
}

