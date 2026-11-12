'use strict';
const { computeSplit } = require('./split');
const { randomCode, bad, HttpError } = require('./util');

const MODES = ['equal', 'items', 'percent'];
const MAX_ITEMS = 100, MAX_MEMBERS = 30, MAX_CENTS = 100000000000;

const isCents = v => Number.isInteger(v) && v >= 0 && v <= MAX_CENTS;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/** Checks the body of create and update requests and returns a clean copy. */
function parseBillBody(b) {
  if (!b || typeof b !== 'object') throw bad('Missing bill data.');
  const title = str(b.title, 80);
  if (!title) throw bad('Give the bill a title.');
  const mode = b.mode || 'equal';
  if (!MODES.includes(mode)) throw bad('Unknown split mode.');
  const currency = str(b.currency || 'ALL', 10).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw bad('Currency must be a 3-letter code such as ALL or EUR.');
  const tipCents = b.tipCents == null ? 0 : b.tipCents, taxCents = b.taxCents == null ? 0 : b.taxCents;
  if (!isCents(tipCents) || !isCents(taxCents)) throw bad('Tip and tax must be whole cents, zero or more.');
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length > MAX_ITEMS) throw bad('A bill can have at most ' + MAX_ITEMS + ' items.');
  const cleanItems = items.map(it => {
    const name = str(it && it.name, 80);
    const qty = it && it.qty == null ? 1 : it && it.qty;
    if (!name) throw bad('Every item needs a name.');
    if (!isCents(it.priceCents)) throw bad('"' + name + '" has an invalid price.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw bad('"' + name + '" needs a quantity from 1 to 99.');
    return { key: it.key != null ? String(it.key) : null, name, priceCents: it.priceCents, qty };
  });
  const members = Array.isArray(b.members) ? b.members : [];
  if (members.length > MAX_MEMBERS) throw bad('A bill can have at most ' + MAX_MEMBERS + ' people.');
  const cleanMembers = members.map(m => {
    const name = str(m && m.name, 40);
    const percent = m && m.percent != null ? Number(m.percent) : 0;
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw bad('Percentages must be between 0 and 100.');
    return {
      key: m && m.key != null ? String(m.key) : null,
      id: m && Number.isInteger(m.id) ? m.id : null,
      userId: m && Number.isInteger(m.userId) ? m.userId : null,
      name, percent
    };
  });
  const assignments = (Array.isArray(b.assignments) ? b.assignments : []).map(a => ({ item: String(a.item), member: String(a.member) }));
  let dueDate = null;
  if (b.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.dueDate))) throw bad('Due date must look like 2026-12-31.');
    dueDate = String(b.dueDate);
  }
  return { title, merchant: str(b.merchant, 80), mode, currency, tipCents, taxCents, items: cleanItems, members: cleanMembers, assignments, dueDate };
}

function publicUser(u) { return u ? { id: u.id, name: u.name, shareCode: u.share_code, color: u.color } : null; }

