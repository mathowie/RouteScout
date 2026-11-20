import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectPoint, distanceMeters, normalizeFix, newAssist, updateAssist, usableFix, freshFix } from '../dist/gps.mjs';

const current = [45.2, -123.2];
const next = [45.201, -123.2];
const A = { action: 'straight', waypoint: current };
const B = { action: 'right', waypoint: next };
const t = 1_800_000_000_000;
const fix = (point, ms = 0, accuracy = 8) => ({ point, accuracy, time: t + ms });
const update = (state, reading, from = A, to = B) => updateAssist(state, from, to, reading, reading.time);

test('projects a north-up map and distinguishes a GPS fix beyond the west edge', () => {
  const bounds = { north: 46, south: 44, west: -124, east: -122 };
  assert.deepEqual(projectPoint(bounds, [46, -124], 1200, 600), { x: 0, y: 0, inside: true });
  const mid = projectPoint(bounds, [45, -123], 1200, 600);
  assert.equal(mid.x, 600);
  assert.ok(mid.y > 301 && mid.y < 305);
  assert.equal(projectPoint(bounds, [45, -124.01], 1200, 600).inside, false);
  assert.ok(Math.abs(distanceMeters([45.2, -123.2], [45.201, -123.2]) - 111.2) < 1);
});

test('a fix without valid coordinates or a real timestamp is unusable', () => {
  assert.equal(normalizeFix({ coords: { latitude: 45.2, longitude: -123.2, accuracy: 8 } }), null);
  assert.equal(normalizeFix({ coords: { latitude: null, longitude: -123.2, accuracy: 8 }, timestamp: t }), null);
  const normalized = normalizeFix({ coords: { latitude: 45.2, longitude: -123.2, accuracy: 8 }, timestamp: t });
  assert.equal(usableFix(normalized, t + 20_000), true);
  assert.equal(usableFix(normalized, t + 35_000), false);
});

test('a nearby next turn cannot jump the route before passing the current waypoint', () => {
  let state = update(newAssist(), fix(next));
  state = update(state, fix(next, 3000));
  assert.equal(state.advance, false);
  assert.equal(state.entered, false);
});

test('starts in sequence and needs two separate accurate readings at the next turn', () => {
  let state = update(newAssist(), fix(current));
  assert.equal(state.entered, true);
  state = update(state, fix(next, 9000));
  assert.equal(state.advance, false);
  state = update(state, fix(next, 9000));
  assert.equal(state.advance, false);
  state = update(state, fix(next, 11000));
  assert.equal(state.advance, true);
});

test('coarse fixes, a position gap, or leaving the approach cannot satisfy both readings', () => {
  let state = update(newAssist(), fix(current));
  state = update(state, fix(next, 9000, 70));
  assert.equal(state.advance, false);
  state = update(state, fix(next, 11000));
  state = update(state, fix([45.203, -123.2], 13000));
  state = update(state, fix(next, 15000));
  assert.equal(state.advance, false);
  state = update(state, fix(next, 28000));
  assert.equal(state.advance, false);
});

test('service, manual, close, and missing waypoints never advance automatically', () => {
  for (const [from, to] of [
    [{ ...A, service: true }, B], [{ ...A, stops: 2 }, B], [{ ...A, manual: true }, B],
    [A, { ...B, manual: true }],
    [A, { ...B, waypoint: [45.2002, -123.2] }], [A, { ...B, waypoint: null }],
  ]) {
    const armed = update(newAssist(), fix(current), from, to);
    const candidate = update(armed, fix(to.waypoint || next, 9000), from, to);
    assert.equal(update(candidate, fix(to.waypoint || next, 11000), from, to).advance, false);
  }
});

test('arrival after a long GPS gap needs a new sequential start', () => {
  let state = update(newAssist(), fix(current));
  state = update(state, fix(next, 120_000));
  state = update(state, fix(next, 122_000));
  assert.equal(state.entered, false);
  assert.equal(state.advance, false);
});

test('a future-dated location cannot replace the latest accepted position', () => {
  assert.equal(freshFix(fix(current, 3_600_000), fix(current), t + 1000), false);
  assert.equal(freshFix(fix(current, 1500), fix(current), t + 1500), true);
  assert.equal(freshFix(fix(current, 1500), fix(current, 1500), t + 1600), false);
  assert.equal(freshFix(fix(current, 1800, 105), fix(current, 1500), t + 1800), true);
});
