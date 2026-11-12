'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReceipt, parseMoney } = require('../public/receipt');

test('parseMoney understands different number styles', () => {
  assert.equal(parseMoney('10.00'), 1000);
  assert.equal(parseMoney('12,50'), 1250);
  assert.equal(parseMoney('1,234.50'), 123450);
  assert.equal(parseMoney('1.234,50'), 123450);
  assert.equal(parseMoney('850'), 85000);
  assert.equal(parseMoney('1,200'), 120000);
  assert.equal(parseMoney('$6.5'), 650);
  assert.equal(parseMoney('abc'), null);
});

test('a café receipt with decimals: items, quantities, total', () => {
  const r = parseReceipt(`Brew District Café
Jakarta
12/11/2026 10:42
2 x Flat white      5.60
1 Cappuccino        3.00
Cheesecake          4.50
SUBTOTAL           13.10
TOTAL              13.10
CASH               20.00
CHANGE              6.90
Thank you!`);
  assert.equal(r.merchant, 'Brew District Café');
  assert.deepEqual(r.items, [
    { name: 'Flat white', priceCents: 280, qty: 2 },
    { name: 'Cappuccino', priceCents: 300, qty: 1 },
    { name: 'Cheesecake', priceCents: 450, qty: 1 }
  ]);
  assert.equal(r.totalCents, 1310);
  assert.equal(r.mismatchCents, 0);
});

test('the receipt from the design reference (QTY DESC AMT)', () => {
  const r = parseReceipt(`QTY: DESC   AMT
1 Widget A   $10.00
2 Gadget B   $15.00
1 item C     $6.50
3 Product D  $21.00
TOTAL        $54.50`);
  assert.equal(r.items.length, 4);
  assert.equal(r.items[1].priceCents, 750); assert.equal(r.items[1].qty, 2);
  assert.equal(r.items[3].priceCents, 700); assert.equal(r.items[3].qty, 3);
  assert.equal(r.totalCents, 5450);
  // the sample itself does not add up (items are 52.50), so the gap must be reported rather than hidden
  assert.equal(r.mismatchCents, 200);
});

test('tax and tip are picked out, and tax already inside the prices is not added twice', () => {
  const a = parseReceipt(`Pizza Mia\nMargherita 8.00\nCola 1.50\nTAX 0.95\nTIP 1.00\nTOTAL 11.45`);
  assert.equal(a.taxCents, 95); assert.equal(a.tipCents, 100); assert.equal(a.mismatchCents, 0);
  const b = parseReceipt(`Pizza Mia\nMargherita 8.00\nCola 1.50\nVAT 20% 1.58\nTOTAL 9.50`);
  assert.equal(b.taxCents, 0); assert.equal(b.includedTax, true); assert.equal(b.mismatchCents, 0);
});

test('Albanian receipt with whole lek amounts', () => {
  const r = parseReceipt(`Oda Garden
Tavë kosi 850
Fërgesë 700
Raki 900
TVSH 20% 290
Totali 2450`);
  assert.deepEqual(r.items.map(i => i.priceCents), [85000, 70000, 90000]);
  assert.equal(r.totalCents, 245000);
  assert.equal(r.taxCents, 0); assert.equal(r.includedTax, true);
});

test('dates, phone numbers and card lines are not mistaken for items', () => {
  const r = parseReceipt(`Corner Shop\nTel 04 222 3344\n12.11.2026 09:15\nBread 1.20\nMilk 2.10\nVISA **** 1234 3.30\nTOTAL 3.30`);
  assert.deepEqual(r.items.map(i => i.name), ['Bread', 'Milk']);
});

test('an unreadable photo gives no items instead of crashing', () => {
  assert.deepEqual(parseReceipt('').items, []);
  assert.deepEqual(parseReceipt('@@@@ ~~~ ||||').items, []);
});
