import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, moveCursor, routeTotals, serviceRequired, findSteps } from '../dist/route.mjs';

const steps = [
  { id: 1, action: 'straight', title: 'Elm Street', source: 'Continue on Elm Street',
    miles: 0.4, stops: 0, regular: 0, centralized: 0, waypoint: [45.2, -123.2] },
  { id: 2, action: 'left', title: 'Birch Road', source: 'Turn left into the lot to service mailbox',
    miles: 0.1, stops: 0, regular: 0, centralized: 0, waypoint: [45.202, -123.2], service: true },
  { id: 3, action: 'right', title: 'Elm Street', source: 'Turn right onto Elm Street',
    miles: 0.2, stops: 2, regular: 1, centralized: 12, details: ['Use the back exit'] },
];
const fixture = { version: 1, id: 'DEMO', name: 'Test route', area: 'Test town', miles: 0.72, steps };

test('loads the original sequence and shows certified rather than summed rounded mileage', () => {
  const route = parseRoute(JSON.stringify(fixture));
  assert.deepEqual(route.steps.map(step => step.title), ['Elm Street', 'Birch Road', 'Elm Street']);
  assert.deepEqual(routeTotals(route), { steps: 3, miles: 0.72, stops: 2, regular: 1, centralized: 12 });
});

test('rejects malformed and reordered route data without accepting executable map markup', () => {
  for (const input of [
    '{', { ...fixture, steps: [] }, { ...fixture, steps: [...steps].reverse() },
    { ...fixture, steps: [{ ...steps[0], waypoint: [null, -123] }, ...steps.slice(1)] },
    { ...fixture, steps: [{ ...steps[0], service: 'true' }, ...steps.slice(1)] },
    { ...fixture, steps: [{ ...steps[0], manual: 'true' }, ...steps.slice(1)] },
    { ...fixture, map: { image: 'data:image/svg+xml,<svg onload="alert(1)"></svg>', width: 200, height: 200 } },
  ]) assert.throws(() => parseRoute(input), /route|map|step/i);
});

test('requires confirmation for a printed service instruction even if the stops column is zero', () => {
  const route = parseRoute(fixture);
  assert.equal(serviceRequired(route.steps[0]), false);
  assert.equal(serviceRequired(route.steps[1]), true);
  assert.equal(serviceRequired(route.steps[2]), true);
});

test('progress cannot move past completion and returns to the last instruction on back', () => {
  const route = parseRoute(fixture);
  assert.equal(moveCursor(route, 0, 'previous'), 0);
  assert.equal(moveCursor(route, 2, 'next'), 3);
  assert.equal(moveCursor(route, 3, 'next'), 3);
  assert.equal(moveCursor(route, 3, 'previous'), 2);
  assert.equal(moveCursor(route, 1, 'jump', 2), 2);
  assert.equal(moveCursor(route, 1, 'jump', 99), 1);
});

test('search finds original compound notes, repeated streets, and exact packet numbers', () => {
  const route = parseRoute(fixture);
  assert.deepEqual(findSteps(route, 'elm').map(step => step.id), [1, 3]);
  assert.deepEqual(findSteps(route, 'BACK exit').map(step => step.id), [3]);
  assert.deepEqual(findSteps(route, '#2').map(step => step.id), [2]);
  assert.deepEqual(findSteps(route, '', true).map(step => step.id), [2, 3]);
});
