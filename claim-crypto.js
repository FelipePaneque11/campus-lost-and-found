//This file has two functions. 
//encryptDetail() takes the student’s sentence and returns a string SQLite can store. 
//decryptDetail() takes that string and recovers the sentence.

const { randomBytes, createCipheriv, createDecipheriv } = require("node:crypto");

const keyHex = process.env.CAMPUS_CLAIM_KEY || "";

if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error("Set CAMPUS_CLAIM_KEY before starting the secure app.");
}

const key = Buffer.from(keyHex, "hex");

function encryptDetail(detail) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
        cipher.update(detail, "utf8"),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // Store the three pieces together in the existing SQLite TEXT column.
    return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptDetail(storedValue) {
    const [ivHex, tagHex, encryptedHex] = storedValue.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });

    decipher.setAuthTag(Buffer.from(tagHex, "hex"));

    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final()
    ]);

    return plaintext.toString("utf8");
}

module.exports = { encryptDetail, decryptDetail };