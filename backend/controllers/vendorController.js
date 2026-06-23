const db = require('../database/database');

// 1. Get Vendor Dashboard Stats
const getVendorStats = async (req, res, next) => {
  try {
    const vendorId = req.user.id; // Authenticated vendor ID

    // Fetch Total Products
    const productsCount = await db.get(
      'SELECT COUNT(*) as total FROM Products WHERE vendor_id = ?',
      [vendorId]
    );

    // Fetch Total Orders containing this vendor's products
    const ordersCount = await db.get(
      `SELECT COUNT(DISTINCT oi.order_id) as total 
       FROM Order_Items oi 
       JOIN Products p ON oi.product_id = p.id 
       WHERE p.vendor_id = ?`,
      [vendorId]
    );

    // Fetch Total Revenue from vendor's sold products (excluding Cancelled orders)
    const revenueSum = await db.get(
      `SELECT COALESCE(SUM(oi.price * oi.quantity), 0) as total 
       FROM Order_Items oi 
       JOIN Products p ON oi.product_id = p.id 
       JOIN Orders o ON oi.order_id = o.id 
       WHERE p.vendor_id = ? AND o.status != 'Cancelled'`,
      [vendorId]
    );

    // Fetch Low Stock Alerts (Stock <= 5)
    const lowStockAlerts = await db.all(
      'SELECT id, name, stock, price FROM Products WHERE vendor_id = ? AND stock <= 5 ORDER BY stock ASC',
      [vendorId]
    );

    return res.status(200).json({
      success: true,
      data: {
        totalProducts: productsCount ? productsCount.total : 0,
        totalOrders: ordersCount ? ordersCount.total : 0,
        totalRevenue: revenueSum ? revenueSum.total : 0.0,
        lowStockCount: lowStockAlerts.length,
        lowStockProducts: lowStockAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Inventory Details for Vendor
const getVendorInventory = async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    // Get all products with stock details
    const inventory = await db.all(
      'SELECT id, name, price, stock, category, image_url, created_at FROM Products WHERE vendor_id = ? ORDER BY stock ASC',
      [vendorId]
    );

    return res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Vendor Products List
const getVendorProducts = async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const products = await db.all(
      'SELECT * FROM Products WHERE vendor_id = ? ORDER BY created_at DESC',
      [vendorId]
    );

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Get Vendor Orders List
const getVendorOrders = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const orders = await db.all(
      `SELECT DISTINCT o.id, o.total_price, o.discount_applied, o.coupon_code, o.status, o.order_date, u.name as customer_name, u.email as customer_email
       FROM Orders o
       JOIN Users u ON o.user_id = u.id
       JOIN Order_Items oi ON o.id = oi.order_id
       JOIN Products p ON oi.product_id = p.id
       WHERE p.vendor_id = ?
       ORDER BY o.order_date DESC`,
      [vendorId]
    );

    for (const order of orders) {
      const items = await db.all(
        `SELECT oi.id as item_id, oi.product_id, oi.quantity, oi.price, p.name as product_name, p.image_url
         FROM Order_Items oi
         JOIN Products p ON oi.product_id = p.id
         WHERE oi.order_id = ? AND p.vendor_id = ?`,
        [order.id, vendorId]
      );
      order.items = items;
      let vendorSubtotal = 0;
      items.forEach(i => {
        vendorSubtotal += i.price * i.quantity;
      });
      order.vendorSubtotal = vendorSubtotal;
    }

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// 5. Get Vendor Store Profile
const getVendorStore = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    let store = await db.get('SELECT * FROM Stores WHERE vendor_id = ?', [vendorId]);
    if (!store) {
      // Create a default store profile if not exists
      const vendor = await db.get('SELECT vendor_name FROM Vendors WHERE id = ?', [vendorId]);
      const name = vendor ? vendor.vendor_name : 'My Store';
      const result = await db.run(
        'INSERT INTO Stores (vendor_id, store_name, store_description, store_logo, store_banner, commission_rate) VALUES (?, ?, ?, ?, ?, 10.00)',
        [vendorId, name + ' Store', 'Premium collection of products.', 'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=800', 'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=1200']
      );
      store = {
        id: result.id,
        vendor_id: vendorId,
        store_name: name + ' Store',
        store_description: 'Premium collection of products.',
        store_logo: 'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=800',
        store_banner: 'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=1200',
        commission_rate: 10.00
      };
    }
    const walletInfo = await db.get('SELECT wallet_balance FROM Vendors WHERE id = ?', [vendorId]);
    store.wallet_balance = walletInfo ? walletInfo.wallet_balance : 0.00;

    return res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

// 6. Update Vendor Store Profile
const updateVendorStore = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { store_name, store_description, store_logo, store_banner } = req.body;

    if (!store_name) {
      return res.status(400).json({ success: false, message: 'Store name is required.' });
    }

    const existing = await db.get('SELECT * FROM Stores WHERE vendor_id = ?', [vendorId]);
    if (existing) {
      await db.run(
        'UPDATE Stores SET store_name = ?, store_description = ?, store_logo = ?, store_banner = ? WHERE vendor_id = ?',
        [store_name, store_description, store_logo, store_banner || null, vendorId]
      );
    } else {
      await db.run(
        'INSERT INTO Stores (vendor_id, store_name, store_description, store_logo, store_banner) VALUES (?, ?, ?, ?, ?)',
        [vendorId, store_name, store_description, store_logo, store_banner || null]
      );
    }

    return res.status(200).json({ success: true, message: 'Store profile updated successfully.' });
  } catch (error) {
    next(error);
  }
};

// 7. Bulk Upload Products
const bulkUploadProducts = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { products } = req.body; // Array of product objects

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'An array of products is required.' });
    }

    for (const p of products) {
      const { name, description, price, stock, category, subcategory } = p;
      if (!name || !price || !category) continue; // skip invalid records

      await db.run(
        `INSERT INTO Products (name, description, price, stock, category, subcategory, vendor_id, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved')`,
        [name, description || '', price, stock || 0, category, subcategory || 'General', vendorId]
      );
    }

    return res.status(201).json({ success: true, message: `Successfully bulk uploaded ${products.length} products.` });
  } catch (error) {
    next(error);
  }
};

