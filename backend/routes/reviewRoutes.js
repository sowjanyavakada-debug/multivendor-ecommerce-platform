const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Get product reviews and rating breakdowns is public
router.get('/product/:productId', reviewController.getProductReviews);

// Add/Edit review requires authenticated customer
router.post('/', verifyToken, requireRole(['user']), reviewController.addReview);
router.put('/:id', verifyToken, requireRole(['user']), reviewController.editReview);

// Delete review requires either review owner (customer) or administrator
router.delete('/:id', verifyToken, requireRole(['user', 'admin']), reviewController.deleteReview);

module.exports = router;
