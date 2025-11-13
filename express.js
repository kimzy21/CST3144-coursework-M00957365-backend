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

    //return result to frontend - object updated and saved in mongodb
    res.json((result.matchedCount === 1) ? {msg: "success"} : {msg: "error"});
  } catch (err) {
    console.error('Error updating document:', err.message);
    next(err);
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
