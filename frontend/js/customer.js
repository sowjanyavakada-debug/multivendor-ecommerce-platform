document.addEventListener('DOMContentLoaded', async () => {
  renderSharedLayout();

  // Route protection
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'user') {
    API.showToast('Please log in as a customer to access this page.', true);
    setTimeout(() => { window.location.href = 'auth.html'; }, 1500);
    return;
  }

  // Set header values
  document.getElementById('customer-name').innerText = `Welcome Back, ${user.name}!`;
  document.getElementById('customer-email').innerText = user.email;

  // Initialize operations
  await loadWalletBalance();
  await loadOrderHistory();
  await loadRefundRequests();
  await loadWishlist();
  await loadChatThreads();

  // Bind forms
  setupFormBindings();
});

// Load user wallet balance
async function loadWalletBalance() {
  try {
    const res = await API.get('/auth/wallet');
    const balance = res.data ? res.data.wallet_balance : 0.00;
    document.getElementById('wallet-balance-display').innerText = `₹${parseFloat(balance).toFixed(2)}`;
  } catch (err) {
    console.error('Failed to load wallet balance:', err);
  }
}

// Load customer orders list & timelines
async function loadOrderHistory() {
  const container = document.getElementById('orders-container');
  try {
    const res = await API.get('/orders/history');
    const orders = res.data || [];
    renderOrdersList(orders, container);
  } catch (err) {
    console.error('Failed to load order history:', err);
    container.innerHTML = `<div class="alert alert-danger">Failed to load orders.</div>`;
  }
}

