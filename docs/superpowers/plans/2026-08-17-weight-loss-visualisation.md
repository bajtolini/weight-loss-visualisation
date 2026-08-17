# weight-loss-visualisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static GitHub Pages site that plots weigh-ins from `weights.txt` and lets the athlete add a new weigh-in from a form that commits to the repo via the GitHub Contents API.

**Architecture:** Pure data logic (parse/serialise/insert/validate) in `weights.js` as an ES module shared by the browser page and Node tests. `index.html` holds the UI: form, inline-SVG chart, entries table, ⚙ config panel, and the GitHub API read/write. Data lives in `weights.txt` (CSV `date,weight,delta`) in the same repo.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), inline SVG, GitHub Contents API, `node --test` (Node ≥ 18; machine has v26). No build, no dependencies.

## Global Constraints

- No framework, no chart library, no build step, no npm dependencies (spec "Explicit non-goals").
- `weights.txt` format: header `date,weight,delta`; lines `YYYY-MM-DD,<weight>,<delta|blank>`; sorted ascending by date; delta = weight − previous line's weight, blank on first line; weights and deltas printed with exactly one decimal (`87.4`, `-0.5`, `0.0`).
- Chart: y-axis fixed 68–90; dotted reference lines at 87.4 and 70, labelled.
- Weight valid range 40–150 kg, at most one decimal. Date not in the future, not a duplicate.
- Token and `owner/repo` live only in `localStorage`; token field is `type="password"`.
- Commit message on save: `weigh-in YYYY-MM-DD: W`.
- Never `git push` — the athlete pushes personally.
- Commit messages: no AI attribution trailers.
- Repo root: local clone (already `git init`-ed, branch `main`, spec committed).

---

## File structure

| File | Responsibility |
|---|---|
| `weights.js` | Pure functions: `parseWeights`, `serialiseWeights`, `insertWeighIn`, `recomputeDeltas`, `validateEntry`, `formatKg`, `todayISO`. No DOM, no fetch. |
| `test/weights.test.js` | `node --test` unit tests for `weights.js`. |
| `index.html` | Page: markup + CSS + UI module script that imports `weights.js`; chart rendering (`renderChart`), table (`renderTable`), form wiring, config panel, GitHub API read/write (`ghGet`, `ghPut`). |
| `weights.txt` | Data file, seeded with the 12-08-2026 lab weigh-in. |
| `README.md` | Purpose, Pages setup, token setup, local run, data format. |
| `.gitignore` | `node_modules/` (defensive), `.DS_Store`. |

---

### Task 1: Data module — parse & serialise

**Files:**
- Create: `weights.js`
- Create: `test/weights.test.js`
- Create: `.gitignore`

**Interfaces:**
- Produces:
  - `parseWeights(text: string): Array<{date: string, weight: number, delta: number|null}>` — ignores header line and blank lines; throws `Error("Bad line N: ...")` on malformed lines.
  - `serialiseWeights(entries): string` — header + one line per entry, `\n`-terminated, one-decimal formatting.
  - `formatKg(n: number|null): string` — `n.toFixed(1)`, `""` for null.

- [ ] **Step 1: Write the failing tests**

`test/weights.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeights, serialiseWeights, formatKg } from '../weights.js';

const SAMPLE = 'date,weight,delta\n2026-08-12,87.4,\n2026-08-24,86.9,-0.5\n';

test('parseWeights reads header-less rows into entries', () => {
  assert.deepEqual(parseWeights(SAMPLE), [
    { date: '2026-08-12', weight: 87.4, delta: null },
    { date: '2026-08-24', weight: 86.9, delta: -0.5 },
  ]);
});

test('parseWeights tolerates blank lines and CRLF', () => {
  const crlf = 'date,weight,delta\r\n2026-08-12,87.4,\r\n\r\n';
  assert.deepEqual(parseWeights(crlf), [{ date: '2026-08-12', weight: 87.4, delta: null }]);
});

test('parseWeights throws on malformed line', () => {
  assert.throws(() => parseWeights('date,weight,delta\nnot-a-date,87.4,\n'), /Bad line 2/);
  assert.throws(() => parseWeights('date,weight,delta\n2026-08-12,abc,\n'), /Bad line 2/);
});

test('serialiseWeights round-trips and formats one decimal', () => {
  const entries = parseWeights(SAMPLE);
  assert.equal(serialiseWeights(entries), SAMPLE);
  assert.equal(serialiseWeights([{ date: '2026-08-12', weight: 87, delta: null }]),
    'date,weight,delta\n2026-08-12,87.0,\n');
});

test('formatKg', () => {
  assert.equal(formatKg(87.4), '87.4');
  assert.equal(formatKg(-0.5), '-0.5');
  assert.equal(formatKg(0), '0.0');
  assert.equal(formatKg(null), '');
});
```

