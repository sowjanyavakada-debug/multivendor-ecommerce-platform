const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public endpoints
router.get('/', productController.getProducts);
router.get('/suggestions', productController.getSuggestions);
router.get('/featured', productController.getFeaturedProducts);
router.get('/trending', productController.getTrendingProducts);
router.get('/bestsellers', productController.getBestSellers);
router.get('/meta/categories', productController.getCategories);
router.post('/scraped', productController.createScrapedProduct);
router.get('/:id', productController.getProductById);
router.get('/:id/related', productController.getRelatedProducts);
router.get('/vendor/store/:vendorId', productController.getVendorPublicStore);

// Customer endpoints (Requires User role)
router.get('/user/recently-viewed', verifyToken, requireRole(['user']), productController.getRecentlyViewed);
router.post('/:id/view', verifyToken, requireRole(['user']), productController.logProductView);

// Vendor/Admin endpoints (Authenticated)
router.post('/', verifyToken, requireRole(['vendor']), upload.single('image'), productController.createProduct);
router.put('/:id', verifyToken, requireRole(['vendor', 'admin']), upload.single('image'), productController.updateProduct);
router.delete('/:id', verifyToken, requireRole(['vendor', 'admin']), productController.deleteProduct);

module.exports = router;
