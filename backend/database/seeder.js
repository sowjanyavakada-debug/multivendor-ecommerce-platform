const { run, get, initDatabase } = require('./database');
const bcrypt = require('bcryptjs');

const seedData = async () => {
  console.log('Starting data seeding...');
  try {
    // 1. Initialize Tables first
    await initDatabase();

    // 2. Clear existing dynamic tables if we want a clean seed
    await run('DELETE FROM Reviews');
    await run('DELETE FROM Products');
    const testUserEmail = 'user@test.com';
    const testVendorEmail = 'vendor@test.com';

    let user = await get('SELECT * FROM Users WHERE email = ?', [testUserEmail]);
    let userId;
    if (!user) {
      const userHash = await bcrypt.hash('UserSecurePass123!', 10);
      const res = await run(
        'INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Test Customer', testUserEmail, userHash, 'user']
      );
      userId = res.id;
      console.log('Test user seeded.');
    } else {
      userId = user.id;
    }

    // Seed vendors
    let vendor = await get('SELECT * FROM Vendors WHERE email = ?', [testVendorEmail]);
    let vendorId;
    if (!vendor) {
      const vendorHash = await bcrypt.hash('VendorSecurePass123!', 10);
      const res = await run(
        'INSERT INTO Vendors (vendor_name, email, password, status) VALUES (?, ?, ?, ?)',
        ['Gadget World', testVendorEmail, vendorHash, 'approved']
      );
      vendorId = res.id;
      console.log('Approved test vendor seeded.');
    } else {
      vendorId = vendor.id;
    }

    // Seed Pending Vendor
    const pendingEmail = 'vendor_pending@test.com';
    let pendingVendor = await get('SELECT * FROM Vendors WHERE email = ?', [pendingEmail]);
    if (!pendingVendor) {
      const vendorHash = await bcrypt.hash('VendorSecurePass123!', 10);
      await run(
        'INSERT INTO Vendors (vendor_name, email, password, status) VALUES (?, ?, ?, ?)',
        ['Pending Store LLC', pendingEmail, vendorHash, 'pending']
      );
      console.log('Pending test vendor seeded.');
    }

    // Seed Blocked Vendor
    const blockedEmail = 'vendor_blocked@test.com';
    let blockedVendor = await get('SELECT * FROM Vendors WHERE email = ?', [blockedEmail]);
    if (!blockedVendor) {
      const vendorHash = await bcrypt.hash('VendorSecurePass123!', 10);
      await run(
        'INSERT INTO Vendors (vendor_name, email, password, status) VALUES (?, ?, ?, ?)',
        ['Spammy Shop', blockedEmail, vendorHash, 'blocked']
      );
      console.log('Blocked test vendor seeded.');
    }

    // Seed Stores for approved vendor
    const store = await get('SELECT * FROM Stores WHERE vendor_id = ?', [vendorId]);
    if (!store) {
      await run(
        'INSERT INTO Stores (vendor_id, store_name, store_description, store_logo, commission_rate) VALUES (?, ?, ?, ?, ?)',
        [vendorId, 'Gadget World Store', 'Your premium destination for electronic gadgets and smartphones.', 'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=800', 10.00]
      );
      console.log('Test store seeded for vendor.');
    }

    // Seed Delivery Partners
    const dp = await get('SELECT * FROM DeliveryPartners LIMIT 1');
    if (!dp) {
      await run("INSERT INTO DeliveryPartners (name, phone, status) VALUES ('Express Logistics', '+91 9999999999', 'Active')");
      await run("INSERT INTO DeliveryPartners (name, phone, status) VALUES ('SafeShip Services', '+91 8888888888', 'Active')");
      console.log('Test delivery partners seeded.');
    }

    // Seed sample messages
    const msg = await get('SELECT * FROM Messages LIMIT 1');
    if (!msg) {
      await run("INSERT INTO Messages (sender_id, sender_role, receiver_id, receiver_role, message) VALUES (?, 'user', 1, 'admin', 'Hello admin, is live support working?')", [userId]);
      await run("INSERT INTO Messages (sender_id, sender_role, receiver_id, receiver_role, message) VALUES (1, 'admin', ?, 'user', 'Yes! Our support chat is fully functional. How can we help you today?')", [userId]);
      console.log('Sample messages seeded.');
    }

    // Seed Products
    const productCount = await get('SELECT COUNT(*) as count FROM Products');
    if (productCount.count === 0) {
      const productsToSeed = [
        // --- ELECTRONICS ---
        {
          name: 'iPhone 15 Pro Max',
          description: 'Latest flagship iPhone with titanium design, custom action button, and 5x optical zoom camera.',
          price: 1199.99,
          stock: 15,
          image_url: 'uploads/iphone15.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Dell XPS 13 Laptop',
          description: 'Stunning 13.4-inch display laptop powered by Intel Core i7, 16GB RAM, and 512GB SSD.',
          price: 999.99,
          stock: 5,
          image_url: 'uploads/dellxps13.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Wireless Noise Cancelling Headphones',
          description: 'Over-ear headphones with custom high-fidelity sound, active noise cancellation, and 30-hour battery life.',
          price: 299.99,
          stock: 5,
          image_url: 'uploads/headphones.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'UltraWide Curved Gaming Monitor',
          description: '34-inch curved gaming monitor with 144Hz refresh rate, 1ms response time, and HDR 400.',
          price: 499.99,
          stock: 10,
          image_url: 'uploads/gamingmonitor.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 0
        },

        // --- FASHION ---
        {
          name: 'Designer Aviator Sunglasses',
          description: 'Classic gold-framed aviator sunglasses with polarized UV400 protective lenses.',
          price: 125.00,
          stock: 30,
          image_url: 'uploads/sunglasses.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Handcrafted Leather Chelsea Boots',
          description: 'Premium Italian leather Chelsea boots with durable rubber soles and elastic side panels.',
          price: 189.99,
          stock: 12,
          image_url: 'uploads/chelseaboots.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Retro Canvas Crossbody Bag',
          description: 'Durable cotton canvas bag with leather accents, perfect for daily commuting or casual outings.',
          price: 45.99,
          stock: 25,
          image_url: 'uploads/canvasbag.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 0
        },

        // --- HOME & KITCHEN ---
        {
          name: 'Ergonomic Office Chair',
          description: 'High back mesh desk chair with adjustable lumbar support, 3D armrests, and dynamic recline.',
          price: 189.99,
          stock: 20,
          image_url: 'uploads/officechair.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Professional Smoothie Blender',
          description: 'High-speed blender with 1200W motor, professional-grade blades, and BPA-free pitcher.',
          price: 89.99,
          stock: 12,
          image_url: 'uploads/blender.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Smart Espresso Coffee Machine',
          description: '15-bar pump espresso maker with integrated milk frother, touchscreen controls, and temperature PID.',
          price: 279.99,
          stock: 8,
          image_url: 'uploads/espressomachine.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Ceramic Non-Stick Cookware Set',
          description: '10-piece non-toxic ceramic coated pots and pans set, oven safe up to 500°F.',
          price: 149.99,
          stock: 15,
          image_url: 'uploads/cookwareset.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },

        // --- CLOTHING ---
        {
          name: 'Classic Leather Jacket',
          description: 'Premium black genuine leather jacket for men. Perfect slim fit windproof biker jacket.',
          price: 149.50,
          stock: 45,
          image_url: 'uploads/leatherjacket.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Premium Fleece Hoodie',
          description: 'Ultra-soft cotton blend hoodie with kangaroo pockets and brushed interior lining.',
          price: 54.99,
          stock: 50,
          image_url: 'uploads/hoodie.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Slim Fit Denim Jeans',
          description: 'Classic blue stretch denim jeans with 5-pocket styling and vintage wash finish.',
          price: 69.99,
          stock: 40,
          image_url: 'uploads/jeans.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 0
        },

        // --- ACCESSORIES ---
        {
          name: 'Premium GPS Smart Watch',
          description: 'Fitness tracker smart watch with heart rate monitor, sleep tracking, and built-in GPS.',
          price: 199.99,
          stock: 22,
          image_url: 'uploads/smartwatch.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Minimalist Leather Bifold Wallet',
          description: 'Slim genuine leather wallet with RFID blocking technology and 8 card slots.',
          price: 34.99,
          stock: 60,
          image_url: 'uploads/wallet.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Insulated Stainless Steel Water Bottle',
          description: 'Double-walled vacuum insulated water bottle, keeps drinks cold for 24h or hot for 12h.',
          price: 24.99,
          stock: 100,
          image_url: 'uploads/waterbottle.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: '15W Fast Wireless Charging Pad',
          description: 'Qi-certified fast charging pad with non-slip silicone surface and smart indicator LED.',
          price: 29.99,
          stock: 35,
          image_url: 'uploads/wirelesscharger.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Mechanical Gaming Keyboard',
          description: 'Tactile mechanical keyboard with customized RGB lighting backlights and durable switches.',
          price: 79.99,
          stock: 25,
          image_url: 'uploads/mechanicalkeyboard.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: '4K Smart Projector',
          description: 'Ultra-bright home theater projector with built-in speakers and smart streaming software.',
          price: 349.99,
          stock: 8,
          image_url: 'uploads/smartprojector.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Classic Wool Trench Coat',
          description: 'Timeless double-breasted woolen trench coat. Stylish outerwear for autumn and winter.',
          price: 139.99,
          stock: 15,
          image_url: 'uploads/trenchcoat.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Digital Air Fryer',
          description: 'Large capacity air fryer with digital touchscreen panel and 8 preset cooking settings.',
          price: 99.99,
          stock: 12,
          image_url: 'uploads/airfryer.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Damascus Steel Chef Knife',
          description: 'Premium handcrafted kitchen knife with highly sharp edge and ergonomic pakkawood handle.',
          price: 59.99,
          stock: 20,
          image_url: 'uploads/chefsknife.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Anti-Theft Travel Backpack',
          description: 'Water-resistant travel bag with hidden zippers, TSA lock, and integrated USB charging port.',
          price: 45.99,
          stock: 30,
          image_url: 'uploads/travelbackpack.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 1
        },
        // --- 26 NEW PREMIUM PRODUCTS ---
        {
          name: 'Elite Noise-Cancelling Earbuds',
          description: 'True wireless earbuds with adaptive noise cancellation, 40-hour battery life, and crystal-clear call quality.',
          price: 149.99,
          stock: 25,
          image_url: 'uploads/earbuds.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Smart Ambient Speaker',
          description: 'Voice-controlled smart speaker with rich 360-degree sound, smart home hub integration, and ambient LED light.',
          price: 89.99,
          stock: 18,
          image_url: 'uploads/smartspeaker.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Portable Cinema Projector',
          description: 'Pocket-sized full HD projector with built-in Wi-Fi, battery, and compatibility with all streaming apps.',
          price: 249.99,
          stock: 10,
          image_url: 'uploads/portableprojector.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'High-Speed Wi-Fi 6 Router',
          description: 'Next-gen dual-band Wi-Fi router for seamless gaming, 4K streaming, and smart home connectivity.',
          price: 129.99,
          stock: 15,
          image_url: 'uploads/wifirouter.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Professional Vlog Camera Kit',
          description: 'Mirrorless compact camera with flip-out screen, external microphone, and tripod grip for creators.',
          price: 799.99,
          stock: 8,
          image_url: 'uploads/vlogcamera.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Electric Standing Desk',
          description: 'Motorized height adjustable standing desk with memory presets and smooth dual-motor operation.',
          price: 349.99,
          stock: 12,
          image_url: 'uploads/standingdesk.jpg',
          category: 'Electronics',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Classic Wool Fedora Hat',
          description: 'Handcrafted 100% Australian wool felt fedora with a structured brim and elegant leather band decoration.',
          price: 59.99,
          stock: 20,
          image_url: 'uploads/fedorahat.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Minimalist Urban Backpack',
          description: 'Sleek weather-proof commuter backpack with padded 15-inch laptop compartment and hidden pockets.',
          price: 79.99,
          stock: 30,
          image_url: 'uploads/urbanbackpack.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Polarized Active Sports Sunglasses',
          description: 'Lightweight and impact-resistant sports sunglasses for cycling, running, and outdoor adventures.',
          price: 39.99,
          stock: 50,
          image_url: 'uploads/sportssunglasses.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Automatic Mechanical Watch',
          description: 'Self-winding luxury wristwatch with a skeleton dial window, stainless steel band, and water resistance.',
          price: 199.99,
          stock: 15,
          image_url: 'uploads/mechanicalwatch.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: '14K Gold Plated Link Bracelet',
          description: 'Elegant and delicate chain link bracelet, double plated for long-lasting shine and durability.',
          price: 49.99,
          stock: 40,
          image_url: 'uploads/goldbracelet.jpg',
          category: 'Fashion',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Precision Gooseneck Kettle',
          description: 'Electric variable temperature control kettle, perfect for pour-over coffee and tea brewing.',
          price: 69.99,
          stock: 22,
          image_url: 'uploads/gooseneckkettle.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Smart Indoor Herb Garden',
          description: 'Self-watering hydroponics system with high-efficiency LED grow lights for fresh indoor greens.',
          price: 119.99,
          stock: 14,
          image_url: 'uploads/herbgarden.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Cold Press Juicer Machine',
          description: 'Slow masticating juicer for maximum juice yield, nutrient extraction, and minimal oxidation.',
          price: 159.99,
          stock: 16,
          image_url: 'uploads/slowjuicer.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Ultrasonic Ceramic Oil Diffuser',
          description: 'Aromatherapy essential oil diffuser with color changing LED lights and auto-shutoff security function.',
          price: 29.99,
          stock: 45,
          image_url: 'uploads/oildiffuser.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Smart Robot Vacuum & Mop',
          description: 'LiDAR navigation robot vacuum cleaner with 4000Pa suction power and automatic water control mop.',
          price: 299.99,
          stock: 10,
          image_url: 'uploads/robotvacuum.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'Magnetic Acacia Wood Knife Block',
          description: 'Double-sided magnetic knife holder, space-saving kitchen counter organizer without knives.',
          price: 39.99,
          stock: 25,
          image_url: 'uploads/knifeblock.jpg',
          category: 'Home & Kitchen',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Waterproof Lightweight Windbreaker',
          description: 'Outdoor rain jacket with hood, adjustable drawstrings, and zipper pockets for hiking and travel.',
          price: 49.99,
          stock: 35,
          image_url: 'uploads/windbreaker.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: '100% Merino Wool Sweater',
          description: 'Ultra-soft and breathable crewneck sweater made of premium high-grade knit Merino wool.',
          price: 79.99,
          stock: 20,
          image_url: 'uploads/woolsweater.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Quick-Dry Workout Joggers',
          description: 'Athletic sweatpants with zipper pockets, elastic waistband, and 4-way stretch fabric.',
          price: 34.99,
          stock: 60,
          image_url: 'uploads/workoutjoggers.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Casual Lightweight Linen Shirt',
          description: 'Summer casual long sleeve button-down shirt made from breathable linen-cotton blend.',
          price: 39.99,
          stock: 30,
          image_url: 'uploads/linenshirt.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Trail Running Shoes',
          description: 'All-terrain running shoes with high grip lugged outsoles, cushioning midsoles, and breathable upper mesh.',
          price: 89.99,
          stock: 24,
          image_url: 'uploads/runningshoes.jpg',
          category: 'Clothing',
          vendor_id: vendorId,
          is_featured: 1
        },
        {
          name: 'RFID Leather Travel Wallet',
          description: 'Genuine leather passport holder organizer with zip closure and RFID blocking technology.',
          price: 27.99,
          stock: 50,
          image_url: 'uploads/travelwallet.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Ergonomic Neck Pillow',
          description: 'High-density memory foam travel pillow for airplanes, cars, and home office comfort.',
          price: 24.99,
          stock: 40,
          image_url: 'uploads/travelpillow.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Eco-Friendly Non-Slip Yoga Mat',
          description: 'TPE material dual-textured yoga mat with carrying strap, excellent grip and cushioning thickness.',
          price: 34.99,
          stock: 45,
          image_url: 'uploads/yogamat.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 0
        },
        {
          name: 'Adjustable Aluminium Laptop Stand',
          description: 'Portable folding desk riser for laptops up to 17 inches, featuring ergonomic cooling angles.',
          price: 19.99,
          stock: 70,
          image_url: 'uploads/laptopstand.jpg',
          category: 'Accessories',
          vendor_id: vendorId,
          is_featured: 1
        }
      ];

      for (const p of productsToSeed) {
        await run(
          'INSERT INTO Products (name, description, price, stock, image_url, category, vendor_id, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [p.name, p.description, p.price, p.stock, p.image_url, p.category, p.vendor_id, p.is_featured]
        );
      }
      console.log('Test products seeded.');
    }

    // Seed Reviews
    const reviewCount = await get('SELECT COUNT(*) as count FROM Reviews');
    if (reviewCount.count === 0) {
      // Get some product ids
      const products = await require('./database').all('SELECT id FROM Products LIMIT 3');
      if (products.length > 0) {
        // Review for first product: Rating 5
        await run(
          'INSERT INTO Reviews (user_id, product_id, rating, review) VALUES (?, ?, ?, ?)',
          [userId, products[0].id, 5, 'Absolutely fantastic! Exceeded my expectations. Highly recommend this brand.']
        );
        // Review for second product: Rating 4
        if (products[1]) {
          await run(
            'INSERT INTO Reviews (user_id, product_id, rating, review) VALUES (?, ?, ?, ?)',
            [userId, products[1].id, 4, 'Very good build quality and features. Battery life is decent.']
          );
        }
        console.log('Test reviews seeded.');
      }
    }

    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
};

// If run directly
if (require.main === module) {
  seedData().then(() => {
    process.exit(0);
  });
}

module.exports = seedData;
