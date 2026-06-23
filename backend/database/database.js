const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Determine Database Name
let dbName = process.env.DB_NAME || 'multivendor';
if (process.env.NODE_ENV === 'test') {
  dbName = 'test_ecommerce';
}

// Bootstrap function to create database if not exists
const bootstrapDb = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'sowjanya'
    });

    if (dbName === 'test_ecommerce') {
      await connection.query(`DROP DATABASE IF EXISTS \`test_ecommerce\``);
      console.log('Dropped test_ecommerce database for clean run.');
    }

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();
    console.log(`Ensured MySQL database '${dbName}' exists.`);
  } catch (err) {
    console.error('Error bootstrapping MySQL database:', err.message);
    throw err;
  }
};

let pool;
const getPool = async () => {
  if (!pool) {
    await bootstrapDb();
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'sowjanya',
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      typeCast: function (field, next) {
        if (field.type === 'DECIMAL' || field.type === 'NEWDECIMAL') {
          const value = field.string();
          return value === null ? null : parseFloat(value);
        }
        return next();
      }
    });
  }
  return pool;
};

// Helper query wrappers to replicate SQLite Promise functions
const dbRun = async (sql, params = []) => {
  const p = await getPool();
  const [result] = await p.query(sql, params);
  return { id: result.insertId, changes: result.affectedRows };
};

const dbGet = async (sql, params = []) => {
  const p = await getPool();
  const [rows] = await p.query(sql, params);
  return rows[0] || null;
};

const dbAll = async (sql, params = []) => {
  const p = await getPool();
  const [rows] = await p.query(sql, params);
  return rows;
};

// Initialize schema and seed default data
const initDatabase = async () => {
  try {
    // Create Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Vendors table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Vendors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Products table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL CHECK(price >= 0),
        stock INT NOT NULL DEFAULT 0 CHECK(stock >= 0),
        image_url VARCHAR(255),
        category VARCHAR(255) NOT NULL,
        vendor_id INT NOT NULL,
        is_featured INT DEFAULT 0 CHECK(is_featured IN (0, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(vendor_id) REFERENCES Vendors(id) ON DELETE CASCADE
      )
    `);

    // Create Cart table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1 CHECK(quantity > 0),
        UNIQUE(user_id, product_id),
        FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES Products(id) ON DELETE CASCADE
      )
    `);

    // Create Wishlist table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Wishlist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        UNIQUE(user_id, product_id),
        FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES Products(id) ON DELETE CASCADE
      )
    `);

    // Create Recently Viewed table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS RecentlyViewed (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id),
        FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES Products(id) ON DELETE CASCADE
      )
    `);

    // Create Coupons table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(255) NOT NULL UNIQUE,
        discount_percentage DECIMAL(5,2) NOT NULL CHECK(discount_percentage > 0 AND discount_percentage <= 100),
        expiry_date VARCHAR(255) NOT NULL
      )
    `);

    // Create Orders table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_price DECIMAL(10,2) NOT NULL CHECK(total_price >= 0),
        discount_applied DECIMAL(10,2) DEFAULT 0,
        coupon_code VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);

    // Create Order Items table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Order_Items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT,
        quantity INT NOT NULL CHECK(quantity > 0),
        price DECIMAL(10,2) NOT NULL CHECK(price >= 0),
        FOREIGN KEY(order_id) REFERENCES Orders(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES Products(id) ON DELETE SET NULL
      )
    `);

    // Create Reviews table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT NOT NULL CHECK(rating >= 1 AND rating <= 5),
        review TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id),
        FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES Products(id) ON DELETE CASCADE
      )
    `);

    // Create Stores table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Stores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id INT NOT NULL UNIQUE,
        store_name VARCHAR(255) NOT NULL,
        store_description TEXT,
        store_logo VARCHAR(255),
        commission_rate DECIMAL(5,2) DEFAULT 10.00,
        FOREIGN KEY (vendor_id) REFERENCES Vendors(id) ON DELETE CASCADE
      )
    `);

    // Create RefundRequests table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS RefundRequests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        vendor_id INT NOT NULL,
        reason TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (vendor_id) REFERENCES Vendors(id) ON DELETE CASCADE
      )
    `);

    // Create Messages table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        sender_role VARCHAR(50) NOT NULL,
        receiver_id INT NOT NULL,
        receiver_role VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        order_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create DeliveryPartners table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS DeliveryPartners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create SystemSettings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS SystemSettings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL
      )
    `);

    // Create Notifications table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read INT DEFAULT 0 CHECK(is_read IN (0, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables initialized successfully. Verifying columns...');

    // Add new columns if missing
    await addColumnIfNotExists('Users', 'wallet_balance', 'DECIMAL(10,2) NOT NULL DEFAULT 1000.00');
    await addColumnIfNotExists('Users', 'social_provider', 'VARCHAR(50) DEFAULT NULL');
    await addColumnIfNotExists('Users', 'password_reset_token', 'VARCHAR(255) DEFAULT NULL');

    await addColumnIfNotExists('Vendors', 'wallet_balance', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    await addColumnIfNotExists('Vendors', 'commission_rate', 'DECIMAL(5,2) DEFAULT 10.00');

    await addColumnIfNotExists('Stores', 'store_banner', 'VARCHAR(255) DEFAULT NULL');

    await addColumnIfNotExists('Products', 'status', "VARCHAR(50) DEFAULT 'Approved'");
    await addColumnIfNotExists('Products', 'subcategory', "VARCHAR(255) DEFAULT 'General'");

    await addColumnIfNotExists('Orders', 'shipping_method', "VARCHAR(50) DEFAULT 'Standard'");
    await addColumnIfNotExists('Orders', 'shipping_fee', 'DECIMAL(10,2) DEFAULT 10.00');
    await addColumnIfNotExists('Orders', 'tax_amount', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists('Orders', 'payment_method', "VARCHAR(50) DEFAULT 'COD'");
    await addColumnIfNotExists('Orders', 'payment_status', "VARCHAR(50) DEFAULT 'Pending'");
    await addColumnIfNotExists('Orders', 'tracking_number', 'VARCHAR(255) DEFAULT NULL');
    await addColumnIfNotExists('Orders', 'delivery_status', "VARCHAR(50) DEFAULT 'Pending'");
    await addColumnIfNotExists('Orders', 'delivery_partner_id', 'INT DEFAULT NULL');
    await addColumnIfNotExists('Orders', 'recipient_name', 'VARCHAR(255) DEFAULT NULL');
    await addColumnIfNotExists('Orders', 'delivery_address', 'TEXT DEFAULT NULL');
    await addColumnIfNotExists('Orders', 'recipient_phone', 'VARCHAR(50) DEFAULT NULL');

    // Seed admin user
    await seedAdminUser();
    
    // Seed some basic coupons
    await seedCoupons();

    // Seed System settings
    await seedSystemSettings();

  } catch (err) {
    console.error('Error during database initialization:', err);
  }
};

