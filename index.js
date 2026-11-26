const express = require("express");
const path = require("node:path");
const db = require("./database");
const session = require("express-session");
const argon2 = require("argon2");
const { randomBytes } = require("node:crypto");
const { readFile } = require("node:fs/promises");
const handleError = require("./error-handler");
const { logSecurityEvent, recordFailedLogin } = require("./security-log");
const { encryptDetail, decryptDetail } = require("./claim-crypto");

const app = express();
const port = 3000;
let dummyPasswordHash;

app.disable("x-powered-by");

app.use(function setSecurityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ];

    res.setHeader("Content-Security-Policy", policy.join("; "));
    next();
});

app.use("/js", express.static(path.join(__dirname, "public", "js")));

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

function requireModerator(req, res, next){
    if(req.session.role !== "moderator"){
        logSecurityEvent("moderator_access_denied");
        return res.status(403).send("Only moderator can review ownership claims.")
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

function escapeHtmlText(text){
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

async function sendFormPage(req, res, filename, itemSummary = "") {
    if (!req.session.csrfToken) {
        req.session.csrfToken = randomBytes(32).toString("hex");
    }

    const filePath = path.join(__dirname, "views", filename);
    const html = await readFile(filePath, "utf8");

    // Both forms on the report page need the token for this session.
    const safeSummary = escapeHtmlText(itemSummary);

    const page = html
        .replaceAll("{{CSRF_TOKEN}}", req.session.csrfToken)
        .split("{{ITEM_SUMMARY}}").join(safeSummary);

        res.setHeader("Cache-Control", "no-store");
        res.send(page);
}

//send the homepage response when someone visits the root url
app.get("/", async function showHomePage(req, res) {
    const search = req.query.search ?? "";

    if (typeof search !== "string") {
        return res.status(400).send("Search must be text.");
    }

    let summary = "";
    if (search.trim()) {
        summary = "Search results for: " + escapeHtmlText(search.trim());
    }

    const html = await readFile(path.join(__dirname, "views", "items.html"), "utf8");
    const page = html.split("{{SEARCH_SUMMARY}}").join(summary);
    res.send(page);
});

app.get("/api/items", function getItems(req,res){
    const search = req.query.search || "";

    if(typeof search !== "string"){
        return res.status(400).json({error: "Search must be text." });
    }

    //we retrieve ID because 2 peple might report the same item name, like airpods or student card, etc...
    const query = db.prepare(`
        SELECT id, name, location
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
        recordFailedLogin();
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
            logSecurityEvent("login_succeeded");
            if(user.role === "moderator"){
                return res.redirect(303, "/moderator/claims");
            }
            res.redirect(303, "items/new");
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

//route for claim an item
app.get("/items/:id/claim", requireLogin, function showClaimPage(req, res) {
    const item = db.prepare(`
        SELECT name, location
        FROM items
        WHERE id = ?
    `).get(req.params.id);

    if (!item) {
        return res.status(404).send("Item not found.");
    }

    return sendFormPage(req, res, "claim-item.html", item.name + " — " + item.location);
});

app.post("/items/:id/claim", requireLogin, requireCsrfToken, function submitClaim(req, res) {
    const detail = req.body.detail;

    if (typeof detail !== "string" || detail.trim().length === 0) {
        return res.status(400).send("Enter a detail that identifies the item.");
    }

    if (detail.trim().length > 300) {
        return res.status(400).send("Keep the identifying detail within 300 characters.");
    }

    const item = db.prepare("SELECT id FROM items WHERE id = ?").get(req.params.id);

    if (!item) {
        return res.status(404).send("Item not found.");
    }

    // The claims table allows one claim per student for each item.
    const result = db.prepare(`
        INSERT INTO claims (item_id, user_id, identifying_detail)
        VALUES (?, ?, ?)
        ON CONFLICT(item_id, user_id) DO NOTHING
    `).run(item.id, req.session.userId, encryptDetail(detail.trim()));

    if (result.changes === 0) {
        return res.status(409).send("You already submitted a claim for this item.");
    }

    res.status(201).send("Claim submitted. It is pending moderator review.");
});

app.get("/api/moderator/claims", requireLogin, requireModerator, function listPendingClaims(req, res){
    const claims = db.prepare(`
        SELECT claims.id, items.name AS item_name, claims.identifying_detail
        FROM claims
        JOIN items ON items.id = claims.item_id
        WHERE claims.status = 'pending'
        ORDER BY claims.id
    `).all();

    //this route has already checked the session and the moderator role
    for(const claim of claims){
        claim.identifying_detail = decryptDetail(claim.identifying_detail);
    }

    //the response contains private ownership details
    res.setHeader("Cache-Control", "no-store");
    res.json(claims);
})

app.post("/moderator/claims/:id/review", requireLogin, requireModerator, requireCsrfToken, function reviewClaim(req, res){
    const decision = req.body.decision;

    if(decision !== "approved" && decision !== "rejected"){
        return res.status(400).send("Choose Approve or Reject.")
    }

    //The NOT EXISTS works like:
    //if two students claim the same headphones. 
    //Once the moderator approves the first claim,
    //SQLite sees that the headphones already have an approved claim. 
    //The moderator can still reject the second claim.
    const result = db.prepare(`
        UPDATE claims
        SET status = ?
        WHERE id = ?
            AND status = 'pending'
            AND (? = 'rejected' OR NOT EXISTS (
                SELECT 1 FROM claims AS other
                WHERE other.item_id = claims.item_id
                AND other.status = 'approved'
            ))
    `).run(decision, req.params.id, decision);

    if(result.changes === 0){
        return res.status(409).send("This decision could not be saved. Repoen the queue to check the claim.")
    }

    res.redirect(303, "/moderator/claims");
});

app.get("/moderator/claims", requireLogin, requireModerator, function showReviewPage(req, res) {
    return sendFormPage(req, res, "review-claims.html");
});

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

