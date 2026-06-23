document.addEventListener('DOMContentLoaded', async () => {
  // Render shared layouts
  renderSharedLayout();

  // Read query params from URL (e.g., from categories redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category');
  if (initialCategory) {
    document.getElementById('filterCategory').value = initialCategory;
  }

  // Load catalog on start
  await loadCatalog(1);

  // Apply filters event
  document.getElementById('btn-apply-filters').addEventListener('click', async () => {
    await loadCatalog(1);
  });

  // Reset filters event
  document.getElementById('btn-reset-filters').addEventListener('click', async () => {
    document.getElementById('searchQuery').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterMinPrice').value = '';
    document.getElementById('filterMaxPrice').value = '';
    document.getElementById('filterSort').value = 'newest';
    await loadCatalog(1);
  });

  // Autocomplete Suggestions logic
  const searchInput = document.getElementById('searchQuery');
  const suggestionBox = document.getElementById('autocomplete-suggestion-box');

  searchInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    if (val.length < 2) {
      suggestionBox.style.display = 'none';
      return;
    }
    try {
      const res = await API.get(`/products/suggestions?q=${encodeURIComponent(val)}`);
      if (res.success && res.data.length > 0) {
        suggestionBox.innerHTML = res.data.map(item => `
          <div class="suggestion-item">${item}</div>
        `).join('');
        suggestionBox.style.display = 'block';
      } else {
        suggestionBox.style.display = 'none';
      }
    } catch (err) {
      console.error('Suggestions fetch failed:', err);
    }
  });

  // Handle Suggestion Item Click
  suggestionBox.addEventListener('click', async (e) => {
    if (e.target.classList.contains('suggestion-item')) {
      searchInput.value = e.target.innerText;
      suggestionBox.style.display = 'none';
      await loadCatalog(1);
    }
  });

  // Hide suggestion box on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionBox.contains(e.target)) {
      suggestionBox.style.display = 'none';
    }
  });

  // Grid actions
  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-view-details')) {
      const id = e.target.getAttribute('data-id');
      await openProductModal(id);
    }
    if (e.target.classList.contains('btn-add-cart')) {
      const id = e.target.getAttribute('data-id');
      await handleAddToCart(id);
    }
  });

  // Modal direct actions
  const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');
  if (modalAddToCartBtn) {
    modalAddToCartBtn.addEventListener('click', async () => {
      if (activeProductId) {
        await handleAddToCart(activeProductId);
      }
    });
  }

  const modalAddToWishlistBtn = document.getElementById('modalAddToWishlistBtn');
  if (modalAddToWishlistBtn) {
    modalAddToWishlistBtn.addEventListener('click', async () => {
      if (activeProductId) {
        await handleAddToWishlist(activeProductId);
      }
    });
  }
});

let currentPage = 1;
let activeProductId = null;
let activeModal = null;

async function loadCatalog(page = 1) {
  currentPage = page;
  const q = document.getElementById('searchQuery').value.trim();
  const category = document.getElementById('filterCategory').value;
  const min_price = document.getElementById('filterMinPrice').value;
  const max_price = document.getElementById('filterMaxPrice').value;
  const sort = document.getElementById('filterSort').value;
  const limit = 6;

  // Build query string
  let query = `/products?page=${page}&limit=${limit}`;
  if (q) query += `&q=${encodeURIComponent(q)}`;
  if (category) query += `&category=${encodeURIComponent(category)}`;
  if (min_price) query += `&min_price=${min_price}`;
  if (max_price) query += `&max_price=${max_price}`;
  if (sort) query += `&sort=${sort}`;

  try {
    const res = await API.get(query);
    renderCatalogGrid(res.data);
    renderPagination(res.pagination);
    document.getElementById('catalog-count-info').innerText = `Showing ${res.data.length} of ${res.pagination.totalItems} products`;
  } catch (err) {
    console.error('Catalog fetch error:', err);
    document.getElementById('catalog-grid').innerHTML = '<div class="col-12 text-center text-danger">Failed to load catalog products.</div>';
  }
}

