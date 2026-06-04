const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../data/heartlink.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

function save() {
  try {
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, Buffer.from(db.export()));
    fs.renameSync(tmp, DB_PATH);
  } catch(e) { console.error('DB save error:', e.message); }
}

function normalise(args) {
  if (!args.length) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

function makeStmt(sql) {
  return {
    run(...args) {
      db.run(sql, normalise(args));
      const changes = db.getRowsModified();
      const r = db.exec('SELECT last_insert_rowid()');
      const lastInsertRowid = r.length ? r[0].values[0][0] : 0;
      save();
      return { changes, lastInsertRowid };
    },
    get(...args) {
      const stmt = db.prepare(sql);
      stmt.bind(normalise(args));
      if (!stmt.step()) { stmt.free(); return undefined; }
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    },
    all(...args) {
      const stmt = db.prepare(sql);
      stmt.bind(normalise(args));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }
  };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password      TEXT    NOT NULL,
    age           INTEGER NOT NULL CHECK(age >= 18),
    gender        TEXT    NOT NULL DEFAULT 'other',
    interested_in TEXT    NOT NULL DEFAULT 'everyone',
    bio           TEXT    DEFAULT '',
    interests     TEXT    DEFAULT '[]',
    avatar        TEXT    DEFAULT NULL,
    plan          TEXT    DEFAULT 'free',
    role          TEXT    DEFAULT 'user',
    is_active     INTEGER DEFAULT 1,
    created_at    TEXT    DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS swipes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    swiper_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action     TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now')),
    UNIQUE(swiper_id, swiped_id)
  );
  CREATE TABLE IF NOT EXISTS matches (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    DEFAULT (datetime('now')),
    UNIQUE(user1_id, user2_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT    NOT NULL DEFAULT '',
    image_url  TEXT    DEFAULT NULL,
    read_at    TEXT    DEFAULT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payments (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan                  TEXT    NOT NULL,
    amount_usd            REAL    NOT NULL,
    stripe_session_id     TEXT    DEFAULT NULL,
    stripe_payment_intent TEXT    DEFAULT NULL,
    stripe_receipt        TEXT    DEFAULT NULL,
    status                TEXT    NOT NULL DEFAULT 'pending',
    created_at            TEXT    DEFAULT (datetime('now')),
    updated_at            TEXT    DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id    INTEGER REFERENCES matches(id) ON DELETE SET NULL,
    reason      TEXT    NOT NULL DEFAULT 'Other',
    detail      TEXT    DEFAULT '',
    status      TEXT    DEFAULT 'pending',
    created_at  TEXT    DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS blocks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    DEFAULT (datetime('now')),
    UNIQUE(blocker_id, blocked_id)
  );
  CREATE TABLE IF NOT EXISTS mutes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    DEFAULT (datetime('now')),
    UNIQUE(user_id, muted_id)
  );
  CREATE INDEX IF NOT EXISTS idx_swipes_swiper  ON swipes(swiper_id);
  CREATE INDEX IF NOT EXISTS idx_matches_u1     ON matches(user1_id);
  CREATE INDEX IF NOT EXISTS idx_matches_u2     ON matches(user2_id);
  CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id);
  CREATE INDEX IF NOT EXISTS idx_payments_user  ON payments(user_id);
`;

let _ready;
function getDb() {
  if (!_ready) {
    _ready = initSqlJs().then(async SQL => {
      db = fs.existsSync(DB_PATH)
        ? new SQL.Database(fs.readFileSync(DB_PATH))
        : new SQL.Database();
      db.run('PRAGMA foreign_keys = ON;');
      db.run('PRAGMA encoding = "UTF-8";');
      // Run schema safely
      for (const stmt of SCHEMA.split(';').map(s=>s.trim()).filter(Boolean)) {
        try { db.run(stmt + ';'); } catch(e) { /* ignore duplicate column etc */ }
      }
      save();
      // Seed admin account
      await seedAdmin();
      console.log('💾 SQLite ready:', DB_PATH);
      return wrapper;
    });
  }
  return _ready;
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@heartlink.app';
  const pass  = process.env.ADMIN_PASSWORD || 'Admin@2026!';
  const existing = wrapper.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (!existing) {
    const hashed = await bcrypt.hash(pass, 10);
    wrapper.prepare(
      `INSERT INTO users (name,email,password,age,gender,role,plan,is_active)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run('Admin', email, hashed, 30, 'other', 'admin', 'vip', 1);
    console.log(`🔑 Admin seeded: ${email}`);
  }
}

const wrapper = {
  prepare: (sql) => makeStmt(sql),
  exec:    (sql) => { db.run(sql); save(); }
};

module.exports = { getDb };
