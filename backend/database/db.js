const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve('./database/jarvis.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passphrase_hash TEXT NOT NULL,
    plan TEXT DEFAULT 'trial',
    plan_status TEXT DEFAULT 'trial',
    trial_start INTEGER DEFAULT (strftime('%s','now')),
    trial_end INTEGER DEFAULT (strftime('%s','now') + 432000),
    stripe_customer_id TEXT DEFAULT NULL,
    stripe_subscription_id TEXT DEFAULT NULL,
    failed_attempts INTEGER DEFAULT 0,
    locked_until INTEGER DEFAULT NULL,
    trust_mode INTEGER DEFAULT 0,
    is_vip INTEGER DEFAULT 0,
    secret_question TEXT DEFAULT NULL,
    secret_answer TEXT DEFAULT NULL,
    personality TEXT DEFAULT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    trigger_phrase TEXT NOT NULL,
    actions TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    command TEXT NOT NULL,
    response TEXT,
    status TEXT DEFAULT 'executed',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY,
    voice_rate REAL DEFAULT 0.95,
    voice_pitch REAL DEFAULT 1.05,
    always_listen INTEGER DEFAULT 0
  );
`;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);
  const migs = [
    'ALTER TABLE users ADD COLUMN is_vip INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN plan_status TEXT DEFAULT "trial"',
    'ALTER TABLE users ADD COLUMN trial_end INTEGER DEFAULT 0',
  ];
  migs.forEach(m => { try { db.run(m); } catch(e) {} });
  saveDB();
  return db;
}

function saveDB() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function prepare(sql) {
  return {
    run: (...params) => {
      let i = 0;
      const q = sql.replace(/\?/g, () => {
        const p = params[i++];
        if (p === null || p === undefined) return 'NULL';
        if (typeof p === 'number') return p;
        return `'${String(p).replace(/'/g, "''")}'`;
      });
      db.run(q); saveDB();
      const r = db.exec('SELECT last_insert_rowid() as id');
      return { lastInsertRowid: r[0]?.values[0][0] || 0 };
    },
    get: (...params) => {
      let i = 0;
      const q = sql.replace(/\?/g, () => {
        const p = params[i++];
        if (p === null || p === undefined) return 'NULL';
        if (typeof p === 'number') return p;
        return `'${String(p).replace(/'/g, "''")}'`;
      });
      const r = db.exec(q);
      if (!r[0]?.values[0]) return undefined;
      return Object.fromEntries(r[0].columns.map((c, i) => [c, r[0].values[0][i]]));
    },
    all: (...params) => {
      let i = 0;
      const q = sql.replace(/\?/g, () => {
        const p = params[i++];
        if (p === null || p === undefined) return 'NULL';
        if (typeof p === 'number') return p;
        return `'${String(p).replace(/'/g, "''")}'`;
      });
      const r = db.exec(q);
      if (!r[0]) return [];
      return r[0].values.map(row => Object.fromEntries(r[0].columns.map((c, i) => [c, row[i]])));
    }
  };
}

function exec(sql) { db.run(sql); saveDB(); }
module.exports = { initDB, prepare, exec, saveDB };
