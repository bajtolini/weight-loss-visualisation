import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeights, serialiseWeights, formatKg, recomputeDeltas, insertWeighIn, validateEntry, previewDelta, todayISO } from '../weights.js';

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
  assert.throws(() => parseWeights('date,weight,delta\n2026-08-12,,\n'), /Bad line 2/);
});

test('parseWeights throws on calendar-invalid dates', () => {
  assert.throws(() => parseWeights('date,weight,delta\n2026-02-31,80.0,\n'), /Bad line 2/);
  assert.throws(() => parseWeights('date,weight,delta\n2026-13-45,80.0,\n'), /Bad line 2/);
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

test('previewDelta returns null delta for non-finite weight', () => {
  const base = recomputeDeltas([E('2026-08-12', 87.4), E('2026-08-26', 86.4)]);
  assert.deepEqual(previewDelta(base, { date: '2026-08-19', weight: NaN }), { delta: null, vsDate: null });
});

test('todayISO formats local date', () => {
  assert.equal(todayISO(new Date(2026, 7, 5, 23, 30)), '2026-08-05');
});