`.gitignore`:
```
node_modules/
.DS_Store
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `node --test`
Expected: FAIL — `Cannot find module '../weights.js'`.

- [ ] **Step 3: Implement `weights.js`**

```js
// weights.js — pure data logic for weight-loss-visualisation. No DOM, no fetch.

export const HEADER = 'date,weight,delta';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatKg(n) {
  return n === null || n === undefined ? '' : n.toFixed(1);
}

export function parseWeights(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line === HEADER) return;
    const parts = line.split(',');
    const [date, weightStr, deltaStr = ''] = parts;
    const weight = Number(weightStr);
    const delta = deltaStr.trim() === '' ? null : Number(deltaStr);
    if (parts.length < 2 || parts.length > 3 || !DATE_RE.test(date) ||
        !Number.isFinite(weight) || (delta !== null && !Number.isFinite(delta))) {
      throw new Error(`Bad line ${i + 1}: ${raw}`);
    }
    entries.push({ date, weight, delta });
  });
  return entries;
}

export function serialiseWeights(entries) {
  const rows = entries.map(e => `${e.date},${formatKg(e.weight)},${formatKg(e.delta)}`);
  return [HEADER, ...rows].join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: 5 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add weights.js test/weights.test.js .gitignore
git commit -m "Add weights data module: parse, serialise, formatKg"
```

---

### Task 2: Data module — insert, recompute deltas, validate

**Files:**
- Modify: `weights.js`
- Modify: `test/weights.test.js`

**Interfaces:**
- Consumes: `parseWeights`, `serialiseWeights` from Task 1.
- Produces:
  - `recomputeDeltas(entries): entries` — returns a NEW array sorted by date asc with deltas recomputed (first = null, others = weight − previous weight, rounded to 1 decimal).
  - `insertWeighIn(entries, {date, weight}): entries` — returns new array with the entry inserted, sorted, deltas recomputed. Throws on duplicate date.
  - `validateEntry({date, weight}, entries, today: string): string[]` — array of human-readable error strings; empty = valid.
  - `previewDelta(entries, {date, weight}): {delta: number|null, vsDate: string|null}` — delta vs the nearest earlier date (null if none).
  - `todayISO(d = new Date()): string` — local-date `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing tests** (append to `test/weights.test.js`; extend the import line)

```js
import { recomputeDeltas, insertWeighIn, validateEntry, previewDelta, todayISO } from '../weights.js';

const E = (date, weight, delta = null) => ({ date, weight, delta });

test('recomputeDeltas sorts and recomputes, does not mutate input', () => {
  const input = [E('2026-08-24', 86.9, 99), E('2026-08-12', 87.4, 5)];
  const out = recomputeDeltas(input);
  assert.deepEqual(out, [E('2026-08-12', 87.4, null), E('2026-08-24', 86.9, -0.5)]);
  assert.equal(input[0].delta, 99); // untouched
});

test('recomputeDeltas rounds float noise to one decimal', () => {
  const out = recomputeDeltas([E('2026-08-12', 87.4), E('2026-08-19', 87.1)]);
  assert.equal(out[1].delta, -0.3);
});

test('insertWeighIn inserts mid-file and fixes neighbours', () => {
  const base = recomputeDeltas([E('2026-08-12', 87.4), E('2026-08-26', 86.4)]);
  const out = insertWeighIn(base, { date: '2026-08-19', weight: 87.0 });
  assert.deepEqual(out, [
    E('2026-08-12', 87.4, null),
    E('2026-08-19', 87.0, -0.4),
    E('2026-08-26', 86.4, -0.6),
  ]);
});

test('insertWeighIn throws on duplicate date', () => {
  const base = [E('2026-08-12', 87.4)];
  assert.throws(() => insertWeighIn(base, { date: '2026-08-12', weight: 80 }), /already/);
});

test('validateEntry', () => {
  const base = [E('2026-08-12', 87.4)];
  const today = '2026-08-17';
  assert.deepEqual(validateEntry({ date: '2026-08-17', weight: 87.0 }, base, today), []);
  assert.ok(validateEntry({ date: '2026-08-18', weight: 87.0 }, base, today).some(m => /future/.test(m)));
  assert.ok(validateEntry({ date: '2026-08-12', weight: 87.0 }, base, today).some(m => /already/.test(m)));
  assert.ok(validateEntry({ date: '2026-08-17', weight: 39.9 }, base, today).some(m => /40/.test(m)));
  assert.ok(validateEntry({ date: '2026-08-17', weight: 150.1 }, base, today).some(m => /150/.test(m)));
  assert.ok(validateEntry({ date: '2026-08-17', weight: 87.45 }, base, today).some(m => /decimal/.test(m)));
  assert.ok(validateEntry({ date: '', weight: 87 }, base, today).some(m => /date/i.test(m)));
  assert.ok(validateEntry({ date: '2026-08-17', weight: NaN }, base, today).some(m => /weight/i.test(m)));
});

test('previewDelta uses nearest earlier date', () => {
  const base = recomputeDeltas([E('2026-08-12', 87.4), E('2026-08-26', 86.4)]);
  assert.deepEqual(previewDelta(base, { date: '2026-08-19', weight: 87.0 }), { delta: -0.4, vsDate: '2026-08-12' });
  assert.deepEqual(previewDelta(base, { date: '2026-08-01', weight: 88 }), { delta: null, vsDate: null });
  assert.deepEqual(previewDelta([], { date: '2026-08-01', weight: 88 }), { delta: null, vsDate: null });
});

test('todayISO formats local date', () => {
  assert.equal(todayISO(new Date(2026, 7, 5, 23, 30)), '2026-08-05');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `does not provide an export named 'recomputeDeltas'`.

- [ ] **Step 3: Implement** (append to `weights.js`)

```js
const round1 = n => Math.round(n * 10) / 10;

export function recomputeDeltas(entries) {
  const sorted = [...entries]
    .map(e => ({ date: e.date, weight: e.weight, delta: null }))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sorted.length; i++) {
    sorted[i].delta = round1(sorted[i].weight - sorted[i - 1].weight);
  }
  return sorted;
}