function renderCatalogGrid(products) {
  const container = document.getElementById('catalog-grid');
  if (!products || products.length === 0) {
    container.innerHTML = '<div class="col-12 text-center py-5 text-muted"><i class="bi bi-emoji-frown fs-2 d-block mb-3"></i>No products match your filter criteria.</div>';
    return;
  }

  container.innerHTML = products.map(prod => {
    const imageUrl = prod.image_url ? `http://localhost:5000/${prod.image_url}` : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
    return `
      <div class="col-sm-6 col-md-4 animate-fade-up">
        <div class="card premium-card h-100">
          <img src="${imageUrl}" class="card-img-top" alt="${prod.name}">
          <div class="card-body d-flex flex-column text-center">
            <h5 class="fw-bold mb-1 text-truncate" title="${prod.name}">${prod.name}</h5>
            <span class="badge bg-secondary-subtle text-secondary mb-2 align-self-center">${prod.category}</span>
            <p class="price fw-bold text-primary mb-3">₹${prod.price.toFixed(2)}</p>
            <div class="d-grid gap-2 mt-auto">
              <button class="btn btn-outline-primary btn-sm btn-view-details" data-id="${prod.id}">View Details</button>
              <button class="btn btn-premium-primary btn-sm btn-add-cart" data-id="${prod.id}">Add To Cart</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPagination(meta) {
  const container = document.getElementById('pagination-container');
  if (!meta || meta.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '<nav><ul class="pagination pagination-md">';
  
  // Previous button
  html += `
    <li class="page-item ${meta.currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="event.preventDefault(); loadCatalog(${meta.currentPage - 1})"><i class="bi bi-chevron-left"></i></a>
    </li>
  `;

  // Pages
  for (let i = 1; i <= meta.totalPages; i++) {
    html += `
      <li class="page-item ${meta.currentPage === i ? 'active' : ''}">
        <a class="page-link" href="#" onclick="event.preventDefault(); loadCatalog(${i})">${i}</a>
      </li>
    `;
  }

  // Next button
  html += `
    <li class="page-item ${meta.currentPage === meta.totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="event.preventDefault(); loadCatalog(${meta.currentPage + 1})"><i class="bi bi-chevron-right"></i></a>
    </li>
  `;

  html += '</ul></nav>';
  container.innerHTML = html;
}

// Product Details & Reviews Modal logic (Synchronized)
async function openProductModal(productId) {
  activeProductId = productId;
  try {
    const res = await API.get(`/products/${productId}`);
    const prod = res.data;
    
    document.getElementById('modalTitle').innerText = prod.name;
    document.getElementById('modalPrice').innerText = `₹${prod.price.toFixed(2)}`;
    document.getElementById('modalDescription').innerText = prod.description || 'No description available.';
    document.getElementById('modalCategory').innerText = prod.category;
    document.getElementById('modalImage').src = prod.image_url ? `http://localhost:5000/${prod.image_url}` : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
    
    const storeLink = document.getElementById('modalVendorStoreLink');
    if (storeLink) {
      storeLink.innerText = prod.vendor_name || 'Visit Store';
      storeLink.href = `store.html?vendor_id=${prod.vendor_id}`;
    }
    
    // Log product view
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await API.post(`/products/${productId}/view`);
      } catch (e) {
        console.warn('Logging product view failed:', e.message);
      }
    }

    document.getElementById('submitReviewForm').reset();
    document.getElementById('selectedRating').value = 5;
    resetRatingStars(5);
    
    await loadProductReviews(productId);

    if (!activeModal) {
      activeModal = new bootstrap.Modal(document.getElementById('productModal'));
    }
    activeModal.show();
  } catch (err) {
    API.showToast('Failed to load product details.', true);
  }
}