function renderOrdersList(orders, container) {
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="premium-card p-5 text-center my-4">
        <i class="bi bi-bag-x fs-1 d-block mb-3 text-muted"></i>
        <h5 class="fw-bold">No orders found</h5>
        <a href="shop.html" class="btn btn-premium-primary mt-3">Start Shopping</a>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(ord => {
    const orderDate = new Date(ord.order_date).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let badgeClass = 'pending';
    let progressWidth = 0;
    let stepStates = { ordered: 'completed', processing: '', shipped: '', delivered: '' };

    const status = ord.status.toLowerCase();
    if (status === 'pending') {
      badgeClass = 'pending';
      progressWidth = 0;
      stepStates.ordered = 'active';
    } else if (status === 'processing') {
      badgeClass = 'approved';
      progressWidth = 33;
      stepStates.ordered = 'completed';
      stepStates.processing = 'active';
    } else if (status === 'shipped') {
      badgeClass = 'approved';
      progressWidth = 66;
      stepStates.ordered = 'completed';
      stepStates.processing = 'completed';
      stepStates.shipped = 'active';
    } else if (status === 'delivered') {
      badgeClass = 'approved';
      progressWidth = 100;
      stepStates.ordered = 'completed';
      stepStates.processing = 'completed';
      stepStates.shipped = 'completed';
      stepStates.delivered = 'completed';
    } else if (status === 'cancelled') {
      badgeClass = 'blocked';
    }

    let trackerHtml = '';
    if (status === 'cancelled') {
      trackerHtml = `
        <div class="alert alert-danger bg-danger-subtle text-danger border-0 rounded-3 p-3 d-flex align-items-center gap-2 mb-0 mt-3" role="alert">
          <i class="bi bi-x-circle-fill fs-5"></i>
          <div class="fw-semibold">This order has been cancelled/refunded.</div>
        </div>
      `;
    } else {
      trackerHtml = `
        <div class="shipping-timeline mb-4">
          <div class="timeline-progress-bar" style="width: ${progressWidth}%;"></div>
          <div class="timeline-step ${stepStates.ordered}"><div class="step-icon"><i class="bi bi-receipt"></i></div><div class="step-label">Ordered</div></div>
          <div class="timeline-step ${stepStates.processing}"><div class="step-icon"><i class="bi bi-box-seam-fill"></i></div><div class="step-label">Processing</div></div>
          <div class="timeline-step ${stepStates.shipped}"><div class="step-icon"><i class="bi bi-truck animate-pulse"></i></div><div class="step-label">Shipped</div></div>
          <div class="timeline-step ${stepStates.delivered}"><div class="step-icon"><i class="bi bi-check-lg"></i></div><div class="step-label">Delivered</div></div>
        </div>
      `;
    }

    const couponInfo = ord.coupon_code ? `(${ord.coupon_code})` : '';
    
    // Show refund option only for Delivered status
    let actionBtnHtml = '';
    if (status === 'delivered') {
      actionBtnHtml = `
        <button class="btn btn-danger btn-sm me-2" onclick="openRefundModal(${ord.id}, ${ord.total_price})">
          <i class="bi bi-arrow-counterclockwise"></i> Return & Refund
        </button>
      `;
    }

    return `
      <div class="order-detail-card mb-4">
        <div class="order-detail-header">
          <div><span class="text-muted small">ORDER ID</span><h5 class="fw-bold mb-0 text-dark">#${ord.id}</h5></div>
          <div><span class="text-muted small">PLACED ON</span><div class="fw-semibold text-dark">${orderDate}</div></div>
          <div><span class="text-muted small">TOTAL PAID</span><div class="fw-bold text-primary fs-5">₹${parseFloat(ord.total_price).toFixed(2)} ${couponInfo}</div></div>
          <div><span class="text-muted small d-block mb-1">STATUS</span><span class="custom-badge ${badgeClass}">${ord.status}</span></div>
        </div>
        
        <div class="row align-items-center">
          <div class="col-lg-8">${trackerHtml}</div>
          <div class="col-lg-4 text-lg-end mt-3 mt-lg-0">
            ${actionBtnHtml}
            <button class="btn btn-outline-primary btn-sm px-4 fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseItems-${ord.id}" onclick="loadOrderDetails(${ord.id})">
              <i class="bi bi-eye"></i> View Items
            </button>
          </div>
        </div>

        <div class="collapse mt-3" id="collapseItems-${ord.id}">
          <div class="border-top pt-3 mt-3">
            <h6 class="fw-bold mb-3"><i class="bi bi-list-stars"></i> Items Breakdown</h6>
            <div class="table-responsive">
              <table class="table table-borderless align-middle mb-0">
                <thead>
                  <tr class="text-muted small border-bottom">
                    <th>Product</th>
                    <th>Vendor</th>
                    <th>Price</th>
                    <th class="text-center">Qty</th>
                    <th class="text-end">Total</th>
                  </tr>
                </thead>
                <tbody id="items-container-${ord.id}">
                  <tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.loadOrderDetails = async (orderId) => {
  const container = document.getElementById(`items-container-${orderId}`);
  if (!container) return;

  try {
    const res = await API.get(`/orders/${orderId}`);
    const items = res.data.items || [];
    container.innerHTML = items.map(item => {
      const img = item.image_url ? `http://localhost:5000/${item.image_url}` : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-3">
              <img src="${img}" class="rounded border" style="width: 40px; height: 40px; object-fit: cover;">
              <div>
                <span class="fw-bold d-block text-dark">${item.product_name || 'Product'}</span>
                <small class="text-muted">ID: ${item.product_id}</small>
              </div>
            </div>
          </td>
          <td><span class="badge bg-light text-dark border">${item.vendor_name || 'Store'}</span></td>
          <td>₹${parseFloat(item.price).toFixed(2)}</td>
          <td class="text-center fw-semibold">${item.quantity}</td>
          <td class="text-end fw-bold text-dark">₹${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading items.</td></tr>`;
  }
};

// Returns & Refunds
async function loadRefundRequests() {
  const container = document.getElementById('refunds-list-container');
  try {
    const res = await API.get('/refunds/customer');
    const refunds = res.data || [];
    if (refunds.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No returns or refund requests.</td></tr>`;
      return;
    }

    container.innerHTML = refunds.map(r => {
      const date = new Date(r.created_at).toLocaleDateString('en-IN');
      let statusClass = 'pending';
      if (r.status === 'Approved') statusClass = 'approved';
      if (r.status === 'Rejected') statusClass = 'blocked';

      return `
        <tr>
          <td><span class="fw-bold text-dark">#${r.order_id}</span></td>
          <td>${r.vendor_name || 'Vendor'}</td>
          <td><small class="text-muted d-block" style="max-width: 250px;">${r.reason}</small></td>
          <td class="fw-bold text-danger">₹${parseFloat(r.amount).toFixed(2)}</td>
          <td><span class="custom-badge ${statusClass}">${r.status}</span></td>
          <td>${date}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load refunds.</td></tr>`;
  }
}

// Refund request modal popup
window.openRefundModal = (orderId, amount) => {
  document.getElementById('refund-order-id').value = orderId;
  document.getElementById('refund-amount').value = amount;
  document.getElementById('refund-order-lbl').innerText = `#${orderId}`;
  document.getElementById('refund-amount-lbl').innerText = `₹${parseFloat(amount).toFixed(2)}`;
  
  const modal = new bootstrap.Modal(document.getElementById('refundModal'));
  modal.show();
};

// Wishlist Loading
async function loadWishlist() {
  const container = document.getElementById('wishlist-items-container');
  try {
    const res = await API.get('/wishlist');
    const items = res.data || [];
    if (items.length === 0) {
      container.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Your wishlist is empty.</td></tr>`;
      return;
    }

    container.innerHTML = items.map(item => {
      const img = item.image_url ? `http://localhost:5000/${item.image_url}` : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-3">
              <img src="${img}" class="rounded border" style="width: 40px; height: 40px; object-fit: cover;">
              <span class="fw-bold text-dark">${item.name}</span>
            </div>
          </td>
          <td>${item.category}</td>
          <td class="fw-semibold">₹${parseFloat(item.price).toFixed(2)}</td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-premium-primary btn-sm px-2" onclick="moveWishlistToCart(${item.id})">
                <i class="bi bi-cart-plus"></i> Add
              </button>
              <button class="btn btn-outline-danger btn-sm px-2" onclick="removeFromWishlist(${item.id})">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to load wishlist.</td></tr>`;
  }
}

window.moveWishlistToCart = async (productId) => {
  try {
    await API.post('/cart', { product_id: productId, quantity: 1 });
    await API.delete(`/wishlist/${productId}`);
    API.showToast('Item moved to shopping cart.');
    loadWishlist();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

window.removeFromWishlist = async (productId) => {
  try {
    await API.delete(`/wishlist/${productId}`);
    API.showToast('Removed from wishlist.');
    loadWishlist();
  } catch (err) {
    API.showToast(err.message, true);
  }
};

// Chat logs
let activeChatOtherId = null;
let activeChatOtherRole = null;

async function loadChatThreads() {
  const container = document.getElementById('chat-sidebar-threads');
  try {
    const res = await API.get('/messages/chats');
    const chats = res.data || [];
    if (chats.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted small">No active threads</div>`;
      return;
    }

    container.innerHTML = chats.map(chat => {
      const activeClass = (activeChatOtherId === chat.other_id && activeChatOtherRole === chat.other_role) ? 'active' : '';
      const displayTime = chat.lastTimestamp ? new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="chat-sidebar-item ${activeClass}" onclick="openChatThread(${chat.other_id}, '${chat.other_role}', '${chat.other_name}')">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fw-bold small text-dark">${chat.other_name}</span>
            <small class="text-muted" style="font-size: 0.7rem;">${displayTime}</small>
          </div>
          <div class="small text-muted text-truncate" style="max-width: 210px;">${chat.lastMessage || 'Open chat'}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load chat threads:', err);
  }
}

window.initiateSupportChat = (role, id, name) => {
  openChatThread(id, role, name);
};

window.openChatThread = async (otherId, role, name) => {
  activeChatOtherId = otherId;
  activeChatOtherRole = role;

  // Render header details
  document.getElementById('chat-active-name').innerText = name;
  document.getElementById('chat-active-role').innerText = role === 'admin' ? 'Support Desk Agent' : 'Store Representative';

  // Highlight selection
  loadChatThreads();

  // Load message logs
  await loadMessages();

  // Reveal form
  document.getElementById('chat-send-form').classList.remove('d-none');
};

async function loadMessages() {
  if (!activeChatOtherId || !activeChatOtherRole) return;

  const container = document.getElementById('chat-messages-container');
  try {
    const res = await API.get(`/messages/history?other_id=${activeChatOtherId}&other_role=${activeChatOtherRole}`);
    const messages = res.data || [];
    
    if (messages.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted">No messages yet. Send a message to start conversation.</div>`;
      return;
    }

    container.innerHTML = messages.map(msg => {
      const isSelf = msg.sender_role === 'user';
      const bubbleClass = isSelf ? 'self' : 'other';
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="chat-bubble ${bubbleClass}">
          <div>${msg.message}</div>
          <span class="chat-time">${time}</span>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.error('Failed to load chat messages:', err);
  }
}

// Form logic configurations
function setupFormBindings() {
  // Wallet Deposit Form
  const depositForm = document.getElementById('deposit-wallet-form');
  if (depositForm) {
    depositForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('deposit-amount').value;
      try {
        await API.post('/auth/wallet/add', { amount });
        API.showToast(`Deposited ₹${parseFloat(amount).toFixed(2)} to wallet.`);
        
        // Hide modal
        const modalEl = document.getElementById('depositModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        await loadWalletBalance();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Refund request submission Form
  const refundForm = document.getElementById('refund-request-form');
  if (refundForm) {
    refundForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const order_id = document.getElementById('refund-order-id').value;
      const amount = document.getElementById('refund-amount').value;
      const reason = document.getElementById('refund-reason').value;

      try {
        await API.post('/refunds/request', { order_id, amount, reason });
        API.showToast('Return refund request submitted successfully.');

        // Hide modal
        const modalEl = document.getElementById('refundModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        await loadOrderHistory();
        await loadRefundRequests();
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
      const textInput = document.getElementById('chat-input-text');
      const message = textInput.value;

      if (!message || !activeChatOtherId || !activeChatOtherRole) return;

      try {
        await API.post('/messages/send', {
          receiver_id: activeChatOtherId,
          receiver_role: activeChatOtherRole,
          message
        });
        textInput.value = '';
        await loadMessages();
        await loadChatThreads();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }

  // Password Update Form
  const passwordForm = document.getElementById('profile-password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = JSON.parse(localStorage.getItem('user'));
      const new_password = document.getElementById('profile-new-password').value;
      const confirm_password = document.getElementById('profile-confirm-password').value;

      if (new_password.length < 6) {
        API.showToast('Password must be at least 6 characters.', true);
        return;
      }
      if (new_password !== confirm_password) {
        API.showToast('Passwords do not match.', true);
        return;
      }

      try {
        await API.post('/auth/reset-password', { email: user.email, new_password });
        API.showToast('Password updated successfully.');
        passwordForm.reset();
      } catch (err) {
        API.showToast(err.message, true);
      }
    });
  }
}
