# Logic Runner deployment guide

## Which package should I use?

- Use the **Vercel/GitHub source package** if you want the easiest public
  deployment, automatic updates, or access to the editable source.
- Use the **static-upload package** if you already have cPanel, shared hosting,
  an Apache/Nginx server, or a subdomain with a document-root folder.

The game runs entirely in the visitor's browser. There is no database, backend,
API key, environment variable, or separate audio file to configure.

---

# Recommended: GitHub to Vercel

This is the easiest long-term option. GitHub stores the code and Vercel
publishes it. Later, every change committed to the main GitHub branch can
trigger a fresh deployment automatically.

## Part 1 — unzip the source

1. Download `Logic-Runner-Vercel-GitHub-Source-v6.zip`.
2. In Windows File Explorer, right-click the ZIP.
3. Click **Extract All...**
4. Click **Extract**.
5. Open the extracted folder. You should see `app`, `public`, `package.json`,
   and this guide. Those are the files that belong in GitHub.

## Part 2 — put the files on GitHub

1. Go to <https://github.com/> and sign in or create an account.
2. Click the **+** button in the top-right corner.
3. Click **New repository**.
4. Repository name: `logic-runner`.
5. Choose **Private** if only you should see the source, or **Public** if anyone
   may see it. Either option can still produce a public website.
6. Leave **Add a README**, **.gitignore**, and **license** unchecked. The package
   already contains the needed files.
7. Click **Create repository**.
8. On the empty repository page, click **uploading an existing file**.
   If that link is not visible, use **Add file → Upload files**.
9. Drag every file and folder from inside the extracted source folder into the
   browser upload area. Do not upload the ZIP itself.
10. Wait until all filenames appear.
11. In the commit box, type `Initial Logic Runner deployment`.
12. Click **Commit changes**.

Check the result: the repository's top level should directly contain `app`,
`public`, and `package.json`. They should not be buried inside a second
`Logic-Runner...` folder.

## Part 3 — deploy the GitHub repository on Vercel

1. Go to <https://vercel.com/> and click **Sign Up**.
2. Choose **Continue with GitHub** and authorize Vercel.
3. In Vercel, click **Add New... → Project**.
4. Find the `logic-runner` repository and click **Import**.
5. Vercel should identify the framework as **Next.js**.
6. Leave **Root Directory** as `./`.
7. Do not add environment variables; this game has none.
8. Leave the build and output settings on their automatic defaults.
9. Click **Deploy**.
10. Wait for the success screen, then click the preview image or **Visit**.

Vercel gives you a public address similar to:

```text
https://logic-runner-yourname.vercel.app
```

## Part 4 — update the live game later

For a simple browser-only update:

1. Open the GitHub repository.
2. Use **Add file → Upload files**.
3. Upload the changed files using the same folder structure.
4. Commit the changes to the `main` branch.
5. Open the Vercel project and watch the new deployment finish.

For frequent editing, install GitHub Desktop and clone the repository instead
of repeatedly uploading through the browser.

## Part 5 — connect your own domain

If `3feed.ir` already hosts another site, do not replace its root-domain DNS.
Use a subdomain such as `game.3feed.ir` so the existing site remains untouched.

1. Open the Logic Runner project in Vercel.
2. Open **Settings → Domains**.
3. Enter the domain or subdomain you want, for example `game.3feed.ir`.
4. Click **Add**.
5. Vercel shows the exact DNS record required.
6. Open the DNS panel at the company that manages the domain.
7. Create the exact record Vercel displayed. Do not guess the record.
8. Return to Vercel and wait for the domain status to become valid.

DNS changes can take time to spread. Vercel handles HTTPS after the domain is
verified.

---

# Alternative: upload the prebuilt static site

Use `Logic-Runner-Static-Upload-v6.zip` for cPanel or another conventional web
host. No Node.js is required on that server.

## cPanel / shared-hosting steps

1. Download and unzip `Logic-Runner-Static-Upload-v6.zip`.
2. Open the extracted folder.
3. Inside it, open the `public_html` folder. This folder contains `index.html`,
   `_next`, `assets`, and `favicon.svg`.
4. Sign in to your hosting control panel.
5. Open **File Manager**.
6. Open the document root for the domain:
   - the main site often uses `public_html`;
   - a subdomain may use a separate folder shown in the subdomain settings.
7. Back up any existing site before replacing files.
8. Upload everything **inside** the package's `public_html` folder.
9. Make sure `index.html` is directly inside the hosting document root, not
   inside an extra nested folder.
10. Visit the domain and test the intro, audio toggle, missions, city-fall
    ending, logo links, LinkedIn link, and Singularity exit.

This build expects to live at a domain or subdomain root, such as
`game.3feed.ir`. A root or subdomain is easier than a path such as
`example.com/logic-runner/`.

## Nginx, Apache, or a VPS

Upload the contents of the package's `public_html` folder to the directory your
web server uses for that domain. Configure the domain's document root to that
directory. Because this is a static site, the server only needs to return the
files; it does not run Node.js.

---

# Run the editable source locally on Windows

1. Install the **LTS** version of Node.js from <https://nodejs.org/>.
2. Restart File Explorer after installation.
3. Open the extracted Vercel/GitHub source folder.
4. Double-click `START_LOCAL_WINDOWS.bat`.
5. The first run downloads the project packages and may take a few minutes.
6. Your browser opens at <http://localhost:3000>.
7. Keep the black window open while playing.
8. Press `Ctrl+C` in that window to stop the local server.

If Windows SmartScreen appears, confirm that you extracted this package and
choose the option to run the batch file. You can also avoid the batch file:
open Terminal in the folder and run:

```text
npm ci
npm run dev
```

Then visit <http://localhost:3000>.

## Build a fresh static copy yourself

Double-click `BUILD_STATIC_WINDOWS.bat`. When it finishes, Windows opens the
generated `out` folder. Upload everything inside `out` to your host's document
root.

---

# Common problems

## Vercel says it cannot find `package.json`

The source was uploaded one folder too deep. In GitHub, `package.json` must be
visible at the repository's top level beside `app` and `public`.

## The website loads but images or styling are missing

For conventional hosting, check that `_next`, `assets`, and `favicon.svg` were
uploaded beside `index.html`. Do not rename those folders.

## The background music is silent at first

Browsers commonly require a click or tap before starting audio. Enter the game
and use the on-screen audio control.

## A custom domain is not working yet

Compare the DNS record with the exact record shown by Vercel and allow time for
DNS changes to spread. If the root domain already hosts another site, use a
subdomain instead.

## Local Windows start says Node.js is missing

Install the LTS version from <https://nodejs.org/>, close and reopen File
Explorer, and double-click `START_LOCAL_WINDOWS.bat` again.
