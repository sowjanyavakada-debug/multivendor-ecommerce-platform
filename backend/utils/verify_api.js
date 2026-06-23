// Programmatic verification script using native http library
// Sets up a temporary test database to keep dev database pristine.
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';

const http = require('http');

// Helper to make HTTP requests
const request = (method, urlPath, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('\n====================================================');
  console.log('STARTING AUTOMATED BACKEND INTEGRATION TESTS');
  console.log('====================================================\n');

  // Start the server
  const server = require('../server');
  
  // Wait for DB initialization (let's sleep 5s to ensure MySQL schemas are created)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  let userToken = '';
  let vendorToken = '';
  let adminToken = '';
  let testProductId = null;
  let testOrderId = null;
  let testReviewId = null;
  let testVendorId = null;

  try {
    // 1. Health Check
    console.log('Testing: GET /health');
    const health = await request('GET', '/health');
    if (health.status !== 200 || !health.body.success) {
      throw new Error(`Health Check Failed: ${JSON.stringify(health)}`);
    }
    console.log('  \x1b[32m✔ Passed\x1b[0m\n');

    // 2. User Registration
    console.log('Testing: POST /api/auth/register (User)');
    const userReg = await request('POST', '/api/auth/register', {}, {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'UserSecurePass123!'
    });
    if (userReg.status !== 201 || !userReg.body.success) {
      throw new Error(`User Registration Failed: ${JSON.stringify(userReg)}`);
    }
    console.log('  \x1b[32m✔ Passed (User ID: ' + userReg.body.user.id + ')\x1b[0m\n');

    // 3. User Login
    console.log('Testing: POST /api/auth/login (User)');
    const userLog = await request('POST', '/api/auth/login', {}, {
      email: 'john@example.com',
      password: 'UserSecurePass123!'
    });
    if (userLog.status !== 200 || !userLog.body.token) {
      throw new Error(`User Login Failed: ${JSON.stringify(userLog)}`);
    }
    userToken = userLog.body.token;
    console.log('  \x1b[32m✔ Passed (Token acquired)\x1b[0m\n');

    // 4. Admin Login (uses seeded credentials)
    console.log('Testing: POST /api/auth/admin/login');
    const adminLog = await request('POST', '/api/auth/admin/login', {}, {
      email: 'admin@ecommerce.com',
      password: 'AdminSecurePass123!'
    });
    if (adminLog.status !== 200 || !adminLog.body.token) {
      throw new Error(`Admin Login Failed: ${JSON.stringify(adminLog)}`);
    }
    adminToken = adminLog.body.token;
    console.log('  \x1b[32m✔ Passed (Admin Token acquired)\x1b[0m\n');

    // 5. Vendor Registration
    console.log('Testing: POST /api/auth/vendor/register');
    const vendorReg = await request('POST', '/api/auth/vendor/register', {}, {
      vendor_name: 'ElectroStore',
      email: 'electro@vendor.com',
      password: 'VendorSecurePass123!'
    });
    if (vendorReg.status !== 201 || !vendorReg.body.success) {
      throw new Error(`Vendor Registration Failed: ${JSON.stringify(vendorReg)}`);
    }
    testVendorId = vendorReg.body.vendor.id;
    console.log('  \x1b[32m✔ Passed (Vendor Status: pending, ID: ' + testVendorId + ')\x1b[0m\n');

    // 6. Vendor Login (Should fail: status is pending)
    console.log('Testing: POST /api/auth/vendor/login (Should fail due to pending status)');
    const vendorLogFail = await request('POST', '/api/auth/vendor/login', {}, {
      email: 'electro@vendor.com',
      password: 'VendorSecurePass123!'
    });
    if (vendorLogFail.status !== 403) {
      throw new Error(`Vendor LogIn should have failed with status 403: ${JSON.stringify(vendorLogFail)}`);
    }
    console.log('  \x1b[32m✔ Passed (Authentication properly blocked)\x1b[0m\n');

    // 7. Admin Approves Vendor
    console.log('Testing: PUT /api/admin/vendors/:id/approve (Admin Auth)');
    const vendorApprove = await request('PUT', `/api/admin/vendors/${testVendorId}/approve`, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (vendorApprove.status !== 200 || !vendorApprove.body.success) {
      throw new Error(`Vendor approval by admin failed: ${JSON.stringify(vendorApprove)}`);
    }
    console.log('  \x1b[32m✔ Passed (Vendor Approved)\x1b[0m\n');

    // 8. Vendor Login (Should succeed now)
    console.log('Testing: POST /api/auth/vendor/login (After Approval)');
    const vendorLogSuccess = await request('POST', '/api/auth/vendor/login', {}, {
      email: 'electro@vendor.com',
      password: 'VendorSecurePass123!'
    });
    if (vendorLogSuccess.status !== 200 || !vendorLogSuccess.body.token) {
      throw new Error(`Vendor login failed: ${JSON.stringify(vendorLogSuccess)}`);
    }
    vendorToken = vendorLogSuccess.body.token;
    console.log('  \x1b[32m✔ Passed (Vendor Token acquired)\x1b[0m\n');

    // 9. Vendor Creates Product
    console.log('Testing: POST /api/products (Vendor Auth)');
    const prodCreate = await request('POST', '/api/products', {
      'Authorization': `Bearer ${vendorToken}`
    }, {
      name: 'Super Wireless Earbuds',
      description: 'Noise cancelling Bluetooth 5.2 earbuds with IPX7 waterproofing.',
      price: 89.99,
      stock: 50,
      category: 'Electronics',
      is_featured: 1
    });
    if (prodCreate.status !== 201 || !prodCreate.body.data.id) {
      throw new Error(`Product Creation Failed: ${JSON.stringify(prodCreate)}`);
    }
    testProductId = prodCreate.body.data.id;
    console.log('  \x1b[32m✔ Passed (Product ID: ' + testProductId + ')\x1b[0m\n');

    // 10. Get Products (Public)
    console.log('Testing: GET /api/products?q=Earbuds (Search)');
    const prodSearch = await request('GET', '/api/products?q=Earbuds');
    if (prodSearch.status !== 200 || prodSearch.body.data.length === 0) {
      throw new Error(`Product search failed: ${JSON.stringify(prodSearch)}`);
    }
    console.log('  \x1b[32m✔ Passed (Found: ' + prodSearch.body.data[0].name + ')\x1b[0m\n');

    // 11. Add to Cart (Customer)
    console.log('Testing: POST /api/cart (Customer Auth)');
    const cartAdd = await request('POST', '/api/cart', {
      'Authorization': `Bearer ${userToken}`
    }, {
      product_id: testProductId,
      quantity: 2
    });
    if (cartAdd.status !== 200 || !cartAdd.body.success) {
      throw new Error(`Adding to cart failed: ${JSON.stringify(cartAdd)}`);
    }
    console.log('  \x1b[32m✔ Passed\x1b[0m\n');

    // 12. Create Admin Coupon (Admin Auth)
    console.log('Testing: POST /api/admin/coupons (Admin Auth)');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const expiry = tomorrow.toISOString().split('T')[0];
    const couponCreate = await request('POST', '/api/admin/coupons', {
      'Authorization': `Bearer ${adminToken}`
    }, {
      code: 'VERIFY10',
      discount_percentage: 10,
      expiry_date: expiry
    });
    if (couponCreate.status !== 201) {
      throw new Error(`Coupon creation failed: ${JSON.stringify(couponCreate)}`);
    }
    console.log('  \x1b[32m✔ Passed\x1b[0m\n');

    // 13. Checkout / Place Order with Coupon (Customer Auth)
    console.log('Testing: POST /api/orders (Customer Checkout with VERIFY10)');
    const checkout = await request('POST', '/api/orders', {
      'Authorization': `Bearer ${userToken}`
    }, {
      coupon_code: 'VERIFY10',
      recipient_name: 'John Doe',
      delivery_address: '123 Main St, Springfield',
      recipient_phone: '555-1234'
    });
    if (checkout.status !== 201 || !checkout.body.data.orderId) {
      throw new Error(`Checkout failed: ${JSON.stringify(checkout)}`);
    }
    testOrderId = checkout.body.data.orderId;
    console.log('  \x1b[32m✔ Passed (Order ID: ' + testOrderId + ', Total: $' + checkout.body.data.finalPrice + ')\x1b[0m\n');

    // 14. Stock Depletion Verification
    console.log('Testing: Checking product stock after purchase');
    const checkStock = await request('GET', `/api/products/${testProductId}`);
    if (checkStock.status !== 200 || checkStock.body.data.stock !== 48) { // 50 starting - 2 purchased = 48
      throw new Error(`Stock level was not correctly decremented: ${JSON.stringify(checkStock)}`);
    }
    console.log('  \x1b[32m✔ Passed (Stock successfully decremented to 48)\x1b[0m\n');

    // 15. User Adds Review (Customer Auth)
    console.log('Testing: POST /api/reviews (Customer Auth)');
    const reviewAdd = await request('POST', '/api/reviews', {
      'Authorization': `Bearer ${userToken}`
    }, {
      product_id: testProductId,
      rating: 5,
      review: 'Awesome product! Battery lasts forever.'
    });
    if (reviewAdd.status !== 201) {
      throw new Error(`Adding review failed: ${JSON.stringify(reviewAdd)}`);
    }
    console.log('  \x1b[32m✔ Passed\x1b[0m\n');

    // 16. Get Review Breakdowns (Public)
    console.log('Testing: GET /api/reviews/product/:id (Public)');
    const reviewGet = await request('GET', `/api/reviews/product/${testProductId}`);
    if (reviewGet.status !== 200 || reviewGet.body.data.averageRating !== 5.0) {
      throw new Error(`Review stats aggregation failed: ${JSON.stringify(reviewGet)}`);
    }
    testReviewId = reviewGet.body.data.reviews[0].id;
    console.log('  \x1b[32m✔ Passed (Average Rating: ' + reviewGet.body.data.averageRating + ')\x1b[0m\n');

    // 17. Cancel Order & Verify Stock Rollback (Admin Auth)
    console.log('Testing: PUT /api/orders/:id/status -> Cancelled (Admin Auth)');
    const cancelOrder = await request('PUT', `/api/orders/${testOrderId}/status`, {
      'Authorization': `Bearer ${adminToken}`
    }, {
      status: 'Cancelled'
    });
    if (cancelOrder.status !== 200) {
      throw new Error(`Order cancellation failed: ${JSON.stringify(cancelOrder)}`);
    }

    console.log('Testing: Re-checking stock levels post-cancellation');
    const checkStockAfterCancel = await request('GET', `/api/products/${testProductId}`);
    if (checkStockAfterCancel.status !== 200 || checkStockAfterCancel.body.data.stock !== 50) { // Should be back to 50
      throw new Error(`Stock level was not restored: ${JSON.stringify(checkStockAfterCancel)}`);
    }
    console.log('  \x1b[32m✔ Passed (Stock successfully restored back to 50)\x1b[0m\n');

    // 18. Admin Stats
    console.log('Testing: GET /api/admin/stats (Admin Auth)');
    const adminStats = await request('GET', '/api/admin/stats', {
      'Authorization': `Bearer ${adminToken}`
    });
    if (adminStats.status !== 200 || adminStats.body.data.totalProducts !== 1) {
      throw new Error(`Admin Dashboard Stats failed: ${JSON.stringify(adminStats)}`);
    }
    console.log('  \x1b[32m✔ Passed (System Stats loaded correctly)\x1b[0m\n');

    console.log('====================================================');
    console.log('ALL API TESTS PASSED SUCCESSFULLY! 🚀');
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n\x1b[31m❌ TEST SUITE FAILED WITH ERROR:\x1b[0m');
    console.error(error);
    process.exitCode = 1;
  } finally {
    console.log('Closing server...');
    server.close(() => {
      console.log('Server shut down.');
      const db = require('../database/database');
      db.db.close(() => {
        console.log('Database pool closed.');
        console.log('Verification run finished.');
        process.exit(process.exitCode || 0);
      });
    });
  }
};

runTests();
