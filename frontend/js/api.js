const API_BASE_URL = 'http://localhost:5000/api';

// Premium Toast Alert system
const showToast = (message, isError = false) => {
  let toastContainer = document.getElementById('premium-toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'premium-toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '24px';
    toastContainer.style.right = '24px';
    toastContainer.style.zIndex = '99999';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-alert animate-fade-up';
  toast.style.background = isError ? 'var(--danger)' : 'var(--secondary)';
  toast.style.color = '#fff';
  toast.style.padding = '16px 24px';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = 'var(--shadow-lg)';
  toast.style.fontWeight = '600';
  toast.style.marginBottom = '10px';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(20px)';
  toast.style.transition = 'all 0.3s ease';

  const icon = isError ? '❌' : '✅';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 50);

  // Remove toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
};

// Global Fetch Wrapper
const request = async (method, endpoint, body = null, isFormData = false) => {
  const token = localStorage.getItem('token');
  
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    // Handle status codes
    if (response.status === 401) {
      // Unauthorized, token might have expired
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login if not already there and on a protected page
      const currentPath = window.location.pathname;
      if (currentPath.includes('vendor.html') || currentPath.includes('admin.html') || currentPath.includes('checkout.html')) {
        showToast('Session expired. Please log in again.', true);
        setTimeout(() => {
          window.location.href = 'auth.html';
        }, 1500);
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong.');
    }
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
};

// Export Client functions globally
window.API = {
  get: (endpoint) => request('GET', endpoint),
  post: (endpoint, body) => request('POST', endpoint, body),
  put: (endpoint, body) => request('PUT', endpoint, body),
  delete: (endpoint) => request('DELETE', endpoint),
  postFormData: (endpoint, formData) => request('POST', endpoint, formData, true),
  putFormData: (endpoint, formData) => request('PUT', endpoint, formData, true),
  showToast,
};

// Shared Navigation Renderer (Renders premium Navbar and Footer across all pages)
window.renderSharedLayout = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const currentPath = window.location.pathname;

  // 1. Render Navbar
  const navbarElement = document.querySelector('.navbar');
  if (navbarElement) {
    let navLinks = '';
    
    // Links based on role
    if (user) {
      if (user.role === 'admin') {
        navLinks += `<li class="nav-item"><a class="nav-link ${currentPath.includes('admin.html') ? 'active' : ''}" href="admin.html">Admin Panel</a></li>`;
      } else if (user.role === 'vendor') {
        navLinks += `<li class="nav-item"><a class="nav-link ${currentPath.includes('vendor.html') ? 'active' : ''}" href="vendor.html">Vendor Panel</a></li>`;
      } else {
        // Customer Links
        navLinks += `
          <li class="nav-item"><a class="nav-link ${currentPath.includes('shop.html') ? 'active' : ''}" href="shop.html">Shop Catalog</a></li>
          <li class="nav-item"><a class="nav-link ${currentPath.includes('cart.html') ? 'active' : ''}" href="cart.html">Cart & Wishlist</a></li>
          <li class="nav-item"><a class="nav-link ${currentPath.includes('customer.html') ? 'active' : ''}" href="customer.html">Customer Dashboard</a></li>
        `;
      }
      navLinks += `
        <li class="nav-item ms-lg-3">
          <span class="navbar-text text-white-50 me-2">Hi, ${user.name || 'User'}</span>
        </li>
        <li class="nav-item">
          <a class="nav-link btn btn-danger text-white px-3" href="#" id="logout-btn">Logout</a>
        </li>
      `;
    } else {
      // Logged out links
      navLinks += `
        <li class="nav-item"><a class="nav-link ${currentPath.includes('shop.html') ? 'active' : ''}" href="shop.html">Shop Catalog</a></li>
        <li class="nav-item"><a class="nav-link ${currentPath.includes('auth.html') ? 'active' : ''}" href="auth.html">Login / Register</a></li>
      `;
    }

    navbarElement.innerHTML = `
      <div class="container">
        <a class="navbar-brand fw-bold text-white" href="index.html">🛒 ShopHub</a>
        <button class="navbar-toggler text-white" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMenu">
          <span class="navbar-toggler-icon" style="filter: invert(1);"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarMenu">
          <ul class="navbar-nav ms-auto align-items-center">
            <li class="nav-item me-lg-3">
              <button class="btn btn-sm text-white fs-5 border-0" id="theme-toggle-btn" title="Toggle Light/Dark Mode">
                <i class="bi bi-moon-fill" id="theme-icon"></i>
              </button>
            </li>
            <!-- Notification Bell -->
            ${user ? `
            <li class="nav-item me-lg-3 dropdown" id="notifications-navbar-item">
              <button class="btn btn-sm text-white fs-5 border-0 position-relative" id="notification-bell-btn" title="Notifications" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-bell-fill"></i>
                <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" id="notification-count" style="font-size: 0.55rem; padding: 4px 6px;">0</span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-lg p-0" id="notification-dropdown-menu" style="min-width: 320px; max-height: 400px; overflow-y: auto; border-radius: 12px; border: none; font-size: 0.9rem;">
                <li class="p-3 border-bottom d-flex justify-content-between align-items-center">
                  <span class="fw-bold">Notifications</span>
                  <button class="btn btn-link btn-sm text-decoration-none p-0" id="mark-all-read-btn" style="font-size: 0.8rem; outline: none; box-shadow: none;">Mark all read</button>
                </li>
                <div id="notifications-list-wrapper">
                  <li class="text-center py-4 text-muted small">No notifications</li>
                </div>
              </ul>
            </li>
            ` : ''}
            <li class="nav-item"><a class="nav-link ${currentPath.endsWith('index.html') || currentPath.endsWith('/') ? 'active' : ''}" href="index.html">Home</a></li>
            ${navLinks}
          </ul>
        </div>
      </div>
    `;

    // Initialize theme based on preference
    const storedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    if (storedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      if (themeIcon) {
        themeIcon.className = 'bi bi-sun-fill text-warning';
      }
    }

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        if (themeIcon) {
          themeIcon.className = isDark ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-fill';
        }
      });
    }

    // Hook up logout listener
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showToast('Logged out successfully.');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      });
    }

    // Hook up notifications logic if logged in
    if (user) {
      const fetchNotifications = async () => {
        const countBadge = document.getElementById('notification-count');
        const listWrapper = document.getElementById('notifications-list-wrapper');
        if (!countBadge || !listWrapper) return;

        try {
          const res = await window.API.get('/notifications');
          if (res.success) {
            const notifications = res.data || [];
            const unreadCount = notifications.filter(n => n.is_read === 0).length;

            if (unreadCount > 0) {
              countBadge.innerText = unreadCount;
              countBadge.classList.remove('d-none');
            } else {
              countBadge.classList.add('d-none');
            }

            if (notifications.length === 0) {
              listWrapper.innerHTML = `<li class="text-center py-4 text-muted small">No notifications</li>`;
              return;
            }

            listWrapper.innerHTML = notifications.map(n => {
              const date = new Date(n.created_at).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              const unreadStyle = n.is_read === 0 ? 'background-color: var(--secondary-subtle); border-left: 3px solid var(--primary); font-weight: 500;' : '';
              return `
                <li class="p-3 border-bottom notification-item" style="cursor: pointer; ${unreadStyle}" data-id="${n.id}">
                  <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="fw-bold text-dark" style="font-size: 0.85rem;">${n.title}</span>
                    <small class="text-muted" style="font-size: 0.7rem;">${date}</small>
                  </div>
                  <div class="small text-muted text-wrap">${n.message}</div>
                </li>
              `;
            }).join('');

            // Click listener for individual notifications to mark as read
            const items = listWrapper.querySelectorAll('.notification-item');
            items.forEach(item => {
              item.addEventListener('click', async (e) => {
                const notifId = item.getAttribute('data-id');
                try {
                  await window.API.put(`/notifications/${notifId}/read`);
                  await fetchNotifications();
                } catch (err) {
                  console.error('Failed to mark notification as read:', err);
                }
              });
            });
          }
        } catch (err) {
          console.error('Failed to fetch notifications:', err);
        }
      };

      // Mark all read button handler
      const markAllReadBtn = document.getElementById('mark-all-read-btn');
      if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await window.API.put('/notifications/read-all');
            await fetchNotifications();
          } catch (err) {
            console.error('Failed to mark all notifications as read:', err);
          }
        });
      }

      // Initial call and periodic update check
      fetchNotifications();
      setInterval(fetchNotifications, 10000);
    }
  }

  // 2. Render Footer
  const footerElement = document.querySelector('footer');
  if (footerElement) {
    footerElement.innerHTML = `
      <div class="container">
        <div class="row g-4">
          <div class="col-12 col-md-4">
            <h2 class="footer-title">🛒 ShopHub</h2>
            <p class="mt-3">A premium, highly secure multi-vendor marketplace connecting verified vendors with customers globally.</p>
          </div>
          <div class="col-6 col-md-3 ms-md-auto">
            <h5>Quick Links</h5>
            <ul class="list-unstyled mt-3">
              <li><a href="index.html">Home</a></li>
              <li><a href="shop.html">Shop Catalog</a></li>
              <li><a href="cart.html">Cart Manager</a></li>
            </ul>
          </div>
          <div class="col-6 col-md-3">
            <h5>Security Details</h5>
            <ul class="list-unstyled mt-3 text-white-50">
              <li>🔒 JWT Authentication</li>
              <li>🔑 Bcrypt Password Hash</li>
              <li>🛡️ Input Sanitization</li>
            </ul>
          </div>
        </div>
        <hr class="my-4" style="border-color: rgba(255,255,255,0.08);">
        <div class="text-center text-white-50">
          <p class="mb-0">© 2026 ShopHub. All rights reserved. Powered by Node.js, Express & MySQL.</p>
        </div>
      </div>
    `;
  }
};
