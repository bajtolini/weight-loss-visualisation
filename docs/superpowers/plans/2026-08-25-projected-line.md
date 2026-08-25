# Projected Line (Expected Weight) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bright-red "projected" line to the chart and an "Expected" column to the table, showing the assumed weight course at 0.5 kg lost per week starting from the first recorded weight (87.4 kg).

**Architecture:** A new pure function `projectedWeights(entries)` in `weights.js` derives one expected-weight point per actual measurement date (same dates, same count — projection grows only when a new weigh-in is added). Values are computed cumulatively from the first entry — `expected = firstWeight − (0.5/7) × daysSinceFirst` — and rounded to two decimals; this equals summing the exact per-interval increments (0.5/7 × day-gap between consecutive measurements) but avoids compounding rounding drift. `index.html` consumes it in `renderChart` (second SVG path + points, bright red) and `renderTable` (new column after Delta). Nothing is stored — `weights.txt` format is unchanged.

**Tech Stack:** Vanilla ES modules, no dependencies. Tests via `node --test` (`npm test`). Dates are `YYYY-MM-DD` strings; `Date.parse` on them yields UTC midnight, so day differences are exact multiples of 86 400 000 ms (no DST issues).

**Spec:** User request of 2026-08-25 (conversation): projected line from 87.4 starting point, one point per actual measurement, rate 0.5 kg/week prorated by day-difference (0.5/7 × days), rounded to two decimals, bright red in the chart, and an "Expected weight" column after Delta in the table.

## Global Constraints

- No new dependencies; keep `weights.js` DOM-free and fetch-free.
- Expected values always display with exactly two decimals (e.g. `87.40 kg`).
- Rate constant: 0.5 kg per 7 days.
- Projection starts at the first (earliest-dated) entry's actual weight — currently 87.4, but derived from data, never hardcoded.
- Projected line color: bright red (`#f00`) in both light and dark themes.
- `weights.txt` schema (`date,weight,delta`) unchanged.
- Commits on branch `feat/projected-line`; never push (user pushes themselves). No AI attribution trailers in commit messages.

---

### Task 1: Pure logic — `projectedWeights` + `formatKg2`

**Files:**
- Modify: `weights.js` (append after `recomputeDeltas`, ~line 49)
- Test: `test/weights.test.js`

**Interfaces:**
- Consumes: entry objects `{ date: 'YYYY-MM-DD', weight: number, delta: number|null }` as produced by `parseWeights`/`recomputeDeltas`.
- Produces: `projectedWeights(entries) => Array<{ date: string, expected: number }>` sorted ascending by date, same length as `entries`; `formatKg2(n) => string` ('' for null/undefined, else `n.toFixed(2)`). Tasks 2 and 3 import both by these exact names.

- [ ] **Step 1: Write the failing tests** — append to `test/weights.test.js`:

```js
test('projectedWeights: one point per entry, 0.5 kg/week prorated by days, 2 decimals', () => {
  const base = [E('2026-08-12', 87.4), E('2026-08-16', 85.6), E('2026-08-25', 82.7)];
  assert.deepEqual(projectedWeights(base), [
    { date: '2026-08-12', expected: 87.4 },   // start = first actual weight
    { date: '2026-08-16', expected: 87.11 },  // 87.4 - 0.5/7*4  = 87.1142... -> 87.11
    { date: '2026-08-25', expected: 86.47 },  // 87.4 - 0.5/7*13 = 86.4714... -> 86.47
  ]);
});

test('projectedWeights: exact weekly cadence drops exactly 0.5', () => {
  const base = [E('2026-08-12', 87.4), E('2026-08-19', 86.0), E('2026-08-26', 85.0)];
  assert.deepEqual(projectedWeights(base).map(p => p.expected), [87.4, 86.9, 86.4]);
});

test('projectedWeights: sorts unsorted input, handles empty and single entry', () => {
  assert.deepEqual(projectedWeights([]), []);
  assert.deepEqual(projectedWeights([E('2026-08-12', 87.4)]), [{ date: '2026-08-12', expected: 87.4 }]);
  const unsorted = [E('2026-08-25', 82.7), E('2026-08-12', 87.4)];
  assert.deepEqual(projectedWeights(unsorted).map(p => p.date), ['2026-08-12', '2026-08-25']);
});

test('formatKg2 renders two decimals', () => {
  assert.equal(formatKg2(87.4), '87.40');
  assert.equal(formatKg2(86.47), '86.47');
  assert.equal(formatKg2(null), '');
});
```

Also extend the import line at the top of the test file with `projectedWeights, formatKg2`.

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test`
Expected: FAIL — `projectedWeights`/`formatKg2` are not exported.

- [ ] **Step 3: Write minimal implementation** — append to `weights.js`:

```js
const round2 = n => Math.round(n * 100) / 100;
const MS_PER_DAY = 864e5;
export const PROJECTED_RATE_PER_WEEK = 0.5; // kg lost per 7 days

export function projectedWeights(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];
  const t0 = Date.parse(sorted[0].date);
  const w0 = sorted[0].weight;
  return sorted.map(e => {
    const days = (Date.parse(e.date) - t0) / MS_PER_DAY;
    return { date: e.date, expected: round2(w0 - (PROJECTED_RATE_PER_WEEK / 7) * days) };
  });
}