function createBillsService(db) {
  const q = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    isFriend: db.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?'),
    billById: db.prepare('SELECT * FROM bills WHERE id = ?'),
    billByCode: db.prepare('SELECT * FROM bills WHERE code = ?'),
    codeTaken: db.prepare('SELECT 1 FROM bills WHERE code = ?'),
    items: db.prepare('SELECT * FROM items WHERE bill_id = ? ORDER BY position, id'),
    members: db.prepare('SELECT * FROM members WHERE bill_id = ? ORDER BY id'),
    assigns: db.prepare('SELECT a.item_id, a.member_id FROM assignments a JOIN items i ON i.id = a.item_id WHERE i.bill_id = ?'),
    insBill: db.prepare('INSERT INTO bills (owner_id,title,merchant,currency,tip_cents,tax_cents,mode,code,due_date) VALUES (?,?,?,?,?,?,?,?,?)'),
    updBill: db.prepare('UPDATE bills SET title=?, merchant=?, currency=?, tip_cents=?, tax_cents=?, mode=?, due_date=?, status=? WHERE id=?'),
    delItems: db.prepare('DELETE FROM items WHERE bill_id = ?'),
    insItem: db.prepare('INSERT INTO items (bill_id,name,price_cents,qty,position) VALUES (?,?,?,?,?)'),
    insMember: db.prepare('INSERT INTO members (bill_id,user_id,name,percent) VALUES (?,?,?,?)'),
    updMember: db.prepare('UPDATE members SET name=?, percent=? WHERE id=?'),
    delMember: db.prepare('DELETE FROM members WHERE id=?'),
    insAssign: db.prepare('INSERT OR IGNORE INTO assignments (item_id,member_id) VALUES (?,?)'),
    memberById: db.prepare('SELECT * FROM members WHERE id = ?'),
    setPaid: db.prepare("UPDATE members SET paid=?, paid_at=CASE WHEN ?=1 THEN datetime('now') ELSE NULL END WHERE id=?"),
    unpaidCount: db.prepare('SELECT COUNT(*) c FROM members WHERE bill_id=? AND paid=0 AND user_id IS NOT (SELECT owner_id FROM bills WHERE id=?)'),
    setStatus: db.prepare('UPDATE bills SET status=? WHERE id=?'),
    delBill: db.prepare('DELETE FROM bills WHERE id=?'),
    mine: db.prepare(`SELECT DISTINCT b.id FROM bills b LEFT JOIN members m ON m.bill_id=b.id
                      WHERE b.owner_id=? OR m.user_id=? ORDER BY b.id DESC`),
    memberOf: db.prepare('SELECT 1 FROM members WHERE bill_id=? AND user_id=?')
  };

  function newCode() {
    for (let i = 0; i < 20; i++) { const c = randomCode(6); if (!q.codeTaken.get(c)) return c; }
    throw new HttpError(500, 'Could not create a bill code. Try again.');
  }

  function canView(bill, userId) { return bill.owner_id === userId || !!q.memberOf.get(bill.id, userId); }

  function detail(bill, viewerId) {
    const items = q.items.all(bill.id);
    const members = q.members.all(bill.id);
    const assigns = q.assigns.all(bill.id);
    const split = computeSplit({
      mode: bill.mode, tipCents: bill.tip_cents, taxCents: bill.tax_cents,
      items: items.map(i => ({ id: i.id, priceCents: i.price_cents, qty: i.qty })),
      members: members.map(m => ({ id: m.id, percent: m.percent })),
      assignments: assigns.map(a => ({ itemId: a.item_id, memberId: a.member_id }))
    });
    const owner = q.userById.get(bill.owner_id);
    const mineRow = members.find(m => m.user_id === viewerId);
    return {
      id: bill.id, title: bill.title, merchant: bill.merchant || '', currency: bill.currency, mode: bill.mode,
      tipCents: bill.tip_cents, taxCents: bill.tax_cents, code: bill.code, status: bill.status, dueDate: bill.due_date,
      createdAt: bill.created_at, owner: publicUser(owner), isOwner: bill.owner_id === viewerId,
      subtotalCents: split.subtotalCents, totalCents: split.totalCents, unassignedCents: split.unassignedCents,
      myMemberId: mineRow ? mineRow.id : null,
      items: items.map(i => ({
        id: i.id, name: i.name, priceCents: i.price_cents, qty: i.qty,
        assignees: assigns.filter(a => a.item_id === i.id).map(a => a.member_id)
      })),
      members: members.map(m => {
        const u = m.user_id ? q.userById.get(m.user_id) : null;
        const s = split.perMember[m.id];
        return {
          id: m.id, userId: m.user_id, name: m.name, color: u ? u.color : '#D9DCE3', percent: m.percent,
          isOwner: m.user_id === bill.owner_id, paid: !!m.paid, paidAt: m.paid_at,
          itemsCents: s.itemsCents, extrasCents: s.extrasCents, totalCents: s.totalCents
        };
      })
    };
  }

  function writeBill(bill, ownerId, p) {
    // members
    const existing = new Map(q.members.all(bill.id).map(m => [m.id, m]));
    const keyToMember = new Map();
    const keep = new Set();
    let sawOwner = false;
    for (const m of p.members) {
      let userId = m.userId;
      if (userId != null) {
        if (userId === ownerId) sawOwner = true;
        else if (!q.isFriend.get(ownerId, userId) && !(m.id && existing.get(m.id) && existing.get(m.id).user_id === userId)) {
          throw bad('You can only add friends to a bill. Add them by their code first.');
        }
        if (!q.userById.get(userId)) throw bad('Unknown user.');
      }
      let name = m.name;
      if (userId != null && !name) name = q.userById.get(userId).name;
      if (!name) throw bad('Every person needs a name.');
      let row = m.id ? existing.get(m.id) : null;
      if (row) { q.updMember.run(name, m.percent, row.id); keep.add(row.id); keyToMember.set(m.key || String(row.id), row.id); }
      else {
        const dupe = userId != null && [...existing.values()].find(r => r.user_id === userId);
        if (dupe) { keep.add(dupe.id); keyToMember.set(m.key || String(dupe.id), dupe.id); continue; }
        const info = q.insMember.run(bill.id, userId, name, m.percent);
        keep.add(Number(info.lastInsertRowid)); keyToMember.set(m.key || String(info.lastInsertRowid), Number(info.lastInsertRowid));
      }
    }
    // the owner is always on their own bill
    let ownerRow = [...existing.values()].find(r => r.user_id === ownerId);
    if (!sawOwner && !ownerRow) {
      const u = q.userById.get(ownerId);
      const info = q.insMember.run(bill.id, ownerId, u.name, 0);
      ownerRow = { id: Number(info.lastInsertRowid) };
    }
    if (ownerRow) keep.add(ownerRow.id);
    for (const id of existing.keys()) if (!keep.has(id)) q.delMember.run(id);

    // items replace
    q.delItems.run(bill.id);
    const keyToItem = new Map();
    p.items.forEach((it, i) => {
      const info = q.insItem.run(bill.id, it.name, it.priceCents, it.qty, i);
      keyToItem.set(it.key != null ? it.key : String(i), Number(info.lastInsertRowid));
    });
    for (const a of p.assignments) {
      const itemId = keyToItem.get(a.item), memberId = keyToMember.get(a.member);
      if (itemId && memberId) q.insAssign.run(itemId, memberId);
    }
  }

  function refreshStatus(billId) {
    const bill = q.billById.get(billId);
    const others = q.members.all(billId).filter(m => m.user_id !== bill.owner_id);
    const settled = others.length > 0 && others.every(m => m.paid);
    q.setStatus.run(settled ? 'settled' : 'open', billId);
  }

  const create = db.transaction((ownerId, body) => {
    const p = parseBillBody(body);
    const info = q.insBill.run(ownerId, p.title, p.merchant, p.currency, p.tipCents, p.taxCents, p.mode, newCode(), p.dueDate);
    const bill = q.billById.get(Number(info.lastInsertRowid));
    writeBill(bill, ownerId, p);
    refreshStatus(bill.id);
    return detail(q.billById.get(bill.id), ownerId);
  });

  const update = db.transaction((billId, ownerId, body) => {
    const bill = q.billById.get(billId);
    if (!bill) throw new HttpError(404, 'Bill not found.');
    if (bill.owner_id !== ownerId) throw new HttpError(403, 'Only the person who created the bill can change it.');
    const p = parseBillBody(body);
    q.updBill.run(p.title, p.merchant, p.currency, p.tipCents, p.taxCents, p.mode, p.dueDate, bill.status, bill.id);
    writeBill(bill, ownerId, p);
    refreshStatus(bill.id);
    return detail(q.billById.get(bill.id), ownerId);
  });

  function get(billId, userId) {
    const bill = q.billById.get(billId);
    if (!bill || !canView(bill, userId)) throw new HttpError(404, 'Bill not found.');
    return detail(bill, userId);
  }

  function list(userId) {
    return q.mine.all(userId, userId).map(r => {
      const d = detail(q.billById.get(r.id), userId);
      const me = d.members.find(m => m.userId === userId);
      const unpaidOthers = d.members.filter(m => !m.isOwner && !m.paid);
      return {
        id: d.id, title: d.title, merchant: d.merchant, currency: d.currency, status: d.status, totalCents: d.totalCents,
        createdAt: d.createdAt, dueDate: d.dueDate, isOwner: d.isOwner, owner: d.owner,
        peopleCount: d.members.length,
        payerCount: d.members.filter(m => !m.isOwner).length,
        paidCount: d.members.filter(m => !m.isOwner && m.paid).length,
        people: d.members.slice(0, 5).map(m => ({ name: m.name, color: m.color })),
        myShareCents: me ? me.totalCents : 0, iPaid: me ? me.paid : false,
        owedToMeCents: d.isOwner ? unpaidOthers.reduce((s, m) => s + m.totalCents, 0) : 0
      };
    });
  }

  function join(userId, code) {
    const bill = q.billByCode.get(String(code || '').trim().toUpperCase());
    if (!bill) throw new HttpError(404, 'No bill has that code.');
    if (bill.status === 'settled') throw bad('That bill is already settled.');
    if (!q.memberOf.get(bill.id, userId) && bill.owner_id !== userId) {
      const count = q.members.all(bill.id).length;
      if (count >= MAX_MEMBERS) throw bad('That bill is full.');
      q.insMember.run(bill.id, userId, q.userById.get(userId).name, 0);
    }
    return detail(q.billById.get(bill.id), userId);
  }

  function setPaid(billId, memberId, userId, paid) {
    const bill = q.billById.get(billId);
    if (!bill || !canView(bill, userId)) throw new HttpError(404, 'Bill not found.');
    const m = q.memberById.get(memberId);
    if (!m || m.bill_id !== bill.id) throw new HttpError(404, 'Person not found on this bill.');
    if (bill.owner_id !== userId && m.user_id !== userId) throw new HttpError(403, 'You can only mark your own share as paid.');
    q.setPaid.run(paid ? 1 : 0, paid ? 1 : 0, m.id);
    refreshStatus(bill.id);
    return detail(q.billById.get(bill.id), userId);
  }

  function remove(billId, userId) {
    const bill = q.billById.get(billId);
    if (!bill || !canView(bill, userId)) throw new HttpError(404, 'Bill not found.');
    if (bill.owner_id !== userId) throw new HttpError(403, 'Only the person who created the bill can delete it.');
    q.delBill.run(bill.id);
  }

  function summary(userId) {
    const bills = list(userId);
    let owedToYou = 0, youOwe = 0, open = 0;
    for (const b of bills) {
      if (b.status !== 'open') continue;
      open++;
      if (b.isOwner) owedToYou += b.owedToMeCents;
      else if (!b.iPaid) youOwe += b.myShareCents;
    }
    return { owedToYouCents: owedToYou, youOweCents: youOwe, openBills: open };
  }

  return { create, update, get, list, join, setPaid, remove, summary };
}

module.exports = { createBillsService, parseBillBody, publicUser };
