//checks if student can enter a sql injection

const signIn = require("./sign-in")
const { test, expect } = require("@playwright/test");

test("the preview displays an item name as plain text", async function({ page }){
    await signIn(page);

    await page.getByLabel("Item name").fill("<b>USB charger</b>");
    await page.getByLabel("Where did you find it?").fill("Library");

    const preview = page.locator("#preview");

    await expect(preview).toHaveText("<b>USB charger</b> - Library");
    // The browser should not have created a bold element inside the preview.
    await expect(preview.locator("b")).toHaveCount(0);
})