export function insertWeighIn(entries, { date, weight }) {
  if (entries.some(e => e.date === date)) {
    throw new Error(`An entry for ${date} already exists`);
  }
  return recomputeDeltas([...entries, { date, weight, delta: null }]);
}

export function previewDelta(entries, { date, weight }) {
  const earlier = entries.filter(e => e.date < date).sort((a, b) => a.date.localeCompare(b.date));
  if (earlier.length === 0) return { delta: null, vsDate: null };
  const prev = earlier[earlier.length - 1];
  return { delta: round1(weight - prev.weight), vsDate: prev.date };
}

export function validateEntry({ date, weight }, entries, today) {
  const errors = [];
  if (!date || !DATE_RE.test(date)) errors.push('Pick a date.');
  else if (date > today) errors.push('Date cannot be in the future.');
  else if (entries.some(e => e.date === date)) errors.push(`An entry for ${date} already exists.`);
  if (typeof weight !== 'number' || !Number.isFinite(weight)) errors.push('Enter a weight.');
  else {
    if (weight < 40 || weight > 150) errors.push('Weight must be between 40 and 150 kg.');
    if (round1(weight) !== weight) errors.push('Weight can have at most one decimal.');
  }
  return errors;
}

export function todayISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: 12 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add weights.js test/weights.test.js
git commit -m "Add insertWeighIn, recomputeDeltas, validateEntry, previewDelta, todayISO"
```

---

### Task 3: Seed data file + page skeleton with chart and table (read-only mode)

**Files:**
- Create: `weights.txt`
- Create: `index.html`

**Interfaces:**
- Consumes: `parseWeights`, `formatKg` from `weights.js`.
- Produces (inside `index.html`'s module script): `renderChart(entries)`, `renderTable(entries)`, `loadAndRender()`; a global `state = { entries: [] }`.

- [ ] **Step 1: Create `weights.txt`** (seed = lab weigh-in from `bieganie-2026.pdf`)

```
date,weight,delta
2026-08-12,87.4,
```

- [ ] **Step 2: Create `index.html`** — markup, CSS, and read-only rendering. (Form/config/save wiring come in Task 4; the elements exist now but are inert.)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weight loss</title>
<style>
  :root { --bg:#fff; --fg:#111; --muted:#666; --line:#2a6fdb; --ref:#999; --down:#1a7f37; --up:#c62828; --panel:#f4f4f6; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --fg:#eee; --muted:#aaa; --line:#6ea0ff; --ref:#777; --panel:#1d1d22; } }
  * { box-sizing:border-box; }
  body { margin:0; padding:1rem; font:15px/1.4 system-ui, sans-serif; background:var(--bg); color:var(--fg); max-width:900px; margin-inline:auto; }
  h1 { font-size:1.4rem; margin:.2rem 0 1rem; display:flex; justify-content:space-between; align-items:center; }
  h1 button { font-size:1.1rem; background:none; border:1px solid var(--muted); color:var(--fg); border-radius:6px; padding:.2rem .5rem; cursor:pointer; }
  form, #config { background:var(--panel); border-radius:8px; padding:.8rem; margin-bottom:1rem; display:grid; gap:.6rem; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); align-items:end; }
  label { display:flex; flex-direction:column; gap:.2rem; font-size:.85rem; color:var(--muted); }
  input { font:inherit; padding:.4rem; border:1px solid var(--muted); border-radius:6px; background:var(--bg); color:var(--fg); }
  #delta { font-weight:600; color:var(--fg); }
  button.primary { font:inherit; padding:.5rem .9rem; border:0; border-radius:6px; background:var(--line); color:#fff; cursor:pointer; }
  button.primary:disabled { opacity:.5; cursor:not-allowed; }
  #msg { grid-column:1/-1; min-height:1.2em; font-size:.9rem; }
  #msg.err { color:var(--up); } #msg.ok { color:var(--down); }
  #config { display:none; } #config.open { display:grid; }
  svg { width:100%; height:auto; display:block; }
  .axis text, .ref text, .pt text { font-size:11px; fill:var(--muted); }
  .axis line, .axis path { stroke:var(--muted); stroke-width:1; }
  .ref line { stroke:var(--ref); stroke-dasharray:4 4; }
  .series { fill:none; stroke:var(--line); stroke-width:2; }
  .pt circle { fill:var(--line); }
  .pt:hover circle { r:6; }
  .pt text { opacity:0; fill:var(--fg); font-weight:600; }
  .pt:hover text { opacity:1; }
  table { width:100%; border-collapse:collapse; margin-top:1rem; }
  th, td { text-align:left; padding:.35rem .5rem; border-bottom:1px solid var(--panel); }
  td.down { color:var(--down); } td.up { color:var(--up); }
</style>
</head>
<body>
<h1>Weight loss <button id="cfgBtn" title="Settings" type="button">⚙</button></h1>

<div id="config">
  <label>GitHub token (fine-grained, Contents read/write on this repo)
    <input id="token" type="password" autocomplete="off">
  </label>
  <label>owner/repo
    <input id="repo" type="text" placeholder="user/weight-loss-visualisation">
  </label>
  <button class="primary" id="cfgSave" type="button">Save settings</button>
</div>

<form id="form" novalidate>
  <label>Date <input id="date" type="date" required></label>
  <label>Weight (kg) <input id="weight" type="number" step="0.1" min="40" max="150" inputmode="decimal" required></label>
  <label>Delta <span id="delta">—</span></label>
  <button class="primary" id="save" type="submit" disabled>Save</button>
  <div id="msg"></div>
</form>

<div id="chart"></div>
<table id="table"><thead><tr><th>Date</th><th>Weight</th><th>Delta</th></tr></thead><tbody></tbody></table>

<script type="module">
import { parseWeights, formatKg } from './weights.js';

const state = { entries: [] };
const $ = id => document.getElementById(id);

const Y_MIN = 68, Y_MAX = 90, REF_LINES = [87.4, 70];

export function renderChart(entries) {
  const W = 900, H = 400, P = { t: 20, r: 20, b: 40, l: 45 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const y = v => P.t + ih * (1 - (v - Y_MIN) / (Y_MAX - Y_MIN));
  const dates = entries.map(e => Date.parse(e.date));
  const x0 = dates.length ? Math.min(...dates) : Date.now() - 864e5;
  const x1 = dates.length > 1 ? Math.max(...dates) : x0 + 30 * 864e5;
  const x = t => P.l + iw * ((t - x0) / (x1 - x0));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time">`;
  // y grid + axis labels every 2 kg
  s += '<g class="axis">';
  for (let v = Y_MIN; v <= Y_MAX; v += 2) {
    s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke-opacity=".15"/>`;
    s += `<text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  s += `<path d="M${P.l},${P.t}V${P.t + ih}H${W - P.r}" fill="none"/>`;
  // x labels: first, last, and up to 4 in between
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const t = x0 + (x1 - x0) * (i / ticks);
    const d = new Date(t).toISOString().slice(0, 10);
    s += `<text x="${x(t)}" y="${H - P.b + 16}" text-anchor="middle">${d}</text>`;
  }
  s += '</g>';
  // reference lines
  s += '<g class="ref">';
  for (const v of REF_LINES) {
    s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    s += `<text x="${W - P.r}" y="${y(v) - 4}" text-anchor="end">${v} kg</text>`;
  }
  s += '</g>';
  // series
  if (entries.length) {
    const pts = entries.map(e => [x(Date.parse(e.date)), y(e.weight)]);
    s += `<path class="series" d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('')}"/>`;
    entries.forEach((e, i) => {
      const [px, py] = pts[i];
      const label = `${e.date} · ${formatKg(e.weight)} kg${e.delta === null ? '' : ' · ' + (e.delta > 0 ? '+' : '') + formatKg(e.delta)}`;
      const anchor = px > W * 0.7 ? 'end' : (px < W * 0.3 ? 'start' : 'middle');
      s += `<g class="pt"><circle cx="${px}" cy="${py}" r="4"/><title>${esc(label)}</title>` +
           `<text x="${px}" y="${py - 10}" text-anchor="${anchor}">${esc(label)}</text></g>`;
    });
  }
  s += '</svg>';
  $('chart').innerHTML = s;
}

