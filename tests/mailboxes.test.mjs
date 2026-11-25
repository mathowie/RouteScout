import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, serviceRequired } from '../dist/route.mjs';
import { assistEligible } from '../dist/gps.mjs';

const range = (start, end, label) => ({ ...(label ? { label } : {}), sequence: { start, end } });
const step = (id, extra = {}) => ({ id, action: 'left', title: 'Gregory Street', source: 'Turn left onto Gregory Street and service the mailboxes.', miles: .2, stops: 0, regular: 0, centralized: 0, manual: true, waypoint: null, ...extra });
const packet = steps => ({ version: 1, id: 'TEST-MAILBOXES', name: 'Mailbox practice', area: 'Fictional town', map: null, steps });
const fixture = () => parseRoute(packet([
  step(1),
  step(2, { service: true, stops: 2, mailboxes: [range(680, 712, 'Gregory Street cluster'), range(713, 724)] }),
  step(3),
]));

test('import retains each mailbox range and keeps the source delivery counts', () => {
  const route = fixture();
  assert.deepEqual(route.steps[1].mailboxes, [
    { label: 'Gregory Street cluster', sequence: { start: 680, end: 712 } },
    { label: 'Mailbox 2', sequence: { start: 713, end: 724 } },
  ]);
  assert.equal(route.steps[1].stops, 2);
  assert.equal(route.steps[1].centralized, 0);
});

test('unknown ranges and old packets stay usable without invented sequence numbers', () => {
  const route = parseRoute(packet([step(1, { service: true, stops: 2, mailboxes: [{}, { sequence: null, label: 'Unmarked cluster' }] }), step(2)]));
  assert.deepEqual(route.steps[0].mailboxes, [{ label: 'Mailbox 1', sequence: null }, { label: 'Unmarked cluster', sequence: null }]);
  assert.deepEqual(route.steps[1].mailboxes, []);
  assert.deepEqual(parseRoute(packet([step(1, { mailboxes: null })])).steps[0].mailboxes, []);
});

test('normalized mailbox data can be saved and imported again without losing its ranges', () => {
  const route = fixture();
  assert.deepEqual(parseRoute(JSON.stringify(route)), route);
});

test('malformed ranges and incomplete mailbox lists fail import rather than hide deliveries', () => {
  const bad = [
    [range(713, 680)], [range(0, 712)], [range(680.5, 712)], [range(680, 1_000_000)],
    [{ sequence: { start: 680 } }], [{ sequence: { end: 712 } }], [{ sequence: [680, 712] }],
    [{ sequence: { start: '680', end: 712 } }], [{ label: '   ' }], [null], '680-712',
    Array.from({ length: 1001 }, () => ({})),
  ];
  for (const mailboxes of bad) assert.throws(() => parseRoute(packet([step(1, { service: true, mailboxes })])), /mailbox|sequence|step/i);
  assert.throws(() => parseRoute(packet([step(1, { stops: 3, mailboxes: [range(680, 712)] })])), /mailbox|stop|step/i);
  assert.throws(() => parseRoute(packet([step(1, { mailboxes: [range(680, 712)] })])), /mailbox|service|step/i);
});

test('repeated ranges and explicit mailbox lists with unspecified source stop counts are retained', () => {
  const route = parseRoute(packet([step(1, { service: true, mailboxes: [range(680, 712), range(680, 712), range(900, 900)] })]));
  assert.equal(route.steps[0].mailboxes.length, 3);
  assert.equal(route.steps[0].stops, 0);
  assert.equal(serviceRequired(route.steps[0]), true);
  assert.equal(assistEligible(route.steps[0], step(2)), false);
});

test('Next and Back progress through each mailbox before leaving its route step', async () => {
  const { moveGuidance } = await import('../dist/mailboxes.mjs');
  const route = fixture();
  assert.deepEqual(moveGuidance(route, { index: 0, mailboxIndex: 0 }, 'next'), { index: 1, mailboxIndex: 0 });
  assert.deepEqual(moveGuidance(route, { index: 1, mailboxIndex: 0 }, 'next'), { index: 1, mailboxIndex: 1 });
  assert.deepEqual(moveGuidance(route, { index: 1, mailboxIndex: 1 }, 'next'), { index: 2, mailboxIndex: 0 });
  assert.deepEqual(moveGuidance(route, { index: 1, mailboxIndex: 1 }, 'previous'), { index: 1, mailboxIndex: 0 });
  assert.deepEqual(moveGuidance(route, { index: 2, mailboxIndex: 0 }, 'previous'), { index: 1, mailboxIndex: 1 });
  assert.deepEqual(moveGuidance(route, { index: 1, mailboxIndex: 1 }, 'jump', 1), { index: 1, mailboxIndex: 0 });
  assert.deepEqual(moveGuidance(route, { index: 1, mailboxIndex: 1 }, 'reset'), { index: 0, mailboxIndex: 0 });
});

test('old and stale saved positions normalize safely, including completion and a one-mailbox step', async () => {
  const { normalizePosition, moveGuidance } = await import('../dist/mailboxes.mjs');
  const route = fixture();
  assert.deepEqual(normalizePosition(route, { index: 1 }), { index: 1, mailboxIndex: 0 });
  assert.deepEqual(normalizePosition(route, { index: 1, mailboxIndex: 1 }), { index: 1, mailboxIndex: 1 });
  assert.deepEqual(normalizePosition(route, { index: 1, mailboxIndex: 40 }), { index: 1, mailboxIndex: 0 });
  assert.deepEqual(normalizePosition(route, { index: 3, mailboxIndex: 1 }), { index: 3, mailboxIndex: 0 });
  assert.deepEqual(normalizePosition(route, { index: -10, mailboxIndex: -1 }), { index: 0, mailboxIndex: 0 });
  assert.deepEqual(moveGuidance(route, { index: 3, mailboxIndex: 0 }, 'next'), { index: 3, mailboxIndex: 0 });
  const single = parseRoute(packet([step(1, { stops: 1, mailboxes: [range(680, 712)] })]));
  assert.deepEqual(moveGuidance(single, { index: 0, mailboxIndex: 0 }, 'next'), { index: 1, mailboxIndex: 0 });
  assert.deepEqual(moveGuidance(single, { index: 1, mailboxIndex: 0 }, 'previous'), { index: 0, mailboxIndex: 0 });
});

test('package reminder speaks only the selected mailbox range without claiming package quantities', async () => {
  const { mailboxReminder, sequenceLabel, mailboxLabel } = await import('../dist/mailboxes.mjs');
  const [first, second] = fixture().steps[1].mailboxes;
  const spoken = mailboxReminder(first, 0, 2);
  assert.match(spoken, /680 through 712/);
  assert.match(spoken, /check the van for packages/i);
  assert.doesNotMatch(spoken, /713|724|33 packages/);
  assert.match(mailboxReminder(second, 1, 2), /713 through 724/);
  assert.equal(sequenceLabel(first), 'Sequence 680–712');
  assert.equal(mailboxLabel(second, 1), 'Mailbox 2');
  const single = { label: '', sequence: { start: 900, end: 900 } };
  assert.equal(sequenceLabel(single), 'Sequence 900');
  assert.match(mailboxReminder(single, 0, 1), /sequence number 900\b/);
  assert.doesNotMatch(mailboxReminder(single, 0, 1), /900 through 900/);
  assert.equal(sequenceLabel({ sequence: null }), 'Sequence not provided');
  assert.match(mailboxReminder({ label: '', sequence: null }, 0, 1), /no sequence range/i);
});
