const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// All wishlist routes require authenticated customer
router.use(verifyToken, requireRole(['user']));

router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.delete('/:product_id', wishlistController.removeFromWishlist);

module.exports = router;
