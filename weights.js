// weights.js — pure data logic for weight-loss-visualisation. No DOM, no fetch.

export const HEADER = 'date,weight,delta';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(date) {
  return DATE_RE.test(date) && Number.isFinite(Date.parse(date)) &&
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
}

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
    if (parts.length < 2 || parts.length > 3 || !isValidDate(date) ||
        !weightStr.trim() || !Number.isFinite(weight) || (delta !== null && !Number.isFinite(delta))) {
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

const round2 = n => Math.round(n * 100) / 100;
const MS_PER_DAY = 864e5;
export const PROJECTED_RATE_PER_WEEK = 0.5; // kg lost per 7 days

// One expected-weight point per actual weigh-in date, assuming a steady
// PROJECTED_RATE_PER_WEEK loss from the first entry's weight. Cumulative from
// the start (not step-by-step) so display rounding never compounds.
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

export function insertWeighIn(entries, { date, weight }) {
  if (entries.some(e => e.date === date)) {
    throw new Error(`An entry for ${date} already exists`);
  }
  return recomputeDeltas([...entries, { date, weight, delta: null }]);
}

export function previewDelta(entries, { date, weight }) {
  if (typeof weight !== 'number' || !Number.isFinite(weight)) return { delta: null, vsDate: null };
  const earlier = entries.filter(e => e.date < date).sort((a, b) => a.date.localeCompare(b.date));
  if (earlier.length === 0) return { delta: null, vsDate: null };
  const prev = earlier[earlier.length - 1];
  return { delta: round1(weight - prev.weight), vsDate: prev.date };
}

export function validateEntry({ date, weight }, entries, today) {
  const errors = [];
  if (!date || !DATE_RE.test(date)) errors.push('Pick a date.');
  else if (!isValidDate(date)) errors.push('Pick a valid date.');
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
