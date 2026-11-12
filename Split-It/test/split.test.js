'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { distribute, computeSplit } = require('../src/split');

test('distribute always sums to the total, even when it does not divide evenly', () => {
  for (const [total, n] of [[100, 3], [1, 3], [10000, 7], [999, 2], [0, 4]]) {
    const parts = distribute(total, Array(n).fill(1));
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
    assert.ok(Math.max(...parts) - Math.min(...parts) <= 1);
  }
});

test('distribute respects weights and falls back to equal when all weights are zero', () => {
  assert.deepEqual(distribute(1000, [1, 3]), [250, 750]);
  assert.deepEqual(distribute(100, [0, 0]), [50, 50]);
  assert.deepEqual(distribute(100, [30, 70]), [30, 70]);
});

test('equal split with tip: everyone pays the same and the total matches', () => {
  const r = computeSplit({ mode: 'equal', tipCents: 300, taxCents: 0,
    items: [{ id: 1, priceCents: 1000, qty: 2 }], members: [{ id: 1 }, { id: 2 }, { id: 3 }], assignments: [] });
  assert.equal(r.totalCents, 2300);
  const sum = Object.values(r.perMember).reduce((s, m) => s + m.totalCents, 0);
  assert.equal(sum, 2300);
});

test('by item: shared items are split between their people, extras follow what each person ordered', () => {
  const r = computeSplit({ mode: 'items', tipCents: 100, taxCents: 0,
    items: [{ id: 1, priceCents: 1000, qty: 1 }, { id: 2, priceCents: 3000, qty: 1 }],
    members: [{ id: 10 }, { id: 20 }],
    assignments: [{ itemId: 1, memberId: 10 }, { itemId: 2, memberId: 20 }] });
  assert.equal(r.perMember[10].itemsCents, 1000);
  assert.equal(r.perMember[20].itemsCents, 3000);
  assert.equal(r.perMember[10].extrasCents, 25);
  assert.equal(r.perMember[20].extrasCents, 75);
  assert.equal(r.perMember[10].totalCents + r.perMember[20].totalCents, 4100);
});

test('by item: an item nobody claimed is shared equally and reported as unassigned', () => {
  const r = computeSplit({ mode: 'items', tipCents: 0, taxCents: 0,
    items: [{ id: 1, priceCents: 500, qty: 1 }], members: [{ id: 1 }, { id: 2 }], assignments: [] });
  assert.equal(r.unassignedCents, 500);
  assert.equal(r.perMember[1].totalCents + r.perMember[2].totalCents, 500);
});

test('percent split', () => {
  const r = computeSplit({ mode: 'percent', tipCents: 0, taxCents: 0,
    items: [{ id: 1, priceCents: 10000, qty: 1 }], members: [{ id: 1, percent: 40 }, { id: 2, percent: 60 }], assignments: [] });
  assert.equal(r.perMember[1].totalCents, 4000);
  assert.equal(r.perMember[2].totalCents, 6000);
});

test('a bill with no people does not crash', () => {
  const r = computeSplit({ mode: 'equal', tipCents: 0, taxCents: 0, items: [{ id: 1, priceCents: 100, qty: 1 }], members: [], assignments: [] });
  assert.equal(r.totalCents, 100);
});
