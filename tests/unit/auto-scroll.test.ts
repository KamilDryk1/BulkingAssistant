/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateAutoScrollVelocity } from '../../src/utils/auto-scroll';

const viewport = {
  edgeSize: 80,
  maximumSpeed: 720,
  viewportHeight: 800,
  viewportTop: 100,
};

test('keeps auto-scroll idle outside the edge zones', () => {
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 500 }), 0);
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 180 }), 0);
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 820 }), 0);
});

test('accelerates symmetrically toward the top and bottom edges', () => {
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 140 }), -360);
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 860 }), 360);
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 100 }), -720);
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 900 }), 720);
});

test('caps auto-scroll speed when the finger moves outside the viewport', () => {
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 20 }), -720);
  assert.equal(calculateAutoScrollVelocity({ ...viewport, fingerY: 980 }), 720);
});