export function renderTable(entries) {
  const rows = [...entries].reverse().map(e => {
    const cls = e.delta === null ? '' : (e.delta < 0 ? 'down' : (e.delta > 0 ? 'up' : ''));
    const d = e.delta === null ? '—' : (e.delta > 0 ? '+' : '') + formatKg(e.delta);
    return `<tr><td>${e.date}</td><td>${formatKg(e.weight)} kg</td><td class="${cls}">${d}</td></tr>`;
  });
  $('table').querySelector('tbody').innerHTML = rows.join('');
}

export async function loadAndRender() {
  const res = await fetch(`./weights.txt?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load weights.txt (${res.status})`);
  state.entries = parseWeights(await res.text());
  renderChart(state.entries);
  renderTable(state.entries);
}

loadAndRender().catch(err => { $('msg').textContent = err.message; $('msg').className = 'err'; });
</script>
</body>
</html>
```

- [ ] **Step 3: Verify manually**

Run: `python -m http.server 8000` (from repo root), open `http://localhost:8000/`.
Expected: chart with y-axis 68–90, dotted lines labelled `87.4 kg` and `70 kg`, one point on 2026-08-12 at 87.4; table shows one row `2026-08-12 · 87.4 kg · —`. Hover the point → label. Form visible but Save disabled. Stop the server (Ctrl+C).

