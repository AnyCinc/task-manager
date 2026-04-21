// SQLiteからSupabase PostgreSQLへデータ移行スクリプト
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "tasks.db");
const DATABASE_URL = "postgresql://postgres.aunujhqycvbctnpccebw:1357Anychitokiwa@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function migrate() {
  // SQLite読み込み
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  // PostgreSQL接続
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // テーブル作成
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, initial TEXT DEFAULT '',
      role TEXT DEFAULT 'member', pin_hash TEXT DEFAULT '', department TEXT DEFAULT '',
      webhook_url TEXT DEFAULT '', email TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY, meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
      title TEXT NOT NULL, description TEXT DEFAULT '', assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assignee_name TEXT DEFAULT '', deadline TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'todo',
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY, case_no TEXT DEFAULT '', type TEXT NOT NULL,
      description TEXT DEFAULT '', interview_date TEXT DEFAULT '',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL, assignee_name TEXT DEFAULT '',
      status TEXT DEFAULT 'active', company_no TEXT DEFAULT '', company_name TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 既存データクリア
  await pool.query("DELETE FROM tasks");
  await pool.query("DELETE FROM cases");
  await pool.query("DELETE FROM meetings");
  await pool.query("DELETE FROM users");

  // Users移行
  const users = [];
  const stmt1 = db.prepare("SELECT * FROM users ORDER BY id");
  while (stmt1.step()) users.push(stmt1.getAsObject());
  stmt1.free();

  for (const u of users) {
    await pool.query(
      "INSERT INTO users (id, name, initial, role, pin_hash, department, webhook_url, email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [u.id, u.name, u.initial||"", u.role||"member", u.pin_hash||"", u.department||"", u.webhook_url||"", u.email||""]
    );
  }
  // シーケンスリセット
  if (users.length) {
    const maxId = Math.max(...users.map(u => u.id));
    await pool.query(`SELECT setval('users_id_seq', $1)`, [maxId]);
  }
  console.log(`Users: ${users.length}件 移行完了`);

  // Meetings移行
  const meetings = [];
  const stmt2 = db.prepare("SELECT * FROM meetings ORDER BY id");
  while (stmt2.step()) meetings.push(stmt2.getAsObject());
  stmt2.free();

  for (const m of meetings) {
    await pool.query(
      "INSERT INTO meetings (id, title, content, created_by) VALUES ($1,$2,$3,$4)",
      [m.id, m.title, m.content, m.created_by||null]
    );
  }
  if (meetings.length) {
    const maxId = Math.max(...meetings.map(m => m.id));
    await pool.query(`SELECT setval('meetings_id_seq', $1)`, [maxId]);
  }
  console.log(`Meetings: ${meetings.length}件 移行完了`);

  // Tasks移行
  const tasks = [];
  const stmt3 = db.prepare("SELECT * FROM tasks ORDER BY id");
  while (stmt3.step()) tasks.push(stmt3.getAsObject());
  stmt3.free();

  for (const t of tasks) {
    await pool.query(
      "INSERT INTO tasks (id, meeting_id, title, description, assignee_id, assignee_name, deadline, priority, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [t.id, t.meeting_id||null, t.title, t.description||"", t.assignee_id||null, t.assignee_name||"", t.deadline||"", t.priority||"medium", t.status||"todo"]
    );
  }
  if (tasks.length) {
    const maxId = Math.max(...tasks.map(t => t.id));
    await pool.query(`SELECT setval('tasks_id_seq', $1)`, [maxId]);
  }
  console.log(`Tasks: ${tasks.length}件 移行完了`);

  // Cases移行
  const cases = [];
  const stmt4 = db.prepare("SELECT * FROM cases ORDER BY id");
  while (stmt4.step()) cases.push(stmt4.getAsObject());
  stmt4.free();

  for (const c of cases) {
    await pool.query(
      "INSERT INTO cases (id, case_no, type, description, interview_date, assignee_id, assignee_name, status, company_no, company_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [c.id, c.case_no||"", c.type, c.description||"", c.interview_date||"", c.assignee_id||null, c.assignee_name||"", c.status||"active", c.company_no||"", c.company_name||""]
    );
  }
  if (cases.length) {
    const maxId = Math.max(...cases.map(c => c.id));
    await pool.query(`SELECT setval('cases_id_seq', $1)`, [maxId]);
  }
  console.log(`Cases: ${cases.length}件 移行完了`);

  await pool.end();
  console.log("\n✅ 移行完了！");
}

migrate().catch(err => { console.error("移行エラー:", err); process.exit(1); });
