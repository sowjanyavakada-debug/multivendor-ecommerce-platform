document.addEventListener('DOMContentLoaded', async () => {
  // Render shared layouts
  renderSharedLayout();

  // Route protection
  const token = localStorage.getItem('token');
  if (!token) {
    API.showToast('Please log in to view your orders.', true);
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 1500);
    return;
  }

  // Load order history
  await loadOrderHistory();
});

async function loadOrderHistory() {
  const container = document.getElementById('orders-container');
  try {
    const res = await API.get('/orders/history');
    const orders = res.data || [];
    renderOrdersList(orders, container);
  } catch (err) {
    console.error('Failed to load order history:', err);
    container.innerHTML = `
      <div class="alert alert-danger text-center py-4" role="alert">
        <i class="bi bi-exclamation-triangle-fill fs-3 d-block mb-2"></i>
        Failed to load your order history. Please try again later.
      </div>
    `;
  }
}

function renderOrdersList(orders, container) {
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="premium-card p-5 text-center my-4 animate-fade-up">
        <div class="stat-icon indigo mx-auto mb-4">
          <i class="bi bi-bag-x fs-2"></i>
        </div>
        <h4 class="fw-bold mb-2">No Orders Placed Yet</h4>
        <p class="text-muted mx-auto mb-4" style="max-width: 420px;">
          You haven't placed any orders on ShopHub yet. Explore our premium catalog to purchase verified goods from top vendors.
        </p>
        <a href="shop.html" class="btn btn-premium-primary">
          <i class="bi bi-shop"></i> Explore Shop Catalog
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(ord => {
    // Format Date
    const orderDate = new Date(ord.order_date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Determine Status Badge & Timeline config
    let badgeClass = 'pending';
    let progressWidth = 0;
    let stepStates = { ordered: 'completed', processing: '', shipped: '', delivered: '' };

    const status = ord.status.toLowerCase();
    if (status === 'pending') {
      badgeClass = 'pending';
      progressWidth = 0;
      stepStates.ordered = 'active';
    } else if (status === 'processing') {
      badgeClass = 'approved'; // reusing colors (amber-like or green)
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
      badgeClass = 'blocked'; // red
    }

    // Render Timeline or Cancelled message
    let trackerHtml = '';
    if (status === 'cancelled') {
      trackerHtml = `
        <div class="alert alert-danger bg-danger-subtle text-danger border-0 rounded-3 p-3 d-flex align-items-center gap-2 mb-0 mt-3" role="alert">
          <i class="bi bi-x-circle-fill fs-5"></i>
          <div class="fw-semibold">This order has been cancelled and products have been restocked.</div>
        </div>
      `;
    } else {
      trackerHtml = `
        <div class="shipping-timeline mb-4">
          <div class="timeline-progress-bar" style="width: ${progressWidth}%;"></div>
          
          <div class="timeline-step ${stepStates.ordered}">
            <div class="step-icon"><i class="bi bi-receipt"></i></div>
            <div class="step-label">Ordered</div>
          </div>
          
          <div class="timeline-step ${stepStates.processing}">
            <div class="step-icon"><i class="bi bi-box-seam-fill"></i></div>
            <div class="step-label">Processing</div>
          </div>
          
          <div class="timeline-step ${stepStates.shipped}">
            <div class="step-icon"><i class="bi bi-truck animate-pulse"></i></div>
            <div class="step-label">Shipped</div>
          </div>
          
          <div class="timeline-step ${stepStates.delivered}">
            <div class="step-icon"><i class="bi bi-check-lg"></i></div>
            <div class="step-label">Delivered</div>
          </div>
        </div>
      `;
    }

    // Discount Details
    const couponInfo = ord.coupon_code 
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle ms-2"><i class="bi bi-tag-fill"></i> Coupon: ${ord.coupon_code} (-₹${parseFloat(ord.discount_applied).toFixed(2)})</span>` 
      : '';

    return `
      <div class="order-detail-card mb-4 animate-fade-up">
        <div class="order-detail-header">
          <div>
            <span class="text-muted small">ORDER ID</span>
            <h5 class="fw-bold mb-0 text-dark">#${ord.id}</h5>
          </div>
          <div>
            <span class="text-muted small">PLACED ON</span>
            <div class="fw-semibold text-dark">${orderDate}</div>
          </div>
          <div>
            <span class="text-muted small">TOTAL PAID</span>
            <div class="fw-bold text-primary fs-5">₹${parseFloat(ord.total_price).toFixed(2)} ${couponInfo}</div>
          </div>
          <div>
            <span class="text-muted small d-block mb-1">STATUS</span>
            <span class="custom-badge ${badgeClass}">${ord.status}</span>
          </div>
        </div>

        <div class="row align-items-center">
          <div class="col-lg-8">
            ${trackerHtml}
          </div>
          <div class="col-lg-4 text-lg-end mt-3 mt-lg-0">
            <button class="btn btn-outline-primary btn-sm px-4 fw-semibold" 
                    type="button" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#collapseItems-${ord.id}" 
                    aria-expanded="false" 
                    onclick="loadOrderDetails(${ord.id})">
              <i class="bi bi-eye"></i> View Items Purchased
            </button>
          </div>
        </div>

        <!-- Collapsible Details Container -->
        <div class="collapse mt-3" id="collapseItems-${ord.id}">
          <div class="border-top pt-3 mt-3">
            <h6 class="fw-bold mb-3"><i class="bi bi-list-stars"></i> Items Breakdown</h6>
            <div class="table-responsive">
              <table class="table table-borderless align-middle mb-0" id="itemsTable-${ord.id}">
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
                  <tr>
                    <td colspan="5" class="text-center py-4">
                      <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                      <span class="ms-2 text-muted small">Loading order items...</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Global cache for order detail results
const cachedOrderDetails = {};

window.loadOrderDetails = async (orderId) => {
  const container = document.getElementById(`items-container-${orderId}`);
  if (!container) return;

  // Serve from cache if already loaded
  if (cachedOrderDetails[orderId]) {
    renderItemsTable(cachedOrderDetails[orderId], container);
    return;
  }

  try {
    const res = await API.get(`/orders/${orderId}`);
    const items = res.data.items || [];
    cachedOrderDetails[orderId] = items;
    renderItemsTable(items, container);
  } catch (err) {
    console.error(`Failed to fetch details for order #${orderId}:`, err);
    container.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger py-3">
          <i class="bi bi-exclamation-triangle"></i> Failed to retrieve items for this order.
        </td>
      </tr>
    `;
  }
};

function renderItemsTable(items, container) {
  if (items.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-3">
          No items found.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const imageUrl = item.image_url ? `http://localhost:5000/${item.image_url}` : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
    const itemTotal = item.price * item.quantity;
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-3">
            <img src="${imageUrl}" class="rounded border" style="width: 40px; height: 40px; object-fit: cover;">
            <div>
              <span class="fw-bold d-block text-dark">${item.product_name || 'Product Details'}</span>
              <small class="text-muted">${item.vendor_name || 'ShopHub Store'}</small>
            </div>
          </div>
        </td>
        <td>
          <span class="badge bg-light text-dark border">${item.vendor_name || 'Gadget World'}</span>
        </td>
        <td>₹${parseFloat(item.price).toFixed(2)}</td>
        <td class="text-center fw-semibold">${item.quantity}</td>
        <td class="text-end fw-bold text-dark">₹${parseFloat(itemTotal).toFixed(2)}</td>
      </tr>
    `;
  }).join('');
}
