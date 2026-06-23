const db = require('../database/database');

// 1. Place Order (Checkout)
// 1. Place Order (Checkout)
const placeOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
      coupon_code, 
      payment_method = 'COD', 
      shipping_method = 'Standard',
      recipient_name,
      delivery_address,
      recipient_phone
    } = req.body;

    if (!recipient_name || !delivery_address || !recipient_phone) {
      return res.status(400).json({ success: false, message: 'Recipient name, delivery address, and phone number are required.' });
    }

    // Fetch user's cart
    const cartItems = await db.all(
      `SELECT c.product_id, c.quantity, p.name, p.price, p.stock, p.vendor_id 
       FROM Cart c 
       JOIN Products p ON c.product_id = p.id 
       WHERE c.user_id = ?`,
      [userId]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    // Validate stock levels before placing order
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${item.name}. Only ${item.stock} left.`,
        });
      }
    }

    // Fetch system settings for tax & shipping calculations
    const taxSetting = await db.get("SELECT setting_value FROM SystemSettings WHERE setting_key = 'tax_percentage'");
    const shipSetting = await db.get("SELECT setting_value FROM SystemSettings WHERE setting_key = 'shipping_fee_flat'");
    
    const taxPct = taxSetting ? parseFloat(taxSetting.setting_value) : 5.0;
    let baseShipFee = shipSetting ? parseFloat(shipSetting.setting_value) : 15.0;

    if (shipping_method === 'Express') {
      baseShipFee += 10.0; // premium shipping surcharge
    }

    // Calculate cart base total
    let subtotal = 0;
    cartItems.forEach((item) => {
      subtotal += item.price * item.quantity;
    });

    // Validate and Apply Coupon if provided
    let discountApplied = 0;
    if (coupon_code) {
      const coupon = await db.get('SELECT * FROM Coupons WHERE code = ?', [coupon_code]);
      if (!coupon) {
        return res.status(400).json({ success: false, message: 'Invalid coupon code.' });
      }

      // Check Expiry Date
      const today = new Date().toISOString().split('T')[0];
      if (coupon.expiry_date < today) {
        return res.status(400).json({ success: false, message: 'This coupon has expired.' });
      }

      discountApplied = (subtotal * coupon.discount_percentage) / 100;
      discountApplied = parseFloat(discountApplied.toFixed(2));
    }

    // Tax amount
    const taxableTotal = Math.max(0, subtotal - discountApplied);
    const taxAmount = parseFloat((taxableTotal * taxPct / 100).toFixed(2));
    
    // Final price
    const finalPrice = parseFloat((taxableTotal + taxAmount + baseShipFee).toFixed(2));

    // Handle payment checks
    let paymentStatus = 'Pending';
    if (payment_method === 'Wallet') {
      const user = await db.get('SELECT wallet_balance FROM Users WHERE id = ?', [userId]);
      if (!user || user.wallet_balance < finalPrice) {
        return res.status(400).json({ success: false, message: `Insufficient wallet balance. You need ₹${finalPrice.toFixed(2)}.` });
      }
      // Deduct from wallet
      await db.run('UPDATE Users SET wallet_balance = wallet_balance - ? WHERE id = ?', [finalPrice, userId]);
      paymentStatus = 'Paid';
    } else if (['Stripe', 'Razorpay', 'PayPal'].includes(payment_method)) {
      paymentStatus = 'Paid'; // simulated secure integration success
    }

    // Generate tracking number
    const trackingNumber = 'SH-' + Math.floor(10000000 + Math.random() * 90000000);

    // Place Order - Insert into Orders Table
    const orderResult = await db.run(
      `INSERT INTO Orders (
        user_id, total_price, discount_applied, coupon_code, status, 
        shipping_method, shipping_fee, tax_amount, payment_method, payment_status,
        tracking_number, delivery_status, recipient_name, delivery_address, recipient_phone
       ) VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
      [
        userId, finalPrice, discountApplied, coupon_code || null,
        shipping_method, baseShipFee, taxAmount, payment_method, paymentStatus,
        trackingNumber, recipient_name, delivery_address, recipient_phone
      ]
    );

    const orderId = orderResult.id;

    // Insert order items, reduce stock, and allocate vendor payouts (wallet with commission cut)
    for (const item of cartItems) {
      // Insert item
      await db.run(
        `INSERT INTO Order_Items (order_id, product_id, quantity, price) 
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.price]
      );

      // Reduce product stock
      await db.run(
        'UPDATE Products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );

      // Retrieve vendor commission rate (defaulting to store rate, else global)
      const storeInfo = await db.get('SELECT commission_rate FROM Stores WHERE vendor_id = ?', [item.vendor_id]);
      const vendorRate = storeInfo ? parseFloat(storeInfo.commission_rate) : 10.00;

      // Payout logic: credit net amount to vendor wallet (automatic commission split)
      const itemSubtotal = item.price * item.quantity;
      const netPayout = parseFloat((itemSubtotal * (100 - vendorRate) / 100).toFixed(2));

      await db.run(
        'UPDATE Vendors SET wallet_balance = wallet_balance + ? WHERE id = ?',
        [netPayout, item.vendor_id]
      );
    }

    // Clear user cart
    await db.run('DELETE FROM Cart WHERE user_id = ?', [userId]);

    // Insert Order Placed Notification
    await db.run(
      'INSERT INTO Notifications (user_id, title, message) VALUES (?, ?, ?)',
      [
        userId,
        'Order Placed Successfully',
        `Your order #${orderId} for a total of ₹${finalPrice.toFixed(2)} has been placed successfully. Tracking ID is ${trackingNumber}.`
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      data: {
        orderId,
        subtotal,
        discountApplied,
        taxAmount,
        shippingFee: baseShipFee,
        finalPrice,
        paymentStatus,
        trackingNumber,
        status: 'Pending',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get User Order History (Customer only)
const getOrderHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const orders = await db.all(
      'SELECT * FROM Orders WHERE user_id = ? ORDER BY order_date DESC',
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Order Details (Customer / Vendor / Admin)
const getOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch base order details
    const order = await db.get(
      `SELECT o.*, u.name as customer_name, u.email as customer_email 
       FROM Orders o 
       JOIN Users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Fetch order items joined with product vendor info
    const items = await db.all(
      `SELECT oi.id as item_id, oi.product_id, oi.quantity, oi.price, 
              p.name as product_name, p.image_url, p.vendor_id, v.vendor_name 
       FROM Order_Items oi 
       LEFT JOIN Products p ON oi.product_id = p.id 
       LEFT JOIN Vendors v ON p.vendor_id = v.id 
       WHERE oi.order_id = ?`,
      [id]
    );

    // Authorization checks
    if (userRole === 'admin') {
      // Admins see everything
      return res.status(200).json({
        success: true,
        data: {
          ...order,
          items,
        },
      });
    }

    if (userRole === 'user') {
      // Customers see only their own orders
      if (order.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'Access denied. You do not own this order.' });
      }

      return res.status(200).json({
        success: true,
        data: {
          ...order,
          items,
        },
      });
    }

    if (userRole === 'vendor') {
      // Vendors see only order items matching their vendor_id
      const vendorItems = items.filter((item) => item.vendor_id === userId);
      
      if (vendorItems.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied. You do not have products in this order.' });
      }

      // Calculate total specific to this vendor
      let vendorSubtotal = 0;
      vendorItems.forEach(i => {
        vendorSubtotal += i.price * i.quantity;
      });

      return res.status(200).json({
        success: true,
        data: {
          id: order.id,
          status: order.status,
          order_date: order.order_date,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          vendorSubtotal,
          items: vendorItems,
        },
      });
    }

    return res.status(403).json({ success: false, message: 'Unauthorized role.' });
  } catch (error) {
    next(error);
  }
};

// 4. Update Order Status (Admin / Vendor owning products in this order)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Fetch order
    const order = await db.get('SELECT * FROM Orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Status check
    if (order.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update status. Order is already Cancelled.' });
    }

    // Authorization
    if (userRole !== 'admin') {
      if (userRole === 'vendor') {
        // Vendor can update if they own a product in the order
        const items = await db.all(
          `SELECT oi.id FROM Order_Items oi 
           JOIN Products p ON oi.product_id = p.id 
           WHERE oi.order_id = ? AND p.vendor_id = ?`,
          [id, userId]
        );
        if (items.length === 0) {
          return res.status(403).json({ success: false, message: 'Unauthorized to modify status of this order.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Only admins or relative vendors can update order status.' });
      }
    }

    // Restock Inventory if status changed to Cancelled
    if (status === 'Cancelled') {
      const orderItems = await db.all(
        'SELECT product_id, quantity FROM Order_Items WHERE order_id = ?',
        [id]
      );
      for (const item of orderItems) {
        if (item.product_id) {
          await db.run(
            'UPDATE Products SET stock = stock + ? WHERE id = ?',
            [item.quantity, item.product_id]
          );
        }
      }
    }

    // Update status, tracking details, and delivery partner if provided
    let updateSql = 'UPDATE Orders SET status = ?';
    const params = [status];
    if (req.body.tracking_number !== undefined) {
      updateSql += ', tracking_number = ?';
      params.push(req.body.tracking_number);
    }
    if (req.body.delivery_partner_id !== undefined) {
      updateSql += ', delivery_partner_id = ?';
      params.push(req.body.delivery_partner_id);
    }
    updateSql += ' WHERE id = ?';
    params.push(id);

    await db.run(updateSql, params);

    // Insert Order Status Update Notification
    await db.run(
      'INSERT INTO Notifications (user_id, title, message) VALUES (?, ?, ?)',
      [
        order.user_id,
        'Order Status Update',
        `Your order #${id} has been updated to "${status}".`
      ]
    );

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status} successfully.`,
      data: {
        orderId: id,
        status,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getDeliveryPartners = async (req, res, next) => {
  try {
    const partners = await db.all("SELECT * FROM DeliveryPartners WHERE status = 'Active'");
    return res.status(200).json({ success: true, data: partners });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  placeOrder,
  getOrderHistory,
  getOrderDetails,
  updateOrderStatus,
  getDeliveryPartners,
};
