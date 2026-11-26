const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const db = require("../database");
const signIn = require("./sign-in");

async function signInModerator(page) {
    const password = process.env.CAMPUS_TEST_MODERATOR_PASSWORD;

    if (!password) {
        throw new Error("Set CAMPUS_TEST_MODERATOR_PASSWORD first.");
    }

    // Remove the student's session before signing in as moderator.
    await page.context().clearCookies();
    await page.goto("http://127.0.0.1:3000/login");

    await page.getByLabel("Username").fill("demo-moderator");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(
        "http://127.0.0.1:3000/moderator/claims"
    );
}

// Run the workflow once for approval and once for rejection.
for (const decision of ["approved", "rejected"]) {
    test("a moderator can mark a claim as " + decision, async function ({ page }) {
        const itemName = "Test headphones " + randomUUID();
        const detail = "There is a green sticker inside the case.";

        const result = db.prepare(
            "INSERT INTO items (name, location) VALUES (?, ?)"
        ).run(itemName, "Library");

        const itemId = Number(result.lastInsertRowid);

        // Only the approval test will create a second student.
        let secondStudentId = null;

        try {
            // Submit a claim using the student account.
            await signIn(page);
            await page.goto(
                "http://127.0.0.1:3000/items/" + itemId + "/claim"
            );

            await page.getByLabel("How can you identify this item?").fill(detail);
            await page.getByRole("button", { name: "Submit claim" }).click();

            await expect(page.locator("body")).toHaveText(
                "Claim submitted. It is pending moderator review."
            );

            await signInModerator(page);

            // Find the card belonging to this test's unique item.
            const card = page.locator("#claims section").filter({
                hasText: itemName
            });

            // The moderator should see the decrypted identifying detail.
            await expect(card.locator("p")).toHaveText(detail);

            let buttonName = "Approve";
            if (decision === "rejected") {
                buttonName = "Reject";
            }

            await card.getByRole("button", { name: buttonName }).click();

            // A reviewed claim should disappear from the pending queue.
            await expect(card).toHaveCount(0);

            const claim = db.prepare(
                "SELECT status FROM claims WHERE item_id = ?"
            ).get(itemId);

            expect(claim.status).toBe(decision);

            // After approval, another claim for this item must not be approved.
            if (decision === "approved") {
                const student = db.prepare(
                    "SELECT password_hash FROM users WHERE username = ?"
                ).get("demo-student");

                // Create a temporary student for the competing claim.
                const secondStudent = db.prepare(`
                    INSERT INTO users (username, password_hash, role)
                    VALUES (?, ?, ?)
                `).run(
                    "test-student-" + randomUUID(),
                    student.password_hash,
                    "student"
                );

                secondStudentId = Number(secondStudent.lastInsertRowid);

                // Reuse the encrypted test detail for a second pending claim.
                const secondClaim = db.prepare(`
                    INSERT INTO claims (item_id, user_id, identifying_detail)
                    SELECT item_id, ?, identifying_detail
                    FROM claims
                    WHERE item_id = ?
                `).run(secondStudentId, itemId);

                const secondClaimId = Number(secondClaim.lastInsertRowid);

                // Get a valid token for the moderator's session.
                await page.goto("http://127.0.0.1:3000/items/new");

                const csrfToken = await page.locator(
                    'input[name="csrfToken"]'
                ).first().inputValue();

                // Attempt to approve the competing claim.
                const response = await page.request.post(
                    "http://127.0.0.1:3000/moderator/claims/" +
                        secondClaimId + "/review",
                    {
                        form: {
                            decision: "approved",
                            csrfToken: csrfToken
                        },
                        maxRedirects: 0
                    }
                );

                expect(response.status()).toBe(409);

                // The competing claim must remain pending.
                const secondSavedClaim = db.prepare(
                    "SELECT status FROM claims WHERE id = ?"
                ).get(secondClaimId);

                expect(secondSavedClaim.status).toBe("pending");

                // Exactly one claim should be approved for this item.
                const approved = db.prepare(`
                    SELECT COUNT(*) AS total
                    FROM claims
                    WHERE item_id = ? AND status = 'approved'
                `).get(itemId);

                expect(approved.total).toBe(1);
            }
        } finally {
            // Remove claims before their item and student records.
            db.prepare("DELETE FROM claims WHERE item_id = ?").run(itemId);
            db.prepare("DELETE FROM items WHERE id = ?").run(itemId);

            if (secondStudentId !== null) {
                db.prepare("DELETE FROM users WHERE id = ?").run(secondStudentId);
            }
        }
    });
}