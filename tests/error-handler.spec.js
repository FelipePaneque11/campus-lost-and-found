const { test, expect } = require("@playwright/test");
const handleError = require("../error-handler");

test("an unexpected error returns a generic message to the visitor", function () {
    const error = new Error("Internal detail: database connection failed");
    const req = { method: "GET" };

    // Stand in for Express so we can inspect the status and response text.
    const res = {
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(message) {
            this.body = message;
        }
    };

    handleError(error, req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toBe("Something went wrong. Please try again.");
});