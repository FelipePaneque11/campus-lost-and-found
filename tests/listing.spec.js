//checks what another visitor sees after the item has been saved to SQLite

const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const db = require("../database");

test("a saved item name appears as plain text to another visitor", async function ({ page, browser }) {
    const name = "<b>USB charger</b>";

    // Give this test its own location so cleanup only removes its record.
    const location = "Test room " + randomUUID();

    try {
        await page.goto("http://127.0.0.1:3000/items/new");
        await page.getByLabel("Item name").fill(name);
        await page.getByLabel("Where did you find it?").fill(location);
        await page.getByRole("button", { name: "Report item" }).click();
        await expect(page).toHaveURL("http://127.0.0.1:3000/");

        // A fresh browser session represents another visitor opening the listing.
        const visitor = await browser.newPage();
        await visitor.goto("http://127.0.0.1:3000/");

        const row = visitor.locator("#item-list li").filter({ hasText: location });
        await expect(row).toHaveText(name + " — " + location);
        await expect(row.locator("b")).toHaveCount(0);

        await visitor.close();
    } finally {
        db.prepare("DELETE FROM items WHERE name = ? AND location = ?").run(name, location);
    }
});