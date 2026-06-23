const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// All vendor routes require authentication and vendor role
router.use(verifyToken, requireRole(['vendor']));

router.get('/stats', vendorController.getVendorStats);
router.get('/inventory', vendorController.getVendorInventory);
router.get('/products', vendorController.getVendorProducts);
router.get('/orders', vendorController.getVendorOrders);
router.get('/store', vendorController.getVendorStore);
router.put('/store', vendorController.updateVendorStore);
router.post('/products/bulk', vendorController.bulkUploadProducts);
router.post('/payout', vendorController.requestPayout);

// Coupons management
router.get('/coupons', vendorController.getCoupons);
router.post('/coupons', vendorController.createCoupon);
router.delete('/coupons/:id', vendorController.deleteCoupon);

// Reviews management
router.get('/reviews', vendorController.getVendorReviews);
router.delete('/reviews/:id', vendorController.deleteVendorReview);

module.exports = router;
