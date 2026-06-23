const db = require('../database/database');

// 1. Get Admin Dashboard Stats
const getAdminStats = async (req, res, next) => {
  try {
    const usersCount = await db.get("SELECT COUNT(*) as total FROM Users WHERE role = 'user'");
    const vendorsCount = await db.get('SELECT COUNT(*) as total FROM Vendors');
    const productsCount = await db.get('SELECT COUNT(*) as total FROM Products');
    const ordersCount = await db.get('SELECT COUNT(*) as total FROM Orders');
    
    // Revenue sum (all non-cancelled orders)
    const revenueSum = await db.get(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM Orders WHERE status != 'Cancelled'"
    );

    // Vendor approvals split status
    const pendingVendors = await db.get("SELECT COUNT(*) as total FROM Vendors WHERE status = 'pending'");

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: usersCount ? usersCount.total : 0,
        totalVendors: vendorsCount ? vendorsCount.total : 0,
        totalProducts: productsCount ? productsCount.total : 0,
        totalOrders: ordersCount ? ordersCount.total : 0,
        totalRevenue: revenueSum ? revenueSum.total : 0.0,
        pendingVendorsCount: pendingVendors ? pendingVendors.total : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Manage Users - List Users
const getUsers = async (req, res, next) => {
  try {
    const users = await db.all(
      "SELECT id, name, email, role, created_at FROM Users WHERE role = 'user' ORDER BY created_at DESC"
    );
    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Manage Users - Delete User
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await db.get('SELECT * FROM Users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete admin accounts.' });
    }

    await db.run('DELETE FROM Users WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'User account deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 4. Manage Vendors - List Vendors
const getVendors = async (req, res, next) => {
  try {
    const vendors = await db.all(
      'SELECT id, vendor_name, email, status, commission_rate, created_at FROM Vendors ORDER BY created_at DESC'
    );
    return res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Manage Vendors - Approve Vendor (status = 'approved')
const approveVendor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const vendor = await db.get('SELECT * FROM Vendors WHERE id = ?', [id]);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    await db.run("UPDATE Vendors SET status = 'approved' WHERE id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: `Vendor '${vendor.vendor_name}' approved successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Manage Vendors - Block Vendor (status = 'blocked')
const blockVendor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const vendor = await db.get('SELECT * FROM Vendors WHERE id = ?', [id]);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    await db.run("UPDATE Vendors SET status = 'blocked' WHERE id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: `Vendor '${vendor.vendor_name}' blocked successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

// 7. Manage Orders - List All Orders
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await db.all(
      `SELECT o.*, u.name as customer_name 
       FROM Orders o 
       JOIN Users u ON o.user_id = u.id 
       ORDER BY o.order_date DESC`
    );

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// 8. Manage Coupons - Create Coupon
const createCoupon = async (req, res, next) => {
  try {
    const { code, discount_percentage, expiry_date } = req.body;

    if (!code || !discount_percentage || !expiry_date) {
      return res.status(400).json({ success: false, message: 'All coupon fields (code, discount_percentage, expiry_date) are required.' });
    }

    const discountVal = parseFloat(discount_percentage);
    if (discountVal <= 0 || discountVal > 100) {
      return res.status(400).json({ success: false, message: 'Discount percentage must be between 1 and 100.' });
    }

    // Check if exists
    const existing = await db.get('SELECT * FROM Coupons WHERE code = ?', [code.toUpperCase()]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists.' });
    }

    await db.run(
      'INSERT INTO Coupons (code, discount_percentage, expiry_date) VALUES (?, ?, ?)',
      [code.toUpperCase(), discountVal, expiry_date]
    );

    return res.status(201).json({
      success: true,
      message: 'Coupon code created successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 9. Manage Coupons - List Coupons
const getCoupons = async (req, res, next) => {
  try {
    const coupons = await db.all('SELECT * FROM Coupons ORDER BY expiry_date ASC');
    return res.status(200).json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    next(error);
  }
};

// 10. Manage Coupons - Delete Coupon
const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await db.get('SELECT * FROM Coupons WHERE id = ?', [id]);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    await db.run('DELETE FROM Coupons WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 11. Moderation - List All Products
const getAllProductsForModeration = async (req, res, next) => {
  try {
    const products = await db.all(
      `SELECT p.*, v.vendor_name 
       FROM Products p 
       JOIN Vendors v ON p.vendor_id = v.id 
       ORDER BY p.created_at DESC`
    );
    return res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

// 12. Moderation - Update Product status
const updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Approved', 'Rejected'

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid moderation status.' });
    }

    await db.run('UPDATE Products SET status = ? WHERE id = ?', [status, id]);
    return res.status(200).json({ success: true, message: `Product moderation status set to ${status}.` });
  } catch (error) {
    next(error);
  }
};

// 13. System Settings - Get Settings
const getSystemSettings = async (req, res, next) => {
  try {
    const settings = await db.all('SELECT * FROM SystemSettings');
    const config = {};
    settings.forEach(s => {
      config[s.setting_key] = s.setting_value;
    });
    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

// 14. System Settings - Update Settings
const updateSystemSettings = async (req, res, next) => {
  try {
    const { tax_percentage, shipping_fee_flat, global_commission_percentage, cms_banner_text, cms_banner_image, cms_blogs } = req.body;

    const updates = {
      tax_percentage,
      shipping_fee_flat,
      global_commission_percentage,
      cms_banner_text,
      cms_banner_image,
      cms_blogs
    };

    for (const key in updates) {
      if (updates[key] !== undefined) {
        await db.run(
          'INSERT INTO SystemSettings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [key, updates[key], updates[key]]
        );
      }
    }

    return res.status(200).json({ success: true, message: 'System settings updated successfully.' });
  } catch (error) {
    next(error);
  }
};

// 15. Delivery Partner - List
const getDeliveryPartners = async (req, res, next) => {
  try {
    const partners = await db.all('SELECT * FROM DeliveryPartners ORDER BY created_at DESC');
    return res.status(200).json({ success: true, data: partners });
  } catch (error) {
    next(error);
  }
};

// 16. Delivery Partner - Add
const addDeliveryPartner = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    }

    const result = await db.run('INSERT INTO DeliveryPartners (name, phone) VALUES (?, ?)', [name, phone]);
    return res.status(201).json({ success: true, message: 'Delivery partner registered successfully.', id: result.id });
  } catch (error) {
    next(error);
  }
};

// 17. Delivery Partner - Delete
const deleteDeliveryPartner = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM DeliveryPartners WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Delivery partner removed successfully.' });
  } catch (error) {
    next(error);
  }
};

const rejectVendor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await db.get('SELECT * FROM Vendors WHERE id = ?', [id]);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }
    await db.run("UPDATE Vendors SET status = 'rejected' WHERE id = ?", [id]);
    return res.status(200).json({
      success: true,
      message: `Vendor '${vendor.vendor_name}' registration application rejected successfully.`
    });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await db.all('SELECT * FROM Categories ORDER BY name ASC');
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }
    const existing = await db.get('SELECT id FROM Categories WHERE name = ?', [name]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category name already exists.' });
    }
    const result = await db.run('INSERT INTO Categories (name, description) VALUES (?, ?)', [name, description || '']);
    return res.status(201).json({ success: true, message: 'Category created successfully.', id: result.id });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM Categories WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const updateVendorCommission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { commission_rate } = req.body;
    if (commission_rate === undefined || isNaN(commission_rate) || commission_rate < 0 || commission_rate > 100) {
      return res.status(400).json({ success: false, message: 'Invalid commission rate.' });
    }
    await db.run('UPDATE Stores SET commission_rate = ? WHERE vendor_id = ?', [commission_rate, id]);
    await db.run('UPDATE Vendors SET commission_rate = ? WHERE id = ?', [commission_rate, id]);
    return res.status(200).json({ success: true, message: 'Commission rate updated successfully.' });
  } catch (error) {
    next(error);
  }
};

const getPayoutRequests = async (req, res, next) => {
  try {
    const payouts = await db.all(
      `SELECT pr.*, v.vendor_name, v.email as vendor_email 
       FROM PayoutRequests pr 
       JOIN Vendors v ON pr.vendor_id = v.id 
       ORDER BY pr.created_at DESC`
    );
    return res.status(200).json({ success: true, data: payouts });
  } catch (error) {
    next(error);
  }
};

const approvePayout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await db.get('SELECT * FROM PayoutRequests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Payout request not found.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Payout request is already resolved.' });
    }
    await db.run("UPDATE PayoutRequests SET status = 'Approved' WHERE id = ?", [id]);
    return res.status(200).json({ success: true, message: 'Payout request approved successfully.' });
  } catch (error) {
    next(error);
  }
};

