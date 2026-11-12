'use strict';
/* Shared by the server and the browser (served at /shared/split.js), so live totals on screen match the saved ones. */
(function (root) {
/**
 * Bill splitting maths. Everything is in whole cents so totals always add up exactly.
 * No database or HTTP in here, which keeps it easy to test.
 */

/** Split `total` cents by `weights`; the result always sums to `total` (largest remainder). */
function distribute(total, weights) {
  const n = weights.length;
  if (n === 0) return [];
  let w = weights.map(x => (Number.isFinite(x) && x > 0 ? BigInt(Math.round(x * 1000)) : 0n));
  let sum = w.reduce((a, b) => a + b, 0n);
  if (sum === 0n) { w = weights.map(() => 1n); sum = BigInt(n); }
  const T = BigInt(total);
  const floors = w.map(x => (T * x) / sum);
  const rems = w.map((x, i) => ({ i, r: (T * x) % sum }));
  let left = Number(T - floors.reduce((a, b) => a + b, 0n));
  rems.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  const out = floors.map(Number);
  for (let k = 0; k < left; k++) out[rems[k % n].i] += 1;
  return out;
}

/**
 * bill: { mode: 'equal'|'items'|'percent', tipCents, taxCents,
 *         items: [{id, priceCents, qty}], members: [{id, percent}],
 *         assignments: [{itemId, memberId}] }
 * returns { subtotalCents, totalCents, unassignedCents, perMember: { [memberId]: {itemsCents, extrasCents, totalCents} } }
 */
function computeSplit(bill) {
  const members = bill.members || [];
  const items = bill.items || [];
  const ids = members.map(m => m.id);
  const lineTotal = it => it.priceCents * it.qty;
  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const extras = (bill.tipCents || 0) + (bill.taxCents || 0);
  const base = new Map(ids.map(id => [id, 0]));
  let unassigned = 0;

  if (members.length) {
    if (bill.mode === 'items') {
      for (const it of items) {
        const who = (bill.assignments || []).filter(a => a.itemId === it.id && base.has(a.memberId)).map(a => a.memberId);
        const total = lineTotal(it);
        if (!who.length) { unassigned += total; continue; }
        distribute(total, who.map(() => 1)).forEach((c, i) => base.set(who[i], base.get(who[i]) + c));
      }
      if (unassigned) distribute(unassigned, ids.map(() => 1)).forEach((c, i) => base.set(ids[i], base.get(ids[i]) + c));
    } else if (bill.mode === 'percent') {
      distribute(subtotal, members.map(m => Number(m.percent) || 0)).forEach((c, i) => base.set(ids[i], c));
    } else {
      distribute(subtotal, ids.map(() => 1)).forEach((c, i) => base.set(ids[i], c));
    }
  }

  const baseList = ids.map(id => base.get(id));
  const extraList = members.length ? distribute(extras, baseList) : [];
  const perMember = {};
  ids.forEach((id, i) => {
    perMember[id] = { itemsCents: baseList[i], extrasCents: extraList[i], totalCents: baseList[i] + extraList[i] };
  });
  return { subtotalCents: subtotal, totalCents: subtotal + extras, unassignedCents: unassigned, perMember };
}

var api = { distribute: distribute, computeSplit: computeSplit };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Split = api;
})(typeof window !== 'undefined' ? window : globalThis);
