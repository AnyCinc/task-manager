const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "tasks.db");

const members = [
  { name: "金子", email: "t.kaneko@hitokiwa.onmicrosoft.com" },
  { name: "森", email: "s.mori@hitokiwa.onmicrosoft.com" },
  { name: "兼松", email: "t.kanematsu@hitokiwa.onmicrosoft.com" },
  { name: "三上", email: "h.mikami@hitokiwa.onmicrosoft.com" },
  { name: "松尾", email: "n.matsuo@hitokiwa.onmicrosoft.com" },
  { name: "浜松", email: "t.hamamatsu@hitokiwa.onmicrosoft.com" },
  { name: "中山", email: "h.nakayama@hitokiwa.onmicrosoft.com" },
  { name: "寺西", email: "t.teranishi@hitokiwa.onmicrosoft.com" },
  { name: "田中", email: "t.tanaka@hitokiwa.onmicrosoft.com" },
  { name: "鶴羽", email: "r.tsuruha@hitokiwa.onmicrosoft.com" },
  { name: "杉山", email: "t.sugiyama@hitokiwa.onmicrosoft.com", initial: "S" },
  { name: "メグ", email: "meg@hitokiwa.onmicrosoft.com" },
  { name: "清水", email: "shimizu@hitokiwa.onmicrosoft.com" },
  { name: "青木", email: "aoki@hitokiwa.onmicrosoft.com" },
  { name: "小峯", email: "komine@hitokiwa.onmicrosoft.com" },
  { name: "松居", email: "matsui@any-c.com" },
  { name: "寺田", email: "terada@hitokiwa.onmicrosoft.com" },
  { name: "井下", email: "inoshita@hito-kiwa.co.jp", initial: "I" },
];

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  try { db.run("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); } catch(e) {}

  for (const m of members) {
    const existing = db.exec(`SELECT id FROM users WHERE name LIKE '%${m.name}%'`);
    if (existing.length && existing[0].values.length) {
      const id = existing[0].values[0][0];
      db.run("UPDATE users SET email = ? WHERE id = ?", [m.email, id]);
      console.log(`更新: ${m.name} → ${m.email}`);
    } else {
      db.run("INSERT INTO users (name, initial, role, email) VALUES (?, ?, 'member', ?)",
        [m.name, m.initial || m.name[0], m.email]);
      console.log(`追加: ${m.name} → ${m.email}`);
    }
  }

  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));

  const all = db.exec("SELECT id, name, email FROM users ORDER BY id");
  console.log("\n全メンバー:");
  all[0].values.forEach(r => console.log(`  ${r[0]}: ${r[1]} <${r[2] || "未設定"}>`));
})();
