# 🛒 ShopHub Multi-Vendor Ecommerce Platform

Welcome to **ShopHub**, a premium multi-vendor ecommerce application built with a Node.js/Express backend, vanilla HTML/CSS/JS frontend, and a MySQL database.

This guide details the step-by-step setup to get both the backend server and frontend application running on your local machine.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:
1. **Node.js** (v16.0.0 or higher recommended)
2. **MySQL Server** (Ensure it is running locally)
3. **NPM** (Bundled with Node.js)

---

## ⚙️ Step 1: Database Setup & Configuration

The application is configured to connect to your local MySQL instance.

1. **Verify or Edit Environment Settings:**
   Open the [backend/.env](file:///c:/Users/sowja/OneDrive/Desktop/project/backend/.env) file and verify the MySQL connection details:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=sowjanya
   DB_NAME=ecommerce
   PORT=5000
   JWT_SECRET=super_secret_jwt_key_multi_vendor_platform_987654321
   ```
   *Note: If your local MySQL root password is different from `sowjanya`, please update `DB_PASSWORD` in the `.env` file accordingly.*

2. **Database Creation:**
   The backend automatically creates the database schema (e.g., `ecommerce` or `test_ecommerce`) on startup if they do not already exist, so you do not need to create them manually in MySQL.

---

## 🚀 Step 2: Running the Backend

1. Open your terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install the backend dependencies:
   ```bash
   npm install
   ```

3. Seed the database (creates tables and populates default admin, vendors, products, and reviews):
   ```bash
   node database/seeder.js
   ```

4. Start the backend server:
   - **Development mode (with auto-reload):**
     ```bash
     npm run dev
     ```
   - **Production start:**
     ```bash
     npm start
     ```
   
   The server will start on **`http://localhost:5000`**. You can verify that it is running by visiting the health check page: [http://localhost:5000/health](http://localhost:5000/health).

---

## 💻 Step 3: Running the Frontend

The frontend is a static single-page-style application located in the `frontend` folder. Since it communicates with the backend via API calls, it is best to run it through a local web server (to avoid CORS or local file loading restrictions).

Here are the easiest ways to serve the frontend:

### Option A: VS Code Live Server (Recommended)
If you use VS Code:
1. Install the **Live Server** extension by Ritwick Dey.
2. Click **Go Live** at the bottom-right corner of VS Code, or right-click [frontend/index.html](file:///c:/Users/sowja/OneDrive/Desktop/project/frontend/index.html) and select **Open with Live Server**.

### Option B: Using Node's `serve` package
From the project root directory, run:
```bash
npx serve frontend -l 3000
```
Then open **`http://localhost:3000`** in your browser.

### Option C: Python HTTP Server
If you have Python installed, navigate to the `frontend` folder in your terminal and run:
```bash
cd frontend
python -m http.server 8000
```
Then open **`http://localhost:8000`** in your browser.

---

## 🔑 Default Accounts (Seeded)

Once the seeder has run, you can log in using these pre-configured test credentials:

| Role | Email | Password | Description |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@ecommerce.com` | `AdminSecurePass123!` | Manages vendor registrations, categories, and system stats. |
| **Vendor** | `vendor@test.com` | `VendorSecurePass123!` | Add and edit products, view stock levels. |
| **Customer** | `user@test.com` | `UserSecurePass123!` | Browses products, adds to cart, applies coupons, checks out, and writes reviews. |

---

## 🧪 Running Automated Tests

To verify that the application routes, controllers, database integrations, and stock control flows function correctly:

1. Open your terminal in the `backend` folder.
2. Run the test command:
   ```bash
   npm test
   ```
   *This will dynamically bootstrap a test database (`test_ecommerce`), execute 18 integration test phases, and clean up automatically.*
