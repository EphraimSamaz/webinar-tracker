# Deploy the webinar tracker yourself

This project can be deployed directly from this local folder. A Git push is not required.

## Before deploying

From the `webinar-tracker` folder, run:

```bash
npm ci
npm run check
npm run build
```

The build must create `public/index.html`, `public/ui.js`, `public/styles.css`, `public/assets/`, and `public/design-system/`. The generated `public/` folder is ignored by Git. `vercel.json` tells Vercel to run the same build and serve that folder.

In the **existing** `webinar-tracker` Vercel project, check **Settings → Environment Variables** for these Production values:

- `DATABASE_URL`: the Neon pooled PostgreSQL connection URI.
- `WEBINAR_ACCESS_KEY`: the access key users enter in the tracker.

The current Vercel API has already returned all 54 imported webinars with the local access key, so these settings were working at the time of preparation. Keep both values in Vercel's server-side settings; do not paste them into `config.js` or the Git repository.

## Deploy from this folder

```bash
npx vercel@latest login
npx vercel@latest link
npx vercel@latest deploy --prod
```

When `link` asks for a project, select the **existing `webinar-tracker` project** that owns `https://webinar-tracker.vercel.app/`. This writes an ignored `.vercel/` link locally. The production deploy command uploads the current local files and runs the build without pushing a commit.

After Vercel reports **Ready**, open `https://webinar-tracker.vercel.app/`. You should see the dashboard and its access-key prompt. Enter the key from your local `.env`. If the page is still missing, check that the deployment's Build Logs show `Static webinar dashboard built in public/` and that the project Output Directory is `public`.

If you prefer the Vercel dashboard, use **Deployments → Create Deployment** with the Git commit or branch that contains `vercel.json` and `scripts/build-static.cjs`. That method uses the linked Git repository; the CLI steps above use this local folder directly.
