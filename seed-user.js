//adding users to my db

const db = require("./database");
const argon2 = require("argon2");
const { randomBytes } = require("node:crypto");

async function createDemoStudent(username, role){
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if(existing){
        console.log(username + " already exists");
        return;
    }

    //create a random password so credentials arent hardcoded on github
    const password = randomBytes(12).toString("hex");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const insert = db.prepare(`
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, ?)    
    `);

    insert.run(username, passwordHash, role);
    console.log("Username: ", username);
    console.log("Demo Password: ", password);
}

async function seedUsers(){
    await createDemoStudent("demo-student", "student");
    await createDemoStudent("demo-moderator", "moderator");
}

seedUsers()
    .catch(function (error){
        console.error("Could not create demo users: ", error.message);
        process.exitCode = 1;
    }).finally(function (){
        db.close();
    })