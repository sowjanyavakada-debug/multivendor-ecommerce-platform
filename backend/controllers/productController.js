const db = require('../database/database');
const path = require('path');
const fs = require('fs');

// 1. Get All Products (with Search, Filter, Sort, Pagination)
const getProducts = async (req, res, next) => {
  try {
    let {
      q,
      search,
      category,
      min_price,
      max_price,
      vendor_id,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    const searchQuery = search || q;
    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    let query = 'SELECT p.*, v.vendor_name FROM Products p JOIN Vendors v ON p.vendor_id = v.id WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM Products p JOIN Vendors v ON p.vendor_id = v.id WHERE 1=1';
    const params = [];
    const countParams = [];

    // Search filter (name or description)
    if (searchQuery) {
      const sqlSearch = `%${searchQuery}%`;
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      countQuery += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(sqlSearch, sqlSearch);
      countParams.push(sqlSearch, sqlSearch);
    }

    // Category filter
    if (category) {
      query += ' AND p.category = ?';
      countQuery += ' AND p.category = ?';
      params.push(category);
      countParams.push(category);
    }

    // Vendor filter
    if (vendor_id) {
      query += ' AND p.vendor_id = ?';
      countQuery += ' AND p.vendor_id = ?';
      params.push(vendor_id);
      countParams.push(vendor_id);
    }

    // Price range filters
    if (min_price) {
      query += ' AND p.price >= ?';
      countQuery += ' AND p.price >= ?';
      params.push(parseFloat(min_price));
      countParams.push(parseFloat(min_price));
    }
    if (max_price) {
      query += ' AND p.price <= ?';
      countQuery += ' AND p.price <= ?';
      params.push(parseFloat(max_price));
      countParams.push(parseFloat(max_price));
    }

    // Get total count for pagination metadata
    const countResult = await db.get(countQuery, countParams);
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / limit);

    // Sorting
    if (sort) {
      switch (sort) {
        case 'price_asc':
          query += ' ORDER BY p.price ASC';
          break;
        case 'price_desc':
          query += ' ORDER BY p.price DESC';
          break;
        case 'newest':
          query += ' ORDER BY p.created_at DESC';
          break;
        case 'oldest':
          query += ' ORDER BY p.created_at ASC';
          break;
        case 'name_asc':
          query += ' ORDER BY p.name ASC';
          break;
        case 'name_desc':
          query += ' ORDER BY p.name DESC';
          break;
        default:
          query += ' ORDER BY p.created_at DESC';
      }
    } else {
      query += ' ORDER BY p.created_at DESC';
    }

    // Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const products = await db.all(query, params);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        totalItems: total,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Product by ID
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await db.get(
      'SELECT p.*, v.vendor_name FROM Products p JOIN Vendors v ON p.vendor_id = v.id WHERE p.id = ?',
      [id]
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Create Product (Vendor only)
const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category, is_featured } = req.body;
    const vendorId = req.user.id; // From verifyToken

    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and category are required fields.',
      });
    }

    // Handle uploaded image
    let image_url = null;
    if (req.file) {
      // Multer saves files, make relative url path
      image_url = `uploads/${req.file.filename}`;
    } else if (req.body.image_url) {
      image_url = req.body.image_url;
    }

    const priceVal = parseFloat(price);
    const stockVal = stock ? parseInt(stock) : 0;
    const featuredVal = is_featured === 'true' || is_featured === '1' || is_featured === 1 ? 1 : 0;

    const result = await db.run(
      `INSERT INTO Products (name, description, price, stock, image_url, category, vendor_id, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, priceVal, stockVal, image_url, category, vendorId, featuredVal]
    );

    const newProduct = await db.get('SELECT * FROM Products WHERE id = ?', [result.id]);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: newProduct,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Update Product (Vendor / Admin only)
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category, is_featured } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch existing product
    const product = await db.get('SELECT * FROM Products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Authorization check: Must be owner vendor or admin
    if (userRole !== 'admin' && product.vendor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this product.',
      });
    }

    // Manage image file if a new one is uploaded
    let image_url = product.image_url;
    if (req.file) {
      image_url = `uploads/${req.file.filename}`;

      // Optionally delete old file
      if (product.image_url && product.image_url.startsWith('uploads/')) {
        const oldPath = path.resolve(__dirname, '..', product.image_url);
        fs.access(oldPath, fs.constants.F_OK, (err) => {
          if (!err) {
            fs.unlink(oldPath, (unlinkErr) => {
              if (unlinkErr) console.error('Failed to delete old image file:', unlinkErr);
            });
          }
        });
      }
    } else if (req.body.image_url !== undefined) {
      image_url = req.body.image_url;
    }

    // Prepare fields
    const updatedName = name || product.name;
    const updatedDesc = description !== undefined ? description : product.description;
    const updatedPrice = price !== undefined ? parseFloat(price) : product.price;
    const updatedStock = stock !== undefined ? parseInt(stock) : product.stock;
    const updatedCategory = category || product.category;
    
    let updatedFeatured = product.is_featured;
    if (is_featured !== undefined) {
      updatedFeatured = is_featured === 'true' || is_featured === '1' || is_featured === 1 ? 1 : 0;
    }

    await db.run(
      `UPDATE Products 
       SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, category = ?, is_featured = ?
       WHERE id = ?`,
      [updatedName, updatedDesc, updatedPrice, updatedStock, image_url, updatedCategory, updatedFeatured, id]
    );

    const updatedProduct = await db.get('SELECT * FROM Products WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Delete Product (Vendor / Admin only)
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch product
    const product = await db.get('SELECT * FROM Products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Authorize
    if (userRole !== 'admin' && product.vendor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this product.',
      });
    }

    // Delete image if exists
    if (product.image_url) {
      const imgPath = path.resolve(__dirname, '..', product.image_url);
      fs.access(imgPath, fs.constants.F_OK, (err) => {
        if (!err) {
          fs.unlink(imgPath, (unlinkErr) => {
            if (unlinkErr) console.error('Failed to delete product image:', unlinkErr);
          });
        }
      });
    }

    await db.run('DELETE FROM Products WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 6. Search suggestions
const getSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(200).json({ success: true, data: [] });
    }

    const suggestions = await db.all(
      'SELECT DISTINCT name FROM Products WHERE name LIKE ? LIMIT 8',
      [`%${q}%`]
    );

    const list = suggestions.map((row) => row.name);

    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// 7. Get Related Products (Same category, excluding current product)
const getRelatedProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await db.get('SELECT category FROM Products WHERE id = ?', [id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit) : 4;

    const related = await db.all(
      'SELECT * FROM Products WHERE category = ? AND id != ? LIMIT ?',
      [product.category, id, limit]
    );

    return res.status(200).json({
      success: true,
      data: related,
    });
  } catch (error) {
    next(error);
  }
};

// 8. Get Featured Products
const getFeaturedProducts = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 6;
    const featured = await db.all(
      'SELECT * FROM Products WHERE is_featured = 1 LIMIT ?',
      [limit]
    );

    return res.status(200).json({
      success: true,
      data: featured,
    });
  } catch (error) {
    next(error);
  }
};

// 9. Get Trending Products (High orders count)
const getTrendingProducts = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 6;

    // Fetch products ordered by count of occurrences in Order_Items
    let trending = await db.all(
      `SELECT p.*, count_table.order_count 
       FROM Products p 
       JOIN (
         SELECT product_id, COUNT(id) as order_count 
         FROM Order_Items 
         GROUP BY product_id
       ) count_table ON p.id = count_table.product_id 
       ORDER BY count_table.order_count DESC 
       LIMIT ?`,
      [limit]
    );

    // Fallback if no orders yet, return newest featured/standard products
    if (trending.length === 0) {
      trending = await db.all('SELECT * FROM Products ORDER BY created_at DESC LIMIT ?', [limit]);
    }

    return res.status(200).json({
      success: true,
      data: trending,
    });
  } catch (error) {
    next(error);
  }
};

// 10. Get Best Seller Products (Highest quantity sold)
const getBestSellers = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 6;

    let bestSellers = await db.all(
      `SELECT p.*, sold_table.total_sold 
       FROM Products p 
       JOIN (
         SELECT product_id, SUM(quantity) as total_sold 
         FROM Order_Items 
         GROUP BY product_id
       ) sold_table ON p.id = sold_table.product_id 
       ORDER BY sold_table.total_sold DESC 
       LIMIT ?`,
      [limit]
    );

    // Fallback if no order items exist yet
    if (bestSellers.length === 0) {
      bestSellers = await db.all('SELECT * FROM Products ORDER BY stock ASC LIMIT ?', [limit]); // low stock/popular mock
    }

    return res.status(200).json({
      success: true,
      data: bestSellers,
    });
  } catch (error) {
    next(error);
  }
};

// 11. Add/Log Recently Viewed Product (Customer only)
const logProductView = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const userId = req.user.id;

    // Verify product exists
    const product = await db.get('SELECT id FROM Products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Insert or update view timestamp (bubble to top)
    await db.run(
      `INSERT INTO RecentlyViewed (user_id, product_id, viewed_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP`,
      [userId, productId]
    );

    return res.status(200).json({
      success: true,
      message: 'Product view logged successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 12. Get User's Recently Viewed Products (Customer only)
const getRecentlyViewed = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit) : 6;

    const list = await db.all(
      `SELECT p.*, rv.viewed_at 
       FROM RecentlyViewed rv 
       JOIN Products p ON rv.product_id = p.id 
       WHERE rv.user_id = ? 
       ORDER BY rv.viewed_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// 13. Get Vendor Public Store Profile & Catalog
const getVendorPublicStore = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    // Fetch store profile
    let store = await db.get('SELECT * FROM Stores WHERE vendor_id = ?', [vendorId]);
    if (!store) {
      // Fallback: create dynamic default store name from Vendor table
      const vendor = await db.get('SELECT vendor_name FROM Vendors WHERE id = ?', [vendorId]);
      if (!vendor) {
        return res.status(404).json({ success: false, message: 'Vendor/Store not found.' });
      }
      store = {
        store_name: vendor.vendor_name + ' Store',
        store_description: 'Premium collection of products.',
        store_logo: 'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=800'
      };
    }

    // Fetch all products by this vendor
    const products = await db.all(
      "SELECT * FROM Products WHERE vendor_id = ? AND status = 'Approved' ORDER BY created_at DESC",
      [vendorId]
    );

    return res.status(200).json({
      success: true,
      data: {
        store,
        products
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSuggestions,
  getRelatedProducts,
  getFeaturedProducts,
  getTrendingProducts,
  getBestSellers,
  logProductView,
  getRecentlyViewed,
  getVendorPublicStore,
};
