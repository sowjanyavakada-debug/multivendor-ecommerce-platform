const db = require('../database/database');

// 1. Get Cart Items and Calculate Total
const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch items with details
    const items = await db.all(
      `SELECT c.id as cart_item_id, c.product_id, c.quantity, 
              p.name, p.price, p.image_url, p.stock, p.category 
       FROM Cart c 
       JOIN Products p ON c.product_id = p.id 
       WHERE c.user_id = ?`,
      [userId]
    );

    // Calculate total
    let cartTotal = 0;
    items.forEach((item) => {
      cartTotal += item.price * item.quantity;
    });

    return res.status(200).json({
      success: true,
      data: {
        items,
        cartTotal: parseFloat(cartTotal.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Add Item to Cart
const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const qtyVal = parseInt(quantity);
    if (qtyVal <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    // Verify product exists and check stock
    const product = await db.get('SELECT * FROM Products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    if (product.stock < qtyVal) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.stock} items available.`,
      });
    }

    // Check if product is already in user's cart
    const existingItem = await db.get(
      'SELECT * FROM Cart WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );

    if (existingItem) {
      const newQty = existingItem.quantity + qtyVal;
      if (product.stock < newQty) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Insufficient stock. Only ${product.stock} items in total available.`,
        });
      }

      await db.run(
        'UPDATE Cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
        [newQty, userId, product_id]
      );
    } else {
      await db.run(
        'INSERT INTO Cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, product_id, qtyVal]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Product added to cart successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 3. Update Cart Item Quantity
const updateCartQuantity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || isNaN(quantity)) {
      return res.status(400).json({ success: false, message: 'Valid quantity is required.' });
    }

    const qtyVal = parseInt(quantity);
    if (qtyVal <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0. Use delete to remove.' });
    }

    // Verify cart item exists
    const cartItem = await db.get(
      'SELECT * FROM Cart WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );
    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Item not found in your cart.' });
    }

    // Verify stock
    const product = await db.get('SELECT stock FROM Products WHERE id = ?', [product_id]);
    if (product.stock < qtyVal) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.stock} items available.`,
      });
    }

    await db.run(
      'UPDATE Cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
      [qtyVal, userId, product_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Cart quantity updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 4. Remove Item from Cart
const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;

    const cartItem = await db.get(
      'SELECT * FROM Cart WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Item not found in your cart.' });
    }

    await db.run(
      'DELETE FROM Cart WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Product removed from cart successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 5. Clear Cart (Helper for internal/external checkout)
const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await db.run('DELETE FROM Cart WHERE user_id = ?', [userId]);

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
};
