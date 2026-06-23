# Multi-Vendor Ecommerce Platform - REST API Documentation

This document describes the REST API endpoints, request formats, responses, and security parameters of the multi-vendor e-commerce backend application.

## Base Configuration

- **Development Base URL**: `http://localhost:5000`
- **Port Settings**: Configured via `.env` file (Default: `5000`)
- **Database**: MySQL
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>` (for protected endpoints)

---

## Authentication APIs

### 1. User (Customer) Registration
- **Endpoint**: `POST /api/auth/register`
- **Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "UserSecurePass123!"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### 2. User (Customer) Login
- **Endpoint**: `POST /api/auth/login`
- **Request Body**:
```json
{
  "email": "john@example.com",
  "password": "UserSecurePass123!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "User logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### 3. Vendor Application / Registration
- **Endpoint**: `POST /api/auth/vendor/register`
- **Request Body**:
```json
{
  "vendor_name": "ElectroStore",
  "email": "electro@vendor.com",
  "password": "VendorSecurePass123!"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Vendor application registered successfully. Waiting for admin approval.",
  "vendor": {
    "id": 1,
    "vendor_name": "ElectroStore",
    "email": "electro@vendor.com",
    "status": "pending"
  }
}
```

### 4. Vendor Login
- **Endpoint**: `POST /api/auth/vendor/login`
- **Request Body**:
```json
{
  "email": "electro@vendor.com",
  "password": "VendorSecurePass123!"
}
```
- **Response (200 OK)** (If approved):
```json
{
  "success": true,
  "message": "Vendor logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "vendor": {
    "id": 1,
    "vendor_name": "ElectroStore",
    "email": "electro@vendor.com",
    "status": "approved",
    "role": "vendor"
  }
}
```
- **Response (403 Forbidden)** (If pending):
```json
{
  "success": false,
  "message": "Your vendor account is pending approval by the admin. Please try again later."
}
```

### 5. Admin Login
- **Endpoint**: `POST /api/auth/admin/login`
- **Request Body**:
```json
{
  "email": "admin@ecommerce.com",
  "password": "AdminSecurePass123!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Admin logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": 1,
    "name": "Administrator",
    "email": "admin@ecommerce.com",
    "role": "admin"
  }
}
```

---

## Product Catalog APIs

### 1. Get All Products (With Search, Filter, Sort, Pagination)
- **Endpoint**: `GET /api/products`
- **Query Parameters**:
  - `q` or `search`: Search query matching name or description
  - `category`: Filter by product category (e.g. `Electronics`)
  - `vendor_id`: Filter by vendor ID
  - `min_price`: Filter by minimum price
  - `max_price`: Filter by maximum price
  - `sort`: Sorting criteria (`price_asc`, `price_desc`, `newest`, `oldest`, `name_asc`, `name_desc`)
  - `page`: Page index (default: `1`)
  - `limit`: Items per page (default: `10`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Super Wireless Earbuds",
      "description": "Noise cancelling Bluetooth 5.2 earbuds.",
      "price": 89.99,
      "stock": 50,
      "image_url": "uploads/image-169876543210.webp",
      "category": "Electronics",
      "vendor_id": 1,
      "is_featured": 1,
      "created_at": "2026-06-17 11:40:00",
      "vendor_name": "ElectroStore"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

### 2. Get Product By ID
- **Endpoint**: `GET /api/products/:id`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Super Wireless Earbuds",
    "description": "Noise cancelling Bluetooth 5.2 earbuds.",
    "price": 89.99,
    "stock": 50,
    "image_url": "uploads/image-169876543210.webp",
    "category": "Electronics",
    "vendor_id": 1,
    "is_featured": 1,
    "created_at": "2026-06-17 11:40:00",
    "vendor_name": "ElectroStore"
  }
}
```

### 3. Add New Product (Vendor Role Required)
- **Endpoint**: `POST /api/products`
- **Request Type**: `multipart/form-data`
- **Headers**: `Authorization: Bearer <vendor_token>`
- **Body Fields**:
  - `name`: string (Required)
  - `description`: string (Optional)
  - `price`: decimal (Required)
  - `stock`: integer (Optional)
  - `category`: string (Required)
  - `is_featured`: integer/boolean (Optional, `1` or `0`)
  - `image`: file upload (Optional, image formats)
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Product created successfully.",
  "data": {
    "id": 1,
    "name": "Super Wireless Earbuds",
    "description": "Noise cancelling Bluetooth 5.2 earbuds.",
    "price": 89.99,
    "stock": 50,
    "image_url": "uploads/image-169876543210.webp",
    "category": "Electronics",
    "vendor_id": 1,
    "is_featured": 1,
    "created_at": "2026-06-17 11:40:00"
  }
}
```

### 4. Edit Product (Vendor Owner or Admin Role Required)
- **Endpoint**: `PUT /api/products/:id`
- **Request Type**: `multipart/form-data`
- **Headers**: `Authorization: Bearer <token>`
- **Body Fields**: Any subset of creation parameters, plus optional new file under `image`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Product updated successfully.",
  "data": { ... }
}
```

### 5. Delete Product (Vendor Owner or Admin Role Required)
- **Endpoint**: `DELETE /api/products/:id`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Product deleted successfully."
}
```

### 6. Search suggestions
- **Endpoint**: `GET /api/products/suggestions?q=<term>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    "Super Wireless Earbuds"
  ]
}
```

### 7. Featured Products
- **Endpoint**: `GET /api/products/featured?limit=6`
- **Response (200 OK)**: List of products marked as `is_featured = 1`.

### 8. Trending Products
- **Endpoint**: `GET /api/products/trending?limit=6`
- **Response (200 OK)**: Returns products with the highest order volume (falls back to newest if sales history is empty).

