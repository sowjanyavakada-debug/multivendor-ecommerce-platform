const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined!');
}

// Email validation helper
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate JWT token helper
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

// 1. User Registration
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate fields
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields (name, email, password) are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists in Users
    const existingUser = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered as a user.' });
    }

    // Check if vendor already exists with this email
    const existingVendor = await db.get('SELECT * FROM Vendors WHERE email = ?', [email]);
    if (existingVendor) {
      return res.status(400).json({ success: false, message: 'Email is registered as a vendor.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.run(
      'INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'user']
    );

    const token = generateToken({ id: result.id, email, role: 'user', name });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: {
        id: result.id,
        name,
        email,
        role: 'user',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. User Login
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
    if (!user || user.role !== 'user') {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role, name: user.name });

    return res.status(200).json({
      success: true,
      message: 'User logged in successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Vendor Registration
const registerVendor = async (req, res, next) => {
  try {
    const { vendor_name, email, password } = req.body;

    if (!vendor_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields (vendor_name, email, password) are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Check if vendor already exists
    const existingVendor = await db.get('SELECT * FROM Vendors WHERE email = ?', [email]);
    if (existingVendor) {
      return res.status(400).json({ success: false, message: 'Email is already registered as a vendor.' });
    }

    // Check if email registered as user
    const existingUser = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is registered as a user.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert vendor (status is 'pending' by default)
    const result = await db.run(
      'INSERT INTO Vendors (vendor_name, email, password) VALUES (?, ?, ?)',
      [vendor_name, email, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: 'Vendor application registered successfully. Waiting for admin approval.',
      vendor: {
        id: result.id,
        vendor_name,
        email,
        status: 'pending',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Vendor Login
const loginVendor = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const vendor = await db.get('SELECT * FROM Vendors WHERE email = ?', [email]);
    if (!vendor) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check Vendor Status
    if (vendor.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account is pending approval by the admin. Please try again later.',
      });
    }

    if (vendor.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account application was rejected by the admin.',
      });
    }

    if (vendor.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account has been blocked. Please contact customer support.',
      });
    }

    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken({ id: vendor.id, email: vendor.email, role: 'vendor', name: vendor.vendor_name });

    return res.status(200).json({
      success: true,
      message: 'Vendor logged in successfully.',
      token,
      vendor: {
        id: vendor.id,
        vendor_name: vendor.vendor_name,
        email: vendor.email,
        status: vendor.status,
        role: 'vendor',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Admin Login
const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const admin = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
    if (!admin || admin.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Access denied. Invalid credentials or insufficient permissions.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Access denied. Invalid credentials or insufficient permissions.' });
    }

    const token = generateToken({ id: admin.id, email: admin.email, role: 'admin', name: admin.name });

    return res.status(200).json({
      success: true,
      message: 'Admin logged in successfully.',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
      },
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, new_password } = req.body;
    if (!email || !new_password) {
      return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }
    const user = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
    const vendor = await db.get('SELECT * FROM Vendors WHERE email = ?', [email]);
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    if (user) {
      await db.run('UPDATE Users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
      return res.status(200).json({ success: true, message: 'Password reset successful for user.' });
    } else if (vendor) {
      await db.run('UPDATE Vendors SET password = ? WHERE id = ?', [hashedPassword, vendor.id]);
      return res.status(200).json({ success: true, message: 'Password reset successful for vendor.' });
    } else {
      return res.status(404).json({ success: false, message: 'Account with this email not found.' });
    }
  } catch (err) {
    next(err);
  }
};

const socialLogin = async (req, res, next) => {
  try {
    const { email, name, provider } = req.body;
    if (!email || !name || !provider) {
      return res.status(400).json({ success: false, message: 'Email, name, and provider details are required.' });
    }

    let user = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(Math.random().toString(36), salt);
      const result = await db.run(
        'INSERT INTO Users (name, email, password, role, social_provider) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, 'user', provider]
      );
      user = { id: result.id, name, email, role: 'user' };
    }

    const jwtToken = generateToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    return res.status(200).json({
      success: true,
      message: `Social login successful via ${provider}.`,
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    next(err);
  }
};

const getWalletBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    let wallet_balance = 0.00;

    if (role === 'vendor') {
      const vendor = await db.get('SELECT wallet_balance FROM Vendors WHERE id = ?', [userId]);
      wallet_balance = vendor ? vendor.wallet_balance : 0.00;
    } else {
      const user = await db.get('SELECT wallet_balance FROM Users WHERE id = ?', [userId]);
      wallet_balance = user ? user.wallet_balance : 0.00;
    }

    return res.status(200).json({
      success: true,
      data: { wallet_balance }
    });
  } catch (err) {
    next(err);
  }
};

const addWalletMoney = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid deposit amount greater than zero.' });
    }

    await db.run('UPDATE Users SET wallet_balance = wallet_balance + ? WHERE id = ?', [val, userId]);

    const user = await db.get('SELECT wallet_balance FROM Users WHERE id = ?', [userId]);
    return res.status(200).json({
      success: true,
      message: 'Deposited successfully.',
      data: { wallet_balance: user ? user.wallet_balance : 0.00 }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerUser,
  loginUser,
  registerVendor,
  loginVendor,
  loginAdmin,
  resetPassword,
  socialLogin,
  getWalletBalance,
  addWalletMoney,
};
