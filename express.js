var express = require("express");
const cors = require("cors");
const path = require("path");

let app = express();

app.use(cors());

// Serve frontend folder
app.use(express.static(path.join(__dirname, "../CST3144-coursework-M00957365")));


// Middleware to parse JSON bodies
app.use(express.json());

app.use("/Assets", express.static(path.join(__dirname, "Assets")));

//connect to products.js
let myProduct = require('./products');

//middleware funct
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Welcome to our homepage!");
});

app.get("/collections/products", (req, res) => {
  res.json(myProduct);
});

app.post("/collections/products", (req, res) => {
  const newProduct = req.body;

  // Add a unique ID if not provided
  if (!newProduct.id) {
    newProduct.id = myProduct.length
      ? myProduct[myProduct.length - 1].id + 1
      : 1001;
  }

  myProduct.push(newProduct);
  res.status(201).json({
    message: "Product added successfully",
    product: newProduct,
  });
});

app.put("/collections/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = myProduct.findIndex((p) => p.id === id);

  if (index !== -1) {
    myProduct[index] = { ...myProduct[index], ...req.body };
    res.json({ message: "Product updated", product: myProduct[index] });
  } else {
    res.status(404).json({ message: "Product not found" });
  }
});

app.delete("/collections/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = myProduct.findIndex((p) => p.id === id);

  if (index !== -1) {
    const deleted = myProduct.splice(index, 1);
    res.json({ message: "Product deleted", deleted });
  } else {
    res.status(404).json({ message: "Product not found" });
  }
});

app.get("/search", (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({ message: "Search query is missing" });
  }

  const searchTerm = query.toLowerCase();

  const results = myProduct.filter((p) => {
    return (
      p.title.toLowerCase().includes(searchTerm) ||
      p.location.toLowerCase().includes(searchTerm) ||
      p.price.toString().includes(searchTerm) ||
      p.availableInventory.toString().includes(searchTerm)
    );
  });

  res.json(results);
});

app.use((req, res) => {
  res.status(404).send("Resource not found");
}); //always at the end

//start server
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌐 Open your webpage: http://localhost:${PORT}`);
});
