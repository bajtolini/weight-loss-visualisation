# weight-loss-visualisation

Tracks weigh-ins in `weights.txt` and plots them on a GitHub Pages page. New weigh-ins are added from the page's form and committed to this repo through the GitHub Contents API.

The chart also shows a bright-red **projected line**: the assumed course of losing 0.5 kg per week, starting from the first weigh-in's weight and prorated by the actual day gaps between measurements (0.5/7 kg per day). It has exactly one point per weigh-in — a new point appears only when a new entry is saved — and the same values, rounded to two decimals, appear in the table's **Expected** column (after Delta). Expected values are derived at render time and never stored in `weights.txt`.

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

**Caveat:** this page is served from `https://<user>.github.io/...`, and `localStorage` is scoped per origin — so the token sits in `localStorage` under the `<user>.github.io` origin, which is *shared by every GitHub Pages site published under that account*, not just this repo. That's why the token must be scoped to this single repo with **Contents: Read and write** only (no other permissions, no other repos). Set an expiry when you generate it (e.g. 1 year) and rotate it then. Anyone with access to that browser profile (or another GitHub Pages site under the same account, if it were ever compromised) could read and use it, so treat it like any other credential.

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
