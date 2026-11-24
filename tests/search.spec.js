const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const db = require("../database");

test("search finds an item whose name contains an apostrophe", async function ({ request }) {
    // A unique suffix keeps the test independent of items already in the database.
    const name = "Felipe's notebook " + randomUUID();
    const location = "Library";

    const insert = db.prepare("INSERT INTO items (name, location) VALUES (?, ?)");
    const savedItem = insert.run(name, location);

    try {
        const response = await request.get("http://127.0.0.1:3000/api/items", {
            params: { search: name }
        });

        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual([{ name: name, location: location }]);
    } finally {
        db.prepare("DELETE FROM items WHERE id = ?").run(savedItem.lastInsertRowid);
    }
});