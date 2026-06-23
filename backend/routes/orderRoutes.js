const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Place Order and View Order History require Customer authorization
router.post('/', verifyToken, requireRole(['user']), orderController.placeOrder);
router.get('/history', verifyToken, requireRole(['user']), orderController.getOrderHistory);

// Active delivery partners list
router.get('/delivery-partners', verifyToken, requireRole(['user', 'vendor', 'admin']), orderController.getDeliveryPartners);

// Detailed single order lookup is accessible to Customer (if owned), Vendor (if order contains their items), or Admin
router.get('/:id', verifyToken, requireRole(['user', 'vendor', 'admin']), orderController.getOrderDetails);

// Status updates can be completed by Admin or related Vendor
router.put('/:id/status', verifyToken, requireRole(['vendor', 'admin']), orderController.updateOrderStatus);

module.exports = router;
