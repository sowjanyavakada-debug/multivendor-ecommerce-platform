const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/request', requireRole(['user']), refundController.requestRefund);
router.get('/customer', requireRole(['user']), refundController.getCustomerRefunds);
router.get('/vendor', requireRole(['vendor']), refundController.getVendorRefunds);
router.get('/admin', requireRole(['admin']), refundController.getAdminRefunds);
router.put('/:id/status', requireRole(['vendor', 'admin']), refundController.updateRefundStatus);

module.exports = router;
