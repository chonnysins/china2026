# China Winter Trip — Itinerary Site

A single, self-contained interactive trip planner (itinerary, budgets, maps, bookings).
No build step, no backend — just one `index.html` file.

## Deploy to GitHub Pages

### Option A — straight from the GitHub website (no tools needed)
1. Sign in to github.com → click **New repository**. Name it anything (e.g. `china-trip`), set it **Public**, click **Create**.
2. On the new repo page, click **uploading an existing file**.
3. Drag in **`index.html`** (and optionally **`.nojekyll`**), then click **Commit changes**.
4. Go to **Settings → Pages**.
5. Under **Build and deployment → Source**, choose **Deploy from a branch**.
6. Set branch to **`main`** and folder to **`/ (root)`**, then **Save**.
7. Wait ~1 minute. Your site goes live at:
   `https://<your-username>.github.io/<repo-name>/`

### Option B — with Git
```bash
git init
git add index.html .nojekyll
git commit -m "Add trip site"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
# then enable Pages in Settings → Pages (branch: main, folder: /root)
```

## Updating it later
Replace `index.html` with the new version (re-upload on the website, or commit + push).
Pages redeploys automatically within a minute or so.

## Good to know
- **`.nojekyll`** tells GitHub Pages to skip its Jekyll build and serve the file as-is.
  Not strictly required here, but harmless and recommended.
- The page loads a few things over the internet at view time: map tiles (Carto/OpenStreetMap),
  fonts (Google Fonts), and destination photos (Wikimedia). These work fine over GitHub Pages' HTTPS.
- **In mainland China**, Google Fonts and Wikimedia can be blocked — the site still works, but
  fonts may fall back and some photos may not load without a VPN. (The maps use OpenStreetMap,
  which is more reliable there.)
- The link is public but unguessable. Don't put passwords or passport numbers in it.
