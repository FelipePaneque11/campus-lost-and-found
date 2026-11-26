# Campus Lost and Found

A local web application for my Secure Application Programming assignment. Students can report found items and submit ownership claims. Moderators can review the identifying details and approve or reject claims.

## Run the application

I developed the project on Windows using PowerShell and Node.js 24.11.0. SQLite is included in this version of Node.js.

Clone the repository and choose the version you want to run:

```powershell
git clone https://github.com/FelipePaneque11/campus-lost-and-found.git
cd campus-lost-and-found
git switch secure
npm.cmd ci
```

For the insecure version, use `git switch insecure` before installing the dependencies.

### Set up the encryption key on the secure branch

The secure version encrypts private claim details before saving them. Run this in the PowerShell terminal where you will start the server. It reuses your saved key or generates one on first use.

```powershell
$key = [Environment]::GetEnvironmentVariable("CAMPUS_CLAIM_KEY", "User")
if (-not $key) {
    $key = node -p "require('node:crypto').randomBytes(32).toString('hex')"
    [Environment]::SetEnvironmentVariable("CAMPUS_CLAIM_KEY", $key, "User")
}
$env:CAMPUS_CLAIM_KEY = $key
```

Keep the same key to read existing encrypted claims. Skip this step on the insecure branch.

### Create the sample data and start the server

```powershell
node seed.js
node seed-user.js
node index.js
```

Open http://127.0.0.1:3000. The first seed script adds two found items. The second creates `demo-student` and `demo-moderator` and prints a password for each newly created account. Save those passwords for your local demo. Running the script again keeps existing accounts and passwords.

The branches use separate databases. The secure version saves `campus-lost-and-found-secure.sqlite` in your Windows user folder. The insecure version saves `campus.sqlite` in the project folder. Seed each version the first time you run it.

### Try the main workflow

1. Browse the home page and search for `bottle`.
2. Sign in as `demo-student`. Open the home page, choose **Claim this item**, and submit a fictional identifying detail.
3. In a private browser window, sign in as `demo-moderator`. Open the review queue and approve or reject the claim.

### Run the browser tests

Leave the server running. Open a second PowerShell terminal in the project folder and enter the student password for the branch being tested:

```powershell
$credential = Get-Credential -UserName "demo-student" -Message "Enter the local demo student password"
$env:CAMPUS_TEST_PASSWORD = $credential.GetNetworkCredential().Password
npx.cmd playwright install chromium
npx.cmd playwright test
```

Press Ctrl+C in the server terminal to stop the application.