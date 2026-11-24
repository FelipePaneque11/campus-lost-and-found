const express = require("express");

const app = express();
const port = 3000;

//send the homepage response when someone visits the root url
app.get("/", function showHomePage(req,res){
    res.send("Campus Lost & Found");
});

app.listen(port, "127.0.0.1", function onServerStart(){
    console.log("Server running at http://127.0.0.1:" + port)
});

