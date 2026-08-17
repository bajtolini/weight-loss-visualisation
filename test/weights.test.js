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
  assert.throws(() => parseWeights('date,weight,delta\n2026-08-12,,\n'), /Bad line 2/);
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
