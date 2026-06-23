const assert = require('assert');
const http = require('http');

const API_PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${API_PORT}/api`;

const requestJson = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const urlObj = new URL(url);
    const options = {
      method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('==================================================');
  console.log('STARTING AUTOMATED EXTENSIONS ENDPOINTS TESTING...');
  console.log('==================================================');

  try {
    // 1. Health check
    console.log('\n[TEST 1] Verifying Backend Service Health...');
    const health = await requestJson('GET', '/../health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.success, true);
    console.log('✅ Health check endpoint verified.');

    // 2. Simulated Social Login
    console.log('\n[TEST 2] Verifying Simulated Social Login...');
    const social = await requestJson('POST', '/auth/social-login', {
      email: 'social_verify@test.com',
      name: 'Verify Account',
      provider: 'Google'
    });
    assert.strictEqual(social.status, 200);
    assert.strictEqual(social.body.success, true);
    assert.ok(social.body.token);
    const userToken = social.body.token;
    console.log('✅ Social Login verified.');

    // 3. User Wallet Balance
    console.log('\n[TEST 3] Verifying Wallet Retrieval & Top-ups...');
    const wallet = await requestJson('GET', '/auth/wallet', null, {
      'Authorization': `Bearer ${userToken}`
    });
    assert.strictEqual(wallet.status, 200);
    assert.ok(wallet.body.data.wallet_balance !== undefined);
    
    const deposit = await requestJson('POST', '/auth/wallet/add', { amount: 250 }, {
      'Authorization': `Bearer ${userToken}`
    });
    assert.strictEqual(deposit.status, 200);
    assert.strictEqual(deposit.body.data.wallet_balance, wallet.body.data.wallet_balance + 250);
    console.log('✅ Wallet operations verified.');

    // 4. Authenticate approved test vendor for role-specific tests
    console.log('\n[TEST 4] Authenticating Vendor Account...');
    const vendorLogin = await requestJson('POST', '/auth/vendor/login', {
      email: 'vendor@test.com',
      password: 'VendorSecurePass123!'
    });
    assert.strictEqual(vendorLogin.status, 200);
    const vendorToken = vendorLogin.body.token;
    console.log('✅ Vendor authenticated successfully.');

    // 5. Vendor Store profile details
    console.log('\n[TEST 5] Verifying Vendor Store Profile...');
    const storeGet = await requestJson('GET', '/vendor/store', null, {
      'Authorization': `Bearer ${vendorToken}`
    });
    assert.strictEqual(storeGet.status, 200);
    assert.ok(storeGet.body.data.store_name);

    const storeUpdate = await requestJson('PUT', '/vendor/store', {
      store_name: 'Gadget World Labs',
      store_description: 'Updated descriptions',
      store_logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'
    }, {
      'Authorization': `Bearer ${vendorToken}`
    });
    assert.strictEqual(storeUpdate.status, 200);
    console.log('✅ Store profile endpoints verified.');

    // 6. Bulk Products Upload
    console.log('\n[TEST 6] Verifying Bulk Catalog Upload...');
    const bulk = await requestJson('POST', '/vendor/products/bulk', {
      products: [
        { name: 'Bulk Keyboard A', price: 45.0, stock: 10, category: 'Electronics' },
        { name: 'Bulk Mouse B', price: 25.0, stock: 15, category: 'Electronics' }
      ]
    }, {
      'Authorization': `Bearer ${vendorToken}`
    });
    assert.strictEqual(bulk.status, 201);
    console.log('✅ Bulk upload products verified.');

    // 7. Chat messages system
    console.log('\n[TEST 7] Verifying Direct Support Chat...');
    // Send a message
    const sendMsg = await requestJson('POST', '/messages/send', {
      receiver_id: 1, // Admin user ID
      receiver_role: 'admin',
      message: 'Hello helpdesk, this is a verify check message.'
    }, {
      'Authorization': `Bearer ${userToken}`
    });
    assert.strictEqual(sendMsg.status, 201);
    console.log('✅ Sending support message verified.');

    console.log('\n==================================================');
    console.log('ALL API ENDPOINT EXTENSIONS VERIFIED SUCCESSFULLY!');
    console.log('==================================================');
  } catch (error) {
    console.error('❌ Endpoint verification failed:', error.message);
    process.exit(1);
  }
};

runTests();
