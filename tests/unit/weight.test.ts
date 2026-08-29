/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  kilogramsToPounds,
  normalizeDecimalInput,
  poundsToKilograms,
} from '../../src/features/units/weight';

test('converts kilograms to pounds and back without losing meaningful precision', () => {
  const kilograms = 82.5;
  const pounds = kilogramsToPounds(kilograms);

  assert.ok(Math.abs(pounds - 181.8813662985) < 0.000001);
  assert.ok(Math.abs(poundsToKilograms(pounds) - kilograms) < 0.000001);
});

test('normalizes decimal input from English and Polish keyboards', () => {
  assert.equal(normalizeDecimalInput(' 82.5 '), 82.5);
  assert.equal(normalizeDecimalInput('82,5'), 82.5);
});
