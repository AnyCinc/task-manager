const crypto = require("crypto");

const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !!DATABASE_URL;

let db; // sql.js instance (SQLite mode only)
let pool; // pg Pool (Postgres mode only)

// ===== PostgreSQL mode =====
async function initPostgres() {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // テーブル作成
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      initial TEXT DEFAULT '',
      role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      pin_hash TEXT DEFAULT '',
      department TEXT DEFAULT '',
      webhook_url TEXT DEFAULT '',
      email TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assignee_name TEXT DEFAULT '',
      deadline TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      case_no TEXT DEFAULT '',
      type TEXT NOT NULL,
      description TEXT DEFAULT '',
      interview_date TEXT DEFAULT '',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assignee_name TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      company_no TEXT DEFAULT '',
      company_name TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 初期管理者
  const res = await pool.query("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
  if (parseInt(res.rows[0].c) === 0) {
    await pool.query("INSERT INTO users (name, initial, role, pin_hash) VALUES ($1, $2, $3, $4)",
      ["管理者", "Admin", "admin", hashPin("0000")]);
  }

  console.log("PostgreSQL接続完了 (Supabase)");
}

// ===== SQLite mode =====
async function initSqlite() {
  const initSqlJs = require("sql.js");
  const fs = require("fs");
  const path = require("path");
  const DB_PATH = path.join(__dirname, "tasks.db");
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON");

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    initial TEXT DEFAULT '',
    role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
    pin_hash TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_no TEXT DEFAULT '',
    type TEXT NOT NULL,
    description TEXT DEFAULT '',
    interview_date TEXT DEFAULT '',
    assignee_id INTEGER,
    assignee_name TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  // マイグレーション
  try { db.run("ALTER TABLE users ADD COLUMN department TEXT DEFAULT ''"); saveSqlite(); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN webhook_url TEXT DEFAULT ''"); saveSqlite(); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); saveSqlite(); } catch(e) {}
  try { db.run("ALTER TABLE cases ADD COLUMN company_no TEXT DEFAULT ''"); saveSqlite(); } catch(e) {}
  try { db.run("ALTER TABLE cases ADD COLUMN company_name TEXT DEFAULT ''"); saveSqlite(); } catch(e) {}

  const row = db.exec("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
  const adminCount = row[0]?.values[0][0] || 0;
  if (adminCount === 0) {
    db.run("INSERT INTO users (name, initial, role, pin_hash) VALUES (?, ?, ?, ?)",
      ["管理者", "Admin", "admin", hashPin("0000")]);
    saveSqlite();
  }

  console.log("SQLite接続完了 (ローカル)");
}

function saveSqlite() {
  const fs = require("fs");
  const path = require("path");
  const data = db.export();
  fs.writeFileSync(path.join(__dirname, "tasks.db"), Buffer.from(data));
}

// ===== Unified API =====
async function initDb() {
  if (isPostgres) {
    await initPostgres();
  } else {
    await initSqlite();
  }
}

function hashPin(pin) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

// query: SELECT → returns array of objects
function query(sql, params = []) {
  if (isPostgres) {
    // Convert ? placeholders to $1, $2, ... for pg
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return pool.query(pgSql, params).then(res => res.rows);
  } else {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

// run: INSERT/UPDATE/DELETE
function run(sql, params = []) {
  if (isPostgres) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return pool.query(pgSql, params);
  } else {
    db.run(sql, params);
    saveSqlite();
  }
}

// lastId: get last inserted id
function lastId() {
  if (isPostgres) {
    return pool.query("SELECT lastval() as id").then(res => res.rows[0].id);
  } else {
    const r = db.exec("SELECT last_insert_rowid() as id");
    return r[0]?.values[0][0];
  }
}

module.exports = { initDb, query, run, lastId, hashPin };