async function loadProductReviews(productId) {
  try {
    const reviewsRes = await API.get(`/reviews/product/${productId}`);
    const summary = reviewsRes.data;
    
    const avg = summary.averageRating || 0;
    document.getElementById('avgRatingText').innerText = avg.toFixed(1);
    document.getElementById('totalReviewsText').innerText = `${summary.totalReviews || 0} reviews`;
    
    let starsHtml = '';
    const fullStars = Math.floor(avg);
    const halfStar = avg % 1 >= 0.5 ? 1 : 0;
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        starsHtml += '<i class="bi bi-star-fill text-warning"></i>';
      } else if (i === fullStars + 1 && halfStar) {
        starsHtml += '<i class="bi bi-star-half text-warning"></i>';
      } else {
        starsHtml += '<i class="bi bi-star text-warning"></i>';
      }
    }
    document.getElementById('avgStarsContainer').innerHTML = starsHtml;
    
    const breakdown = summary.breakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const total = summary.totalReviews || 1;
    let breakdownHtml = '';
    for (let rating = 5; rating >= 1; rating--) {
      const count = breakdown[rating] || 0;
      const percentage = (count / total) * 100;
      breakdownHtml += `
        <div class="rating-bar-container">
          <div class="rating-bar-label">${rating} Star</div>
          <div class="rating-bar-progress">
            <div class="rating-bar-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="rating-bar-count">${count}</div>
        </div>
      `;
    }
    document.getElementById('breakdownContainer').innerHTML = breakdownHtml;

    const listContainer = document.getElementById('modalReviewsList');
    if (summary.reviews && summary.reviews.length > 0) {
      listContainer.innerHTML = summary.reviews.map(rev => {
        let rStars = '';
        for (let i = 1; i <= 5; i++) {
          rStars += i <= rev.rating ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-warning"></i>';
        }
        const reviewerName = rev.reviewer_name || 'Anonymous';
        return `
          <div class="border-bottom py-2 mb-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fw-bold">${reviewerName}</span>
              <div class="star-rating fs-6">${rStars}</div>
            </div>
            <p class="text-muted mb-0 small">${rev.review}</p>
          </div>
        `;
      }).join('');
    } else {
      listContainer.innerHTML = `<div class="text-muted text-center py-3">No reviews yet. Be the first to review!</div>`;
    }
  } catch (err) {
    console.error('Error loading reviews:', err);
  }
}

// Review stars input picker
const starPicker = document.getElementById('ratingStarPicker');
if (starPicker) {
  starPicker.addEventListener('click', (e) => {
    if (e.target.tagName === 'I') {
      const val = parseInt(e.target.getAttribute('data-val'));
      document.getElementById('selectedRating').value = val;
      resetRatingStars(val);
    }
  });
}

function resetRatingStars(val) {
  const stars = document.querySelectorAll('#ratingStarPicker i');
  stars.forEach((star, index) => {
    if (index < val) {
      star.className = 'bi bi-star-fill cursor-pointer';
    } else {
      star.className = 'bi bi-star cursor-pointer';
    }
  });
}

// Handle Submit Review
const reviewForm = document.getElementById('submitReviewForm');
if (reviewForm) {
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      API.showToast('Please log in to submit a review.', true);
      setTimeout(() => { window.location.href = 'auth.html'; }, 1500);
      return;
    }
    const rating = parseInt(document.getElementById('selectedRating').value);
    const review = document.getElementById('reviewText').value.trim();
    try {
      await API.post('/reviews', { product_id: activeProductId, rating, review });
      API.showToast('Review submitted successfully!');
      document.getElementById('reviewText').value = '';
      await loadProductReviews(activeProductId);
    } catch (err) {
      API.showToast(err.message || 'Failed to submit review.', true);
    }
  });
}

// Cart/Wishlist Add helpers
async function handleAddToCart(productId) {
  const token = localStorage.getItem('token');
  if (!token) {
    API.showToast('Please log in to add items to cart.', true);
    setTimeout(() => { window.location.href = 'auth.html'; }, 1500);
    return;
  }
  try {
    const res = await API.post('/cart', { product_id: productId, quantity: 1 });
    if (res.success) {
      API.showToast('Added to cart successfully!');
    }
  } catch (err) {
    API.showToast(err.message || 'Failed to add to cart.', true);
  }
}

async function handleAddToWishlist(productId) {
  const token = localStorage.getItem('token');
  if (!token) {
    API.showToast('Please log in to add items to wishlist.', true);
    setTimeout(() => { window.location.href = 'auth.html'; }, 1500);
    return;
  }
  try {
    const res = await API.post('/wishlist', { product_id: productId });
    if (res.success) {
      API.showToast('Added to wishlist successfully!');
    }
  } catch (err) {
    API.showToast(err.message || 'Failed to add to wishlist.', true);
  }
}
