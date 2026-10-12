const Database = require('better-sqlite3');
const fs = require('fs');
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

const db = new Database('./data/shix.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  phone TEXT PRIMARY KEY,
  creds TEXT,
  created_at INTEGER,
  last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_phone TEXT,
  target TEXT,
  type TEXT,
  detail TEXT,
  ts INTEGER
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_phone TEXT,
  target TEXT,
  target_type TEXT,
  count INTEGER,
  delay_ms INTEGER,
  status TEXT,
  created_at INTEGER
);
`);

module.exports = db;
