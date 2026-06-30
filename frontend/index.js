document.addEventListener('DOMContentLoaded', async () => {
  // Render shared layouts
  renderSharedLayout();

  // Load home page products
  await loadHomepageProducts();

  // Hook up event listeners for dynamically rendered buttons
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

let activeProductId = null;
let activeModal = null;

// Categories Navigation
window.goToCategory = (category) => {
  window.location.href = `shop.html?category=${encodeURIComponent(category)}`;
};

// Fetch and render homepage products
async function loadHomepageProducts() {
  try {
    const featuredRes = await API.get('/products/featured?limit=4');
    renderProducts('featured-products-container', featuredRes.data);
  } catch (err) {
    console.error('Featured load failed:', err);
    document.getElementById('featured-products-container').innerHTML = '<div class="col-12 text-center text-danger">Failed to load featured products.</div>';
  }

  try {
    const trendingRes = await API.get('/products/trending?limit=4');
    renderProducts('trending-products-container', trendingRes.data);
  } catch (err) {
    console.error('Trending load failed:', err);
    document.getElementById('trending-products-container').innerHTML = '<div class="col-12 text-center text-danger">Failed to load trending products.</div>';
  }

  try {
    const bestSellersRes = await API.get('/products/bestsellers?limit=4');
    renderProducts('bestsellers-products-container', bestSellersRes.data);
  } catch (err) {
    console.error('Best sellers load failed:', err);
    document.getElementById('bestsellers-products-container').innerHTML = '<div class="col-12 text-center text-danger">Failed to load best sellers.</div>';
  }
}

// Render dynamic card rows
function renderProducts(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!products || products.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-4 text-muted">No products found.</div>`;
    return;
  }

  container.innerHTML = products.map(prod => {
    const imageUrl = window.getProductImageUrl(prod.image_url, prod.name);
    return `
      <div class="col-6 col-md-3">
        <div class="card premium-card h-100">
          <img src="${imageUrl}" class="card-img-top" alt="${prod.name}" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'; this.onerror=null;">
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

// Product Details & Reviews Modal logic
async function openProductModal(productId) {
  activeProductId = productId;
  try {
    const res = await API.get(`/products/${productId}`);
    const prod = res.data;
    
    // Fill basic details
    document.getElementById('modalTitle').innerText = prod.name;
    document.getElementById('modalPrice').innerText = `₹${prod.price.toFixed(2)}`;
    document.getElementById('modalDescription').innerText = prod.description || 'No description available.';
    document.getElementById('modalCategory').innerText = prod.category;
    const modalImg = document.getElementById('modalImage');
    modalImg.src = window.getProductImageUrl(prod.image_url, prod.name);
    modalImg.onerror = function() {
      this.src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
      this.onerror = null;
    };
    
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

    // Reset review form
    document.getElementById('submitReviewForm').reset();
    document.getElementById('selectedRating').value = 5;
    resetRatingStars(5);
    
    // Fetch and show reviews
    await loadProductReviews(productId);

    // Show modal
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
    
    // Average rating
    const avg = summary.averageRating || 0;
    document.getElementById('avgRatingText').innerText = avg.toFixed(1);
    document.getElementById('totalReviewsText').innerText = `${summary.totalReviews || 0} reviews`;
    
    // Render stars
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
    
    // Render breakdown progress bars
    const breakdown = summary.breakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const total = summary.totalReviews || 1; // avoid divide by zero
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

    // Render list
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