# weight-loss-visualisation — Design

**Date:** 2026-08-17
**Status:** Approved by athlete (design review, this date)
**Scope:** New standalone project. Static GitHub Pages site tracking weigh-ins in a text file, with a chart and a form that commits new entries via the GitHub API.

## Purpose

Track weight loss across the 2026/27 body-composition iterations (see triathlon-planning spec `2026-08-17-iteration2-bodycomp-year-plan-design.md`): three parameters per weigh-in (date, weight, delta vs. previous), stored in a plain text file, visualised on a page viewable from GitHub.

## Files

| File | Role |
|---|---|
| `index.html` | Single page: form + chart + GitHub-API writer. Vanilla JS, inline SVG chart, no build, no dependencies. |
| `weights.txt` | The data. CSV with header `date,weight,delta`. One line per weigh-in, sorted by date ascending. `delta` = weight − previous line's weight, blank on the first line. Example: `2026-08-12,87.4,` then `2026-08-24,86.9,-0.5`. |
| `README.md` | What it is, enabling GitHub Pages (main branch, root), creating the fine-grained token, running locally. |

Hosting: GitHub Pages from `main` root.

## Read path

On load the page fetches `weights.txt` (cache-busted query string), parses it, renders chart + table. Works with no token — this is the read-only "view from GitHub" mode.

## Chart

- Inline SVG, responsive width.
- x = date, y = kg; y-axis fixed **68–90**.
- One point per weigh-in, joined by a line.
- Two dotted horizontal reference lines, labelled **87.4** and **70**.
- Hover/tap a point → tooltip `date · weight kg · delta`.
- Below the chart: table of entries, newest first, delta coloured (negative green, positive red, first entry neutral).

## Form

- Date: `<input type="date">`, default today; invalid if in the future or already present in the file.
- Weight: `<input type="number" step="0.1" min="40" max="150">`; invalid outside 40–150 or with more than one decimal.
- Delta: computed live, read-only, "−0.5 kg vs 2026-08-17" (or "first entry"). Delta is computed against the nearest earlier date, since a back-dated entry may be inserted mid-file.
- Save button, disabled until valid and a token is configured.

## Write path (Save)

1. GET `https://api.github.com/repos/{owner}/{repo}/contents/weights.txt` → fresh content + `sha`.
2. Parse, insert the new line in date order, recompute **all** deltas (so a hand-edited file stays consistent), serialise.
3. PUT the same endpoint with base64 content, `sha`, message `weigh-in YYYY-MM-DD: W`.
4. Success → redraw from the new content, clear the weight field. Failure (network, 409 sha mismatch, 401/403) → error banner, form untouched, nothing lost. On 409 the user simply presses Save again (step 1 refetches).

## Configuration

Small ⚙ panel: fine-grained PAT (Contents: read & write, this repo only) and `owner/repo` (pre-filled from `location.hostname`/`pathname` when served from `*.github.io/<repo>/`, editable). Both stored in `localStorage` only — never in the repo. Token field is `type="password"`.

## Local run

`python -m http.server` in the project folder and open `http://localhost:8000` (fetch of `weights.txt` does not work over `file://`). Saving from local also works (it talks to the GitHub API, not the local file); after saving, `git pull` to update the local `weights.txt`.

## Explicit non-goals

- No target-trajectory line, no body-fat / muscle columns (format is additive-friendly if wanted later).
- No backend, no framework, no build step, no chart library.
- No authentication beyond the user's own PAT.

## Testing

- Pure functions (`parse`, `serialise`, `insertAndRecompute`, `validate`) live in a separate `weights.js` loaded by `index.html`, so they can be exercised by a small Node test file (`test/weights.test.js`, `node --test`) without a browser: parse↔serialise round trip; delta recompute after mid-file insert; validation of future date, duplicate date, out-of-range and 2-decimal weights.
- Manual: open locally, confirm chart with reference lines; save one entry against the real repo; reload from GitHub Pages.
