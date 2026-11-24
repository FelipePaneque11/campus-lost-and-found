//insert mock data into the db for testing the app

const db = require("./database");

db.exec(`
    INSERT INTO items (id, name, location)
    VALUES
        (1, 'Black headphones', 'Library'),
        (2, 'Blue water bottle', 'Computer lab')
    ON CONFLICT(id) DO NOTHING
`);

db.close();