var express = require("express");
const cors = require("cors");
const path = require("path");

const PropertiesReader = require("properties-reader");
let propertiesPath = path.resolve(__dirname, "./dbconnection.properties");
let properties = PropertiesReader(propertiesPath);

const dbPrefix = properties.get('db.prefix');
const dbHost = properties.get('db.host');
const dbName = properties.get('db.name');
const dbUser = properties.get('db.user');
const dbPassword = properties.get('db.password');
const dbParams = properties.get('db.params');

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}${dbParams}`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let db1;

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db1 = client.db(dbName);
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

connectDB();

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
  console.log("Returning static products data:");
  console.log(myProduct); // log the full array
  res.json(myProduct);
});

app.param('collectionName', (req, res, next, collectionName) => { 
    req.collection = db1.collection(collectionName);
    console.log('Middleware set collection:', req.collection.collectionName);
    next();
});

// Fetch all documents from a MongoDB collection
app.get('/collections/:collectionName', async (req, res, next) => {
  try {
    console.log('Received request for collection:', req.params.collectionName);
    console.log('Accessing collection: ', req.collection.collectionName);
    const results = await req.collection.find({}).toArray();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Fetch with limit & sort
app.get('/collections1/:collectionName', async (req, res, next) => {
  try {
    const results = await req.collection.find({}, { limit: 3, sort: { price: -1 } }).toArray();
    console.log('Accessing collection: ', req.collection.collectionName);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/collections/:collectionName/:max/:sortAspect/:sortAscDesc', async function(req, res, next){
  try {
    let max = parseInt(req.params.max);
    let sortDirection = req.params.sortAscDesc.toLowerCase() === "desc" ? -1 : 1;

    console.log('Received request for collection:', req.params.collectionName);
    console.log('Max:', max, 'Sort by:', req.params.sortAspect, 'Direction:', sortDirection);

    // Correct way to fetch with limit and sort
    const results = await req.collection
      .find({})
      .sort({ [req.params.sortAspect]: sortDirection })
      .limit(max)
      .toArray();

    console.log('Retrieved docs:', results);

    res.json(results);

  } catch(err) {
    console.log('Error fetching docs:', err.message);
    next(err);
  }
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
