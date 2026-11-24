const express = require("express");
const path = require("node:path");
const db = require("./database");
const session = require("express-session");
const argon2 = require("argon2");
const { randomBytes } = require("node:crypto");
const { readFile } = require("node:fs/promises");
const handleError = require("./error-handler");

const app = express();
const port = 3000;
let dummyPasswordHash;

app.use(function setSecurityHeaders(req, res, next){
    //tells browser to respect the content type express sends.
    res.setHeader("X-Content-Type-Options", "nosniff");
    //Prevents another page from embedding the app in a frame.
    //This helps protects buttons such as Report item against clickjacking
    res.setHeader("Content-Security-Policy", "frame-Ancestors 'none'");
    next();
})

app.use(express.urlencoded({extended: false}));

app.use(session({
    name: "campus.sid",
    secret: randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 60 * 1000 //sets its lifetime for 30min
    }
}));

//if session hasn't had user login yet, redirect to login page.
function requireLogin(req,res,next){
    if(!req.session.userId){
        return res.redirect(303, "/login");
    }
    next();
}

function requireCsrfToken(req, res, next) {
    const expected = req.session.csrfToken;
    const submitted = req.body?.csrfToken;

    if (!expected || submitted !== expected) {
        return res.status(403).send("Invalid form token. Reload the page and try again.");
    }

    next();
}

async function sendFormPage(req, res, filename) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = randomBytes(32).toString("hex");
    }

    const filePath = path.join(__dirname, "views", filename);
    const html = await readFile(filePath, "utf8");

    // Both forms on the report page need the token for this session.
    const page = html.replaceAll("{{CSRF_TOKEN}}", req.session.csrfToken);

    res.setHeader("Cache-Control", "no-store");
    res.send(page);
}

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

app.get("/items/new", requireLogin, function showReportPage(req, res){
    return sendFormPage(req,res, "report-item.html");
})

app.post("/items", requireLogin, requireCsrfToken, function reportItem(req, res) {
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

app.get("/login", function showLoginPage(req,res){
    return sendFormPage(req, res, "login.html");
});

app.post("/login", requireCsrfToken, async function signIn(req, res, next) {
    const { username, password } = req.body || {};
    
    if(typeof username !== "string" || typeof password !== "string"){
        return res.status(400).send("Enter a username and password.");
    }

    const user = db.prepare(`
        SELECT id, password_hash, role
        FROM users
        WHERE username = ?
    `).get(username.trim());
    
    // Use the fallback hash if the username does not exist.
    let hashToCheck = dummyPasswordHash;
    if(user){
        hashToCheck = user.password_hash;
    }
    //check what the user typed to the hashed password
    const passwordMatches = await argon2.verify(hashToCheck, password);

    if(!user || !passwordMatches){
        return res.status(401).send("Incorrect username or password.");
    }

    //give the signed-in user a fresh session ID
    req.session.regenerate(function (error){
        if(error){
            return next(error);
        }

        req.session.userId = user.id;
        req.session.role = user.role;
        
        //after successful login, redirect to lost item form page
        req.session.save(function (error){
            if(error){
                return next(error)
            }
            res.redirect(303, "/items/new");
        })
    });
})

app.post("/logout", requireLogin, requireCsrfToken, function signOut(req, res, next) {
    //destroy removes the session on the server.
    req.session.destroy(function (error){
        if(error){
            return next(error);
        }

        res.clearCookie("campus.sid");
        res.redirect(303, "/");
    })
})

app.use(handleError);

async function startServer() {
    // Create one fallback hash using the same settings as the demo account.
    const randomPassword = randomBytes(32).toString("hex");
    dummyPasswordHash = await argon2.hash(randomPassword, {
        type: argon2.argon2id
    });

    app.listen(port, "127.0.0.1", function onServerStart() {
        console.log("Server running at http://127.0.0.1:" + port);
    });
}

startServer().catch(function (error) {
    console.error("Could not start the server:", error.message);
    process.exitCode = 1;
});