Also run `node --test` — still 12 pass (module has no DOM references at import time; `renderChart` etc. live in the page, not `weights.js`).

- [ ] **Step 4: Commit**

```bash
git add weights.txt index.html
git commit -m "Add page: chart with reference lines, entries table, read-only load"
```

---

### Task 4: Form, live delta, config panel, and save via GitHub Contents API

**Files:**
- Modify: `index.html` (module script only — append after `loadAndRender()` definition, replace the final `loadAndRender().catch(...)` line with the `init()` shown below)

**Interfaces:**
- Consumes: `insertWeighIn`, `validateEntry`, `previewDelta`, `serialiseWeights`, `todayISO` from `weights.js`; `state`, `renderChart`, `renderTable`, `loadAndRender` from Task 3.
- Produces: `ghGet(cfg)`, `ghPut(cfg, content, sha, message)`, `getConfig()`, `saveEntry()`.

- [ ] **Step 1: Extend the import line**

```js
import { parseWeights, formatKg, insertWeighIn, validateEntry, previewDelta, serialiseWeights, todayISO } from './weights.js';
```

- [ ] **Step 2: Append config + GitHub API + form logic** (before the closing `</script>`, replacing the existing `loadAndRender().catch(...)` line)

```js
// ---------- config (localStorage only) ----------
const LS_TOKEN = 'wlv.token', LS_REPO = 'wlv.repo';

function guessRepo() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return m && seg ? `${m[1]}/${seg}` : '';
}
function getConfig() {
  return {
    token: localStorage.getItem(LS_TOKEN) || '',
    repo: localStorage.getItem(LS_REPO) || guessRepo(),
  };
}
function setMsg(text, cls = '') { $('msg').textContent = text; $('msg').className = cls; }

$('cfgBtn').addEventListener('click', () => {
  const cfg = getConfig();
  $('token').value = cfg.token; $('repo').value = cfg.repo;
  $('config').classList.toggle('open');
});
$('cfgSave').addEventListener('click', () => {
  localStorage.setItem(LS_TOKEN, $('token').value.trim());
  localStorage.setItem(LS_REPO, $('repo').value.trim());
  $('config').classList.remove('open');
  refreshForm();
  setMsg('Settings saved in this browser only.', 'ok');
});

// ---------- GitHub Contents API ----------
const API = 'https://api.github.com/repos';
function ghHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}
async function ghGet(cfg) {
  const res = await fetch(`${API}/${cfg.repo}/contents/weights.txt?ref=main`, { headers: ghHeaders(cfg.token), cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}) — check token/repo.`);
  const j = await res.json();
  const text = new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, '')), c => c.charCodeAt(0)));
  return { text, sha: j.sha };
}
async function ghPut(cfg, content, sha, message) {
  const bytes = new TextEncoder().encode(content);
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  const res = await fetch(`${API}/${cfg.repo}/contents/weights.txt`, {
    method: 'PUT', headers: { ...ghHeaders(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: btoa(bin), sha, branch: 'main' }),
  });
  if (res.status === 409) throw new Error('File changed on GitHub meanwhile — press Save again.');
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}).`);
}

// ---------- form ----------
function readForm() {
  const date = $('date').value;
  const raw = $('weight').value.trim();
  const weight = raw === '' ? NaN : Number(raw);
  return { date, weight };
}
function refreshForm() {
  const entry = readForm();
  const errors = validateEntry(entry, state.entries, todayISO());
  const { token, repo } = getConfig();
  if (Number.isFinite(entry.weight) && entry.date) {
    const { delta, vsDate } = previewDelta(state.entries, entry);
    $('delta').textContent = delta === null ? 'first entry' : `${delta > 0 ? '+' : ''}${formatKg(delta)} kg vs ${vsDate}`;
  } else {
    $('delta').textContent = '—';
  }
  const configured = Boolean(token && repo);
  $('save').disabled = errors.length > 0 || !configured;
  if (!configured) setMsg('Read-only: set a GitHub token in ⚙ to save entries.');
  else setMsg(errors.join(' '), errors.length ? 'err' : '');
}
async function saveEntry(ev) {
  ev.preventDefault();
  const cfg = getConfig();
  const entry = readForm();
  const errors = validateEntry(entry, state.entries, todayISO());
  if (errors.length) { setMsg(errors.join(' '), 'err'); return; }
  $('save').disabled = true;
  setMsg('Saving…');
  try {
    const { text, sha } = await ghGet(cfg);
    const fresh = parseWeights(text);
    const next = insertWeighIn(fresh, entry);           // throws if duplicate on GitHub side
    await ghPut(cfg, serialiseWeights(next), sha, `weigh-in ${entry.date}: ${formatKg(entry.weight)}`);
    state.entries = next;
    renderChart(state.entries); renderTable(state.entries);
    $('weight').value = '';
    setMsg(`Saved ${entry.date}: ${formatKg(entry.weight)} kg.`, 'ok');
  } catch (err) {
    setMsg(err.message, 'err');
  } finally {
    refreshForm();
  }
}

// ---------- init ----------
async function init() {
  $('date').value = todayISO();
  $('date').max = todayISO();
  $('date').addEventListener('input', refreshForm);
  $('weight').addEventListener('input', refreshForm);
  $('form').addEventListener('submit', saveEntry);
  try { await loadAndRender(); } catch (err) { setMsg(err.message, 'err'); }
  refreshForm();
}
init();
```

