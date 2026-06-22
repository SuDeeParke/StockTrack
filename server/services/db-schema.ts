import { hashSync } from 'bcryptjs'
import { db } from './db.js'

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      data TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      data TEXT NOT NULL
    );
  `)

  // Seed admin if no users exist
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
  if (count === 0) {
    const username = process.env.ADMIN_USER ?? 'admin'
    const password = process.env.ADMIN_PASS ?? 'changeme'
    const hash = hashSync(password, 10)
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash)
    console.log(`[db] Admin user "${username}" created`)
  }
}
