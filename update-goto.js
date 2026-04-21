const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const DB_PATH = path.join(__dirname, "tasks.db");

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const existing = db.exec("SELECT id FROM users WHERE name LIKE '%後藤%'");
  if (existing.length && existing[0].values.length) {
    const id = existing[0].values[0][0];
    db.run("UPDATE users SET email = ? WHERE id = ?", ["s.goto@hitokiwa.onmicrosoft.com", id]);
    console.log("更新: 後藤 → s.goto@hitokiwa.onmicrosoft.com");
  }

  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
})();
