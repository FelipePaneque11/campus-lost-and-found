const { expect } = require("@playwright/test");

async function signIn(page) {
    const password = process.env.CAMPUS_TEST_PASSWORD;

    if (!password) {
        throw new Error("Set CAMPUS_TEST_PASSWORD in the test terminal first.");
    }

    await page.goto("http://127.0.0.1:3000/login");
    await page.getByLabel("Username").fill("demo-student");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("http://127.0.0.1:3000/items/new");
}

module.exports = signIn;