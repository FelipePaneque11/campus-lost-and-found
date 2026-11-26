const { test, expect } = require("@playwright/test");
const signIn = require("./sign-in");
const db = require("../database");
const { randomUUID } = require("node:crypto");

test("a student cannot access the moderator claim queue", async function ({ page }) {
    await signIn(page);

    // Check the API that returns private claim details.
    const apiResponse = await page.request.get(
        "http://127.0.0.1:3000/api/moderator/claims"
    );

    expect(apiResponse.status()).toBe(403);
    expect(await apiResponse.text()).toBe(
        "Only moderator can review ownership claims."
    );

    // Check the moderator page too.
    const pageResponse = await page.goto(
        "http://127.0.0.1:3000/moderator/claims"
    );

    expect(pageResponse.status()).toBe(403);
});

test("a student can submit an ownership claim", async function ({ page }) {
    // Create a separate item so existing demo claims cannot affect this test.
    const result = db.prepare(
        "INSERT INTO items (name, location) VALUES (?, ?)"
    ).run("Test headphones " + randomUUID(), "Library");

    const itemId = Number(result.lastInsertRowid);

    try {
        await signIn(page);

        await page.goto(
            "http://127.0.0.1:3000/items/" + itemId + "/claim"
        );

        await page.getByLabel("How can you identify this item?").fill(
            "There is a green sticker inside the case."
        );

        await page.getByRole("button", { name: "Submit claim" }).click();

        await expect(page.locator("body")).toHaveText(
            "Claim submitted. It is pending moderator review."
        );

        // Check that the claim was actually saved in SQLite.
        const claim = db.prepare(
            "SELECT status FROM claims WHERE item_id = ?"
        ).get(itemId);

        expect(claim).toMatchObject({ status: "pending" });
        
        // Try claiming the same item again using the same student account.
        await page.goto(
            "http://127.0.0.1:3000/items/" + itemId + "/claim"
        );

        await page.getByLabel("How can you identify this item?").fill(
            "A second claim for the same headphones."
        );

        await page.getByRole("button", { name: "Submit claim" }).click();

        await expect(page.locator("body")).toHaveText(
            "You already submitted a claim for this item."
        );

        // Confirm that the second attempt did not create another record.
        const savedClaims = db.prepare(
            "SELECT id FROM claims WHERE item_id = ?"
        ).all(itemId);

        expect(savedClaims).toHaveLength(1);
    } finally {
        // Remove the test claim before removing its item.
        db.prepare("DELETE FROM claims WHERE item_id = ?").run(itemId);
        db.prepare("DELETE FROM items WHERE id = ?").run(itemId);
    }
});