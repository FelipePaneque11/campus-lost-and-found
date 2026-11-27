# Campus Lost and Found

This project was developed for my Secure Application Programming assignment. It compares secure and intentionally vulnerable implementations of a small lost and found application.

Students can browse found items, report an item, and submit a private ownership claim. Moderators can review claims and approve or reject them.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Original development baseline and project overview. |
| `secure` | Application with input handling, access controls, CSRF protection, session management, encrypted claim storage, security headers, and logging. |
| `insecure` | Application containing deliberate vulnerabilities for the assignment comparison. |

## Running the project

Use Node.js 24 and Windows PowerShell. Clone the repository:

```powershell
git clone https://github.com/FelipePaneque11/campus-lost-and-found.git
cd campus-lost-and-found
```

Choose a version:

```powershell
git switch secure
```

or:

```powershell
git switch insecure
```

Follow the README on the selected branch for dependency installation, database setup, demo account creation, startup, and testing.

- [Secure configuration manual](https://github.com/FelipePaneque11/campus-lost-and-found/blob/secure/README.md)
- [Insecure configuration manual](https://github.com/FelipePaneque11/campus-lost-and-found/blob/insecure/README.md)

Each version uses a separate database. The secure version also requires a persistent encryption key. Demo passwords are generated locally by `seed-user.js` when each account is first created.

Stop the running Node server before switching branches. Both versions use http://127.0.0.1:3000/.

## Main development baseline

To run the earlier application stored on `main`:

```powershell
npm.cmd ci
node seed.js
node index.js
```

Open http://127.0.0.1:3000/. The complete student and moderator workflows are available on the `secure` and `insecure` branches.