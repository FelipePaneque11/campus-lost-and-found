function handleError(error, req, res, next) {
    // If the response has already started, Express must finish handling it.
    if (res.headersSent) {
        return next(error);
    }

    const status = error.status || 500;
    const message = status >= 500 ? "Something went wrong. Please try again." : "The request could not be processed.";

    console.error("Request failed:", req.method, req.path, status, error.message);
    return res.status(status).send(message);
}

module.exports = handleError;