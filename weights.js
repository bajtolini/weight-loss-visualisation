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
