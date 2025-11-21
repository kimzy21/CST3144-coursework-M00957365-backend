# CST3144-coursework-M00957365-backend
This is the CST3144 Full Stack Development project backend repo of Kimberly Alexya Ramasamy - M00957365

# 🔗 Required Links
Backend Github repo: https://github.com/kimzy21/CST3144-coursework-M00957365-backend.git

Hosted API endpoint (render.com used) - Return All Lessons Route: https://cst3144-coursework-m00957365-backend.onrender.com/collections/products

# 📁 Project Description
The server:
Exposes REST API endpoints for lessons and orders.
Stores data in MongoDB Atlas.
Updates product availability as orders are placed.
Persists changes to the database and serves the frontend.

# 🚀 How to run locally
1. Install dependencies: npm install
2. Start server: npm start or nodemon or npm run dev
3. Default local url: http://localhost:3000

# 📡 Main API routes
Endpoint - Method - Description
/collections/products - GET - returns all lessons
/ordder/start - POST - creates a new temporary order
/order/:id/cart - PUT - updates the cart items
/order/:id - DELETE - cancels an existing order
/order/:id/submit - POST - finalizes the order

# 🗄 MongoDB collections

These were hosted in MongoDB Atlas

# ⚠️ Submission Notes
1. node_modules folder not included in zip
2. Backend deployed online to be used by github pages frontend.