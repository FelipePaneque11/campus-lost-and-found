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

test("a signed-in session must submit its own form token", async function ({ page }) {
    await signIn(page);

    // These requests share the signed-in browser's session cookie.
    const url = "http://127.0.0.1:3000/logout";

    const missing = await page.request.post(url, { maxRedirects: 0 });
    expect(missing.status()).toBe(403);

    const incorrect = await page.request.post(url, {
        form: { csrfToken: "incorrect-token" },
        maxRedirects: 0
    });
    expect(incorrect.status()).toBe(403);

    // Both requests were rejected, so the student should still be signed in.
    await page.goto("http://127.0.0.1:3000/items/new");
    await expect(page.getByRole("button", { name: "Report item" })).toBeVisible();
});