- [ ] **Step 3: Verify manually (local, read-only path)**

Run: `python -m http.server 8000`, open `http://localhost:8000/`.
Expected: date defaults to today; typing `87.0` shows `-0.4 kg vs 2026-08-12`; Save disabled with message "Read-only: set a GitHub token…". Enter `87.45` → error "at most one decimal". Enter a future date → "cannot be in the future" (the picker also blocks it via `max`). Open ⚙, `owner/repo` empty locally (expected — fill by hand later), close.

`node --test` still 12 pass.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add form with live delta, settings panel, and save via GitHub Contents API"
```

---

### Task 5: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

````markdown
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
node --test
```
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README: format, Pages setup, token setup, local run"
```

---

### Task 6: End-to-end check against GitHub (athlete step, after they push)

Not automatable from this machine — the athlete pushes and enables Pages personally.

- [ ] **Step 1 (athlete):** create GitHub repo `weight-loss-visualisation`, `git remote add origin …`, `git push -u origin main`, enable Pages (README §Hosting).
- [ ] **Step 2 (athlete):** open the Pages URL → chart with the seed point visible.
- [ ] **Step 3 (athlete):** create the fine-grained token (README), ⚙ → save; add one weigh-in; expect commit `weigh-in YYYY-MM-DD: W` on `main` and the point appearing.
- [ ] **Step 4:** any defect found here → fix on `main` in a follow-up commit.

---

## Self-review

- **Spec coverage:** files (T1–T5) ✓; read path + read-only mode (T3/T4) ✓; chart y 68–90, dotted 87.4/70 labelled, points+line, hover tooltip, table newest-first with coloured delta (T3) ✓; form validation incl. future/duplicate/range/one-decimal, live delta vs nearest earlier date, Save disabled until valid+configured (T2/T4) ✓; write path GET-sha → insert+recompute all deltas → PUT with commit message, 409 handling, form untouched on failure (T4) ✓; config panel localStorage, password field, owner/repo guessed from Pages URL (T4) ✓; local run + README (T5) ✓; tests via `node --test` on pure functions (T1/T2) ✓; non-goals respected ✓.
- **Placeholders:** none.
- **Type consistency:** `entries` = `Array<{date, weight, delta}>` everywhere; `validateEntry(entry, entries, today)` signature identical in T2 and T4; `previewDelta` returns `{delta, vsDate}` in both; `formatKg` used for all numeric output.
