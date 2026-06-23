const db = require('../database/database');

// 1. Get Product Reviews & Ratings Summary
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Verify product exists
    const product = await db.get('SELECT id FROM Products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Get Reviews
    const reviews = await db.all(
      `SELECT r.*, u.name as reviewer_name 
       FROM Reviews r 
       JOIN Users u ON r.user_id = u.id 
       WHERE r.product_id = ? 
       ORDER BY r.created_at DESC`,
      [productId]
    );

    // Calculate Average & Count
    const stats = await db.get(
      'SELECT AVG(rating) as average, COUNT(*) as count FROM Reviews WHERE product_id = ?',
      [productId]
    );

    const averageRating = stats.average ? parseFloat(Number(stats.average).toFixed(1)) : 0.0;
    const totalReviews = stats.count || 0;

    // Calculate Rating Breakdown (1-5 stars)
    const breakdownRows = await db.all(
      'SELECT rating, COUNT(*) as count FROM Reviews WHERE product_id = ? GROUP BY rating',
      [productId]
    );

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdownRows.forEach((row) => {
      breakdown[row.rating] = row.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        averageRating,
        totalReviews,
        breakdown,
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Add Product Review
const addReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id, rating, review } = req.body;

    if (!product_id || !rating) {
      return res.status(400).json({ success: false, message: 'Product ID and Rating are required.' });
    }

    const ratingVal = parseInt(rating);
    if (ratingVal < 1 || ratingVal > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5.' });
    }

    // Check if product exists
    const product = await db.get('SELECT id FROM Products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Check if already reviewed
    const existing = await db.get(
      'SELECT id FROM Reviews WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product. Please update your existing review.',
      });
    }

    await db.run(
      'INSERT INTO Reviews (user_id, product_id, rating, review) VALUES (?, ?, ?, ?)',
      [userId, product_id, ratingVal, review || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Review added successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 3. Edit Review
const editReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, review } = req.body;

    // Check review
    const reviewItem = await db.get('SELECT * FROM Reviews WHERE id = ?', [id]);
    if (!reviewItem) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    // Authorize
    if (reviewItem.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit this review.' });
    }

    const updatedRating = rating ? parseInt(rating) : reviewItem.rating;
    if (updatedRating < 1 || updatedRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    const updatedText = review !== undefined ? review : reviewItem.review;

    await db.run(
      'UPDATE Reviews SET rating = ?, review = ? WHERE id = ?',
      [updatedRating, updatedText, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 4. Delete Review
const deleteReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;

    const reviewItem = await db.get('SELECT * FROM Reviews WHERE id = ?', [id]);
    if (!reviewItem) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    // Authorize: review owner or admin
    if (userRole !== 'admin' && reviewItem.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this review.' });
    }

    await db.run('DELETE FROM Reviews WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProductReviews,
  addReview,
  editReview,
  deleteReview,
};
