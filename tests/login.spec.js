const { test, expect } = require("@playwright/test");
const signIn = require("./sign-in");

test("reporting requires login and signing out removes access", async function ({ page }) {
    const home = "http://127.0.0.1:3000";

    await page.goto(home + "/items/new");
    await expect(page).toHaveURL(home + "/login");

    await signIn(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(home + "/");

    await page.goto(home + "/items/new");
    await expect(page).toHaveURL(home + "/login");

    // Check the route that writes to SQLite as well as the page with the form.
    const response = await page.request.post(home + "/items", {
        form: {},
        maxRedirects: 0
    });

    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toBe("/login");
});