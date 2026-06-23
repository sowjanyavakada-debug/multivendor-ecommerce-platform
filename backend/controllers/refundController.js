const db = require('../database/database');

// 1. Submit Return/Refund Request (Customer)
const requestRefund = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { order_id, reason, amount } = req.body;

    if (!order_id || !reason || !amount) {
      return res.status(400).json({ success: false, message: 'order_id, reason, and amount are required.' });
    }

    // Verify order ownership & status
    const order = await db.get('SELECT * FROM Orders WHERE id = ? AND user_id = ?', [order_id, userId]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Delivered order not found for this customer.' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Refunds can only be requested for Delivered orders.' });
    }

    // Check if a refund request already exists for this order
    const existing = await db.get('SELECT * FROM RefundRequests WHERE order_id = ?', [order_id]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'A refund request has already been submitted for this order.' });
    }

    // Get vendor_id from the first order item
    const orderItem = await db.get(
      `SELECT p.vendor_id 
       FROM Order_Items oi
       JOIN Products p ON oi.product_id = p.id
       WHERE oi.order_id = ? LIMIT 1`,
      [order_id]
    );

    const vendorId = orderItem ? orderItem.vendor_id : null;
    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor details not found for this order items.' });
    }

    const result = await db.run(
      `INSERT INTO RefundRequests (order_id, user_id, vendor_id, reason, amount, status) 
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [order_id, userId, vendorId, reason, amount]
    );

    return res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully.',
      data: {
        id: result.id,
        order_id,
        user_id: userId,
        vendor_id: vendorId,
        reason,
        amount,
        status: 'Pending'
      }
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Customer Refunds (Customer only)
const getCustomerRefunds = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const refunds = await db.all(
      `SELECT r.*, o.order_date, v.vendor_name 
       FROM RefundRequests r
       JOIN Orders o ON r.order_id = o.id
       JOIN Vendors v ON r.vendor_id = v.id
       WHERE r.user_id = ? ORDER BY r.created_at DESC`,
      [userId]
    );
    return res.status(200).json({ success: true, data: refunds });
  } catch (error) {
    next(error);
  }
};

// 3. Get Vendor Refunds (Vendor only)
const getVendorRefunds = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const refunds = await db.all(
      `SELECT r.*, o.order_date, u.name as customer_name 
       FROM RefundRequests r
       JOIN Orders o ON r.order_id = o.id
       JOIN Users u ON r.user_id = u.id
       WHERE r.vendor_id = ? ORDER BY r.created_at DESC`,
      [vendorId]
    );
    return res.status(200).json({ success: true, data: refunds });
  } catch (error) {
    next(error);
  }
};

// 4. Get Admin Refunds (Admin only)
const getAdminRefunds = async (req, res, next) => {
  try {
    const refunds = await db.all(
      `SELECT r.*, o.order_date, u.name as customer_name, v.vendor_name 
       FROM RefundRequests r
       JOIN Orders o ON r.order_id = o.id
       JOIN Users u ON r.user_id = u.id
       JOIN Vendors v ON r.vendor_id = v.id
       ORDER BY r.created_at DESC`
    );
    return res.status(200).json({ success: true, data: refunds });
  } catch (error) {
    next(error);
  }
};

// 5. Update Refund Status (Admin or Vendor)
const updateRefundStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Approved' or 'Rejected'
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be Approved or Rejected.' });
    }

    const refund = await db.get('SELECT * FROM RefundRequests WHERE id = ?', [id]);
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund request not found.' });
    }

    if (refund.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'This refund request is already resolved.' });
    }

    // Authorization: Admin can resolve any. Vendor can resolve only their own.
    if (userRole !== 'admin') {
      if (userRole === 'vendor') {
        if (refund.vendor_id !== userId) {
          return res.status(403).json({ success: false, message: 'Unauthorized. You do not own the product for this refund.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Only vendors or admins can resolve refund requests.' });
      }
    }

    if (status === 'Approved') {
      // 1. Credit the customer's wallet balance
      await db.run('UPDATE Users SET wallet_balance = wallet_balance + ? WHERE id = ?', [refund.amount, refund.user_id]);

      // 2. Debit the vendor's wallet balance (deducting refunded payout)
      await db.run('UPDATE Vendors SET wallet_balance = wallet_balance - ? WHERE id = ?', [refund.amount, refund.vendor_id]);

      // 3. Mark the Order as Cancelled/Refunded
      await db.run("UPDATE Orders SET status = 'Cancelled' WHERE id = ?", [refund.order_id]);
    }

    await db.run('UPDATE RefundRequests SET status = ? WHERE id = ?', [status, id]);

    return res.status(200).json({
      success: true,
      message: `Refund request was ${status.toLowerCase()} successfully.`,
      data: {
        id,
        status
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestRefund,
  getCustomerRefunds,
  getVendorRefunds,
  getAdminRefunds,
  updateRefundStatus
};
