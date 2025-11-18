var express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const PropertiesReader = require("properties-reader");
let propertiesPath = path.resolve(__dirname, "./dbconnection.properties");
let properties = PropertiesReader(propertiesPath);

const dbPrefix = properties.get('db.prefix');
const dbHost = properties.get('db.host');
const dbName = properties.get('db.name');
const dbUser = properties.get('db.user');
const dbPassword = properties.get('db.password');
const dbParams = properties.get('db.params');

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

//middleware funct
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Welcome to our homepage!");
});

app.get("/collections/products", async (req, res) => {
  try {
    const products = await db1.collection("Products").find({}).toArray();
    const mapped = products.map(p => ({
      id: p.id,
      title: p.title || p.name,
      description: p.description || p.details || "",
      location: p.location || p.place,
      price: p.price || p.cost,
      availableInventory: p.availableInventory || p.stock || 0,
      image: p.image || "Assets/default.jpg",
      rating: p.rating || 0
    }));
    res.json(mapped);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

async function updateProductsJSON(collectionName) {
    try {
        // Fetch all products from MongoDB
        const products = await db1.collection(collectionName).find({}).toArray();

        // Absolute path to the external products.json
        const dataFile = path.resolve("./data/products.json");

        // Ensure the folder exists
        const dataDir = path.dirname(dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Write products to JSON file
        fs.writeFileSync(dataFile, JSON.stringify(products, null, 2), "utf-8");

        console.log(`✅ Synced products.json with latest changes in '${collectionName}'.`);
    } catch (err) {
        console.error(`❌ Error syncing products.json for '${collectionName}':`, err);
    }
}

app.param('collectionName', (req, res, next, collectionName) => { 
    req.collection = db1.collection(collectionName);
    console.log('Middleware set collection:', req.collection.collectionName);
    next();
});

// Fetch all documents from a MongoDB collection
app.get('/collections/:collectionName', async function(req, res, next) {
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
app.get('/collections1/:collectionName', async function(req, res, next) {
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

app.post('/collections/:collectionName', async function(req, res, next) {
  try {
    //validate req.body
    console.log('Received request to insert document:', req.body);

    //insert a new document
    const results = await req.collection.insertOne(req.body);

    //for debugging purposes, log results into console to check
    console.log('Inserted document:', results);

    // Update products.json in background
    updateProductsJSON(req.params.collectionName);

    //return the result to frontend
    res.json(results);
  } catch (err) {
    console.error('Error inserting document:', err.message);
    next(err); //pass the error to the middleware or error handler in the app
  }
});

app.delete('/collections/:collectionName/:id', async function(req, res, next) {
  try {
    //for debugging purposes
    console.log('Received request to delete document with id:', req.params.id);

    //delete a single document by ID
    const result = await req.collection.deleteOne({ _id: new ObjectId(req.params.id) });

    //log results into console log for debugging
    console.log('Delete operation result:', result);

    // Update products.json in background
    updateProductsJSON(req.params.collectionName);

    //indicates number of documents deleted by MongoDB - deleteOne or deleteMany op.
    //checks if exactly one document was deleted, if yess, op successful
    res.json((result.deletedCount === 1) ? {msg: "success"} : {msg: "error"});
  } catch (err) {
    console.error('Error deleting document:', err.message);
    next(err); //pass the error to the middleware or error handler in the app
  }
});

app.put('/collections/:collectionName/:id', async function (req, res, next) {
  try {
    //for debugging
    console.log('Received request to update document with id:', req.params.id);

    //update single document by ID
    const result = await req.collection.updateOne({ _id: new ObjectId(req.params.id)},
    {$set: req.body},
    {safe: true, multi: false});

    //log result into console to check
    console.log('Update operation result:', result);

    // Update products.json in background
    updateProductsJSON(req.params.collectionName);

    //return result to frontend - object updated and saved in mongodb
    res.json((result.matchedCount === 1) ? {msg: "success"} : {msg: "error"});
  } catch (err) {
    console.error('Error updating document:', err.message);
    next(err);
  }
});

app.get("/search", async function(req, res, next) {
  const query = req.query.query;
  if (!query) return res.status(400).json({ message: "Search query is missing" });

  try {
    const regex = new RegExp(query, "i"); // case-insensitive
    const results = await db1.collection("Products").find({
      $or: [
        { title: regex },
        { location: regex },
        { description: regex }
      ]
    }).toArray();
    
    console.log(`Search for "${query}" returned:`);
    console.log(JSON.stringify(results, null, 4)); // 4 spaces indentation
    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    next(err);
  }
});

app.post("/order/start", async function(req, res, next) {
  try {
    const newOrder = {
      status: "pending",
      cart: [],
      firstName: "",
      lastName: "",
      phone: "",
      method: "",
      gift: "",
      createdAt: new Date ()
    };
    const result = await db1.collection("Orders").insertOne(newOrder);
    res.json({
      orderId: result.insertedId,
      message: "Order started"
    });
  } catch (err) {
    console.error("Error creating order:", err);
    next(err);
  }
});

app.put("/order/:id/cart", async function(req, res, next) {
  try {
    const orderId = new ObjectId(req.params.id);
    const newCart = req.body.cart;

    const result = await db1.collection("Orders").updateOne(
      { _id: orderId },
      { $set: { cart: newCart }}
    );
    res.json({ message: "Cart updated" });
  } catch (err) {
    console.error("Error updating cart:", err);
    next (err);
  }
});

app.delete("/order/:id", async function(req, res, next) {
  try {
    const orderId = new ObjectId(rq.params.id);
    await db1.collection("Orders").deleteOne({ _id: orderId });
    res.json({ message: "Order Cancelled"});
  } catch (err) {
    console.error("Error deleting order:", err);
    next(err);
  }
});

app.post("/order/:id/submit", async function (req, res, next) {
  try {
    const orderId = new ObjectId(req.params.id);
    const orderData = req.body;

    //update order details
    await db1.collection("Orders").updateOne(
      { _id: orderId },
      {
        $set: {
          firstName: orderData.firstName,
          lastName: orderData.lastName,
          phone: orderData.phone,
          gift: orderData.gift,
          status: "submitted",
          submittedAt: new Date()
        }
      }
    );

    //decrement product inventory
    for (let id of orderData.cart) {
      await db1.collection("Products").updateOne(
        { id: id },
        { $inc: { availableInventory: -1 }}
      );
    }
    res.json({ message: "Order submitted successfully!"});
  } catch (err) {
    console.error("Error submitting order:", err);
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).send("Resource not found");
}); //always at the end

//start server
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌐 BrainCart website: http://localhost:${PORT}`);
});
