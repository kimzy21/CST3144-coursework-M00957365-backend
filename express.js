//load environment var from .env files to avoid hardcoding credentials in code
//used in industry to keep security best practice.
require('dotenv').config();
var express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

//native MongoDB driver
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//db credentials stored in the .env to avoid exposing passwords in repo
const dbPrefix = process.env.DB_PREFIX;
const dbHost = process.env.DB_HOST;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbParams = process.env.DB_PARAMS;

//MongoDB connection to URI
//if dbName is changed for example, the server will connect to another database
//since code uses db1 = client.db(dbName)
//all further calls will operate on that db
const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}/${dbName}${dbParams}`;

//MongoClient with stable API versioning for consistent behavior
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let db1;

//connection to mongodb asynchronously
//if connection fails, throw error and according message - this can be seen in real time in the backend and terminal
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

//CORS enabled to allow frontend to be hosted elsewhere, ie, github pages to access this API
app.use(cors());

//serving frontend from static HTML from specific folder
//frontend served here to allow both FE and BE to be deployed from one Render service
app.use(express.static(path.join(__dirname, "../CST3144-coursework-M00957365")));


//middleware to parse JSON bodies for all routes - essential otherwise data will be sent to the server in the wrong format
//likely result in error 500
app.use(express.json());

//to check if an image exists in designated folder, else static middleware must return an error message
//if removed, express default static handler would return an HTML 404 page instead of a custom error
app.use("/Assets", (req, res, next) => {
  const fullPath = path.join(__dirname, "Assets", req.path);

  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).send("Image not found");
    next();
  });
});

//custom middleware funct
//logs all incoming requests with timestamps
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

//base test route to test if server works
app.get("/", (req, res) => {
  res.send("Welcome to our homepage!");
});

//fetch all products to be displayed on the frontpage of the website
//this endpoint only retrieves data in the og DB order
app.get("/collections/products", async (req, res) => {
  try {
    const products = await db1.collection("Products").find({}).toArray();

    //mapping db fields to match with frontend fields
    //useful when db docs may not contain all same keys
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

//json syncs
//writes mongdb contents to local JSON files for backup/inspection.
//added as a safety measure and was used during testing to see if backend communicated with db
//useful for debugging purposes since you can see the changes in real time
//now after deployment on render.com, we don't see the change but when testing before deployment, you could see the changes live.
async function updateProductsJSON() {
    try {
        //retrieve all products from mongo
        const products = await db1.collection("Products").find({}).toArray();

        //path to the external products.json
        const dataFile = path.resolve("./data/products.json");

        //make sure the folder exists otherwise create it
        const dataDir = path.dirname(dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        //write products to JSON file - changes could be seen live before deployment
        fs.writeFileSync(dataFile, JSON.stringify(products, null, 2), "utf-8");

        console.log("✅ Synced products.json and Products collection successfully");
    } catch (err) {
        console.error("❌ Error syncing products.json:", err); //throw error if an issue occurred
    }
}

//same as the above but it was used to update the orders.json file when an order was started, updated, cancelled or validated
async function updateOrdersJSON () {
  try {
    const orders = await db1.collection("Orders").find({}).toArray();
    const dataFile = path.resolve("./data/orders.json");

    const dataDir = path.dirname(dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, {recursive: true});
    }

    fs.writeFileSync(dataFile, JSON.stringify(orders, null, 2), "utf-8");
    console.log("✅ orders.json and Orders collection synced successfully.");
  } catch (err) {
    console.error("❌ Failed to sync orders.json", err);
  }
}

//collection handler - middleware allows dynamic URLs like /collections/Products or /collections/Orders
app.param('collectionName', (req, res, next, collectionName) => { 
    req.collection = db1.collection(collectionName);
    console.log('Middleware set collection:', req.collection.collectionName);
    next();
});

//fetch all documents from a mongodb collection
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

//the below can be used as admin functionality - not included in project
//the routes allow the admin to create a new order for the catalog
//update an existing product detail
//and remove a product from the catalog
//the routes were kept as template or to further expand the project into a fully functional admin/client website
app.post('/collections/:collectionName', async function(req, res, next) {
  try {
    //validate req.body
    console.log('Received request to insert document:', req.body);

    //insert a new document
    const results = await req.collection.insertOne(req.body);

    //for debugging purposes, log results into console to check
    console.log('Inserted document:', results);

    // Update products.json in background
    if (req.params.collectionName === "Products") {
      updateProductsJSON();
    }

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
    if (req.params.collectionName === "Products") {
      updateProductsJSON();
    }

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
    if (req.params.collectionName === "Products") {
      updateProductsJSON();
    }

    //return result to frontend - object updated and saved in mongodb
    res.json((result.matchedCount === 1) ? {msg: "success"} : {msg: "error"});
  } catch (err) {
    console.error('Error updating document:', err.message);
    next(err);
  }
});

//full-text search route
//went for option B where search in done both in FE and BE
//allows performance scaling and reduces data sent to FE
app.get("/search", async function(req, res, next) {

  //extract the search text as query from URL
  const query = req.query.query;

  //if no uery was provided, return error instead - tested with postman
  if (!query) return res.status(400).json({ message: "Search query is missing" });

  try {
    const regex = new RegExp(query, "i"); //case-insensitive - allows user to type however they like
    //if above is removed, the search becomes case-sensitive
    
    //perform mongodb search
    //mongodb filters data on the server -> docs matching what was typed are sent back to vue
    //efficient for large datasets and avoids heavy computation in the browser
    const results = await db1.collection("Products").find({
      $or: [
        { title: regex }, //match lesson name
        { location: regex }, //match location
        { description: regex } //match description
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

//create a new order with status pending
app.post("/order/start", async function(req, res, next) {
  try {
    //fields initially empty since client hasn't filled the form in checout page
    const newOrder = {
      status: "pending",
      cart: [],
      firstName: "",
      lastName: "",
      phone: "",
      createdAt: new Date ()
    };
    const result = await db1.collection("Orders").insertOne(newOrder);
    updateOrdersJSON(); //creates a new object in the Orders db

    res.json({
      orderId: result.insertedId,
      message: "Order started"
    });
  } catch (err) {
    console.error("Error creating order:", err);
    next(err);
  }
});

//update cart contents of pending order
app.put("/order/:id/cart", async function(req, res, next) {
  try {
    const orderId = new ObjectId(req.params.id);
    const newCart = req.body.cart;

    const result = await db1.collection("Orders").updateOne(
      { _id: orderId },
      { $set: { cart: newCart }}
    );

    updateOrdersJSON(); //calling function that updates cart
    res.json({ message: "Cart updated" });
  } catch (err) {
    console.error("Error updating cart:", err);
    next (err);
  }
});

//cancel an order and delete it from database
app.delete("/order/:id", async function(req, res, next) {
  try {
    const orderId = new ObjectId(req.params.id);
    await db1.collection("Orders").deleteOne({ _id: orderId });

    updateOrdersJSON(); //calling function that updates the Orders db

    res.json({ message: "Order Cancelled"});
  } catch (err) {
    console.error("Error deleting order:", err);
    next(err);
  }
});

//submit order
//decrement product incentory
//inventory is a shared resource, therefore, db must be updated in backend to prevent errors
app.post("/order/:id/submit", async function (req, res, next) {
  console.log("🛒 ORDER DATA RECEIVED:");
  console.log(JSON.stringify(req.body, null, 2));
  try {
    const orderId = new ObjectId(req.params.id);
    const orderData = req.body;

    //update order details
    await db1.collection("Orders").updateOne(
      { _id: orderId },
      {
        $set: {
          status: "submitted", //order status set as submitted
          firstName: orderData.firstName, //saving inputs from fields to Orders db
          lastName: orderData.lastName,
          phone: orderData.phone,
          cart: orderData.cart, //added with product ids
          total: orderData.total, //total price
          submittedAt: new Date() //date at which order was made
        }
      }
    );

    //decrement product inventory on submitted cart
    //works if same product was purchased twice - hence, decrements twice
    for (let productId of orderData.cart) {
      await db1.collection("Products").updateOne(
        { id: productId },
        { $inc: { availableInventory: -1 }}
      );
    }

    //calling functions to update the Orders and Products db after successful order
    updateOrdersJSON();
    updateProductsJSON();

    res.json({ message: "Order submitted successfully!"});
  } catch (err) {
    console.error("Error submitting order:", err);
    next(err);
  }
});

//to check endpoint for render uptime monitoring - recommended by website
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.use((req, res) => {
  res.status(404).send("Resource not found");
}); //always at the end

//start server
const PORT = process.env.PORT || 3000; // Render provides PORT, fallback to 3000 for local

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  if (!process.env.PORT) {
    console.log(`🌐 BrainCart website: http://localhost:${PORT}`);
  }
});