export function formatKg2(n) {
  return n === null || n === undefined ? '' : n.toFixed(2);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add weights.js test/weights.test.js
git commit -m "Logic: projectedWeights (0.5 kg/week prorated by days) + formatKg2"
```

### Task 2: Chart — bright-red projected line

**Files:**
- Modify: `index.html` — CSS block (~line 28) and `renderChart` (~lines 112–123), import line (~line 67)

**Interfaces:**
- Consumes: `projectedWeights(entries)`, `formatKg2(n)` from Task 1.
- Produces: SVG elements with classes `.projected` (path) and `.ppt` (point groups) — used only within this file.

- [ ] **Step 1: Add CSS** — next to the existing `.series`/`.pt` rules:

```css
.projected { fill:none; stroke:#f00; stroke-width:2; }
.ppt circle { fill:#f00; }
```

(`#f00` deliberately hardcoded, not a `--var` remapped per theme: bright red in both light and dark, per spec.)

- [ ] **Step 2: Extend the import** in the `<script type="module">`:

```js
import { parseWeights, formatKg, insertWeighIn, validateEntry, previewDelta, serialiseWeights, todayISO, projectedWeights, formatKg2 } from './weights.js';
```

- [ ] **Step 3: Render the projected series in `renderChart`** — insert immediately BEFORE the existing `// series` block (so the blue actual line and its hoverable points draw on top of the red line):

```js
  // projected series (0.5 kg/week from first weigh-in), bright red
  const proj = projectedWeights(entries);
  if (proj.length) {
    const ppts = proj.map(p => [x(Date.parse(p.date)), y(p.expected)]);
    s += `<path class="projected" d="${ppts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('')}"/>`;
    proj.forEach((p, i) => {
      const [px, py] = ppts[i];
      s += `<g class="ppt"><circle cx="${px}" cy="${py}" r="3"/><title>${esc(`${p.date} · expected ${formatKg2(p.expected)} kg`)}</title></g>`;
    });
  }
```

Notes for the implementer: `x`, `y`, `esc` already exist in `renderChart`'s scope. Points get `r="3"` (smaller than the actual series' `r="4"`) and a native `<title>` tooltip only — no always-on text labels, so the chart stays readable where the two lines start at the same point (2026-08-12: actual 87.4 vs expected 87.40).

- [ ] **Step 4: Verify in the browser**

Serve the repo root (e.g. `python -m http.server 8000` from the project directory) and open `http://localhost:8000/`. Expected: a bright-red line from (2026-08-12, 87.4) through (2026-08-16, 87.11) to (2026-08-25, 86.47), with exactly 3 red points, sitting above the blue actual line after the first point (actual loss is faster than projection, so blue drops below red). Hovering a red point shows e.g. "2026-08-25 · expected 86.47 kg". Check dark mode too (red must stay visible).

- [ ] **Step 5: Run `npm test`** (guards against accidental `weights.js` breakage), then commit:

```bash
git add index.html
git commit -m "Chart: bright-red projected line (0.5 kg/week from first weigh-in)"
```

### Task 3: Table — Expected column after Delta

**Files:**
- Modify: `index.html` — `<table>` header (~line 64) and `renderTable` (~lines 132–140)

**Interfaces:**
- Consumes: `projectedWeights(entries)`, `formatKg2(n)` from Task 1 (already imported in Task 2).

- [ ] **Step 1: Add the header cell**:

```html
<table id="table"><thead><tr><th>Date</th><th>Weight</th><th>Delta</th><th>Expected</th></tr></thead><tbody></tbody></table>
```

- [ ] **Step 2: Render the column in `renderTable`** — build a date→expected map once, then one extra `<td>` per row:

```js
function renderTable(entries) {
  const expected = new Map(projectedWeights(entries).map(p => [p.date, p.expected]));
  const rows = [...entries].reverse().map(e => {
    const cls = e.delta === null ? '' : (e.delta < 0 ? 'down' : (e.delta > 0 ? 'up' : ''));
    const arrow = cls === 'down' ? CARET_DOWN : (cls === 'up' ? CARET_UP : '');
    const d = e.delta === null ? '—' : arrow + (e.delta > 0 ? '+' : '') + formatKg(e.delta);
    return `<tr><td>${e.date}</td><td>${formatKg(e.weight)} kg</td><td class="${cls}">${d}</td><td>${formatKg2(expected.get(e.date))} kg</td></tr>`;
  });
  $('table').querySelector('tbody').innerHTML = rows.join('');
}
```

- [ ] **Step 3: Verify in the browser** — table (newest first) reads:

| Date | Weight | Delta | Expected |
|---|---|---|---|
| 2026-08-25 | 82.7 kg | ↓-2.9 | 86.47 kg |
| 2026-08-16 | 85.6 kg | ↓-1.8 | 87.11 kg |
| 2026-08-12 | 87.4 kg | — | 87.40 kg |

- [ ] **Step 4: Run `npm test`, then commit**

```bash
git add index.html
git commit -m "Table: Expected column (projected weight) after Delta"
```

### Task 4: Docs

**Files:**
- Modify: `README.md` (mention the projected line / Expected column wherever the chart and table are described)

- [ ] **Step 1: Add a short paragraph** describing the projection: bright-red line, 0.5 kg/week from the first weigh-in, prorated by actual day gaps, one point per measurement, shown to 2 decimals in the Expected column.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "README: document projected line & Expected column"
```
