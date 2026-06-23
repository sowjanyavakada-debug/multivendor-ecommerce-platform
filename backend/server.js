const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./database/database');
const loggingMiddleware = require('./middleware/loggingMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messageRoutes = require('./routes/messageRoutes');
const refundRoutes = require('./routes/refundRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database & Seed admin
initDatabase().then(() => {
  console.log('Database verification and initialization step complete.');
});

// Middleware configurations
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggingMiddleware);

// Serve static uploaded files (Product Images) with premium Unsplash fallback redirects if file is missing
const fs = require('fs');
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(__dirname, 'uploads', req.path);
  if (fs.existsSync(filePath)) {
    return express.static(path.join(__dirname, 'uploads'))(req, res, next);
  }

  // High-quality premium Unsplash fallbacks for seeded images
  const fallbacks = {
    'iphone15.jpg': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600',
    'dellxps13.jpg': 'https://images.unsplash.com/photo-1496181130204-7552cc1524e2?w=600',
    'headphones.jpg': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
    'gamingmonitor.jpg': 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600',
    'sunglasses.jpg': 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600',
    'chelseaboots.jpg': 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600',
    'canvasbag.jpg': 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600',
    'officechair.jpg': 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600',
    'blender.jpg': 'https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=600',
    'espressomachine.jpg': 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600',
    'cookwareset.jpg': 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600',
    'leatherjacket.jpg': 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600',
    'hoodie.jpg': 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600',
    'jeans.jpg': 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600',
    'smartwatch.jpg': 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600',
    'wallet.jpg': 'https://images.unsplash.com/photo-1627124765111-f4398c899041?w=600',
    'waterbottle.jpg': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600',
    'wirelesscharger.jpg': 'https://images.unsplash.com/photo-1622445262465-2481c8573226?w=600',
    'mechanicalkeyboard.jpg': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600',
    'smartprojector.jpg': 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=600',
    'trenchcoat.jpg': 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600',
    'airfryer.jpg': 'https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=600',
    'chefsknife.jpg': 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600',
    'travelbackpack.jpg': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
    // --- 26 NEW PRODUCT FALLBACKS ---
    'earbuds.jpg': 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600',
    'smartspeaker.jpg': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600',
    'portableprojector.jpg': 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=600',
    'wifirouter.jpg': 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600',
    'vlogcamera.jpg': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600',
    'standingdesk.jpg': 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=600',
    'fedorahat.jpg': 'https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=600',
    'urbanbackpack.jpg': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
    'sportssunglasses.jpg': 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=600',
    'mechanicalwatch.jpg': 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600',
    'goldbracelet.jpg': 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
    'gooseneckkettle.jpg': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600',
    'herbgarden.jpg': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600',
    'slowjuicer.jpg': 'https://images.unsplash.com/photo-1610970881699-44a5587caaec?w=600',
    'oildiffuser.jpg': 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600',
    'robotvacuum.jpg': 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=600',
    'knifeblock.jpg': 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600',
    'windbreaker.jpg': 'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=600',
    'woolsweater.jpg': 'https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?w=600',
    'workoutjoggers.jpg': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600',
    'linenshirt.jpg': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600',
    'runningshoes.jpg': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    'travelwallet.jpg': 'https://images.unsplash.com/photo-1627124765111-f4398c899041?w=600',
    'travelpillow.jpg': 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=600',
    'yogamat.jpg': 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600',
    'laptopstand.jpg': 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600'
  };

  const filename = req.path.replace(/^\//, '');
  const fallbackUrl = fallbacks[filename] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
  res.redirect(fallbackUrl);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Ecommerce multi-vendor backend is running smoothly.',
    timestamp: new Date().toISOString()
  });
});

// Catch-all route (404 Not Found)
app.use((req, res, next) => {
  const error = new Error(`Endpoint not found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// Global Error Handler Middleware
app.use(errorMiddleware);

// Start server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Server is running in production-ready mode on port: ${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});

module.exports = server; // Exported for programmatic testing