const rejectPayout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await db.get('SELECT * FROM PayoutRequests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Payout request not found.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Payout request is already resolved.' });
    }
    await db.run("UPDATE PayoutRequests SET status = 'Rejected' WHERE id = ?", [id]);
    // Refund the amount to the vendor's wallet balance
    await db.run('UPDATE Vendors SET wallet_balance = wallet_balance + ? WHERE id = ?', [request.amount, request.vendor_id]);
    return res.status(200).json({ success: true, message: 'Payout request rejected and funds refunded to vendor wallet.' });
  } catch (error) {
    next(error);
  }
};

const getReportsAndAnalytics = async (req, res, next) => {
  try {
    const totalGrossSales = await db.get(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM Orders WHERE status != 'Cancelled'"
    );

    const itemsList = await db.all(
      `SELECT oi.price, oi.quantity, p.vendor_id, o.status
       FROM Order_Items oi
       JOIN Products p ON oi.product_id = p.id
       JOIN Orders o ON oi.order_id = o.id
       WHERE o.status != 'Cancelled'`
    );

    let totalPlatformCommission = 0;
    for (const item of itemsList) {
      const store = await db.get('SELECT commission_rate FROM Stores WHERE vendor_id = ?', [item.vendor_id]);
      const rate = store ? parseFloat(store.commission_rate) : 10.00;
      totalPlatformCommission += (item.price * item.quantity) * (rate / 100);
    }
    totalPlatformCommission = parseFloat(totalPlatformCommission.toFixed(2));

    const topSellers = await db.all(
      `SELECT p.id, p.name, p.category, SUM(oi.quantity) as total_qty_sold, SUM(oi.price * oi.quantity) as total_revenue
       FROM Order_Items oi
       JOIN Products p ON oi.product_id = p.id
       JOIN Orders o ON oi.order_id = o.id
       WHERE o.status != 'Cancelled'
       GROUP BY p.id
       ORDER BY total_qty_sold DESC
       LIMIT 10`
    );

    const vendorsList = await db.all('SELECT id, vendor_name FROM Vendors');
    const vendorPerformance = [];
    for (const v of vendorsList) {
      const salesData = await db.all(
        `SELECT oi.price, oi.quantity
         FROM Order_Items oi
         JOIN Products p ON oi.product_id = p.id
         JOIN Orders o ON oi.order_id = o.id
         WHERE p.vendor_id = ? AND o.status != 'Cancelled'`,
        [v.id]
      );

      let gross = 0;
      let comm = 0;
      const store = await db.get('SELECT commission_rate FROM Stores WHERE vendor_id = ?', [v.id]);
      const rate = store ? parseFloat(store.commission_rate) : 10.00;

      salesData.forEach(item => {
        const itemGross = item.price * item.quantity;
        gross += itemGross;
        comm += itemGross * (rate / 100);
      });

      vendorPerformance.push({
        vendor_id: v.id,
        vendor_name: v.vendor_name,
        total_items_sold: salesData.reduce((acc, curr) => acc + curr.quantity, 0),
        gross_revenue: parseFloat(gross.toFixed(2)),
        commission_earned: parseFloat(comm.toFixed(2)),
        net_earnings: parseFloat((gross - comm).toFixed(2))
      });
    }

    const statusCounts = await db.all(
      'SELECT status, COUNT(*) as count FROM Orders GROUP BY status'
    );
    const orderStatuses = {};
    statusCounts.forEach(s => {
      orderStatuses[s.status] = s.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          gross_sales: totalGrossSales ? totalGrossSales.total : 0.0,
          platform_commission: totalPlatformCommission,
          net_payouts: parseFloat(((totalGrossSales ? totalGrossSales.total : 0.0) - totalPlatformCommission).toFixed(2))
        },
        top_selling_products: topSellers,
        vendor_performance: vendorPerformance,
        order_status_distribution: orderStatuses
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminStats,
  getUsers,
  deleteUser,
  getVendors,
  approveVendor,
  blockVendor,
  rejectVendor,
  getAllOrders,
  createCoupon,
  getCoupons,
  deleteCoupon,
  getAllProductsForModeration,
  updateProductStatus,
  getSystemSettings,
  updateSystemSettings,
  getDeliveryPartners,
  addDeliveryPartner,
  deleteDeliveryPartner,
  getCategories,
  createCategory,
  deleteCategory,
  updateVendorCommission,
  getPayoutRequests,
  approvePayout,
  rejectPayout,
  getReportsAndAnalytics,
};
