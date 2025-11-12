var express = require("express");
const cors = require("cors");
const path = require("path");

let app = express();

app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

app.use("/image", express.static(path.join(__dirname, "image")));

//connect to products.js
let myProduct = require('./products');

//middleware funct
app.use((req, res, next) => {
    console.log("In comes a request to: " + req.url);
    next();
});

app.get("/", (req, res) => {
    res.send("Welcome to out homepage");
});

app.get("/collections/products", (req, res) => {
    res.json(myProduct);
});

app.post("/collections/products", (req, res) => {
    const newProduct = req.body;

    // Optional: add a unique id if not provided
    if (!newProduct.id) {
        newProduct.id = myProduct.length
            ? myProduct[myProduct.length - 1].id + 1
            : 1001;
    }

    myProduct.push(newProduct);
    res.status(201).json({
        message: "Product added successfully",
        product: newProduct
    });
});

app.put("/", function(req, res) {
    res.send("Ok, let's change an element");
});

app.delete("/collections/products/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = myProduct.findIndex(p => p.id === id);
    if (index !== -1) {
        const deleted = myProduct.splice(index, 1);
        res.json({ message: "Product deleted", deleted });
    } else {
        res.status(404).json({ message: "Product not found" });
    }
});

app.use((req, res) => {
    res.status(404).send("Resource not found");
}); //always at the end

//start server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});