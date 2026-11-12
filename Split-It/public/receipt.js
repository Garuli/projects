/* Turns the raw text an OCR engine read from a receipt into items, tax, tip and a total.
   Works in the browser and in Node (for the tests). Pure functions only. */
(function (root) {
  'use strict';

  var TOTAL_WORDS = /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|total|totali|shuma|sum)\b/i;
  var SUBTOTAL_WORDS = /\b(sub\s*-?\s*total|nentotal|nën\s*total)\b/i;
  var TAX_WORDS = /\b(vat|tax|tvsh|tva|gst)\b/i;
  var TIP_WORDS = /\b(tip|gratuity|service(\s*charge)?|bakshish|servis)\b/i;
  var IGNORE_WORDS = /\b(cash|change|card|visa|master\s*card|mastercard|paid|payment|pagesa|kusur|kusuri|rest|tendered|received|discount|zbritje|thank|faleminderit|invoice|fature|faturë|receipt|table|tavolin|server|waiter|kamarier|nipt|nuis|tel|phone|www|http|order\s*#|check\s*#|date|time|cashier|arketar)\b/i;

  /** "1,234.50", "1.234,50", "12,50", "850" -> whole cents (850 -> 85000). Returns null if not a number. */
  function parseMoney(token) {
    var t = String(token).replace(/[^\d.,]/g, '');
    if (!t || !/\d/.test(t)) return null;
    var lastDot = t.lastIndexOf('.'), lastComma = t.lastIndexOf(',');
    var sep = Math.max(lastDot, lastComma);
    var intPart, frac = '';
    if (sep >= 0) {
      var after = t.length - sep - 1;
      var both = lastDot >= 0 && lastComma >= 0;
      if (after === 2 || after === 1 || both && after !== 3) { intPart = t.slice(0, sep); frac = t.slice(sep + 1); }
      else if (after === 3 && !both && (t.match(/[.,]/g) || []).length === 1 && t.slice(0, sep).length <= 3 && t.slice(0, sep) !== '0') { intPart = t; }
      else if (after === 3) { intPart = t; }
      else { intPart = t.slice(0, sep); frac = t.slice(sep + 1); }
    } else intPart = t;
    intPart = intPart.replace(/[.,]/g, '');
    if (!intPart && !frac) return null;
    var cents = parseInt(intPart || '0', 10) * 100 + (frac ? Math.round(parseFloat('0.' + frac.slice(0, 2).padEnd(2, '0')) * 100) : 0);
    return Number.isFinite(cents) ? cents : null;
  }

  // a price at the end of a line: optional currency, number with optional decimals, optional currency/lek word
  var PRICE_TAIL = /(?:^|[\s:*])(?:[$€£]|lek|all)?\s*(-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)\s*(?:[$€£]|lek|all|l|a)?\s*$/i;

  function splitPrice(line) {
    var m = PRICE_TAIL.exec(line);
    if (!m) return null;
    var cents = parseMoney(m[1].replace(/\s/g, ''));
    if (cents == null) return null;
    var raw = m[1].replace(/\s/g, '');
    return { cents: cents, hasDecimals: /[.,]\d{2}$/.test(raw), head: line.slice(0, m.index).replace(/[\s.:*_\-]+$/, '').trim() };
  }

  function cleanName(s) {
    return s.replace(/[|_~=]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s.:*\-–—#]+|[\s.:*\-–—#]+$/g, '').slice(0, 80);
  }

  function parseReceipt(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.replace(/\t/g, ' ').trim(); }).filter(Boolean);
    var parsed = lines.map(function (l) { return { raw: l, p: splitPrice(l) }; });

    // Receipts with decimals ("12.50") are common; if most prices have them, a bare integer is probably not a price.
    var priced = parsed.filter(function (x) { return x.p; });
    var withDec = priced.filter(function (x) { return x.p.hasDecimals; }).length;
    var decimalMode = priced.length > 0 && withDec / priced.length >= 0.5;

    var out = { merchant: '', items: [], taxCents: 0, tipCents: 0, totalCents: null, includedTax: false, mismatchCents: 0 };
    var subtotalSeen = null;

    parsed.forEach(function (x, idx) {
      var line = x.raw, p = x.p;
      if (!p) return;
      if (decimalMode && !p.hasDecimals) return;                // dates, phone numbers, table numbers...
      if (/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.test(line) || /\d{1,2}:\d{2}/.test(line)) return;
      var low = line.toLowerCase();
      if (SUBTOTAL_WORDS.test(low)) { subtotalSeen = p.cents; return; }
      if (TAX_WORDS.test(low)) { out.taxCents += p.cents; return; }
      if (TIP_WORDS.test(low)) { out.tipCents += p.cents; return; }
      if (TOTAL_WORDS.test(low)) { out.totalCents = p.cents; return; }
      if (IGNORE_WORDS.test(low)) return;

      var head = p.head, qty = 1, m;
      if ((m = /^(\d{1,2})\s*(?:x|×|\*)\s+(.+)$/i.exec(head))) { qty = +m[1]; head = m[2]; }
      else if ((m = /^(.+?)\s+(?:x|×)\s*(\d{1,2})$/i.exec(head))) { qty = +m[2]; head = m[1]; }
      else if ((m = /^(\d{1,2})\s+([A-Za-zÀ-ž].+)$/.exec(head))) { qty = +m[1]; head = m[2]; }
      var name = cleanName(head);
      if (!/[A-Za-zÀ-ž]{2}/.test(name) || p.cents <= 0 || qty < 1) return;
      // the printed amount is normally the line total; keep a unit price only when it divides evenly
      var unit = p.cents, q = qty;
      if (qty > 1) { if (p.cents % qty === 0) unit = p.cents / qty; else { unit = p.cents; q = 1; name = cleanName(qty + 'x ' + name); } }
      out.items.push({ name: name, priceCents: unit, qty: q });
    });

    // merchant: the first line near the top that is mostly letters and has no price
    for (var i = 0; i < Math.min(lines.length, 5); i++) {
      var l = lines[i];
      if (!parsed[i].p && /[A-Za-zÀ-ž]{3}/.test(l) && !IGNORE_WORDS.test(l) && !/\d{3,}/.test(l)) { out.merchant = cleanName(l).slice(0, 60); break; }
    }

    var itemsSum = out.items.reduce(function (s, it) { return s + it.priceCents * it.qty; }, 0);
    // VAT that is already inside the prices must not be added a second time
    if (out.totalCents != null && out.taxCents > 0 && itemsSum + out.tipCents === out.totalCents) { out.taxCents = 0; out.includedTax = true; }
    if (out.totalCents == null && subtotalSeen != null && !itemsSum) out.totalCents = subtotalSeen + out.taxCents + out.tipCents;
    if (out.totalCents != null) out.mismatchCents = out.totalCents - (itemsSum + out.taxCents + out.tipCents);
    return out;
  }

  var api = { parseReceipt: parseReceipt, parseMoney: parseMoney };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Receipt = api;
})(typeof window !== 'undefined' ? window : globalThis);