// 8. Request Wallet Payout
const requestPayout = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { amount } = req.body;
    const val = parseFloat(amount);

    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount.' });
    }

    const vendor = await db.get('SELECT wallet_balance FROM Vendors WHERE id = ?', [vendorId]);
    if (!vendor || vendor.wallet_balance < val) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance for this payout request.' });
    }

    await db.run('UPDATE Vendors SET wallet_balance = wallet_balance - ? WHERE id = ?', [val, vendorId]);
    return res.status(200).json({ success: true, message: `Payout of ₹${val.toFixed(2)} processed successfully.` });
  } catch (error) {
    next(error);
  }
};

// 9. Get Coupons (Vendor custom scope)
const getCoupons = async (req, res, next) => {
  try {
    const coupons = await db.all('SELECT * FROM Coupons ORDER BY id DESC');
    return res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    next(error);
  }
};

// 10. Create Coupon (Vendor custom scope)
const createCoupon = async (req, res, next) => {
  try {
    const { code, discount_percentage, expiry_date } = req.body;
    if (!code || !discount_percentage || !expiry_date) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    const existing = await db.get('SELECT id FROM Coupons WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists.' });
    }
    await db.run(
      'INSERT INTO Coupons (code, discount_percentage, expiry_date) VALUES (?, ?, ?)',
      [code, parseFloat(discount_percentage), expiry_date]
    );
    return res.status(201).json({ success: true, message: 'Coupon created successfully.' });
  } catch (error) {
    next(error);
  }
};

// 11. Delete Coupon (Vendor custom scope)
const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM Coupons WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Coupon deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// 12. Get all reviews for vendor's products
const getVendorReviews = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const reviews = await db.all(
      `SELECT r.*, p.name as product_name, u.name as reviewer_name 
       FROM Reviews r 
       JOIN Products p ON r.product_id = p.id 
       JOIN Users u ON r.user_id = u.id 
       WHERE p.vendor_id = ?
       ORDER BY r.created_at DESC`,
      [vendorId]
    );
    return res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

// 13. Delete a review for vendor's product
const deleteVendorReview = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;
    
    const review = await db.get(
      `SELECT r.id 
       FROM Reviews r 
       JOIN Products p ON r.product_id = p.id 
       WHERE r.id = ? AND p.vendor_id = ?`,
      [id, vendorId]
    );
    if (!review) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You can only delete reviews for your own products.' });
    }
    
    await db.run('DELETE FROM Reviews WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Review deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVendorStats,
  getVendorInventory,
  getVendorProducts,
  getVendorOrders,
  getVendorStore,
  updateVendorStore,
  bulkUploadProducts,
  requestPayout,
  getCoupons,
  createCoupon,
  deleteCoupon,
  getVendorReviews,
  deleteVendorReview,
};
