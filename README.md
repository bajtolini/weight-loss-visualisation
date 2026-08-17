# weight-loss-visualisation

Tracks weigh-ins in `weights.txt` and plots them on a GitHub Pages page. New weigh-ins are added from the page's form and committed to this repo through the GitHub Contents API.

## Data format — `weights.txt`

```
date,weight,delta
2026-08-12,87.4,
2026-08-24,86.9,-0.5
```

- `date` — `YYYY-MM-DD`, ascending, unique
- `weight` — kg, one decimal
- `delta` — kg vs. the previous line, blank on the first line (recomputed on every save, so the file can be edited by hand)

## Hosting (once)

1. Push this repo to GitHub.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Open `https://<user>.github.io/weight-loss-visualisation/`.

Without a token the page is read-only (chart + table).

## Saving entries from the page (once per browser)

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate:
   - Repository access: *Only select repositories* → this repo
   - Permissions → Repository → **Contents: Read and write**
2. On the page click ⚙, paste the token, check `owner/repo`, **Save settings**.

The token is stored in the browser's `localStorage` only — never in the repo. Repeat per browser/phone.

## Running locally

```
python -m http.server 8000
```

Open http://localhost:8000/ (`file://` will not load `weights.txt`). Saving from a local page still commits to GitHub; `git pull` afterwards to update your local `weights.txt`.

## Tests

```
npm test
```

(equivalently `node --test`). Requires Node 20+ — `package.json` sets `"type": "module"`, so both `weights.js` and `test/weights.test.js` load as ES modules.
