const express = require("express");
const path = require("node:path");
const db = require("./database");

const app = express();
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

app.listen(port, "127.0.0.1", function onServerStart(){
    console.log("Server running at http://127.0.0.1:" + port)
});

