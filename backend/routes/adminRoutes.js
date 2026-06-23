const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// All administrative routes require JWT verification and admin role
router.use(verifyToken, requireRole(['admin']));

// Stats
router.get('/stats', adminController.getAdminStats);

// User Management
router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.deleteUser);

// Vendor Management
router.get('/vendors', adminController.getVendors);
router.put('/vendors/:id/approve', adminController.approveVendor);
router.put('/vendors/:id/block', adminController.blockVendor);

// Order Management (Global)
router.get('/orders', adminController.getAllOrders);

// Coupon Management
router.post('/coupons', adminController.createCoupon);
router.get('/coupons', adminController.getCoupons);
router.delete('/coupons/:id', adminController.deleteCoupon);

// Moderation
router.get('/products', adminController.getAllProductsForModeration);
router.put('/products/:id/moderation', adminController.updateProductStatus);

// Settings & CMS
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);

// Delivery Partners
router.get('/delivery-partners', adminController.getDeliveryPartners);
router.post('/delivery-partners', adminController.addDeliveryPartner);
router.delete('/delivery-partners/:id', adminController.deleteDeliveryPartner);

module.exports = router;
