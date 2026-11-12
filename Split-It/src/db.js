'use strict';
const Database = require('better-sqlite3');

function openDb(file) {
  const db = new Database(file || ':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone_hash TEXT,
      share_code TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_hash);
    CREATE TABLE IF NOT EXISTS friends (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, friend_id)
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      merchant TEXT,
      currency TEXT NOT NULL DEFAULT 'ALL',
      tip_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'equal',
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'open',
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      percent REAL NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      paid_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_member_user ON members(bill_id, user_id) WHERE user_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS assignments (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, member_id)
    );
  `);
  return db;
}

module.exports = { openDb };
