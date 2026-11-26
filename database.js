const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const os = require("node:os");

//keep the secure demo database outside the git repository
const databasePath = path.join(os.homedir(), "campus-lost-and-found-secure.sqlite");
const db = new DatabaseSync(databasePath);

//keep the existing table and its data when the server restarts
db.exec(`
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'moderator'))
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS claims(
        id INTEGER PRIMARY KEY,
        item_id INTEGER NOT NULL REFERENCES items(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        identifying_detail TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
        UNIQUE (item_id, user_id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY,
        event_type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

module.exports = db;