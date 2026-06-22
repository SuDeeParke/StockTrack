import Database from 'better-sqlite3'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = join(process.cwd(), 'data')
const DB_PATH = process.env.DATABASE_PATH ?? join(DATA_DIR, 'stocktrack.db')

// SQLITE_KEY must be 64 hex chars (32 bytes)
function getKey(): Buffer {
  const raw = process.env.SQLITE_KEY
  if (!raw || raw.length !== 64) {
    throw new Error('SQLITE_KEY env var must be set to a 64-char hex string (openssl rand -hex 32)')
  }
  return Buffer.from(raw, 'hex')
}

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

export function encryptJSON(obj: unknown): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plain = JSON.stringify(obj)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // format: hex(iv):hex(tag):hex(encrypted)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptJSON<T>(blob: string): T {
  const key = getKey()
  const [ivHex, tagHex, dataHex] = blob.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = decipher.update(data) + decipher.final('utf8')
  return JSON.parse(plain) as T
}
