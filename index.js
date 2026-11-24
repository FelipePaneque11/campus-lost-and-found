const express = require("express");
const path = require("node:path");
const db = require("./database");

const app = express();

app.use(express.urlencoded({extended: false}));
const port = 3000;

//send the homepage response when someone visits the root url
app.get("/", function showHomePage(req,res){
    //build the path to items.html
    const page = path.join(__dirname, "views", "items.html");
    res.sendFile(page);
});

app.get("/api/items", function getItems(req,res){
    const search = req.query.search || "";

    if(typeof search !== "string"){
        return res.status(400).json({error: "Search must be text." });
    }

    const query = db.prepare(`
        SELECT name, location
        FROM items
        WHERE instr(lower(name), lower(?)) > 0
           OR instr(lower(location), lower(?)) > 0
        ORDER BY id DESC
    `);

    //the first value is for name and the second is for location
    const items = query.all(search.trim(), search.trim());
    //send what we retrieved on query.all and return to the browser
    res.json(items);
});

app.get("/items/new", function showReportPage(req, res){
    res.sendFile(path.join(__dirname, "views", "report-item.html"));
})

app.post("/items", function reportItem(req, res){
    const fields = req.body || {};

    if(typeof fields.name !== "string" || typeof fields.location !== "string"){
        return res.status(400).send("An item name and location are required.");
    }

    const name = fields.name.trim();
    const location = fields.location.trim();

    //A field containing only spaces after trimming is considered empty
    if(name.length === 0 || location.length === 0){
        return res.status(400).send("An item name and location are required.");
    }

    //input length check
    if(name.length > 100 || location.length > 100){
        return res.status(400).send("Please keep each field within 100 characters.");
    }

    const insert = db.prepare("INSERT INTO items (name,location) VALUES (?,?)");
    insert.run(name, location);

    //return to the listing page after the item has been saved
    res.redirect(303, "/");
});

app.listen(port, "127.0.0.1", function onServerStart(){
    console.log("Server running at http://127.0.0.1:" + port)
});

