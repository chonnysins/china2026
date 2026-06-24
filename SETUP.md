# Trips by Ronnie and Josh — photo backend setup

The site is now a **folder**, not a single file. The static page is `index.html`,
and live photo sharing is handled by one Netlify Function (`netlify/functions/photos.mjs`)
backed by **Netlify Blobs**. Everything is same-origin: if the site loads, uploads load.

## Folder contents
```
trip-site/
├─ index.html                  ← the site (open this in a browser to preview the page itself)
├─ netlify.toml                ← tells Netlify where the function lives
├─ package.json                ← declares the @netlify/blobs dependency
├─ SETUP.md                    ← this file
└─ netlify/functions/photos.mjs ← upload / list / serve photos
```

## Deploy — pick ONE

### Option A · Git (smoothest, auto-installs everything)
1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import from Git**, pick the repo, deploy.
   Netlify runs `npm install` and bundles the function automatically.

### Option B · Netlify CLI (one command, repeatable)
1. `npm install -g netlify-cli`
2. From inside this folder: `netlify deploy --prod`
   (first run will ask you to link/create a site)

### Option C · Drag-and-drop (Netlify Drop)
1. **Inside this folder run `npm install` once** — this creates `node_modules/`
   with `@netlify/blobs`, which drag-and-drop needs (it doesn't install for you).
2. Drag the **whole `trip-site` folder** onto https://app.netlify.com/drop
3. Re-deploy later by dragging the folder again.

## Required: set the shared pass-phrase
Uploads are gated by a secret word you and Ronnie share.
In Netlify → **Site configuration → Environment variables**, add:

```
UPLOAD_SECRET = whatever-word-you-both-agree-on
```

Then redeploy (or wait for the next function cold start). Until this is set,
every upload returns 401 and the app says "pass-phrase / UPLOAD_SECRET not set".

## Using it
- Click the **Add photos** button (bottom-right on the live site).
- Choose a destination, type your name, enter the pass-phrase, pick photos, Upload.
- Photos are downscaled to ~1600px / JPEG in the browser before sending, then
  appear in the top **Our snapshots** shuffle and on that destination's carousel.
- Carousels auto-shuffle every 3 seconds and pause on hover.

## Notes
- **Preview vs. live:** in Claude's in-app preview (and when you just double-click
  `index.html` locally) there is no function, so every gallery shows
  "No photos here yet" / "Couldn't load" — that's the intended graceful fallback.
  The page itself still works. Photos only work on the deployed Netlify site.
- **China reachability:** the upload API shares the site's domain, so it rises and
  falls with the site itself — adding it doesn't make the page less reachable.
  Test your live URL from inside China before relying on it, and prefer a custom
  domain over the bare `*.netlify.app` address for better odds through the firewall.
- **Bake-in fallback still works:** any photo you want guaranteed-visible no matter
  what, send to Claude to embed directly the old way.

## Install it on your phone (PWA)
The site is an installable app. On your Android phone, open the live URL in Chrome:
- Tap the **Install app** button (bottom-left), or use Chrome's menu → **Install app / Add to Home screen**.
- It gets its own icon and opens full-screen, no browser bars.

Once installed and opened at least once, the **static trip works offline** — itinerary,
bookings, day cards, maps, and any photos you've already viewed are cached, so they open
with no signal (planes, tunnels, dead zones behind the firewall). Uploading and hearting
still need a connection (those are shared and live on the backend); they fail gracefully
offline and work again once you're back online.

After you push an update, the app refreshes to the new version the next time it's opened
with a connection (occasionally one relaunch later).
