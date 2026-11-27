# Campus Lost and Found — Insecure Version

This branch contains the intentionally vulnerable version of my Secure Application Programming project. It supports the same main workflow as the secure version so the implementations can be compared.

The examples cover SQL injection, reflected XSS, DOM-based XSS, stored XSS, and readable storage of private ownership details. Run this version locally using fictional demonstration data.

## Requirements

- Node.js 24, developed using version 24.11.0.
- npm, included with Node.js.
- Git.
- Windows PowerShell and a web browser.

SQLite is included with Node.js. The application creates its tables automatically.

## 1. Download and install

For a new local copy:

```powershell
git clone --branch insecure https://github.com/FelipePaneque11/campus-lost-and-found.git
cd campus-lost-and-found
npm.cmd ci
```

If the repository is already on your computer, stop the running server and use:

```powershell
git switch insecure
npm.cmd ci
```

Run all commands from the folder containing `package.json`.

## 2. Create sample items and accounts

```powershell
node seed.js
node seed-user.js
```

`seed.js` inserts the sample headphones and water bottle.

`seed-user.js` creates:

| Username | Role |
|---|---|
| `demo-student` | Reports found items and submits claims. |
| `demo-moderator` | Reviews claims and approves or rejects them. |

The script prints a randomly generated password for each newly created account. Save both passwords privately.

Existing accounts are preserved. Running the script again displays an “already exists” message and keeps the original passwords. Existing passwords cannot be retrieved from the stored hashes.

This branch uses its own database, so use the passwords generated while running the seed script on this branch.

## 3. Start the application

```powershell
node index.js
```

Open:

http://127.0.0.1:3000/

The server listens on `127.0.0.1`, port `3000`. Stop it with `Ctrl+C`.

The insecure version stores claim details directly in SQLite. Its startup requires no `CAMPUS_CLAIM_KEY` configuration.

## 4. Use the application

1. Browse or search the public listings.
2. Open `/login` and sign in as `demo-student`.
3. Report a found item using its name and location.
4. Return to the home page and select **Claim this item**.
5. Submit a fictional identifying detail.
6. In a private browser window, sign in as `demo-moderator`.
7. Open `/moderator/claims` and approve or reject the claim.

Student and moderator permissions are retained on this branch. The intentional flaws are in specific parts of the input handling, output rendering, and data storage.

## 5. Database and sessions

The database file is created in the project folder:

```text
campus.sqlite
```

Private ownership details are stored in readable text for comparison with the secure version’s encrypted storage.

Login uses an automatically generated session secret and the `campus.sid` cookie. Sessions are held in memory, so restarting the server requires users to sign in again.

The forms still use CSRF tokens. These are generated and submitted automatically by the application.

## 6. Run the tests

Keep the server running and open a second PowerShell terminal in the project folder.

Install the test browser on first setup:

```powershell
npx.cmd playwright install chromium
```

Set the student password generated for the insecure database:

```powershell
$studentCredential = Get-Credential -UserName "demo-student" -Message "Enter the insecure demo-student password"
$env:CAMPUS_TEST_PASSWORD = $studentCredential.GetNetworkCredential().Password
```

Run:

```powershell
npx.cmd playwright test --workers=1 --reporter=list
```

To run one file:

```powershell
npx.cmd playwright test tests/search.spec.js --workers=1
```

Some tests assert the behaviour expected from the secure implementation. These can fail against the deliberately vulnerable code, including tests for apostrophes in search and plain-text rendering. Record the actual failure and its cause when comparing branches.

## Troubleshooting

| Problem | What to check |
|---|---|
| Incorrect username or password | Use the credentials generated for this branch’s database. |
| Seed script says the account already exists | Use the password saved during the initial creation. |
| Invalid form token | Reopen the form, especially after restarting the server. |
| Tests cannot find the student password | Set `CAMPUS_TEST_PASSWORD` in the terminal running the tests. |
| Port 3000 is already in use | Stop the other application instance first. |