/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatLocalizedWeight,
  formatLocalizedWeightChange,
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

test('formats display weights using the selected unit and locale', () => {
  assert.equal(formatLocalizedWeight(82.5, 'kg', 'en'), '82.5');
  assert.equal(formatLocalizedWeight(82.5, 'kg', 'pl'), '82,5');
  assert.equal(formatLocalizedWeight(82.5, 'lb', 'en'), '181.9');
});

test('formats localized weight changes with an explicit sign', () => {
  assert.equal(formatLocalizedWeightChange(0.25, 'kg', 'en', 2), '+0.25');
  assert.equal(formatLocalizedWeightChange(-0.25, 'kg', 'pl', 2), '−0,25');
  assert.equal(formatLocalizedWeightChange(0, 'kg', 'pl', 2), '0,00');
});
