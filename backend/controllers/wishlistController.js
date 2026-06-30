const db = require('../database/database');

// 1. Get User's Wishlist Items
const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const items = await db.all(
      `SELECT w.id as wishlist_item_id, w.product_id, 
              p.name, p.price, p.image_url, p.category, p.stock 
       FROM Wishlist w 
       JOIN Products p ON w.product_id = p.id 
       WHERE w.user_id = ?`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Add Item to Wishlist
const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    // Check if product exists
    const product = await db.get('SELECT id FROM Products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Add to wishlist (IGNORE if duplicate)
    await db.run(
      'INSERT IGNORE INTO Wishlist (user_id, product_id) VALUES (?, ?)',
      [userId, product_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Product added to wishlist successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 3. Remove Item from Wishlist
const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;

    const item = await db.get(
      'SELECT * FROM Wishlist WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in your wishlist.' });
    }

    await db.run(
      'DELETE FROM Wishlist WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Product removed from wishlist successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