const addColumnIfNotExists = async (tableName, columnName, columnDef) => {
  try {
    const checkSql = `
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `;
    const row = await dbGet(checkSql, [dbName, tableName, columnName]);
    if (row && row.count === 0) {
      await dbRun(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`Added column ${columnName} to ${tableName}`);
    }
  } catch (err) {
    console.error(`Error adding column ${columnName} to ${tableName}:`, err.message);
  }
};

const seedSystemSettings = async () => {
  try {
    const defaults = [
      { key: 'tax_percentage', val: '5.00' },
      { key: 'shipping_fee_flat', val: '15.00' },
      { key: 'global_commission_percentage', val: '10.00' },
      { key: 'cms_banner_text', val: 'ShopHub Multi-Vendor Marketplace - Premium Collections & Verified Sellers' },
      { key: 'cms_banner_image', val: 'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=800' },
      { key: 'cms_blogs', val: '[{"id":1,"title":"E-Commerce Trends of 2026","summary":"Discover how personalized shopping and smart wallets are changing consumer behaviour.","date":"2026-06-15"},{"id":2,"title":"Vendor Success Guide","summary":"Tips on optimizing stock levels, high-quality images, and customer support relations.","date":"2026-06-17"}]' }
    ];

    for (const item of defaults) {
      const existing = await dbGet('SELECT * FROM SystemSettings WHERE setting_key = ?', [item.key]);
      if (!existing) {
        await dbRun('INSERT INTO SystemSettings (setting_key, setting_value) VALUES (?, ?)', [item.key, item.val]);
      }
    }
    console.log('Default system settings checked/seeded.');
  } catch (err) {
    console.error('Error seeding system settings:', err);
  }
};

const seedAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ecommerce.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

  try {
    const admin = await dbGet('SELECT * FROM Users WHERE email = ?', [adminEmail]);
    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await dbRun(
        'INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Administrator', adminEmail, hashedPassword, 'admin']
      );
      console.log('Default Admin user seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
};

const seedCoupons = async () => {
  try {
    const couponCount = await dbGet('SELECT COUNT(*) as count FROM Coupons');
    if (couponCount.count === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      const expiry = tomorrow.toISOString().split('T')[0];

      await dbRun('INSERT INTO Coupons (code, discount_percentage, expiry_date) VALUES (?, ?, ?)', ['SAVE10', 10.0, expiry]);
      await dbRun('INSERT INTO Coupons (code, discount_percentage, expiry_date) VALUES (?, ?, ?)', ['WELCOME20', 20.0, expiry]);
      await dbRun('INSERT INTO Coupons (code, discount_percentage, expiry_date) VALUES (?, ?, ?)', ['SUPERDEAL50', 50.0, expiry]);
      console.log('Default coupons seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding coupons:', err);
  }
};

module.exports = {
  db: {
    close: (cb) => {
      if (pool) {
        pool.end().then(() => cb()).catch(cb);
      } else {
        cb();
      }
    }
  },
  run: dbRun,
  get: dbGet,
  all: dbAll,
  initDatabase,
};
