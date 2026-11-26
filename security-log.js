const db = require("./database");

function logSecurityEvent(eventType) {
    const insert = db.prepare(`
        INSERT INTO security_events (event_type)
        VALUES (?)
    `);

    insert.run(eventType);
}

function recordFailedLogin() {
    logSecurityEvent("login_failed");

    const recent = db.prepare(`
        SELECT COUNT(*) AS total
        FROM security_events
        WHERE event_type = 'login_failed'
          AND created_at >= datetime('now', '-5 minutes')
    `).get();

    // Alert when the count reaches three, rather than on every later failure.
    if (recent.total === 3) {
        logSecurityEvent("repeated_login_failures");
        console.warn("Security alert: three failed sign-ins within five minutes.");
    }
}

module.exports = { logSecurityEvent, recordFailedLogin };