'use strict';
const { createBillsService } = require('./bills');

/** Demo people and bills, created only when the database is empty. Handy for trying the app out. */
function seedDemo(db, registerUser) {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return false;
  const mk = (name, email, pw, phone, avatar) => registerUser({ name, email, password: pw, phone, avatar });
  const alex = mk('Alex Demo', 'alex@example.com', 'alex123', '+355 69 111 2222', 'av:0.0.2.1');
  const dea = mk('Dea Demo', 'dea@example.com', 'dea123', '+355 69 222 3333', 'av:8.3.0.4');
  const ardit = mk('Ardit Demo', 'ardit@example.com', 'ardit123', '+355 69 333 4444', 'av:3.2.1.2');
  const elira = mk('Elira Demo', 'elira@example.com', 'elira123', '+355 69 444 5555', 'av:7.1.0.3');
  const marko = mk('Marko Demo', 'marko@example.com', 'marko123', '+355 69 555 6666', 'av:2.4.5.6');

  const link = db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)');
  for (const [a, b] of [[alex, dea], [alex, ardit], [alex, elira], [dea, ardit], [dea, elira], [ardit, marko]]) {
    link.run(a.id, b.id); link.run(b.id, a.id);
  }

  const bills = createBillsService(db);
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const lek = n => Math.round(n * 100);

  const dinner = bills.create(alex.id, {
    title: 'Dinner at Oda', merchant: 'Oda Garden', currency: 'ALL', mode: 'items', tipCents: lek(500), taxCents: 0, dueDate: day(5),
    members: [{ key: 'a', userId: alex.id }, { key: 'd', userId: dea.id }, { key: 'r', userId: ardit.id }, { key: 'e', userId: elira.id }],
    items: [
      { key: 'i1', name: 'Tavë kosi', priceCents: lek(850), qty: 2 },
      { key: 'i2', name: 'Fërgesë', priceCents: lek(700), qty: 1 },
      { key: 'i3', name: 'Grilled sea bass', priceCents: lek(1800), qty: 1 },
      { key: 'i4', name: 'Raki (shared)', priceCents: lek(900), qty: 1 },
      { key: 'i5', name: 'Baklava', priceCents: lek(450), qty: 2 }
    ],
    assignments: [
      { item: 'i1', member: 'a' }, { item: 'i1', member: 'd' },
      { item: 'i2', member: 'r' }, { item: 'i3', member: 'e' },
      { item: 'i4', member: 'a' }, { item: 'i4', member: 'd' }, { item: 'i4', member: 'r' }, { item: 'i4', member: 'e' },
      { item: 'i5', member: 'd' }, { item: 'i5', member: 'e' }
    ]
  });
  const dm = dinner.members.find(m => m.userId === dea.id);
  bills.setPaid(dinner.id, dm.id, alex.id, true);

  bills.create(alex.id, {
    title: 'Brew District Café', merchant: 'Brew District', currency: 'ALL', mode: 'equal', tipCents: 0, taxCents: 0, dueDate: day(2),
    members: [{ userId: alex.id }, { userId: dea.id }, { userId: elira.id }],
    items: [{ name: 'Flat white', priceCents: lek(280), qty: 2 }, { name: 'Cappuccino', priceCents: lek(300), qty: 1 }, { name: 'Cheesecake', priceCents: lek(450), qty: 1 }]
  });

  const trip = bills.create(dea.id, {
    title: 'Weekend in Berat', merchant: 'Hostel & taxi', currency: 'ALL', mode: 'percent', tipCents: 0, taxCents: 0, dueDate: day(9),
    members: [{ userId: dea.id, percent: 40 }, { userId: alex.id, percent: 30 }, { userId: ardit.id, percent: 30 }],
    items: [{ name: 'Hostel, 2 nights', priceCents: lek(9000), qty: 1 }, { name: 'Taxi', priceCents: lek(3000), qty: 1 }]
  });

  const old = bills.create(alex.id, {
    title: 'Pizza night', merchant: 'Pizza Mia', currency: 'ALL', mode: 'equal', tipCents: lek(200), taxCents: 0,
    members: [{ userId: alex.id }, { userId: ardit.id }],
    items: [{ name: 'Margherita', priceCents: lek(800), qty: 2 }, { name: 'Cola', priceCents: lek(150), qty: 2 }]
  });
  bills.setPaid(old.id, old.members.find(m => m.userId === ardit.id).id, alex.id, true);
  return { alex, trip };
}

module.exports = { seedDemo };