### 9. Best Sellers
- **Endpoint**: `GET /api/products/bestsellers?limit=6`
- **Response (200 OK)**: Returns products with the highest aggregate item sales quantity.

---

## Cart & Wishlist APIs

### 1. View Cart
- **Endpoint**: `GET /api/cart`
- **Headers**: `Authorization: Bearer <customer_token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "cart_item_id": 1,
        "product_id": 1,
        "quantity": 2,
        "name": "Super Wireless Earbuds",
        "price": 89.99,
        "image_url": "uploads/image-169876543210.webp",
        "stock": 50,
        "category": "Electronics"
      }
    ],
    "cartTotal": 179.98
  }
}
```

### 2. Add to Cart
- **Endpoint**: `POST /api/cart`
- **Headers**: `Authorization: Bearer <customer_token>`
- **Request Body**:
```json
{
  "product_id": 1,
  "quantity": 2
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Product added to cart successfully."
}
```

### 3. Update Cart Item Quantity
- **Endpoint**: `PUT /api/cart/:product_id`
- **Headers**: `Authorization: Bearer <customer_token>`
- **Request Body**:
```json
{
  "quantity": 5
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Cart quantity updated successfully."
}
```

### 4. Remove from Cart
- **Endpoint**: `DELETE /api/cart/:product_id`
- **Headers**: `Authorization: Bearer <customer_token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Product removed from cart successfully."
}
```

### 5. Get Wishlist
- **Endpoint**: `GET /api/wishlist`
- **Headers**: `Authorization: Bearer <customer_token>`

### 6. Add to Wishlist
- **Endpoint**: `POST /api/wishlist`
- **Headers**: `Authorization: Bearer <customer_token>`
- **Request Body**: `{ "product_id": 1 }`

---

## Checkout & Order APIs

### 1. Checkout (Place Order)
- **Endpoint**: `POST /api/orders`
- **Headers**: `Authorization: Bearer <customer_token>`
- **Request Body** (Optional Coupon):
```json
{
  "coupon_code": "SAVE10"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Order placed successfully.",
  "data": {
    "orderId": 1,
    "originalTotal": 179.98,
    "discountApplied": 18.0,
    "finalPrice": 161.98,
    "status": "Pending"
  }
}
```

### 2. Get Order History (Customer)
- **Endpoint**: `GET /api/orders/history`
- **Headers**: `Authorization: Bearer <customer_token>`

### 3. Get Order Details (Customer / Vendor / Admin)
- **Endpoint**: `GET /api/orders/:id`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)** (Admins / Customers see full info. Vendors see filtered list containing only their products and specific subtotal):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 2,
    "total_price": 161.98,
    "discount_applied": 18.0,
    "coupon_code": "SAVE10",
    "status": "Pending",
    "order_date": "2026-06-17 11:45:00",
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "items": [
      {
        "item_id": 1,
        "product_id": 1,
        "quantity": 2,
        "price": 89.99,
        "product_name": "Super Wireless Earbuds",
        "image_url": "uploads/image-169876543210.webp",
        "vendor_id": 1,
        "vendor_name": "ElectroStore"
      }
    ]
  }
}
```

### 4. Update Order Status (Vendor / Admin)
- **Endpoint**: `PUT /api/orders/:id/status`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "status": "Processing" // Pending, Processing, Shipped, Delivered, Cancelled
}
```
- **Inventory Note**: Changing status to `Cancelled` will automatically restock items to vendor inventory!

---

## Reviews APIs

### 1. View Product Reviews and Ratings Summary (Public)
- **Endpoint**: `GET /api/reviews/product/:productId`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "averageRating": 4.5,
    "totalReviews": 2,
    "breakdown": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 1,
      "5": 1
    },
    "reviews": [
      {
        "id": 1,
        "user_id": 2,
        "product_id": 1,
        "rating": 5,
        "review": "Awesome product! Battery lasts forever.",
        "created_at": "2026-06-17 11:50:00",
        "reviewer_name": "John Doe"
      }
    ]
  }
}
```

### 2. Submit Review (Customer Auth)
- **Endpoint**: `POST /api/reviews`
- **Request Body**: `{ "product_id": 1, "rating": 5, "review": "Awesome product!" }`

---

## Vendor Portal APIs

### 1. Vendor Stats (Vendor Auth)
- **Endpoint**: `GET /api/vendor/stats`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "totalProducts": 5,
    "totalOrders": 12,
    "totalRevenue": 2450.90,
    "lowStockCount": 1,
    "lowStockProducts": [
      {
        "id": 3,
        "name": "Noise Cancelling Headphones",
        "stock": 2,
        "price": 299.99
      }
    ]
  }
}
```

### 2. Vendor Products (Vendor Auth)
- **Endpoint**: `GET /api/vendor/products`

---

## Admin Portal APIs

### 1. Get Global Platform Statistics (Admin Auth)
- **Endpoint**: `GET /api/admin/stats`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalVendors": 12,
    "totalProducts": 320,
    "totalOrders": 84,
    "totalRevenue": 14920.50,
    "pendingVendorsCount": 3
  }
}
```

### 2. Approve/Block Vendor (Admin Auth)
- **Endpoints**:
  - `PUT /api/admin/vendors/:id/approve`
  - `PUT /api/admin/vendors/:id/block`

### 3. Coupon Codes Management (Admin Auth)
- **Endpoints**:
  - `POST /api/admin/coupons` (`{ "code": "DEAL20", "discount_percentage": 20, "expiry_date": "2026-12-31" }`)
  - `GET /api/admin/coupons`
  - `DELETE /api/admin/coupons/:id`
