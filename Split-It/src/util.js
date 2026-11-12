'use strict';
const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomCode(len) {
  let s = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = m => new HttpError(400, m);

const AVATAR_COLORS = ['#FFD66B', '#9ED8FF', '#C9B8FF', '#FFB3C7', '#A8E6CF', '#FFC09F'];

/** Turns +355 69 123 4567 / 069 123 4567 / 0035569... into 355691234567. Returns null if it is not a usable number. */
function normalizePhone(raw, defaultCc) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = String(defaultCc || '355') + d.slice(1);
  d = d.replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

module.exports = { randomCode, HttpError, bad, AVATAR_COLORS, normalizePhone };
