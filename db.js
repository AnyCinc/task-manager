const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "tasks.db");

let db;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      initial TEXT DEFAULT '',
      role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      pin_hash TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      assignee_id INTEGER,
      assignee_name TEXT DEFAULT '',
      deadline TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // マイグレーション
  try { db.run("ALTER TABLE users ADD COLUMN department TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN webhook_url TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); save(); } catch(e) {}

  // 初期管理者
  const row = db.exec("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
  const adminCount = row[0]?.values[0][0] || 0;
  if (adminCount === 0) {
    db.run("INSERT INTO users (name, initial, role, pin_hash) VALUES (?, ?, ?, ?)",
      ["管理者", "Admin", "admin", hashPin("0000")]);
    save();
  }

  return db;
}

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function hashPin(pin) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

// Helper: run SELECT and return array of objects
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run INSERT/UPDATE/DELETE
function run(sql, params = []) {
  db.run(sql, params);
  save();
}

// Helper: get last insert id
function lastId() {
  const r = db.exec("SELECT last_insert_rowid() as id");
  return r[0]?.values[0][0];
}

module.exports = { initDb, query, run, lastId, hashPin, save };
