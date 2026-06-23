const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// User routes
router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.post('/reset-password', authController.resetPassword);
router.post('/social-login', authController.socialLogin);

// Wallet routes (authenticated)
router.get('/wallet', verifyToken, authController.getWalletBalance);
router.post('/wallet/add', verifyToken, authController.addWalletMoney);

// Vendor routes
router.post('/vendor/register', authController.registerVendor);
router.post('/vendor/login', authController.loginVendor);

// Admin route
router.post('/admin/login', authController.loginAdmin);

module.exports = router;
