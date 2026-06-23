const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// All cart routes require user login
router.use(verifyToken, requireRole(['user']));

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.put('/:product_id', cartController.updateCartQuantity);
router.delete('/:product_id', cartController.removeFromCart);
router.delete('/', cartController.clearCart);

module.exports = router;
