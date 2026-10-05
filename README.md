# Webinar tracker

The dashboard reads and updates Neon PostgreSQL through `api/webinars.mjs`. The browser never receives the database connection string. An access key protects all API operations.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to the pooled connection URI from Neon and `WEBINAR_ACCESS_KEY` to a random value of at least 24 characters. Keep `.env` out of Git.
3. Run `schema.sql` on a new Neon database, for example in the Neon SQL editor. The original Supabase cluster backup is **not** a schema script for Neon; it includes Supabase system roles and extensions.
4. To import the existing webinar rows from the local backup, run `node --env-file=.env scripts/import-backup.cjs db_cluster-24-08-2026@06-11-55.backup.gz`. The import preserves IDs and ignores rows already present.
5. Run `npm start` and open `http://localhost:3000`. Enter `WEBINAR_ACCESS_KEY` when prompted.

The local `.env` and backup are ignored by Git. The database connection and historical import have already been completed for the current Neon database.

## Deploy on Vercel

Import this repository into Vercel with the **Other** framework preset and the repository root as the project root. No build command or output directory is needed. Vercel serves the static dashboard and `api/webinars.mjs` from the same domain.

In the Vercel project settings, configure these server-side environment variables:

- `DATABASE_URL`: the pooled Neon connection URI, including its SSL and channel binding parameters.
- `WEBINAR_ACCESS_KEY`: the same secret users enter in the dashboard. Use at least 24 random characters.

Leave `config.js` unchanged. The dashboard then calls the API on the same Vercel domain. Redeploy after setting the environment variables. Open the Vercel URL and enter `WEBINAR_ACCESS_KEY` to see the imported webinars.

If the dashboard stays on GitHub Pages instead, set `ALLOWED_ORIGIN` in Vercel to its exact origin (for example `https://yourname.github.io`) and set `window.WEBINAR_API_BASE` in `config.js` to the Vercel origin. The database secret still belongs only in Vercel.

The dashboard stores the access key only in the current browser tab's session storage. Share the access key with authorized users through a private channel. Vercel's environment variables should use the same values as the local `.env`; never add the connection string or access key to `config.js`, HTML, or GitHub Pages secrets that are rendered into client code.

The previous Supabase keep-alive workflow is removed. The old `app.js`, `archive-app.js`, and `supabase.js` files are legacy files and are not loaded by `index.html`.
