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
        expect(await response.json()).toEqual([{ id: Number(savedItem.lastInsertRowid), name: name, location: location }]);
    } finally {
        db.prepare("DELETE FROM items WHERE id = ?").run(savedItem.lastInsertRowid);
    }
});

test("the home page escapes the search term in its HTML response", async function ({ request }) {
    const response = await request.get("http://127.0.0.1:3000/", {
        params: { search: "<b>bottle</b>" }
    });

    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toContain("Search results for: &lt;b&gt;bottle&lt;/b&gt;");
    expect(html).not.toContain("Search results for: <b>bottle</b>");
});

test("reflected search input cannot run JavaScript", async function ({ page }) {
    const search = '<script>document.title = "Reflected XSS demo";</script>';

    // Encode the search term so it travels correctly in the URL.
    await page.goto(
        "http://127.0.0.1:3000/?search=" + encodeURIComponent(search)
    );

    // User input must not change the page title.
    await expect(page).toHaveTitle("Campus Lost & Found");

    const summary = page.locator("#search-summary");

    // The full input should appear as text.
    await expect(summary).toHaveText("Search results for: " + search);

    // The browser must not create a script element from that input.
    await expect(summary.locator("script")).toHaveCount(0);
});